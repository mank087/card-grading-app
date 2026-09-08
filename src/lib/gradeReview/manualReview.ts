import { z } from 'zod';
import { projectCorrection } from './correction';

export const manualReviewNotice = 'Manual reviews can take up to two business days.';
export function hasManualReviewAccess(credits: { is_vip?: boolean; is_card_lover?: boolean; card_lover_current_period_end?: string | null } | null, now = Date.now()) {
  return Boolean(credits?.is_vip || (credits?.is_card_lover && credits.card_lover_current_period_end && Date.parse(credits.card_lover_current_period_end) > now));
}
const score = z.number().int().min(1).max(10);
export const manualVerdictSchema = z.object({
  verdict: z.enum(['confirm', 'clarify', 'request_photos', 'propose_change']),
  notes: z.string().trim().min(10).max(3000),
  scores: z.object({ centering_front: score, centering_back: score, corners_front: score, corners_back: score, edges_front: score, edges_back: score, surface_front: score, surface_back: score }).strict().optional(),
  cap: score.optional(), structuralConfirmed: z.boolean().optional(),
}).strict().superRefine((v,ctx) => { if(v.verdict === 'propose_change' && (!v.scores || v.cap === undefined || v.structuralConfirmed === undefined)) ctx.addIssue({code:'custom',message:'Review all eight face scores and the grade cap before proposing a change.'}); });

/** Customer-facing summary: always says a person reviewed it, then the reviewer's own words. */
export function reviewedSummary(notes: string, before: number, after: number | null) {
  const outcome = after === null || after === before ? `The grade of ${before} stands.` : `Grade updated from ${before} to ${after}.`;
  return `Manually reviewed by the DCM team. ${notes.trim()} ${outcome}`;
}

export function buildManualResult(card: Record<string, unknown>, snapshot: { report: string; grade: number }, reviewId: string, input: z.infer<typeof manualVerdictSchema>) {
  const data = manualVerdictSchema.parse(input);
  if (card.conversational_grading !== snapshot.report || Number(card.conversational_whole_grade) !== Number(snapshot.grade)) throw Error('stale_review');
  if (data.verdict !== 'propose_change') {
    const patch: Record<string,unknown> = {}, expected: Record<string,unknown> = {};
    if(data.verdict==='clarify') {
      const report=JSON.parse(snapshot.report);
      report.manual_review={review_id:reviewId,notes:data.notes};
      const summary=reviewedSummary(data.notes,Number(snapshot.grade),null);
      report.final_grade={...report.final_grade,summary};
      patch.conversational_grading=JSON.stringify(report); expected.conversational_grading=card.conversational_grading;
      if('conversational_final_grade_summary' in card){patch.conversational_final_grade_summary=summary;expected.conversational_final_grade_summary=card.conversational_final_grade_summary;}
    }
    return { patch, expected, outcome: data.verdict === 'request_photos' ? 'unable_to_verify' : data.verdict === 'clarify' ? 'report_corrected' : 'grade_confirmed', proposedGrade: null };
  }
  const report = JSON.parse(snapshot.report);
  if(!report || typeof report !== 'object' || Array.isArray(report)) throw Error('unsupported_report');
  const categories = ['centering','corners','edges','surface'] as const;
  const grades = Object.fromEntries(categories.map(c => [c, Math.min(data.scores![`${c}_front`], data.scores![`${c}_back`])])) as Record<typeof categories[number],number>;
  const after = Math.min(data.cap!, ...Object.values(grades));
  if(after === Number(snapshot.grade)) throw Error('grade_unchanged_use_clarification');
  for(const category of categories)for(const side of ['front','back'] as const){
    const key=`${category}_${side}` as keyof NonNullable<typeof data.scores>;
    if(report.raw_sub_scores?.[key]!==data.scores![key]){
      const section=report[category]??{};
      section[side]={score:data.scores![key],summary:data.notes,manual_review:true};
      section[`${side}_summary`]=data.notes;
      if(category==='centering'){section[side].left_right=null;section[side].top_bottom=null;}
      report[category]=section;
    }
  }
  report.raw_sub_scores = {...report.raw_sub_scores,...data.scores};
  report.manual_review = { review_id:reviewId, notes:data.notes, grades, cap:data.cap, structural_confirmed:data.structuralConfirmed };
  const correction = projectCorrection(card,report,grades,Number(snapshot.grade),after,reviewId,'manual',data.structuralConfirmed!);
  // The PDF/org reports narrate each face from conversational_corners_edges_surface
  // (keys like front_edges), not from the report JSON. Rewrite only the faces the
  // reviewer changed so the narrative stops describing the defect they cleared.
  const narrative=card.conversational_corners_edges_surface;
  if(narrative&&typeof narrative==='object'&&!Array.isArray(narrative)){
    const next=structuredClone(narrative as Record<string,unknown>);let touched=false;
    for(const category of categories)for(const side of ['front','back'] as const){
      const key=`${category}_${side}` as keyof NonNullable<typeof data.scores>;
      if(JSON.parse(snapshot.report).raw_sub_scores?.[key]===data.scores![key])continue;
      const faceKey=`${side}_${category}`;const face=next[faceKey];
      next[faceKey]={...(face&&typeof face==='object'?face as Record<string,unknown>:{}),sub_score:data.scores![key],defects:[],summary:`Manually reviewed by the DCM team: ${data.notes.trim()}`,manual_review:true};touched=true;
    }
    if(touched){correction.patch.conversational_corners_edges_surface=next;correction.expected.conversational_corners_edges_surface=narrative;}
  }
  // A person confirmed every face score, so the model's grade range no longer applies.
  if('conversational_grade_uncertainty' in card){correction.patch.conversational_grade_uncertainty='±0';correction.expected.conversational_grade_uncertainty=card.conversational_grade_uncertainty;}
  // Publish the actual reviewer explanation, retaining the original report in the run snapshot.
  const updated=JSON.parse(String(correction.patch.conversational_grading));
  const summary=reviewedSummary(data.notes,Number(snapshot.grade),after);
  updated.final_grade.summary=summary;
  updated.final_grade.grade_range='±0';
  correction.patch.conversational_grading=JSON.stringify(updated);
  if('conversational_final_grade_summary' in correction.patch)correction.patch.conversational_final_grade_summary=summary;
  return {...correction,proposedGrade:after};
}
