import { describe, expect, it } from 'vitest';
import { severeScoreTriggers, resolveSevereScore, tallySevereVotes, neutralClaim, type SevereTrigger } from './severeScoreCheck';

const base = {
  scores: { corners: 10, edges: 10, surface: 1 },
  passScores: { corners: [10, 10, 10], edges: [10, 10, 10], surface: [1, 10, 1] },
  zoomDefectCategories: new Set<string>(),
  structuralDetected: false,
};
const answer = (classification: string, reason = 'seen') => ({
  finish_reason: 'stop', message: { content: JSON.stringify({ classification, reason }) },
});

describe('low-score verification triggers', () => {
  it('flags the Espeon case: surface 1 with passes 1/10/1 and a clean magnified inspection', () => {
    const [t, ...rest] = severeScoreTriggers(base);
    expect(rest).toHaveLength(0);
    expect(t).toMatchObject({ cat: 'surface', score: 1, spread: 9, zoomClean: true });
  });

  it('leaves agreed, corroborated low scores alone', () => {
    const agreed = severeScoreTriggers({ ...base, passScores: { ...base.passScores, surface: [1, 2, 1] }, zoomDefectCategories: new Set(['surface']) });
    expect(agreed).toHaveLength(0);
  });

  it('does not re-check scores above 4, or surface held by verified structural damage', () => {
    expect(severeScoreTriggers({ ...base, scores: { ...base.scores, surface: 5 } })).toHaveLength(0);
    expect(severeScoreTriggers({ ...base, structuralDetected: true })).toHaveLength(0);
  });

  it('treats a missing magnified inspection as no evidence either way', () => {
    const t = severeScoreTriggers({ ...base, passScores: { ...base.passScores, surface: [1, 2, 1] }, zoomDefectCategories: null });
    expect(t).toHaveLength(0);
  });
});

describe('low-score resolution', () => {
  const trigger: SevereTrigger = { cat: 'surface', score: 1, passScores: [1, 10, 1], spread: 9, zoomClean: true, reasons: [] };
  it('refuted takes the clean reading, bounded by a magnified-inspection cap', () => {
    expect(resolveSevereScore(trigger, { ok: true, confirmed: false, reason: '' }, null)).toBe(10);
    expect(resolveSevereScore(trigger, { ok: true, confirmed: false, reason: '' }, 8)).toBe(8);
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
