import { describe, expect, it } from 'vitest';
import { buildCorrection, captureCorrectionBasis, CORRECTION_FIELDS } from './correction';
import { compareCentering, prepareCenteringReview } from './centeringReview';

function fixture(oldCenter = 8, other = 9, measured = [50, 50]) {
  const report = {
    centering: { front: { left_right: '63/37', top_bottom: '50/50', score: oldCenter }, back: { left_right: '50/50', top_bottom: '50/50', score: 10 } },
    raw_sub_scores: { centering_front: oldCenter, centering_back: 10, corners_front: other },
    corners: { front: { summary: 'Corner observation must be preserved.' } },
    grading_passes: { pass_1: { centering: oldCenter, corners: other, edges: 10, surface: 10 }, pass_2: { centering: oldCenter, corners: other, edges: 10, surface: 10 }, pass_3: { centering: oldCenter, corners: other, edges: 10, surface: 10 }, averaged_rounded: { centering: oldCenter, corners: other, edges: 10, surface: 10, final: Math.min(oldCenter, other) } },
    final_grade: { whole_grade: Math.min(oldCenter, other), grade_range: '±1', summary: 'Old summary' },
    grade_review_scoring_context: captureCorrectionBasis(Math.min(oldCenter, other), { centering: oldCenter, corners: other, edges: 10, surface: 10 }, [other,other,other], false),
  };
  const snapshot = { grade: Math.min(oldCenter, other), report, rubric_version: 'DCM_Grading_v9.23', front_path: 'front.jpg', back_path: 'back.jpg', policy_context: { version: 'centering-v9.23', centering: 'shadow', r0: 'enforce', cv: 'shadow' } };
  const concerns = [{ category: 'centering', side: 'front' }];
  const observation = { faces: [{ side: 'front', layout: 'standard_bordered', left_right: measured, top_bottom: [50,50], confidence: 'high', evidence: [{ region: [0,0,1,1], description: 'The printed borders are clearly visible across both axes.' }], limitations: [] }] };
  const proposal = compareCentering(prepareCenteringReview(snapshot, concerns), observation);
  const card = { ...Object.fromEntries(CORRECTION_FIELDS.map(key => [key,null])), id: 'card', serial: 'SERIAL', card_name: 'Keep identity',
    conversational_grading: JSON.stringify(report), conversational_whole_grade: snapshot.grade,
    conversational_sub_scores: { corners: { weighted: other }, centering: { front: oldCenter, back: 10, weighted: oldCenter } }, label_data: { primaryName: 'Custom card name', grade: snapshot.grade } };
  return { snapshot, report, concerns, proposal, card };
}
describe('verified centering correction projection', () => {
  it('raises a centering-limited grade while preserving unrelated findings and original passes', () => {
    const f = fixture(); const before = JSON.stringify(f);
    const result = buildCorrection(f.card, f.snapshot, f.proposal, f.concerns, 'review');
    expect(result.afterGrade).toBe(9);
    const report = JSON.parse(result.patch.conversational_grading as string);
    expect(report.corners).toEqual(f.report.corners);
    expect(report.grading_passes.pass_1).toEqual(f.report.grading_passes.pass_1);
    expect(report.grading_passes.averaged_rounded.final).toBe(9);
    expect(report.grading_passes.review_applied).toBe(true);
    expect(result.patch.label_data).toMatchObject({ primaryName: 'Custom card name', grade: 9 });
    expect(result.patch).not.toHaveProperty('card_name'); expect(result.patch).not.toHaveProperty('serial');
    expect(JSON.stringify(f)).toBe(before);
  });
  it('retains a lower corner limit when centering improves', () => {
    const f = fixture(8, 7); expect(buildCorrection(f.card, f.snapshot, f.proposal, f.concerns, 'review').afterGrade).toBe(7);
  });
  it('lowers the overall grade when corrected centering becomes the limiting factor', () => {
    const f = fixture(10, 9, [73,27]);
    expect(buildCorrection(f.card, f.snapshot, f.proposal, f.concerns, 'review').afterGrade).toBe(6);
  });
  it('preserves the old grade limit when historical scoring basis is unavailable', () => {
    const f = fixture(); const snapshot = { ...f.snapshot, report: { ...f.report, grade_review_scoring_context: undefined } };
    expect(buildCorrection(f.card, snapshot, f.proposal, f.concerns, 'review').afterGrade).toBe(8);
  });
  it('preserves independent caps and allows 10 when saved constraints support it', () => {
    expect(captureCorrectionBasis(8, { centering: 8, corners: 10, edges: 10, surface: 10 }, [10,10,10], true).non_centering_cap).toBe(8);
    expect(captureCorrectionBasis(8, { centering: 8, corners: 10, edges: 10, surface: 10 }, [10,10,10], false).non_centering_cap).toBe(10);
  });
  it('does not trust edited candidate scores or client patches', () => {
    const f = fixture(); f.proposal.findings[0].candidate_score = 1;
    expect(buildCorrection(f.card, f.snapshot, f.proposal, f.concerns, 'review').afterGrade).toBe(9);
  });
  it('rejects unresolved inspection findings', () => {
    const f = fixture(8, 9, [55,45]);
    expect(() => buildCorrection(f.card, f.snapshot, f.proposal, f.concerns, 'review')).toThrow('unresolved');
  });
});
