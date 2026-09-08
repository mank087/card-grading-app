import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { buildManualResult, manualVerdictSchema } from '@/lib/gradeReview/manualReview';
import { buildDetailsPatch, currentDetails, detailsCorrectionSchema } from '@/lib/gradeReview/cardDetails';
import { refreshPricesAfterDetails } from '@/lib/gradeReview/detailsPricing';
import { revalidatePath } from 'next/cache';
const DETAILS_SELECT='id,category,serial,card_name,card_set,card_number,release_date,featured,manufacturer_name';
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
    const {data:card,error:cardError}=await db.from('cards').select(DETAILS_SELECT).eq('id',review.card_id).single();
    if(cardError)throw cardError;
    const details={current:currentDetails(card as Record<string,unknown>),claim:review.details_claim??null,changes:review.details_changes??null,applied_at:review.details_applied_at??null,category:card.category};
    return reply({review,snapshot:run.snapshot,isCurrent:run.is_current,photos,notifications,details});
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
    const {details:rawDetails,...verdictBody}=(body&&typeof body==='object'?body:{}) as Record<string,unknown>;
    const parsed=manualVerdictSchema.safeParse(verdictBody);if(!parsed.success)return reply({error:'Provide a verdict, notes, and all face scores and cap for a grade change.'},400);
    // Blank strings mean "leave as is"; only non-empty fields are a correction.
    const detailsParsed=detailsCorrectionSchema.safeParse(Object.fromEntries(Object.entries((rawDetails&&typeof rawDetails==='object'?rawDetails:{}) as Record<string,unknown>).filter(([,v])=>typeof v==='string'&&v.trim()).map(([k,v])=>[k,String(v).trim()])));
    if(!detailsParsed.success)return reply({error:'Card details: use a four-digit year and non-empty values.'},400);
    const db=supabaseServer();
    const {data:review,error}=await db.from('card_grade_reviews').select('id,card_id,grade_run_id,review_mode,admin_reviewed_at,details_applied_at').eq('id',id).maybeSingle();
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
        if(applyError)throw applyError;if(applied?.stale)return reply({error:'This review is stale. Reload before continuing.'},409);
        detailsApplied=true;
        // The grade verdict below must be built against the corrected row and snapshot.
        [{data:card,error:cardError},{data:run,error:runError}]=await Promise.all([
          db.from('cards').select('*').eq('id',review.card_id).single(),db.from('card_grade_runs').select('snapshot').eq('id',review.grade_run_id).single()]);
        if(cardError||runError)throw cardError||runError;
      }
    }
    let correction;try{correction=buildManualResult(card,run!.snapshot,id,parsed.data);}catch{return reply({error:'The report changed or the proposed scores are invalid. Reload the review; use clarification if the overall grade is unchanged.'},409);}
    const {data,error:saveError}=await db.rpc('complete_manual_grade_review',{p_id:id,p_admin_id:admin.id,p_verdict:parsed.data.verdict,p_notes:parsed.data.notes,p_patch:correction.patch,p_expected:correction.expected});
    if(saveError)throw saveError;if(data?.stale)return reply({error:'This review is stale. Reload before continuing.'},409);
    for(const category of ['sports','pokemon','mtg','lorcana','onepiece','yugioh','starwars','other'])revalidatePath(`/${category}/${review.card_id}`);
    revalidatePath('/collection');
    // Cached market data described the old identity; refresh it now, best-effort.
    const pricing=detailsApplied?await refreshPricesAfterDetails(db,review.card_id):null;
    return reply({...data,details_applied:detailsApplied,pricing});
  }catch{return reply({error:'Unable to confirm the saved review. Reload before retrying; duplicate completion will not send another email.'},503);}
}
