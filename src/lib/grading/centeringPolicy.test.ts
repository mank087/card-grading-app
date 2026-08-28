/**
 * Cases are the customer's real cards (John Russell, Aug 28 2026) with the
 * values actually stored for them, so a regression here is a regression on the
 * complaint itself — not on a hypothetical.
 *
 * The Lawrence Taylor case matters as much as the failures: it is the card the
 * customer said was CORRECT, and it must keep its 10. A policy that fixes
 * Maynard by breaking Taylor has not fixed anything.
 */

import { describe, it, expect } from 'vitest';
import {
  applyCenteringPolicy,
  ratioDeviation,
  centeringCapNote,
  MAX_PASS_SPREAD,
  type CenteringPolicyInput,
} from './centeringPolicy';

const base = (over: Partial<CenteringPolicyInput> = {}): CenteringPolicyInput => ({
  face: 'front',
  proposedScore: 10,
  ratio: '52/48',
  passDevs: [2, 2, 3],
  layout: 'standard_bordered',
  passScores: [10, 10, 10],
  cv: null,
  imageConfidence: 'B',
  year: 2020,
  ...over,
});

describe('ratioDeviation', () => {
  it.each([
    ['50/50', 0], ['55/45', 5], ['60/40', 10], ['25/75', 25], ['75/25', 25],
  ])('%s -> %i points off centre', (r, expected) => {
    expect(ratioDeviation(r)).toBeCloseTo(expected as number, 5);
  });

  it('returns null for anything unmeasured', () => {
    for (const v of [null, undefined, '', 'XX/XX', 'borderless', 'n/a']) {
      expect(ratioDeviation(v as any)).toBeNull();
    }
  });

  it('normalises non-percentage pairs', () => {
    // "120/80" is 60/40 expressed in raw widths.
    expect(ratioDeviation('120/80')).toBeCloseTo(10, 5);
  });
});

