/**
 * CV_CENTERING_GATE_V1. Cases are real production cards with the values
 * actually stored in cards.cv_centering / capture_quality (Sept 26 2026),
 * hand-checked against the photos on Sept 29.
 */
import { describe, it, expect } from 'vitest';
import {
  applyCvCenteringGate,
  evaluateFaceDisagreement,
  disagreementNote,
  quadSkew,
  worstPct,
  frontScoreFromPct,
  backEffectFromPct,
} from './cvCenteringGate';
import type { CenteringMeasurement } from '../zoomInspection';

const m = (x: Partial<CenteringMeasurement> & Pick<CenteringMeasurement, 'widths' | 'spread'>): CenteringMeasurement => ({
  leftRight: null, topBottom: null, bothAxes: false, worstAxisPct: 50, ...x,
});

// 2014 Topps Chrome Mike Evans (8a66d848). By eye ~48/52 — the MODEL was right.
// CV: near-black chrome border; right side "ended" 14px in (chroma noise).
const EVANS = {
  model: { left_right: '50/50', top_bottom: '54/46' },
  cv: m({ leftRight: '87/13', topBottom: '50/50', bothAxes: true, worstAxisPct: 87,
    widths: { left: 92, right: 14, top: 60, bottom: 61 }, spread: { left: 30, right: 29, top: 3, bottom: 23 } }),
  quad: [{ x: 194, y: 249 }, { x: 792, y: 252 }, { x: 797, y: 849 }, { x: 196, y: 850 }],
};
// 1981 Topps Kevin McHale (b6447b1d). By eye ~49/51 L/R — model right.
// CV: quad corners placed off the card (trapezoid), snap took the inner frame.
const MCHALE = {
  model: { left_right: '52/48', top_bottom: '50/50' },
  cv: m({ leftRight: '76/24', bothAxes: false, worstAxisPct: 76,
    widths: { left: 75, right: 24, top: 19, bottom: null }, spread: { left: 11, right: 17, top: 21, bottom: null } }),
  quad: [{ x: 162, y: 155 }, { x: 836, y: 161 }, { x: 868, y: 866 }, { x: 149, y: 871 }],
};
// 2004 Fleer Tradition Tom Brady (56cb0be2). Recorded 52/48 both axes; by hand
// ~60/40 top/bottom. CV could not measure T/B at all (bottom side failed) and
// read L/R 56/44 — only 4 points from the model.
const BRADY = {
  model: { left_right: '52/48', top_bottom: '52/48' },
  cv: m({ leftRight: '56/44', bothAxes: false, worstAxisPct: 56,
    widths: { left: 78, right: 61, top: 52, bottom: null }, spread: { left: 9, right: 11, top: 10, bottom: null } }),
  quad: [{ x: 143, y: 111 }, { x: 833, y: 128 }, { x: 847, y: 778 }, { x: 123, y: 780 }],
};
// Pacific Ken Griffey Jr. (56cf0578). Hand-measured top 28 / bottom 54 ≈ 34/66 —
// CV (33/67) right, model (53/47) wrong. The positive case.
const PACIFIC = {
  model: { left_right: '50/50', top_bottom: '53/47' },
  cv: m({ leftRight: '48/52', topBottom: '33/67', bothAxes: true, worstAxisPct: 67,
    widths: { left: 82, right: 89, top: 58, bottom: 117 }, spread: { left: 2, right: 8, top: 5, bottom: 4 } }),
  quad: [{ x: 91, y: 98 }, { x: 909, y: 102 }, { x: 906, y: 925 }, { x: 92, y: 925 }],
};

