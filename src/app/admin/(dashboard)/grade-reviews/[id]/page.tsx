'use client';
import { useEffect,useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
const categories=['centering','corners','edges','surface'];
const fields=categories.flatMap(c=>[`${c}_front`,`${c}_back`]);
const detailFields=['card_name','set_name','year','card_number','manufacturer'] as const;
const detailLabels:Record<string,string>={card_name:'Card name',set_name:'Set',year:'Year',card_number:'Card number',manufacturer:'Manufacturer',other:'Other'};
type Detail={review:{review_mode:string;admin_reviewed_at:string|null;admin_notes:string|null;status:string;note:string;customer_result:string|null;concerns:{category:string;side:string}[]};snapshot:{report:string;grade:number};isCurrent:boolean;photos:{side:string;url:string|null}[];notifications:{kind:string;sent_at:string|null;failed_at:string|null;last_error:string|null}[];
  details?:{current:Record<string,string|null>;claim:Record<string,string>|null;changes:{field:string;from:string|null;to:string}[]|null;applied_at:string|null;category:string}};
export default function ManualGradeReviewPage(){
  const {id}=useParams<{id:string}>(),[data,setData]=useState<Detail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
  const [verdict,setVerdict]=useState('confirm'),[notes,setNotes]=useState(''),[scores,setScores]=useState<Record<string,string>>({}),[cap,setCap]=useState(''),[structural,setStructural]=useState(false);
  const [details,setDetails]=useState<Record<string,string>>({}),[saved,setSaved]=useState<{details_applied?:boolean;pricing?:{dcm:number|null;ebayMedian:number|null;errors:string[]}|null}|null>(null);
  useEffect(()=>{const controller=new AbortController();setData(null);setError('');fetch(`/api/admin/grade-reviews/${id}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error);if(controller.signal.aborted)return;setData(body);setNotes(body.review.admin_notes??'');setDetails(Object.fromEntries(detailFields.map(f=>[f,body.details?.current?.[f]??''])));
    try{const report=JSON.parse(body.snapshot.report);setScores(Object.fromEntries(fields.map(f=>[f,report.raw_sub_scores?.[f]===undefined?'':String(report.raw_sub_scores[f])])));setCap(String(report.grade_review_scoring_context?.full_review?.independent_cap??body.snapshot.grade));setStructural(Boolean(report.grade_review_scoring_context?.full_review?.structural_confirmed));}catch{setScores({});setCap(String(body.snapshot.grade));}
  }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[id,refresh]);
  async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
    // Only send detail fields the admin actually changed from the current identity.
    const changedDetails=Object.fromEntries(detailFields.filter(f=>details[f]!==undefined&&details[f].trim()!==''&&details[f].trim()!==(data?.details?.current?.[f]??'')).map(f=>[f,details[f].trim()]));
    const body={verdict,notes,...(verdict==='propose_change'?{scores:Object.fromEntries(fields.map(f=>[f,Number(scores[f])])),cap:Number(cap),structuralConfirmed:structural}:{}),...(Object.keys(changedDetails).length?{details:changedDetails}:{})};
    const r=await fetch(`/api/admin/grade-reviews/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error);setSaved(result);setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:'Unable to save review.');}finally{setBusy(false);}}
  const proposed=Math.min(Number(cap)||10,...fields.map(f=>Number(scores[f])||10));
  const original=(()=>{try{return JSON.parse(data?.snapshot.report??'{}');}catch{return {};}})();
  return <main className="space-y-6 text-gray-900"><Link className="text-purple-700 underline" href="/admin/grade-reviews">Back to review queue</Link><h1 className="text-2xl font-bold">Manual Grade Review</h1>
    {error&&<p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error}</p>}
    {!data?<p>Loading review...</p>:<><p>Original grade: <strong>{data.snapshot.grade}</strong>. Status: {data.review.status.replaceAll('_',' ')}.</p><p className="text-sm">Manual reviews can take up to two business days.</p>
    <section className="rounded border bg-white p-4"><h2 className="font-bold">Customer concern</h2>
      <p className="text-sm text-gray-600">{data.review.concerns?.some(c=>c.category!=='details')?'Grade review requested (all four subgrades).':'Card details only; the grade is not disputed.'}</p>
      <p className="whitespace-pre-wrap">{data.review.note||'No additional note.'}</p>
      {data.details?.claim&&<div className="mt-3 rounded bg-amber-50 p-3 text-sm"><p className="font-semibold">Customer says the card details are wrong:</p><ul className="mt-1 list-disc pl-5">{Object.entries(data.details.claim).map(([k,v])=><li key={k}>{detailLabels[k]??k}: {v}</li>)}</ul></div>}
    </section>
    <section className="rounded border bg-white p-4"><h2 className="font-bold">Card details</h2>
      {data.details?.applied_at?<div className="text-sm"><p className="font-semibold text-green-800">Corrected {new Date(data.details.applied_at).toLocaleString()}</p><ul className="mt-1 list-disc pl-5">{(data.details.changes??[]).map(c=><li key={c.field}>{detailLabels[c.field]??c.field}: {c.from??'(blank)'} → {c.to}</li>)}</ul></div>
      :<><p className="text-sm text-gray-600">Current identification on the card. Edit any field to correct it; the correction applies as soon as you complete the review and refreshes the market price.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">{detailFields.map(f=><label key={f} className="text-sm">{detailLabels[f]}<input type="text" value={details[f]??''} onChange={e=>setDetails(v=>({...v,[f]:e.target.value}))} placeholder={data.details?.current?.[f]??''} className="mt-1 block w-full rounded border p-2" disabled={!!data.review.admin_reviewed_at}/></label>)}</div></>}
      {saved?.details_applied&&<p className="mt-3 text-sm text-green-800">Details applied. Market price refreshed: DCM {saved.pricing?.dcm??'n/a'}, eBay median {saved.pricing?.ebayMedian??'n/a'}{saved.pricing?.errors?.length?` (${saved.pricing.errors.join('; ')})`:''}.</p>}
    </section>
    <section className="grid gap-4 md:grid-cols-2">{data.photos.map(photo=><div key={photo.side}><h2 className="font-bold capitalize">{photo.side}</h2>{photo.url?<a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={`Original ${photo.side} photo`} className="max-h-[650px] w-full object-contain"/></a>:<p>Original photo unavailable.</p>}</div>)}</section>
    <section className="space-y-3 rounded border bg-white p-4"><h2 className="font-bold">Original grade and evidence</h2><p>{typeof original.final_grade?.summary==='string'?original.final_grade.summary:''}</p>
      {categories.map(category=><div key={category} className="border-t pt-3"><h3 className="font-semibold capitalize">{category}</h3>{['front','back'].map(side=>{const explanation=original[category]?.[side]?.summary??original[category]?.[`${side}_summary`];return <div key={side} className="mt-2 text-sm"><strong className="capitalize">{side}: {original.raw_sub_scores?.[`${category}_${side}`]??'Not recorded'}</strong>{typeof explanation==='string'&&<p className="whitespace-pre-wrap">{explanation}</p>}</div>;})}</div>)}
    </section>
    <details className="rounded border bg-white p-4"><summary className="cursor-pointer font-semibold">Complete original report</summary><pre className="mt-4 max-h-[500px] overflow-auto whitespace-pre-wrap break-words text-xs">{data.snapshot.report}</pre></details>
    {data.review.customer_result&&<p className="whitespace-pre-wrap rounded bg-purple-50 p-4">{data.review.customer_result}</p>}
    {data.review.review_mode==='manual'&&!data.review.admin_reviewed_at&&data.isCurrent&&['queued','processing'].includes(data.review.status)?<form onSubmit={submit} className="space-y-4 rounded border bg-white p-5">
      <label className="block font-semibold">Verdict<select value={verdict} onChange={e=>setVerdict(e.target.value)} className="mt-2 block w-full rounded border p-2"><option value="confirm">Confirm original grade</option><option value="clarify">Clarify the grading explanation</option><option value="request_photos">Unable to verify; better photos needed</option><option value="propose_change">Propose a grade change</option></select></label>
      {verdict==='propose_change'&&<fieldset className="space-y-3"><legend className="font-bold">Review all face scores</legend><div className="grid grid-cols-2 gap-3">{fields.map(f=><label key={f} className="capitalize">{f.replace('_',' ')}<input required type="number" min="1" max="10" step="1" value={scores[f]??''} onChange={e=>setScores(v=>({...v,[f]:e.target.value}))} className="block w-full rounded border p-2"/></label>)}</div>
      <label className="block">Independent grade cap (10 means no additional cap)<input required type="number" min="1" max="10" step="1" value={cap} onChange={e=>setCap(e.target.value)} className="ml-2 w-20 rounded border p-2"/></label>
      <label className="block"><input type="checkbox" checked={structural} onChange={e=>setStructural(e.target.checked)}/> Confirmed structural damage</label><p>Proposed overall grade: <strong>{proposed}</strong>. Review the original constraints before changing the cap. Any increase or decrease requires owner acceptance.</p></fieldset>}
      <label className="block font-semibold">Customer verdict and supporting notes<textarea required minLength={10} maxLength={3000} rows={5} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-2 block w-full rounded border p-3"/></label>
      <p className="text-sm">These notes will appear in the customer’s review and notification email. Identify the supporting evidence and explain any uncertainty.</p>
      <button disabled={busy} className="rounded bg-purple-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Saving...':'Complete Review and Queue Email'}</button>
    </form>:<p>This review is complete, awaiting its owner, or no longer current.</p>}
    <section><h2 className="font-bold">Email delivery</h2>{data.notifications.map(n=><p key={n.kind}>{n.kind==='admin_requested'?'Admin alert':'Customer verdict'}: {n.sent_at?'Sent':n.failed_at?'Needs delivery reconciliation':n.last_error?'Retry pending':'Queued'}{n.last_error?` (${n.last_error})`:''}</p>)}</section>
    </>}
  </main>;
}
