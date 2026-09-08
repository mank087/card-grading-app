import { describe, expect, it } from 'vitest';
import { compareCentering, prepareCenteringReview, CENTERING_INSPECTION_PROMPT } from './centeringReview';

export function reviewFixture() {
  return {
    grade: 8, rubric_version: 'DCM_Grading_v9.23', front_path: 'front.jpg', back_path: 'back.jpg',
    policy_context: { version: 'centering-v9.23', centering: 'shadow', r0: 'enforce', cv: 'shadow' },
    report: { centering: { front: { left_right: '50/50', top_bottom: '50/50', score: 10 }, back: { left_right: '50/50', top_bottom: '50/50', score: 10 } },
      raw_sub_scores: { centering_front: 10, centering_back: 10 },
      grading_passes: { pass_1: { centering: 10, centering_dev: 0 }, pass_2: { centering: 10, centering_dev: 0 }, pass_3: { centering: 10, centering_dev: 0 } },
    },
  };
}
export function observationFixture() {
  return { faces: [{ side: 'front', layout: 'standard_bordered', left_right: [63, 37], top_bottom: [50, 50], confidence: 'high',
    evidence: [{ region: [0, 0, 1, 1], description: 'The left printed border is visibly wider than the right border.' }], limitations: [] }] };
}
const concern = [{ category: 'centering', side: 'front' }];

describe('centering review evidence and comparison', () => {
  it('proposes only selected centering changes without changing the original result', () => {
    const snapshot = reviewFixture(); const before = JSON.stringify(snapshot);
    const result = compareCentering(prepareCenteringReview(snapshot, concern), observationFixture());
    expect(result.findings[0]).toMatchObject({ verdict: 'correction_proposed', candidate_score: 8 });
    expect(result.proposed_overall_grade).toBeNull();
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it('confirms matching measurable evidence', () => {
    const observation = observationFixture(); observation.faces[0].left_right = [50, 50];
    expect(compareCentering(prepareCenteringReview(reviewFixture(), concern), observation).findings[0].verdict).toBe('confirmed');
  });
  it.each([[55, 45], [60, 40], [65, 35]])('does not propose numeric changes near a score boundary: %j', (a, b) => {
    const observation = observationFixture(); observation.faces[0].left_right = [a, b];
    expect(compareCentering(prepareCenteringReview(reviewFixture(), concern), observation).findings[0].candidate_score).toBeNull();
  });
  it('requires complete requested faces and rejects duplicate/extra faces', () => {
    const prepared = prepareCenteringReview(reviewFixture(), concern);
    const observation = observationFixture(); observation.faces.push(observation.faces[0]);
    expect(() => compareCentering(prepared, observation)).toThrow('unexpected_review_faces');
    expect(() => compareCentering(prepareCenteringReview(reviewFixture(), [{ category: 'centering', side: 'both' }]), observationFixture())).toThrow('unexpected_review_faces');
  });
  it('does not accept nonstandard border measurements or invented grade fields', () => {
    const prepared = prepareCenteringReview(reviewFixture(), concern);
    const observation = observationFixture(); observation.faces[0].layout = 'full_bleed';
    expect(() => compareCentering(prepared, observation)).toThrow('unmeasurable_ratio');
    expect(() => compareCentering(prepared, { ...observationFixture(), final_grade: 10 })).toThrow();
  });
  it('declines numeric findings with glare or low confidence', () => {
    const observation = observationFixture(); observation.faces[0].confidence = 'low';
    expect(compareCentering(prepareCenteringReview(reviewFixture(), concern), observation).findings[0].candidate_score).toBeNull();
    observation.faces[0].confidence = 'high'; observation.faces[0].limitations = ['Glare obscures the cut edge.'];
    expect(compareCentering(prepareCenteringReview(reviewFixture(), concern), observation).findings[0].candidate_score).toBeNull();
  });
  it('uses the saved design-only policy for full-bleed cards', () => {
    const snapshot = reviewFixture(); snapshot.report.raw_sub_scores.centering_front = 9;
    const observation = { faces: [{ ...observationFixture().faces[0], layout: 'full_bleed', left_right: null, top_bottom: null }] };
    expect(compareCentering(prepareCenteringReview(snapshot, concern), observation).findings[0].candidate_score).toBe(10);
    snapshot.policy_context.r0 = 'off';
    expect(compareCentering(prepareCenteringReview(snapshot, concern), observation).findings[0].candidate_score).toBeNull();
  });
  it('refuses unknown historical policies and non-centering requests before inspection', () => {
    expect(() => prepareCenteringReview({ ...reviewFixture(), rubric_version: 'old' }, concern)).toThrow();
    expect(() => prepareCenteringReview({ ...reviewFixture(), policy_context: null }, concern)).toThrow();
    expect(() => prepareCenteringReview(reviewFixture(), [{ category: 'surface', side: 'front' }])).toThrow();
    const snapshot = reviewFixture(); snapshot.policy_context.cv = 'active';
    expect(() => prepareCenteringReview(snapshot, concern)).toThrow('unsupported_geometry_policy');
  });
  it('rejects invalid ratios and evidence outside the image', () => {
    const observation = observationFixture(); observation.faces[0].left_right = [60, 60];
    expect(() => compareCentering(prepareCenteringReview(reviewFixture(), concern), observation)).toThrow();
    observation.faces[0].left_right = [63, 37]; observation.faces[0].evidence[0].region = [0.9, 0, 0.3, 1];
    expect(() => compareCentering(prepareCenteringReview(reviewFixture(), concern), observation)).toThrow();
  });
  it('does not bypass an original geometry veto without a measurement check', () => {
    const snapshot = reviewFixture();
    const report = { ...snapshot.report, centering: { ...snapshot.report.centering, front: { ...snapshot.report.centering.front, policy: { mode: 'enforce', fired_rules: ['R6'] } } } };
    expect(compareCentering(prepareCenteringReview({ ...snapshot, report }, concern), observationFixture()).findings[0].candidate_score).toBeNull();
  });
  it('keeps the initial inspection scoped and blind to the previous result', () => {
    expect(CENTERING_INSPECTION_PROMPT).toContain('Never return scores or a final grade');
  });
});
