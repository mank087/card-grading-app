import { describe, expect, it, vi } from 'vitest';
import { processOneGradeReview } from './processor';
import type { supabaseServer } from '@/lib/supabaseServer';
import { captureCorrectionBasis } from './correction';

const snapshot = {
  grade: 8, rubric_version: 'DCM_Grading_v9.23', front_path: 'front.jpg', back_path: 'back.jpg',
  policy_context: { version: 'centering-v9.23', centering: 'shadow', r0: 'enforce', cv: 'shadow' },
  report: { centering: { front: { left_right: '50/50', top_bottom: '50/50', score: 10 }, back: { score: 10 } }, raw_sub_scores: { centering_front: 10, centering_back: 10 }, grading_passes: { averaged_rounded: { centering: 10, corners: 8, edges: 10, surface: 10 } } },
};
const observation = { faces: [{ side: 'front', layout: 'standard_bordered', left_right: [50, 50], top_bottom: [50, 50], confidence: 'high',
  evidence: [{ region: [0, 0, 1, 1], description: 'The printed borders appear even on both axes.' }], limitations: [] }] };
function harness(savedSnapshot: unknown = snapshot) {
  const rpc = vi.fn().mockResolvedValueOnce({ data: { id: 'review', card_id: 'card', lease_token: 'lease', snapshot: savedSnapshot, card: { conversational_whole_grade: 8, conversational_grading: JSON.stringify((savedSnapshot as typeof snapshot).report) }, concerns: [{ category: 'centering', side: 'front' }] }, error: null }).mockResolvedValue({ data: true, error: null });
  const inspect = vi.fn().mockResolvedValue({ observation, model: 'test-model', promptTokens: 100, completionTokens: 200 });
  const loadImage = vi.fn().mockResolvedValue({ side: 'front', dataUrl: 'data:image/jpeg;base64,test', sha256: 'test-hash', width: 1000, height: 1400 });
  return { rpc, inspect, loadImage, db: { rpc } as unknown as ReturnType<typeof supabaseServer> };
}

