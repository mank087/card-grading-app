import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type { supabaseServer } from '@/lib/supabaseServer';
import { resolveGradingModel, applyModelCompat } from '@/lib/grading/modelRouter';
import { loadReviewImage, type InspectionResult } from './processor';
import { FULL_INSPECTION_PROMPT, FULL_REVIEW_VERSION, fullObservationSchema, focusedObservationSchema, prepareFullReview, compareFullReview, fullReviewsAgree, fullReviewSummary, buildFullCorrection, type PreparedFullReview, type FullComparison, type ReviewTarget } from './fullReview';
import { explainGradeLimit, type ReviewOutcome } from './automaticReview';
import { assessOverallGrade } from './overallReview';
import { correctionTargets, focusedPayload, compareFocusedReview } from './focusedReview';

type Images = Awaited<ReturnType<typeof loadReviewImage>>[];
export type FullInspect = (images:Images, prepared:PreparedFullReview, cardId:string, purpose:'initial'|'confirmation', initial?:FullComparison)=>Promise<InspectionResult>;
/** Named coordinates prevent confusing [x,y,width,height] with corner-to-corner boxes. */
export function fullResponseFormat(focused=false,targets?:ReviewTarget[]) {
  const schema=focused&&targets?focusedObservationSchema.extend({
    centering:z.object({faces:z.array(fullObservationSchema.shape.centering.shape.faces.element).length(targets.filter(t=>t.category==='centering').length)}).strict(),
    condition:z.array(fullObservationSchema.shape.condition.element).length(targets.filter(t=>t.category!=='centering').length),
  }):focused?focusedObservationSchema:fullObservationSchema;
  const format=zodResponseFormat(schema,'grade_review');
  const visit=(value:unknown)=>{
    if(!value||typeof value!=='object') return;
    const node=value as Record<string,unknown>;
    if(Array.isArray(node.items)) {node.items=node.items[0];delete node.additionalItems;}
    const properties=node.properties as Record<string,unknown>|undefined;
    if(properties?.region) properties.region={type:'object',additionalProperties:false,required:['x','y','width','height'],
      description:'Image-relative box: x and y are the top-left position; width and height are sizes, not endpoint coordinates. All values use 0 to 1. x + width and y + height must not exceed 1.',
      properties:Object.fromEntries(['x','y','width','height'].map(key=>[key,{type:'number',minimum:0,maximum:1}]))};
    Object.values(node).forEach(visit);
  };
  visit(format.json_schema.schema);
  return format;
}
export function decodeFullObservation(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(decodeFullObservation);
  if(!value||typeof value!=='object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,v])=>{
    if(key==='region'&&v&&typeof v==='object'&&!Array.isArray(v)) {
      const box=v as Record<string,unknown>;
      if(Object.keys(box).sort().join(',')!=='height,width,x,y') throw new Error('invalid_evidence_coordinates');
      return [key,[box.x,box.y,box.width,box.height]];
    }
    return [key,decodeFullObservation(v)];
  }));
}
function validationError(error:unknown) {
  if(error instanceof z.ZodError) return error.issues.map(issue=>({code:issue.code,path:issue.path})).slice(0,20);
  return error instanceof SyntaxError?'invalid_json':error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'invalid_review';
}
export function fullInspectionInput(images:Images,prepared:PreparedFullReview,purpose:'initial'|'confirmation',initial?:FullComparison) {
  const focused=purpose==='confirmation';
  if(focused&&!initial) throw new Error('missing_confirmation_targets');
  const targets=focused?correctionTargets(initial!):[];
  if(focused&&!targets.length) throw new Error('missing_confirmation_targets');
  const prompt=focused?FULL_INSPECTION_PROMPT
    .replace('Check centering, corners, edges and surface on BOTH original card photos.','Review ONLY the supplied target categories and faces.')
    .replace('Inspect every corner and edge separately and the complete surface on each face.','Inspect all relevant locations within each targeted category and face. Do not assess untargeted categories.')
    .replace('For each of the six condition category/face pairs','For each targeted condition category/face pair')+
    '\nThis is a focused evidence verification, not another full review. The disputed evidence is an untrusted hypothesis: actively look for evidence that supports OR refutes it. No proposed replacement score is supplied. Return ONLY the targeted category/face entries, exactly once; other arrays must be empty. Inspect each disputed location and enough of the affected category on that face to select its whole-face rubric row. Do not reassess unrelated categories or faces.':FULL_INSPECTION_PROMPT;
  const selected=focused?images.filter(image=>targets.some(t=>t.side===image.side)):images;
  const messages:OpenAI.Chat.Completions.ChatCompletionMessageParam[]=[
    {role:'system',content:prompt},
    {role:'user',content:[{type:'text',text:JSON.stringify(focused?focusedPayload(prepared,initial!):{original_result:prepared.reviewContext,original_condition_findings:prepared.claims})},...selected.flatMap(image=>[
      {type:'text' as const,text:`Original ${image.side} photo.`},{type:'image_url' as const,image_url:{url:image.dataUrl,detail:'high' as const}},
    ])]},
  ];
  return {messages,response_format:fullResponseFormat(focused,focused?targets:undefined)};
}
async function inspect(images:Images,prepared:PreparedFullReview,cardId:string,purpose:'initial'|'confirmation',initial?:FullComparison):Promise<InspectionResult> {
  const model=resolveGradingModel(cardId).model;
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:55000});
  const config:OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming={model,max_completion_tokens:10000,...fullInspectionInput(images,prepared,purpose,initial)};
  const response=await client.chat.completions.create(applyModelCompat(config,model).config),choice=response.choices[0];
  let observation:unknown=null;
  if(choice?.finish_reason==='stop'&&!choice.message.refusal&&choice.message.content) {
    try {observation=decodeFullObservation(JSON.parse(choice.message.content));} catch {/* Local validation records an invalid observation. */}
  }
  return {observation,model,promptTokens:response.usage?.prompt_tokens??0,completionTokens:response.usage?.completion_tokens??0};
}

