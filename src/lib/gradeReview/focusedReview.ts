import { focusedObservationSchema, compareFullReview, type FullComparison, type PreparedFullReview, type ReviewTarget } from './fullReview';

export function correctionTargets(review:FullComparison):ReviewTarget[] {
  return [...review.centering.findings.filter(f=>f.verdict==='correction_proposed').map(f=>({category:'centering' as const,side:f.side})),
    ...review.findings.filter(f=>f.verdict==='correction_proposed').map(f=>({category:f.category,side:f.side}))];
}
export function focusedPayload(prepared:PreparedFullReview,review:FullComparison) {
  const targets=correctionTargets(review);
  return {targets:targets.map(target=>({
    ...target,
    original_score:prepared.reviewContext.face_scores[`${target.category}_${target.side}`],
    original_ratios:target.category==='centering'?prepared.reviewContext.original_centering[target.side]:null,
    original_findings:prepared.claims.filter(c=>c.category===target.category&&c.side===target.side),
    // Hypotheses direct attention to evidence, not to a desired replacement score.
    disputed_evidence:target.category==='centering'?review.centering.findings.find(f=>f.side===target.side)!.evidence:
      review.findings.find(f=>f.category===target.category&&f.side===target.side)!.evidence,
  }))};
}

/** Reject extra/missing faces; merge only targeted observations into the first review. */
export function compareFocusedReview(prepared:PreparedFullReview,initial:FullComparison,raw:unknown) {
  const response=focusedObservationSchema.parse(typeof raw==='string'?JSON.parse(raw):raw);
  const expected=correctionTargets(initial).map(t=>`${t.category}_${t.side}`).sort();
  const actual=[...response.centering.faces.map(f=>`centering_${f.side}`),...response.condition.map(f=>`${f.category}_${f.side}`)].sort();
  if(!expected.length||JSON.stringify(expected)!==JSON.stringify(actual)) throw new Error('unexpected_confirmation_scope');
  const merged=structuredClone(initial.observation);
  for(const face of response.centering.faces) merged.centering.faces[merged.centering.faces.findIndex(f=>f.side===face.side)]=face;
  for(const face of response.condition) merged.condition[merged.condition.findIndex(f=>f.category===face.category&&f.side===face.side)]=face;
  return compareFullReview(prepared,merged);
}
