import { z } from 'zod';
import { CENTERING_REVIEW_VERSION, compareCentering, prepareCenteringReview } from './centeringReview';
import { getConditionFromGrade } from '@/lib/conditionAssessment';
import { buildFinalSummary } from '@/lib/gradeNarrator';
import { estimateProfessionalGrades } from '@/lib/professionalGradeMapper';
import { resolveAutographVerdict } from '@/lib/grading/autographPolicy';

const score = z.number().int().min(1).max(10);
const categories = ['centering', 'corners', 'edges', 'surface'] as const;
const obj = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const CORRECTION_FIELDS = [
  'conversational_grading', 'conversational_whole_grade', 'conversational_decimal_grade', 'raw_decimal_grade', 'dcm_grade_whole',
  'final_dcm_score', 'conversational_condition_label', 'conversational_final_grade_summary', 'conversational_sub_scores',
  'conversational_weighted_sub_scores', 'conversational_limiting_factor', 'conversational_preliminary_grade', 'conversational_centering_ratios',
  'estimated_professional_grades', 'professional_grades', 'ai_grading', 'label_data',
  // Narrative + uncertainty: passed through unchanged here, overridden by the
  // manual review path (see manualReview.ts) and dropped from the patch when
  // untouched so the automatic centering path stays exactly as before.
  'conversational_corners_edges_surface', 'conversational_grade_uncertainty',
] as const;
const PASSTHROUGH_FIELDS = new Set<string>(['conversational_corners_edges_surface', 'conversational_grade_uncertainty']);

/** Save the centering-only basis and the independent cap used by full subgrade reviews. */
export function captureCorrectionBasis(final: number, grades: Record<typeof categories[number], number>, passCaps: number[], explicitCap: boolean, structuralConfirmed = false) {
  const median = [...passCaps].sort((a, b) => a - b)[Math.floor(passCaps.length / 2)];
  let cap = Math.min(grades.corners, grades.edges, grades.surface, Number.isFinite(median) ? median : final);
  if (explicitCap || Math.min(grades.centering, cap) !== final) cap = Math.min(cap, final);
  return { version: 'centering-correction-1', original_centering: grades.centering, non_centering_cap: cap, structural_confirmed: structuralConfirmed,
    full_review: { version: 'all-subgrades-v1', original_scores: { ...grades }, independent_cap: explicitCap || Math.min(...Object.values(grades)) !== final ? final : 10, structural_confirmed: structuralConfirmed } };
}

