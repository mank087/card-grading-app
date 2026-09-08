import { Resend } from 'resend';
import { supabaseServer } from '@/lib/supabaseServer';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';
type Notice={id:string;review_id:string;kind:'admin_requested'|'customer_reviewed';lease_token:string;attempt_count:number;recipient_email?:string|null;delivery_message?:{subject:string;text:string;html?:string}|null;payload:{requester_id:string;card_id:string;category:string;card_name:string;notes?:string;verdict?:string;original_grade?:number;proposed_grade?:number;awaiting_owner?:boolean;details_claim?:Record<string,string>|null;details_changes?:{field:string;from:string|null;to:string}[]|null}};
const detailLabels:Record<string,string>={card_name:'Card name',set_name:'Set',year:'Year',card_number:'Card number',manufacturer:'Manufacturer',other:'Other'};

const SITE='https://dcmgrading.com';
const LOGO=`${SITE}/DCM%20Logo%20white.png`;
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
/** Reviewer notes are plain text typed by an admin; keep paragraph breaks, never interpret markup. */
const paragraphs=(value:string)=>value.split(/\n{2,}/).map(part=>`<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">${escapeHtml(part).replace(/\n/g,'<br>')}</p>`).join('');

/** Shared DCM shell: dark header with the white logo, white body, legal footer. Table layout for email clients. */
function brandedEmail(opts:{preheader:string;eyebrow:string;heading:string;bodyHtml:string;cta:{label:string;url:string};footnote?:string}){
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(opts.heading)} &middot; DCM Grading</title>
<style type="text/css">body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}body{margin:0!important;padding:0!important;width:100%!important;}@media only screen and (max-width:620px){.email-container{width:100%!important;max-width:100%!important;}.pad-mobile{padding-left:20px!important;padding-right:20px!important;}.cta a{display:block!important;width:100%!important;box-sizing:border-box!important;}}</style></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;"><tr><td align="center" style="padding:20px 10px 40px 10px;">
<table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;margin:0 auto;">
  <tr><td bgcolor="#0a0f1a" style="padding:14px 20px;"><a href="${SITE}" style="text-decoration:none;"><img src="${LOGO}" alt="DCM Grading" width="110" style="display:block;width:110px;"></a></td></tr>
  <tr><td bgcolor="#0a0f1a" align="center" class="pad-mobile" style="padding:32px 15px 30px 15px;">
    <p style="color:#34d399;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px 0;">${escapeHtml(opts.eyebrow)}</p>
    <h1 style="color:#ffffff;font-size:26px;margin:0;font-weight:800;line-height:1.25;">${escapeHtml(opts.heading)}</h1>
  </td></tr>
  <tr><td class="pad-mobile" bgcolor="#ffffff" style="padding:30px 30px 10px 30px;">${opts.bodyHtml}</td></tr>
  <tr><td align="center" class="cta" style="padding:10px 30px 34px 30px;"><a href="${opts.cta.url}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">${escapeHtml(opts.cta.label)}</a>
    <p style="color:#9ca3af;font-size:12px;margin:14px 0 0 0;word-break:break-all;">Or open this link: <a href="${opts.cta.url}" style="color:#7c3aed;">${opts.cta.url}</a></p></td></tr>
  <tr><td bgcolor="#f9fafb" style="padding:24px 30px;border-top:1px solid #e5e7eb;">
    ${opts.footnote?`<p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0 0 12px 0;text-align:center;">${escapeHtml(opts.footnote)}</p>`:''}
    <p style="color:#9ca3af;font-size:11px;line-height:1.6;margin:0 0 8px 0;text-align:center;">DCM Grading &middot; <a href="${SITE}" style="color:#9ca3af;text-decoration:underline;">dcmgrading.com</a> &middot; Questions? Reply to this email.</p>
    <p style="color:#9ca3af;font-size:10px;line-height:1.5;margin:0;text-align:center;">Dynamic Collectibles Management LLC &middot; 2300 Bethelview Rd, Ste 110-276, Cumming, GA 30040</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export function reviewEmail(notice:Notice){
  const p=notice.payload;
  const cardUrl=`${SITE}/${categoryToRouteSlug(p.category)}/${p.card_id}`;
  if(notice.kind==='admin_requested'){
    const adminUrl=`${SITE}/admin/grade-reviews/${notice.review_id}`;
    const claimEntries=Object.entries(p.details_claim??{});
    const claimText=claimEntries.length?`\n\nThe customer says these card details are wrong:\n${claimEntries.map(([k,v])=>`- ${detailLabels[k]??k}: ${v}`).join('\n')}`:'';
    const claimHtml=claimEntries.length?`<p style="color:#111827;font-size:14px;font-weight:700;margin:12px 0 4px 0;">Customer says these card details are wrong</p><ul style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px 0;padding-left:20px;">${claimEntries.map(([k,v])=>`<li>${escapeHtml(detailLabels[k]??k)}: ${escapeHtml(v)}</li>`).join('')}</ul>`:'';
    return{subject:'New manual grade review request',
      text:`A customer requested a manual grade review for ${p.card_name}.${claimText}\n\nManual reviews can take up to two business days. Log in to review the original photos, report and customer notes:\n${adminUrl}\n\nCard page: ${cardUrl}`,
      html:brandedEmail({preheader:`Manual review requested for ${p.card_name}`,eyebrow:'Admin alert',heading:'New manual grade review request',
        bodyHtml:`<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">A customer requested a manual grade review for <strong>${escapeHtml(p.card_name)}</strong>.</p>${claimHtml}<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">Manual reviews can take up to two business days. Log in to review the original photos, report and customer notes.</p><p style="color:#6b7280;font-size:13px;margin:0;">Card page: <a href="${cardUrl}" style="color:#7c3aed;">${cardUrl}</a></p>`,
        cta:{label:'Open the review',url:adminUrl}})};
  }
  const labels:Record<string,string>={confirm:'Original grade confirmed',clarify:'Grading explanation clarified',request_photos:'Unable to verify from the original photos',propose_change:'Grade change proposed'};
  const verdict=(p.details_changes?.length&&p.verdict==='confirm')?'Card details corrected; original grade confirmed':(labels[p.verdict??'']??'Review completed');
  const outcome=p.awaiting_owner
    ?`We propose changing your grade from ${p.original_grade} to ${p.proposed_grade}. Your original grade remains in place until you accept. Open your card to accept the change or keep your original grade.`
    :`Your original grade remains ${p.original_grade}.`;
  const changes=p.details_changes??[];
  const changesText=changes.length?`\n\nCard details corrected:\n${changes.map(c=>`- ${detailLabels[c.field]??c.field}: ${c.from??'(blank)'} -> ${c.to}`).join('\n')}\nThe market value has been refreshed for the corrected card.`:'';
  const changesHtml=changes.length?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;"><tr><td bgcolor="#ecfdf5" style="padding:14px 18px;border-radius:10px;border:1px solid #a7f3d0;"><p style="color:#065f46;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px 0;">Card details corrected</p><ul style="color:#111827;font-size:14px;line-height:1.6;margin:0;padding-left:20px;">${changes.map(c=>`<li>${escapeHtml(detailLabels[c.field]??c.field)}: ${escapeHtml(c.from??'(blank)')} &rarr; <strong>${escapeHtml(c.to)}</strong></li>`).join('')}</ul><p style="color:#374151;font-size:13px;margin:8px 0 0 0;">The market value has been refreshed for the corrected card.</p></td></tr></table>`:'';
  const text=`Our team has evaluated ${p.card_name}.\n\nVerdict: ${verdict}${changesText}\n\n${p.notes??''}\n\n${outcome}\n\nView your card and review:\n${cardUrl}`;
  const gradeRow=p.awaiting_owner
    ?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;"><tr><td align="center" bgcolor="#f5f3ff" style="padding:18px;border-radius:10px;border:1px solid #ddd6fe;"><p style="color:#5b21b6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px 0;">Proposed grade change</p><p style="color:#111827;font-size:30px;font-weight:800;margin:0;">${escapeHtml(p.original_grade)} &rarr; ${escapeHtml(p.proposed_grade)}</p><p style="color:#6b7280;font-size:13px;margin:8px 0 0 0;">Your grade stays at ${escapeHtml(p.original_grade)} until you accept.</p></td></tr></table>`
    :`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;"><tr><td align="center" bgcolor="#f9fafb" style="padding:18px;border-radius:10px;border:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px 0;">Your grade</p><p style="color:#111827;font-size:30px;font-weight:800;margin:0;">${escapeHtml(p.original_grade)}</p></td></tr></table>`;
  return{subject:'Your card grade review is ready',text,
    html:brandedEmail({preheader:`${verdict} for ${p.card_name}`,eyebrow:'Manual grade review',heading:'Your card grade review is ready',
      bodyHtml:`<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 6px 0;">Our team has evaluated <strong>${escapeHtml(p.card_name)}</strong>.</p><p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 18px 0;">Verdict: ${escapeHtml(verdict)}</p>${changesHtml}${gradeRow}<p style="color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">Note from the DCM review team</p>${paragraphs(p.notes??'')}<p style="color:#374151;font-size:15px;line-height:1.6;margin:12px 0 0 0;">${escapeHtml(outcome)}</p>`,
      cta:{label:p.awaiting_owner?'Review and decide on your card':'View your card and review',url:cardUrl},
      footnote:'You received this email because you requested a manual grade review on DCM Grading.'})};
}
export async function deliverReviewNotifications(){
  if(process.env.GRADE_REVIEW_EMAILS_ENABLED!=='true')return{paused:true,sent:0};
  if(!process.env.RESEND_API_KEY)throw Error('email_provider_not_configured');
  const db=supabaseServer(),resend=new Resend(process.env.RESEND_API_KEY);let sent=0,failed=0;
  for(let index=0;index<3;index++){
    const {data,error}=await db.rpc('claim_grade_review_notification');if(error)throw Error('notification_claim_failed');if(!data)break;
    const notice=data as Notice;
    try{
      let to=notice.recipient_email??'admin@dcmgrading.com';
      if(!notice.recipient_email&&notice.kind==='customer_reviewed'){
        const {data:user,error:userError}=await db.auth.admin.getUserById(notice.payload.requester_id);
        if(userError||!user.user?.email)throw Error('recipient_unavailable');to=user.user.email;
      }
      let message=notice.delivery_message??reviewEmail(notice);
      if(!notice.recipient_email||!notice.delivery_message){
        const {data:recipient,error:recipientError}=await db.from('grade_review_notifications').update({recipient_email:to,delivery_message:message}).eq('id',notice.id).eq('lease_token',notice.lease_token).select('recipient_email,delivery_message').single();
        if(recipientError||!recipient?.recipient_email)throw Error('recipient_not_saved');
        to=recipient.recipient_email;message=recipient.delivery_message;
      }
      const result=await resend.emails.send({from:'DCM Grading <admin@dcmgrading.com>',to,replyTo:'admin@dcmgrading.com',...message},{idempotencyKey:`grade-review-${notice.id}`});
      if(result.error||!result.data?.id)throw Error('provider_send_failed');
      const {error:saveError}=await db.from('grade_review_notifications').update({sent_at:new Date().toISOString(),provider_id:result.data.id,last_error:null,lease_token:null,lease_expires_at:null}).eq('id',notice.id).eq('lease_token',notice.lease_token);
      if(saveError)throw Error('delivery_receipt_not_saved');sent++;
    }catch(e){
      const code=e instanceof Error&&['recipient_unavailable','provider_send_failed','delivery_receipt_not_saved'].includes(e.message)?e.message:'delivery_unknown';
      const {error:saveError}=await db.from('grade_review_notifications').update({last_error:code,next_attempt_at:new Date(Date.now()+Math.min(3600,60*2**Math.min(notice.attempt_count,6))*1000).toISOString(),lease_token:null,lease_expires_at:null}).eq('id',notice.id).eq('lease_token',notice.lease_token);
      if(saveError)throw Error('delivery_failure_not_saved');failed++;
    }
  }
  return{sent,failed};
}