describe('durable centering processor', () => {
  const correctionSnapshot = () => ({ ...snapshot, report: { ...snapshot.report,
    centering: { ...snapshot.report.centering, front: { left_right: '63/37', top_bottom: '50/50', score: 8 } },
    raw_sub_scores: { centering_front: 8, centering_back: 10 },
    grading_passes: { averaged_rounded: { centering: 8, corners: 9, edges: 10, surface: 10 } },
    grade_review_scoring_context: captureCorrectionBasis(8, { centering: 8, corners: 9, edges: 10, surface: 10 }, [9,9,9], false),
  } });
  it('ignores minor measurement drift without a second inspection or report rewrite', async () => {
    const h = harness(); h.inspect.mockResolvedValue({ observation: { faces: [{ ...observation.faces[0], left_right: [51,49] }] }, model: 'test', promptTokens: 1, completionTokens: 1 });
    await processOneGradeReview(h);
    expect(h.inspect).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_outcome: 'grade_confirmed', p_patch: {} }));
  });
  it('automatically corrects only after two agreeing blind inspections', async () => {
    const source = correctionSnapshot(), before = JSON.stringify(source), h = harness(source);
    await processOneGradeReview(h);
    expect(h.inspect).toHaveBeenCalledTimes(2); expect(h.loadImage).toHaveBeenCalledTimes(2);
    expect(h.inspect.mock.calls.map(call => call[2])).toEqual(['initial','confirmation']);
    expect(JSON.stringify(h.inspect.mock.calls)).not.toContain('63/37');
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_error: null, p_outcome: 'grade_corrected',
      p_result: 'Front centering was corrected: left/right from 63/37 to 50/50. Your overall grade changed from 8 to 9. The report records corners at 9, which limits the overall grade.',
      p_patch: expect.objectContaining({ conversational_whole_grade: 9 }), p_proposal: expect.objectContaining({ verification: { agreed: true } }) }));
    expect(JSON.stringify(source)).toBe(before);
  });
  it('can correct centering while retaining the grade limited by corners', async () => {
    const source = correctionSnapshot(); source.report.grading_passes.averaged_rounded.corners = 8;
    const h = harness(source); await processOneGradeReview(h);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_outcome: 'report_corrected', p_patch: expect.objectContaining({ conversational_whole_grade: 8 }) }));
  });
  it('leaves the grade unchanged when independent measurements disagree', async () => {
    const h = harness(correctionSnapshot());
    h.inspect.mockResolvedValueOnce({ observation, model: 'test', promptTokens: 1, completionTokens: 1 })
      .mockResolvedValueOnce({ observation: { faces: [{ ...observation.faces[0], left_right: [63,37] }] }, model: 'test', promptTokens: 1, completionTokens: 1 });
    await processOneGradeReview(h);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_error: null, p_outcome: 'unable_to_verify', p_patch: {}, p_proposal: expect.objectContaining({ reason: 'disagreement' }) }));
    expect(h.inspect).toHaveBeenCalledTimes(2);
  });
  it('does not retry a correction whose confirmation is unavailable', async () => {
    const h = harness(correctionSnapshot()); h.inspect.mockResolvedValueOnce({ observation, model: 'test', promptTokens: 1, completionTokens: 1 }).mockRejectedValueOnce(new Error('provider failure'));
    await processOneGradeReview(h);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_error: null, p_outcome: 'unable_to_verify', p_patch: {} }));
  });
  it('does not correct images whose bytes changed during inspection', async () => {
    const h = harness(correctionSnapshot());
    h.loadImage.mockResolvedValueOnce({ side: 'front', dataUrl: 'data:image/jpeg;base64,test', sha256: 'original', width: 1000, height: 1400 });
    await processOneGradeReview(h);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_outcome: 'unable_to_verify', p_patch: {}, p_proposal: expect.objectContaining({ reason: 'images_changed' }) }));
  });
  it('does not reroll an uncertain measurement', async () => {
    const h = harness(); h.inspect.mockResolvedValue({ observation: { faces: [{ ...observation.faces[0], confidence: 'low' }] }, model: 'test', promptTokens: 1, completionTokens: 1 });
    await processOneGradeReview(h);
    expect(h.inspect).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_error: null, p_outcome: 'unable_to_verify', p_patch: {} }));
  });
  it('does no work when no claim is available', async () => {
    const h = harness(); h.rpc.mockReset().mockResolvedValue({ data: null, error: null });
    expect(await processOneGradeReview(h)).toEqual({ processed: false });
    expect(h.inspect).not.toHaveBeenCalled();
  });
  it('confirms the grade and explains its recorded cause with usage and image provenance', async () => {
    const h = harness();
    expect(await processOneGradeReview(h)).toMatchObject({ processed: true, recorded: true });
    expect(h.loadImage).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_id: 'review', p_token: 'lease', p_error: null,
      p_outcome: 'grade_confirmed', p_patch: {}, p_result: expect.stringContaining('corners at 8'),
      p_metadata: expect.objectContaining({ inspection_calls: 1, calls: [expect.objectContaining({ model: 'test-model', prompt_tokens: 100 })], images: [expect.objectContaining({ sha256: 'test-hash' })] }),
    }));
    expect(h.rpc.mock.calls.every(([name]) => name === 'claim_grade_review' || name === 'finish_grade_review')).toBe(true);
  });
  it('holds unsupported historical evidence without spending an inspection call', async () => {
    const h = harness({ ...snapshot, rubric_version: 'unknown' });
    await processOneGradeReview(h);
    expect(h.inspect).not.toHaveBeenCalled(); expect(h.loadImage).not.toHaveBeenCalled();
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_outcome: 'unable_to_verify', p_patch: {}, p_proposal: expect.objectContaining({ reason: 'unsupported_report' }) }));
  });
  it('schedules bounded database retries without leaking provider errors', async () => {
    const h = harness(); h.inspect.mockRejectedValue(new Error('secret provider diagnostic'));
    await processOneGradeReview(h);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_error: 'inspection_unavailable', p_patch: {} }));
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain('secret provider diagnostic');
  });
  it('rejects invalid inspection output instead of saving a proposal', async () => {
    const h = harness(); h.inspect.mockResolvedValue({ observation: { grade: 10 }, model: 'test', promptTokens: 100, completionTokens: 100 });
    await processOneGradeReview(h);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review', expect.objectContaining({ p_error: null, p_outcome: 'unable_to_verify', p_patch: {} }));
    expect(h.inspect).toHaveBeenCalledTimes(1);
  });
  it('does not report a stale lease as a recorded result', async () => {
    const h = harness(); h.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await processOneGradeReview(h)).toMatchObject({ processed: true, recorded: false });
  });
  it('does not retry inspection when persisting its result fails', async () => {
    const h = harness(); h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'database down' } });
    await expect(processOneGradeReview(h)).rejects.toThrow('review_finish_failed');
    expect(h.inspect).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });
});
