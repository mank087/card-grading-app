import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { buildManualResult, manualVerdictSchema } from '@/lib/gradeReview/manualReview';
import { buildDetailsPatch, currentDetails, detailsCorrectionSchema } from '@/lib/gradeReview/cardDetails';
import { refreshPricesAfterDetails } from '@/lib/gradeReview/detailsPricing';
import { revalidatePath } from 'next/cache';
import { blockedReason } from '@/lib/gradeReview/blockedReason';
const DETAILS_SELECT='id,category,serial,card_name,card_set,card_number,release_date,featured,manufacturer_name,serial_numbering';
const BLOCK_SELECT='user_id,deleted_at,ownership_status,grade_status,front_path,back_path,conversational_grading,conversational_whole_grade';
type Db=ReturnType<typeof supabaseServer>;
const staleReply=async(db:Db,review:Parameters<typeof reasonFor>[1])=>{const reason=await reasonFor(db,review).catch(()=>null);return {error:reason?`This review cannot be completed: ${reason}`:'The card changed since this review was opened. Reload before continuing.',blocked:reason};};
/** Re-read the rows the completion RPC checks and say which one blocks the review. */
async function reasonFor(db:Db,review:{card_id:string;grade_run_id:string;status:string;requester_id:string;admin_reviewed_at:string|null}){
  const [{data:card},{data:run}]=await Promise.all([db.from('cards').select(BLOCK_SELECT).eq('id',review.card_id).maybeSingle(),
    db.from('card_grade_runs').select('is_current,snapshot').eq('id',review.grade_run_id).maybeSingle()]);
  return blockedReason({review,run,card});
}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
type Context={params:Promise<{id:string}>};
async function adminOf(request:NextRequest){const token=request.cookies.get('admin_token')?.value;return token?verifyAdminSession(token):null;}
export async function GET(request:NextRequest,{params}:Context){
  try{
    if(!await adminOf(request))return reply({error:'Unauthorized'},401);
    const {id}=await params;if(!isUuid(id))return reply({error:'Review not found.'},404);
    const db=supabaseServer();
    const {data:review,error}=await db.from('card_grade_reviews').select('*').eq('id',id).maybeSingle();
    if(error)throw error;if(!review)return reply({error:'Review not found.'},404);
    const {data:run,error:runError}=await db.from('card_grade_runs').select('snapshot,is_current').eq('id',review.grade_run_id).single();
    if(runError)throw runError;
    const photos=await Promise.all(['front','back'].map(async side=>{const path=run.snapshot[`${side}_path`];if(typeof path!=='string')return {side,url:null};const {data,error}=await db.storage.from('cards').createSignedUrl(path,3600);if(error)throw error;return{side,url:data.signedUrl};}));
    const {data:notifications,error:emailError}=await db.from('grade_review_notifications').select('kind,sent_at,failed_at,last_error,attempt_count').eq('review_id',id);
    if(emailError)throw emailError;
    const {data:card,error:cardError}=await db.from('cards').select(`${DETAILS_SELECT},${BLOCK_SELECT}`).eq('id',review.card_id).single();
    if(cardError)throw cardError;
    const details={current:currentDetails(card as Record<string,unknown>),claim:review.details_claim??null,changes:review.details_changes??null,applied_at:review.details_applied_at??null,category:card.category};
    const blocked=blockedReason({review,run,card});
    return reply({review,snapshot:run.snapshot,isCurrent:run.is_current,photos,notifications,details,blocked});
  }catch{return reply({error:'Unable to load this review.'},503);}
}
export async function POST(request:NextRequest,{params}:Context){
  try{
    const admin=await adminOf(request);if(!admin)return reply({error:'Unauthorized'},401);
    const origin=request.headers.get('origin');
    if(origin&&origin!==request.nextUrl.origin)return reply({error:'Invalid request origin.'},403);
    if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
    const {id}=await params;if(!isUuid(id))return reply({error:'Review not found.'},404);
    const raw=await request.text();if(raw.length>16000)return reply({error:'Review is too long.'},413);
    let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid review.'},400);}
    // Close a review that can no longer be completed (card deleted, sold, re-graded...).
    // No verdict is recorded, so no customer email is queued.
    if(body&&typeof body==='object'&&(body as {action?:unknown}).action==='close'){
      const db=supabaseServer();
      const {data:review,error}=await db.from('card_grade_reviews').select('id,card_id,grade_run_id,status,requester_id,admin_reviewed_at,review_mode').eq('id',id).maybeSingle();
      if(error)throw error;if(!review||review.review_mode!=='manual')return reply({error:'Manual review not found.'},404);
      if(review.admin_reviewed_at||!['queued','processing'].includes(review.status))return reply({already_closed:true});
      const reason=await reasonFor(db,review);
      if(!reason)return reply({error:'This review can still be completed, so it cannot be closed.'},409);
      const {data:closed,error:closeError}=await db.from('card_grade_reviews').update({status:'superseded',lease_token:null,lease_expires_at:null})
        .eq('id',id).in('status',['queued','processing']).is('admin_reviewed_at',null).select('id');
      if(closeError)throw closeError;
      if(closed?.length){const {error:eventError}=await db.from('card_grade_review_events').insert({review_id:id,event_type:'admin_closed_blocked',actor_id:admin.id,metadata:{reason}});if(eventError)console.error('[grade-review close] event',eventError.message);}
      return reply({closed:true,reason});
    }
    const {details:rawDetails,...verdictBody}=(body&&typeof body==='object'?body:{}) as Record<string,unknown>;
    const parsed=manualVerdictSchema.safeParse(verdictBody);if(!parsed.success)return reply({error:'Provide a verdict, notes, and all face scores and cap for a grade change.'},400);
    // Blank strings mean "leave as is"; only non-empty fields are a correction.
    const detailsParsed=detailsCorrectionSchema.safeParse(Object.fromEntries(Object.entries((rawDetails&&typeof rawDetails==='object'?rawDetails:{}) as Record<string,unknown>).filter(([,v])=>typeof v==='string'&&v.trim()).map(([k,v])=>[k,String(v).trim()])));
    if(!detailsParsed.success)return reply({error:'Card details: use a four-digit year and non-empty values.'},400);
    const db=supabaseServer();
    const {data:review,error}=await db.from('card_grade_reviews').select('id,card_id,grade_run_id,review_mode,admin_reviewed_at,details_applied_at,status,requester_id').eq('id',id).maybeSingle();
    if(error)throw error;if(!review||review.review_mode!=='manual')return reply({error:'Manual review not found.'},404);
    if(review.admin_reviewed_at)return reply({already_recorded:true});
    let [{data:card,error:cardError},{data:run,error:runError}]=await Promise.all([
      db.from('cards').select('*').eq('id',review.card_id).single(),db.from('card_grade_runs').select('snapshot').eq('id',review.grade_run_id).single()]);
    if(cardError||runError)throw cardError||runError;
    // Identification corrections apply immediately and independently of the grade verdict.
    let detailsApplied=false;
    if(Object.keys(detailsParsed.data).length&&!review.details_applied_at){
      let details;try{details=buildDetailsPatch(card as Record<string,unknown>,run!.snapshot.report,detailsParsed.data,id);}
      catch(e){if(e instanceof Error&&e.message==='no_change')details=null;else return reply({error:'The card changed since this review was opened. Reload before correcting its details.'},409);}
      if(details){
        const {data:applied,error:applyError}=await db.rpc('apply_grade_review_details',{p_id:id,p_admin_id:admin.id,p_patch:details.patch,p_expected:details.expected,p_changes:details.changes});
        if(applyError)throw applyError;if(applied?.stale)return reply(await staleReply(db,review),409);
        detailsApplied=true;
        // The grade verdict below must be built against the corrected row and snapshot.
        [{data:card,error:cardError},{data:run,error:runError}]=await Promise.all([
          db.from('cards').select('*').eq('id',review.card_id).single(),db.from('card_grade_runs').select('snapshot').eq('id',review.grade_run_id).single()]);
        if(cardError||runError)throw cardError||runError;
      }
    }
    let correction;try{correction=buildManualResult(card,run!.snapshot,id,parsed.data);}catch{return reply({error:'The report changed or the proposed scores are invalid. Reload the review; use clarification if the overall grade is unchanged.'},409);}
    const {data,error:saveError}=await db.rpc('complete_manual_grade_review',{p_id:id,p_admin_id:admin.id,p_verdict:parsed.data.verdict,p_notes:parsed.data.notes,p_patch:correction.patch,p_expected:correction.expected});
    if(saveError)throw saveError;if(data?.stale)return reply(await staleReply(db,review),409);
    for(const category of ['sports','pokemon','mtg','lorcana','onepiece','yugioh','starwars','other'])revalidatePath(`/${category}/${review.card_id}`);
    revalidatePath('/collection');
    // Cached market data described the old identity; refresh it now, best-effort.
    // Every field this route can correct (name, set, year, number, manufacturer)
    // is a material identity field, so an applied correction is always material.
    const pricing=detailsApplied?await refreshPricesAfterDetails(db,review.card_id,{materialChange:true}):null;
    return reply({...data,details_applied:detailsApplied,pricing});
  }catch{return reply({error:'Unable to confirm the saved review. Reload before retrying; duplicate completion will not send another email.'},503);}
}
