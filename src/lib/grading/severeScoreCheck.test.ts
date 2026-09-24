import { describe, expect, it } from 'vitest';
import { severeScoreTriggers, resolveSevereScore, tallySevereVotes, neutralClaim, type SevereTrigger } from './severeScoreCheck';

const base = {
  scores: { corners: 10, edges: 10, surface: 1 },
  passScores: { corners: [10, 10, 10], edges: [10, 10, 10], surface: [1, 10, 1] },
  zoomDefectCategories: new Set<string>(),
  structuralDetected: false,
  surfaceDefectTypes: ['print_line'],
};
const answer = (classification: string, reason = 'seen') => ({
  finish_reason: 'stop', message: { content: JSON.stringify({ classification, reason }) },
});

describe('low-score verification triggers', () => {
  it('flags the Espeon case: surface 1, passes 1/10/1, a print line', () => {
    const [t, ...rest] = severeScoreTriggers(base);
    expect(rest).toHaveLength(0);
    expect(t).toMatchObject({ cat: 'surface', score: 1, spread: 9, zoomClean: true });
  });

  it('flags a stain call on toned vintage cardstock (1975 Topps McCovey, passes 1/1/7)', () => {
    const t = severeScoreTriggers({ ...base, passScores: { ...base.passScores, surface: [1, 1, 7] }, surfaceDefectTypes: ['stain', 'stain'] });
    expect(t).toHaveLength(1);
  });

  it('never re-checks deformation: dents, creases, fold lines, scratches', () => {
    for (const types of [['indentation'], ['crease'], ['print_line', 'indentation'], ['scratch']]) {
      expect(severeScoreTriggers({ ...base, surfaceDefectTypes: types })).toHaveLength(0);
    }
  });

  it('never re-checks corners or edges, however low', () => {
    const t = severeScoreTriggers({ ...base, scores: { corners: 2, edges: 2, surface: 9 }, passScores: { corners: [2, 9, 2], edges: [2, 9, 2], surface: [9, 9, 9] } });
    expect(t).toHaveLength(0);
  });

  it('re-checks a unanimous misread too (the same Espeon photo also came back 1/1/1)', () => {
    expect(severeScoreTriggers({ ...base, passScores: { ...base.passScores, surface: [1, 1, 1] } })).toHaveLength(1);
  });

  it('leaves agreed low scores on physical flaws alone', () => {
    expect(severeScoreTriggers({ ...base, passScores: { ...base.passScores, surface: [4, 4, 4] }, scores: { ...base.scores, surface: 4 }, surfaceDefectTypes: ['scratch', 'indentation'] })).toHaveLength(0);
  });

  it('needs a recorded flaw, a score of 4 or below, and no verified structural damage', () => {
    expect(severeScoreTriggers({ ...base, surfaceDefectTypes: [] })).toHaveLength(0);
    expect(severeScoreTriggers({ ...base, scores: { ...base.scores, surface: 5 } })).toHaveLength(0);
    expect(severeScoreTriggers({ ...base, structuralDetected: true })).toHaveLength(0);
  });
});

describe('low-score resolution', () => {
  const trigger: SevereTrigger = { cat: 'surface', score: 1, passScores: [1, 10, 1], spread: 9, zoomClean: true, reasons: [] };
  it('refuted takes the clean reading, bounded by a magnified-inspection cap', () => {
    expect(resolveSevereScore(trigger, { ok: true, confirmed: false, reason: '' }, null)).toBe(10);
    expect(resolveSevereScore(trigger, { ok: true, confirmed: false, reason: '' }, 8)).toBe(8);
  });
  it('a refuted unanimous misread reconciles to 9 only when the magnified inspection was clean', () => {
    const unanimous: SevereTrigger = { ...trigger, passScores: [1, 1, 1], spread: 0 };
    expect(resolveSevereScore(unanimous, { ok: true, confirmed: false, reason: '' }, null)).toBe(9);
    expect(resolveSevereScore({ ...unanimous, zoomClean: false }, { ok: true, confirmed: false, reason: '' }, null)).toBe(1);
  });
  it('confirmed or unknown keeps the score', () => {
    expect(resolveSevereScore(trigger, { ok: true, confirmed: true, reason: '' }, null)).toBe(1);
    expect(resolveSevereScore(trigger, { ok: false, confirmed: null, reason: '' }, null)).toBe(1);
  });
});

describe('neutral claims', () => {
  it('keeps category, face and location but drops the evaluation\'s conclusion', () => {
    const c = neutralClaim('surface front print line (heavy, front surface across the artwork): Blue handwritten lines cross the design');
    expect(c.face).toBe('front');
    expect(c.text).not.toMatch(/handwritten/i);
    expect(c.text).toMatch(/surface front print line/);
  });
});

describe('verifier vote tally', () => {
  it('records the reason from the winning side, not a dissenter', () => {
    const v = tallySevereVotes([answer('physical', 'hand-drawn line'), answer('printed_design', 'traces the outline'), answer('printed_design', 'under the text')]);
    expect(v.reason).toBe('traces the outline');
  });

  it('a signature majority is not damage and is flagged as a signature (autograph policy v9.23)', () => {
    const v = tallySevereVotes([answer('signature'), answer('signature'), answer('physical')]);
    expect(v).toMatchObject({ confirmed: false, signature: true });
    expect(tallySevereVotes([answer('physical'), answer('physical'), answer('signature')]).confirmed).toBe(true);
    expect(tallySevereVotes([answer('printed_design'), answer('printed_design'), answer('signature')]).signature).toBeUndefined();
  });

  it('counts an observation of printed text on top of the line as printed design', () => {
    const observed = (classification: string) => ({ finish_reason: 'stop',
      message: { content: JSON.stringify({ overlap: 'printed_text_on_top', follows_artwork: true, classification, reason: 'text over line' }) } });
    expect(tallySevereVotes([observed('physical'), observed('physical'), answer('physical')]).confirmed).toBe(false);
  });

  it('needs a majority, and three complete answers', () => {
    expect(tallySevereVotes([answer('printed_design'), answer('printed_design'), answer('physical')]).confirmed).toBe(false);
    expect(tallySevereVotes([answer('physical'), answer('physical'), answer('photo_artifact')]).confirmed).toBe(true);
    expect(tallySevereVotes([answer('physical'), answer('printed_design'), answer('cannot_tell')]).confirmed).toBeNull();
    expect(tallySevereVotes([answer('printed_design'), answer('printed_design')]).ok).toBe(false);
    expect(tallySevereVotes([answer('printed_design'), answer('bogus'), answer('printed_design')]).ok).toBe(false);
  });
});