export function buildCorrection(card: Record<string, unknown>, snapshot: unknown, proposal: unknown, concerns: unknown, reviewId: string) {
  const prepared = prepareCenteringReview(snapshot, concerns);
  const proposed = obj(proposal);
  if (proposed.version !== CENTERING_REVIEW_VERSION || !Array.isArray(proposed.findings)) throw new Error('Unsupported review proposal.');
  // Recompute from validated observations; never accept stored/client score edits.
  const checked = compareCentering(prepared, { faces: proposed.findings.map(value => {
    const finding = obj(value), observed = obj(finding.observed);
    const ratio = (value: unknown) => typeof value === 'string' ? value.split('/').map(Number) : null;
    return { side: finding.side, layout: observed.layout, left_right: ratio(observed.left_right), top_bottom: ratio(observed.top_bottom),
      confidence: observed.confidence, evidence: finding.evidence, limitations: finding.limitations };
  }) });
  if (checked.findings.some(finding => finding.candidate_score === null || finding.verdict === 'unable_to_verify')) {
    throw new Error('This review has unresolved evidence and cannot be applied as a correction.');
  }
  if (!checked.findings.some(finding => finding.verdict === 'correction_proposed')) throw new Error('No material correction was established.');
  const report = structuredClone(prepared.report) as Record<string, unknown>;
  const passes = obj(report.grading_passes), rounded = obj(passes.averaged_rounded), weighted = obj(report.weighted_scores);
  const grades = Object.fromEntries(categories.map(category => [category, score.parse(rounded[category] ?? weighted[`${category}_weighted`])])) as Record<typeof categories[number], number>;
  const raw = obj(report.raw_sub_scores), centering = obj(report.centering);
  const beforeGrade = score.parse(prepared.saved.grade);
  if (Number(card.conversational_whole_grade) !== beforeGrade) throw new Error('The card grade has changed. Reload this review.');
  const basis = z.object({ version: z.literal('centering-correction-1'), original_centering: score, non_centering_cap: score, structural_confirmed: z.boolean().default(false) }).safeParse(report.grade_review_scoring_context);
  if (basis.success && basis.data.original_centering !== grades.centering) throw new Error('Saved scoring evidence is inconsistent.');
  for (const finding of checked.findings) {
    if (finding.verdict !== 'correction_proposed') continue;
    const section = obj(centering[finding.side]);
    const summary = finding.observed.layout === 'standard_bordered'
      ? `Grade Review: ${finding.side} centering is ${finding.observed.left_right} left/right and ${finding.observed.top_bottom} top/bottom (score ${finding.candidate_score}).`
      : `Grade Review: the ${finding.side} design has no evenly measurable border (centering score ${finding.candidate_score}).`;
    centering[finding.side] = { ...section, left_right: finding.observed.left_right, top_bottom: finding.observed.top_bottom,
      card_type: { standard_bordered: 'Standard Bordered', full_bleed: 'Full Bleed', asymmetric: 'Asymmetric', obstructed: 'Obstructed', indeterminate: 'Indeterminate' }[finding.observed.layout],
      score: finding.candidate_score, summary, analysis: summary, measurements: summary,
      quality_tier: finding.observed.layout !== 'standard_bordered' ? 'Unmeasurable by design' : finding.candidate_score === 10 ? 'Perfect' : finding.candidate_score === 9 ? 'Excellent' : finding.candidate_score === 8 ? 'Good' : finding.candidate_score === 7 ? 'Fair' : 'Off-Center', policy: finding.policy };
    centering[`${finding.side}_summary`] = summary;
    raw[`centering_${finding.side}`] = finding.candidate_score;
  }
  grades.centering = Math.min(score.parse(raw.centering_front), score.parse(raw.centering_back));
  const cap = basis.success ? basis.data.non_centering_cap : beforeGrade;
  const afterGrade = Math.min(grades.centering, grades.corners, grades.edges, grades.surface, cap);
  report.centering = centering; report.raw_sub_scores = raw;
  return { ...projectCorrection(card, report, grades, beforeGrade, afterGrade, reviewId, 'centering', basis.success && basis.data.structural_confirmed), findings: checked.findings };
}