describe('the cards from the complaint', () => {
  it('Don Maynard: CV disagreement vetoes the 10', () => {
    // Stored: model 50/50 front, CV measured 25/75 on two separate submissions.
    const r = applyCenteringPolicy(base({
      ratio: '50/50', year: 1970, imageConfidence: 'B',
      cv: { dev: 25, bothAxes: true },
    }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R6');
    expect(r.reviewFlag).toBe(true);
  });

  it('Lawrence Taylor: the correct card KEEPS its 10', () => {
    // Model 52/48, CV 53/47 — they agree. Nothing should fire.
    const r = applyCenteringPolicy(base({
      ratio: '52/48', year: 1990, imageConfidence: 'B',
      cv: { dev: 3, bothAxes: true },
      passDevs: [2, 2, 2], passScores: [10, 10, 10],
    }));
    expect(r.score).toBe(10);
    expect(r.capped).toBe(false);
    expect(r.firedRules).toEqual([]);
  });

  it('Alex Karras front: 9 points off does NOT trigger the veto', () => {
    // CV front read 41/59 (dev 9), below the 11-point bar. Deliberately below:
    // the veto is for blatant disagreement, not marginal.
    const r = applyCenteringPolicy(base({
      ratio: '48/52', cv: { dev: 9, bothAxes: true }, year: 1971,
      imageConfidence: 'B', passScores: [10, 10, 10],
    }));
    expect(r.firedRules).not.toContain('R6');
  });

  it('Alex Karras back: a full-bleed face cannot claim a 10', () => {
    const r = applyCenteringPolicy(base({
      face: 'back', layout: 'full_bleed', ratio: '48/52', year: 1971,
    }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R4');
  });

  it('Dave Duerson: centering 10 with no ratio at all is refused', () => {
    const r = applyCenteringPolicy(base({
      ratio: null, cv: null, year: 1989, imageConfidence: 'B', passDevs: [],
    }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R2');
  });
});

describe('R1 — the stated ratio must clear 55/45', () => {
  it('55/45 exactly is still a 10', () => {
    expect(applyCenteringPolicy(base({ ratio: '55/45' })).score).toBe(10);
  });

  it('57/43 is not — this is the ±2% drift the rubric allowed', () => {
    const r = applyCenteringPolicy(base({ ratio: '57/43' }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R1');
  });
});

describe('R3 — the passes must agree', () => {
  it(`blocks at a spread of ${MAX_PASS_SPREAD}`, () => {
    const r = applyCenteringPolicy(base({ passDevs: [1, 3, 1 + MAX_PASS_SPREAD] }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R3');
  });

  it('allows ordinary ensemble noise below it', () => {
    // p50 spread in production is 2 points; that must not be punished.
    expect(applyCenteringPolicy(base({ passDevs: [2, 3, 4] })).score).toBe(10);
  });

  it('does nothing with fewer than two passes', () => {
    expect(applyCenteringPolicy(base({ passDevs: [2] })).firedRules).not.toContain('R3');
  });
});

describe('R5 — vintage plus mediocre photos needs unanimity', () => {
  it('blocks a vintage majority-10 at confidence B', () => {
    const r = applyCenteringPolicy(base({ year: 1971, imageConfidence: 'B', passScores: [10, 10, 9] }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R5');
  });

  it('allows a vintage unanimous 10', () => {
    expect(applyCenteringPolicy(base({ year: 1971, imageConfidence: 'B', passScores: [10, 10, 10] })).score).toBe(10);
  });

  it('does not apply to modern cards', () => {
    expect(applyCenteringPolicy(base({ year: 2021, imageConfidence: 'B', passScores: [10, 10, 9] })).firedRules)
      .not.toContain('R5');
  });
});

describe('R6 — CV may only ever cap', () => {
  it('is ignored on a face with no measurable border', () => {
    // R4 already refuses those faces a 10; CV must not also act on a design it
    // cannot meaningfully measure.
    const r = applyCenteringPolicy(base({ face: 'back', layout: 'full_bleed', cv: { dev: 25, bothAxes: true } }));
    expect(r.firedRules).not.toContain('R6');
  });

  it('acts on a bordered BACK too — face is not the gate, layout is', () => {
    const r = applyCenteringPolicy(base({ face: 'back', layout: 'standard_bordered', cv: { dev: 25, bothAxes: true } }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R6');
  });

  it('acts on a one-axis reading only above the higher bar', () => {
    // 25 pts on one axis is past CV_VETO_MIN_DEV_ONE_AXIS. Requiring both axes
    // made this rule fire on ZERO of 15 real vintage cards.
    const r = applyCenteringPolicy(base({ cv: { dev: 25, bothAxes: false } }));
    expect(r.score).toBe(9);
    expect(r.firedRules).toContain('R6');
  });

  it('flags but does not act when one axis is below the higher bar', () => {
    const r = applyCenteringPolicy(base({ cv: { dev: 13, bothAxes: false } }));
    expect(r.score).toBe(10);
    expect(r.reviewFlag).toBe(true);
    expect(r.firedRules).toContain('R6-flag');
  });

  it('does not fire when the model already admits the card is off-centre', () => {
    // Model said 62/38 — R1 handles that. R6 exists for the case where the
    // model claims clean and CV says otherwise.
    const r = applyCenteringPolicy(base({ ratio: '62/38', cv: { dev: 25, bothAxes: true } }));
    expect(r.firedRules).not.toContain('R6');
  });

  it('never raises a score', () => {
    const r = applyCenteringPolicy(base({ proposedScore: 7, cv: { dev: 0, bothAxes: true } }));
    expect(r.score).toBe(7);
  });
});

describe('general guarantees', () => {
  it('never returns more than proposed', () => {
    for (const s of [1, 5, 8, 9, 10]) {
      expect(applyCenteringPolicy(base({ proposedScore: s, ratio: '90/10' })).score).toBeLessThanOrEqual(s);
    }
  });

  it('reports every rule that fired, not just the first', () => {
    const r = applyCenteringPolicy(base({
      ratio: null, layout: 'full_bleed', passDevs: [1, 9], year: 1970,
      imageConfidence: 'C', passScores: [10, 9, 10],
    }));
    expect(r.firedRules).toEqual(expect.arrayContaining(['R2', 'R3', 'R4', 'R5']));
  });

  it('produces a customer-facing note only when capped', () => {
    expect(centeringCapNote(applyCenteringPolicy(base()))).toBeNull();
    const capped = applyCenteringPolicy(base({ cv: { dev: 25, bothAxes: true } }));
    expect(centeringCapNote(capped)).toMatch(/independent measurement/i);
  });
});