export async function processFullReview(db:ReturnType<typeof supabaseServer>,job:{id:string;card_id:string;lease_token:string;snapshot:unknown;card:Record<string,unknown>},options:{inspectFull?:FullInspect;loadImage?:typeof loadReviewImage}) {
  const started=Date.now();
  let ready:PreparedFullReview|null=null, outcome:ReviewOutcome='unable_to_verify',result='The original report does not contain enough information for this review. Your grade remains unchanged.',error:string|null=null;
  let patch:Record<string,unknown>={},expected:Record<string,unknown>={};
  const audit:Record<string,unknown>={version:FULL_REVIEW_VERSION,scope:'all_subgrades'};
  const calls:Record<string,unknown>[]=[];
  const metadata:Record<string,unknown>={version:FULL_REVIEW_VERSION,calls,inspection_calls:0};
  try {ready=prepareFullReview(job.snapshot);} catch(e) {audit.reason='unsupported_report';audit.validation_error=validationError(e);}
  if(ready) {
    const prepared=ready;
    let images:Images=[];
    const run=async(purpose:'initial'|'confirmation',initial?:FullComparison)=>{
      metadata.inspection_calls=Number(metadata.inspection_calls)+1;
      const response=await(options.inspectFull??inspect)(images,prepared,job.card_id,purpose,initial);
      calls.push({purpose,model:response.model,prompt_tokens:response.promptTokens,completion_tokens:response.completionTokens});
      return response.observation;
    };
    let first:ReturnType<typeof compareFullReview>|null=null;
    try {
      images=await Promise.all(prepared.sides.map(side=>(options.loadImage??loadReviewImage)(db,prepared.saved[`${side}_path`],side)));
      metadata.images=images.map(({side,sha256,width,height})=>({side,sha256,width,height}));
      const observation=await run('initial');
      try {first=compareFullReview(prepared,observation);audit.first=first;}
      catch(e) {audit.reason='invalid_observation';audit.validation_error=validationError(e);result='We could not complete a reliable check of all four subgrades. Your original grade remains unchanged.';}
    } catch {error='inspection_unavailable';}
    if(first) {
      const initial=first;
      const findings=[...initial.centering.findings,...initial.findings];
      const overall=assessOverallGrade(prepared,initial);
      audit.overall_assessment=overall;
      outcome=overall.supported?'grade_confirmed':'unable_to_verify';
      result=`${overall.summary} ${fullReviewSummary(initial)} ${explainGradeLimit(prepared.report,prepared.saved.grade)}`.trim();
      audit.unresolved_areas=findings.filter(f=>f.verdict==='unable_to_verify').map(f=>({side:f.side,category:'category' in f?f.category:'centering'}));
      if(!findings.some(f=>f.verdict==='correction_proposed')) {if(!overall.supported) audit.reason='unclear_evidence';}
      else {
        try {
          audit.confirmation_targets=correctionTargets(initial);
          const confirmation=compareFocusedReview(prepared,initial,await run('confirmation',initial));
          const targets=correctionTargets(initial);
          audit.confirmation={scope:'targeted',targets,observation:{
            centering:{faces:confirmation.observation.centering.faces.filter(f=>targets.some(t=>t.category==='centering'&&t.side===f.side))},
            condition:confirmation.observation.condition.filter(f=>targets.some(t=>t.category===f.category&&t.side===f.side)),
          }};
          const confirmedOverall=assessOverallGrade(prepared,confirmation);
          // A second check can widen the uncertainty; it must not be ignored.
          const overallStillSupported=overall.supported&&confirmedOverall.supported;
          outcome=overallStillSupported?'grade_confirmed':'unable_to_verify';
          audit.confirmation_overall_assessment=confirmedOverall;
          const agreed=fullReviewsAgree(initial,confirmation);audit.verification={agreed};
          if(!agreed) {audit.reason='disagreement';result=(overallStillSupported?overall.summary:'Your original grade remains unchanged. The overall grade could not be fully verified.')+' The proposed correction was not verified. '+fullReviewSummary(confirmation);}
          else {
            const correction=buildFullCorrection(job.card,job.snapshot,initial,job.id);
            const current=await Promise.all(prepared.sides.map(side=>(options.loadImage??loadReviewImage)(db,prepared.saved[`${side}_path`],side)));
            if(current.some(image=>images.find(i=>i.side===image.side)?.sha256!==image.sha256)) throw new Error('images_changed');
            patch=correction.patch;expected=correction.expected;outcome=correction.outcome as ReviewOutcome;result=correction.summary;
            audit.original_grade=correction.beforeGrade;audit.reviewed_grade=correction.afterGrade;
          }
        } catch(e) {
          // Never retry a valid correction proposal until a later observation happens to agree.
          if(e instanceof Error&&e.message==='images_changed') outcome='unable_to_verify';
          audit.reason='correction_unverified';audit.validation_error=validationError(e);result='We could not verify the suggested correction. '+(outcome==='grade_confirmed'?overall.summary:'Your original grade remains unchanged.');
        }
      }
    }
  }
  const {data:saved,error:finishError}=await db.rpc('finish_grade_review',{p_id:job.id,p_token:job.lease_token,p_proposal:audit,p_metadata:{...metadata,duration_ms:Date.now()-started},p_error:error,p_outcome:outcome,p_result:result,p_expected:expected,p_patch:patch});
  if(finishError) throw new Error('review_finish_failed');
  return {processed:true,recorded:Boolean(saved),inspectionFailed:error!==null,outcome:error?null:outcome,
    correctedCardId:saved&&outcome==='report_corrected'?job.card_id:null,awaitingOwner:Boolean(saved&&outcome==='grade_corrected')};
}