export function projectCorrection(card: Record<string, unknown>, report: Record<string, unknown>, grades: Record<typeof categories[number], number>, beforeGrade: number, afterGrade: number, reviewId: string, scope: string, structuralConfirmed: boolean) {
  const passes = obj(report.grading_passes), rounded = obj(passes.averaged_rounded), weighted = obj(report.weighted_scores);
  const raw = obj(report.raw_sub_scores), centering = obj(report.centering);
  const condition = getConditionFromGrade(afterGrade);
  const limiting = categories.find(category => grades[category] === Math.min(...Object.values(grades)))!;
  const capNote = afterGrade < Math.min(...Object.values(grades)) ? `The original grading constraints continue to limit the overall grade to ${afterGrade}.` : null;
  report.centering = centering; report.raw_sub_scores = raw;
  report.grading_passes = { ...passes, averaged_rounded: { ...rounded, ...grades, final: afterGrade }, review_applied: true,
    consensus_notes: ['Original evaluations are retained. The reviewed result includes the verified grade review corrections.'] };
  report.weighted_scores = { ...weighted, ...Object.fromEntries(categories.map(category => [`${category}_weighted`, grades[category]])),
    preliminary_grade: afterGrade, weakest_subgrade: Math.min(...Object.values(grades)), limiting_factor: limiting };
  const final = obj(report.final_grade);
  const summary = buildFinalSummary({ finalGrade: afterGrade, conditionLabel: condition, uncertainty: String(final.grade_range || '±1'), subgrades: grades,
    structuralDetected: structuralConfirmed,
    structuralFindings: [], zoomAdjustments: [], gradeCapNote: capNote, jsonData: report });
  report.final_grade = { ...final, decimal_grade: afterGrade, whole_grade: afterGrade, condition_label: condition, summary, dominant_defect: limiting };
  if (report.scoring) report.scoring = { ...obj(report.scoring), final_grade: afterGrade };
  // Preserve original pass rows; publish the reviewed consensus and updated face findings.
  report.grade_review = { id: reviewId, original_grade: beforeGrade, reviewed_grade: afterGrade, scope };
  const ratios = { front_lr: obj(centering.front).left_right ?? null, front_tb: obj(centering.front).top_bottom ?? null,
    back_lr: obj(centering.back).left_right ?? null, back_tb: obj(centering.back).top_bottom ?? null };
  const pair = (value: unknown): [number, number] | undefined => {
    if (typeof value !== 'string' || !/^\d+\/\d+$/.test(value)) return undefined;
    const [a, b] = value.split('/').map(Number); return [a, b];
  };
  const frontLR = pair(ratios.front_lr), frontTB = pair(ratios.front_tb);
  const estimates = estimateProfessionalGrades({ final_grade: afterGrade,
    centering: frontLR && frontTB ? { front_lr: frontLR, front_tb: frontTB, back_lr: pair(ratios.back_lr), back_tb: pair(ratios.back_tb) } : undefined,
    corners_score: grades.corners, edges_score: grades.edges, surface_score: grades.surface,
    is_authenticated_autograph: resolveAutographVerdict(report).present });
  report.professional_grade_estimates = estimates;
  // The detail API routes treat a card with no ai_grading blob as "never graded"
  // and run a full regrade on the next page load, which silently overwrote an
  // accepted correction (Sept 8 test). Keep the blob and update its two grade
  // numbers so the cached-grade path still short-circuits.
  const aiGrading = card.ai_grading && typeof card.ai_grading === 'object' && !Array.isArray(card.ai_grading) ? structuredClone(obj(card.ai_grading)) : null;
  if (aiGrading) aiGrading['Grading (DCM Master Scale)'] = { ...obj(aiGrading['Grading (DCM Master Scale)']), 'DCM Grade (Final Whole Number)': afterGrade, 'Raw Decimal Grade (Before Rounding)': afterGrade };
  const subScores = structuredClone(obj(card.conversational_sub_scores));
  for (const category of categories) subScores[category] = { ...obj(subScores[category]), front: raw[category + '_front'] ?? obj(subScores[category]).front, back: raw[category + '_back'] ?? obj(subScores[category]).back, weighted: grades[category] };
  const candidate: Record<string, unknown> = {
    conversational_grading: JSON.stringify(report), conversational_whole_grade: afterGrade, conversational_decimal_grade: afterGrade,
    raw_decimal_grade: afterGrade, dcm_grade_whole: afterGrade, final_dcm_score: String(afterGrade),
    conversational_condition_label: condition, conversational_final_grade_summary: summary,
    conversational_sub_scores: subScores,
    // Legacy columns the grading routes no longer write (they stay null on new
    // cards). eBay drafts, listing images and publish read the weighted column
    // FIRST, and a later regrade never clears it, so writing it here left a
    // regraded 9 advertising 10/10/10/10 subgrades. Only refresh them where the
    // card already carries them.
    conversational_weighted_sub_scores: card.conversational_weighted_sub_scores == null ? null : grades,
    conversational_limiting_factor: limiting,
    conversational_preliminary_grade: card.conversational_preliminary_grade == null ? null : afterGrade,
    conversational_centering_ratios: ratios,
    estimated_professional_grades: estimates, professional_grades: null, ai_grading: aiGrading,
    label_data: card.label_data ? { ...obj(card.label_data), grade: afterGrade, gradeFormatted: String(afterGrade), condition } : null,
    conversational_corners_edges_surface: card.conversational_corners_edges_surface,
    conversational_grade_uncertainty: card.conversational_grade_uncertainty,
  };
  const patch = Object.fromEntries(CORRECTION_FIELDS.filter(key => key in card && !(PASSTHROUGH_FIELDS.has(key) && candidate[key] === card[key])).map(key => [key, candidate[key]]));
  const expected = Object.fromEntries(Object.keys(patch).map(key => [key, card[key]]));
  return { patch, expected, beforeGrade, afterGrade, 
    outcome: afterGrade === beforeGrade ? 'report_corrected' : 'grade_corrected',
    explanation: afterGrade === beforeGrade ? `Your overall grade remains ${afterGrade}.` : `Your overall grade changed from ${beforeGrade} to ${afterGrade}.`,
    constraintNote: capNote };
}