describe('helpers', () => {
  it('parses ratios and rejects placeholders', () => {
    expect(worstPct('52/48')).toBe(52);
    expect(worstPct('33/67')).toBe(67);
    expect(worstPct('XX/XX')).toBeNull();
    expect(worstPct(null)).toBeNull();
  });
  it('follows the rubric ladders', () => {
    expect(frontScoreFromPct(55)).toBe(10);
    expect(frontScoreFromPct(56)).toBe(9);
    expect(frontScoreFromPct(67)).toBe(7);
    expect(frontScoreFromPct(87)).toBe(4);
    expect(backEffectFromPct(75)).toBe('none');
    expect(backEffectFromPct(78)).toBe('blocks_10');
    expect(backEffectFromPct(93)).toBe('minus_1');
  });
  it('measures quad skew', () => {
    expect(quadSkew(EVANS.quad)!).toBeLessThan(0.01);
    expect(quadSkew(MCHALE.quad)!).toBeGreaterThan(0.06);
    expect(quadSkew(null)).toBeNull();
  });
});

describe('evaluateFaceDisagreement — the three hand-reviewed cards', () => {
  it('Evans: CV 87/13 vs model 50/50 is rejected as low-confidence (dark border)', () => {
    const r = evaluateFaceDisagreement({ face: 'front', ...EVANS, cardType: 'Standard Bordered' });
    expect(r.disagreement).toBeNull();
    expect(r.skipped).toBe('cv_low_confidence');
    const lr = r.axes.find(a => a.axis === 'left_right')!;
    expect(lr.diff).toBe(37);
    expect(lr.rejected).toEqual(expect.arrayContaining(['side_spread', 'thin_side']));
    // T/B agrees anyway, and its bottom side is noisy too.
    expect(r.axes.find(a => a.axis === 'top_bottom')!.rejected).toContain('side_spread');
  });

  it('McHale: CV 76/24 vs model 52/48 is rejected — the corner quad is skewed', () => {
    const r = evaluateFaceDisagreement({ face: 'front', ...MCHALE });
    expect(r.disagreement).toBeNull();
    expect(r.skipped).toBe('cv_low_confidence');
    expect(r.axes[0].diff).toBe(24);
    expect(r.axes[0].rejected).toEqual(['quad_skew']);
  });

  it('Brady: CV cannot see the real miss (T/B unmeasured); L/R is only 4 apart', () => {
    const r = evaluateFaceDisagreement({ face: 'front', ...BRADY });
    expect(r.disagreement).toBeNull();
    expect(r.skipped).toBe('below_threshold');
    expect(r.axes.map(a => a.axis)).toEqual(['left_right']);
    expect(r.axes[0].diff).toBe(4);
  });

  it('Brady back: model said XX/XX, so there is nothing to compare', () => {
    const r = evaluateFaceDisagreement({
      face: 'back',
      model: { left_right: 'XX/XX', top_bottom: 'XX/XX' },
      cv: m({ topBottom: '78/22', worstAxisPct: 78, widths: { left: null, right: null, top: 56, bottom: 16 }, spread: { left: null, right: null, top: 9, bottom: 25 } }),
      quad: BRADY.quad,
    });
    expect(r.skipped).toBe('no_comparable_axis');
  });
});

describe('evaluateFaceDisagreement — firing and exclusions', () => {
  it('Pacific Griffey: clean, confident CV 33/67 vs model 53/47 fires (front 10 → 7)', () => {
    const r = evaluateFaceDisagreement({ face: 'front', ...PACIFIC, cardType: 'Standard Bordered' });
    expect(r.disagreement).toMatchObject({
      face: 'front', axis: 'top_bottom', model_ratio: '53/47', cv_ratio: '33/67', diff: 14,
      model_effect: 10, cv_effect: 7, would_change_subgrade: true, policy: 'flag_for_review', review: true,
    });
  });
  it('never fires on a slab photo, a full-bleed face or a foil frame', () => {
    expect(evaluateFaceDisagreement({ face: 'front', ...PACIFIC, rigidCase: true }).skipped).toBe('rigid_case');
    expect(evaluateFaceDisagreement({ face: 'front', ...PACIFIC, cardType: 'Full Art / Borderless' }).skipped).toBe('layout_full_bleed');
    expect(evaluateFaceDisagreement({ face: 'front', ...PACIFIC, cardType: 'Foil-Frame' }).skipped).toBe('layout_foil_frame');
  });
  it('a back disagreement only fires when it crosses a back threshold', () => {
    // 53 vs 67 on the back: both ≤75/25, no subgrade effect.
    expect(evaluateFaceDisagreement({ face: 'back', ...PACIFIC }).skipped).toBe('no_subgrade_effect');
    const cv = m({ ...PACIFIC.cv, topBottom: '20/80', worstAxisPct: 80 });
    expect(evaluateFaceDisagreement({ face: 'back', ...PACIFIC, cv }).disagreement).toMatchObject({ model_effect: 'none', cv_effect: 'blocks_10' });
  });
  it('the note never contains an "N/10" that reconcileFaceProse would rewrite', () => {
    const r = evaluateFaceDisagreement({ face: 'front', ...PACIFIC, cv: m({ ...PACIFIC.cv, topBottom: '90/10', worstAxisPct: 90 }) });
    const note = disagreementNote(r.disagreement!);
    expect(note).toContain('about 90 to 10');
    expect(note).not.toMatch(/\d\s*\/\s*10\b/);
  });
});

describe('applyCvCenteringGate — the visionGrader hook', () => {
  const grading = () => ({
    centering: {
      front: { ...PACIFIC.model, score: 10, card_type: 'Standard Bordered', analysis: 'Borders look even.' },
      back: { left_right: '51/49', top_bottom: '52/48', score: 10, analysis: 'Back fine.' },
      front_summary: 'Front centering is excellent.',
    },
    raw_sub_scores: { centering_front: 10, centering_back: 10 },
  });
  const input = (jsonData: any, env: Record<string, string | undefined>) => ({
    jsonData,
    centering: { front: PACIFIC.cv, back: null },
    quads: { front: PACIFIC.quad, back: null },
    rigidCase: false,
    env,
  });

  it('flag OFF: returns null and leaves the grading JSON byte-identical', () => {
    for (const env of [{}, { CV_CENTERING_GATE_V1: '0' }, { CV_CENTERING_GATE_V1: 'off' }]) {
      const j = grading();
      const before = JSON.stringify(j);
      expect(applyCvCenteringGate(input(j, env))).toBeNull();
      expect(JSON.stringify(j)).toBe(before);
    }
  });

  it('flag ON with nothing to flag (Evans): returns [] and changes nothing', () => {
    const j: any = grading();
    j.centering.front = { ...EVANS.model, score: 10, analysis: 'x' };
    const before = JSON.stringify(j);
    const out = applyCvCenteringGate({ ...input(j, { CV_CENTERING_GATE_V1: '1' }), centering: { front: EVANS.cv, back: null }, quads: { front: EVANS.quad, back: null } });
    expect(out).toEqual([]);
    expect(JSON.stringify(j)).toBe(before);
  });

  it('flag ON and firing: records both readings, keeps score and ratios, explains', () => {
    const j: any = grading();
    const out = applyCvCenteringGate(input(j, { CV_CENTERING_GATE_V1: '1' }));
    expect(out).toHaveLength(1);
    expect(j.centering_disagreement).toMatchObject({ review: true, policy: 'flag_for_review' });
    expect(j.centering.front.centering_disagreement).toMatchObject({ model_ratio: '53/47', cv_ratio: '33/67' });
    // Score and ratio fields untouched.
    expect(j.centering.front.score).toBe(10);
    expect(j.raw_sub_scores.centering_front).toBe(10);
    expect(j.centering.front.top_bottom).toBe('53/47');
    // Both readings reach the prose the customer reads.
    expect(j.centering.front_summary).toMatch(/^Two independent reads of the front top\/bottom borders disagreed/);
    expect(j.centering.front_summary).toContain('about 53 to 47');
    expect(j.centering.front_summary).toContain('about 33 to 67');
    expect(j.centering.front.analysis).toMatch(/Borders look even\.$/);
    expect(j.centering.back.centering_disagreement).toBeUndefined();
  });
});
