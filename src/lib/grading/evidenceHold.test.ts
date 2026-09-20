import { describe, expect, it } from 'vitest';
import { explainUncertaintyHold, holderPresent, letterUncertainty } from './evidenceHold';

const complete = { zoomComplete: true, clippedCorners: [] as string[], caseType: 'none' };

describe('when the confidence letter may hold a grade', () => {
  it('lets a C through when every magnified region was inspected, nothing is clipped and there is no holder', () => {
    expect(letterUncertainty({ ...complete, letter: 'C' })).toEqual({ value: 1, coverageOverrodeLetter: true });
  });

  it('keeps C holding the grade when the inspection did not complete', () => {
    expect(letterUncertainty({ ...complete, letter: 'C', zoomComplete: false })).toEqual({ value: 2, coverageOverrodeLetter: false });
  });

  it('keeps C holding the grade when a corner is out of frame', () => {
    expect(letterUncertainty({ ...complete, letter: 'C', clippedCorners: ['front top-left'] }).value).toBe(2);
  });

  it('leaves holders exactly as they were: that policy is the owner\'s to change', () => {
    for (const caseType of ['penny_sleeve', 'top_loader', 'semi_rigid', 'slab', 'one_touch']) {
      expect(letterUncertainty({ ...complete, letter: 'C', caseType }).value).toBe(2);
    }
  });

  it('never softens a D, whatever the coverage', () => {
    expect(letterUncertainty({ ...complete, letter: 'D' })).toEqual({ value: 3, coverageOverrodeLetter: false });
  });

  it('does not change A or B, and treats a missing letter as B', () => {
    expect(letterUncertainty({ ...complete, letter: 'A' }).value).toBe(0);
    expect(letterUncertainty({ ...complete, letter: 'b' }).value).toBe(1);
    expect(letterUncertainty({ ...complete, letter: null }).value).toBe(1);
  });

  it('reads "none", "unknown" and blank as no holder', () => {
    for (const none of ['none', 'NONE', 'unknown', '', null, undefined]) expect(holderPresent(none)).toBe(false);
    expect(holderPresent('penny_sleeve')).toBe(true);
  });
});

describe('saying why a grade was held', () => {
  const base = { ...complete, letter: 'C', structuralUncertainty: 0, passSpread: 0 };

  it('names the clipped corner, and says what to retake', () => {
    const hold = explainUncertaintyHold({ ...base, clippedCorners: ['front top-left', 'front top-right'] });
    expect(hold.cause).toBe('clipped_corner');
    expect(hold.reason).toContain('front top-left, front top-right');
    expect(hold.advice).toMatch(/whole card inside the frame/);
  });

  it('does not blame the photos when the evaluations simply disagreed', () => {
    const hold = explainUncertaintyHold({ ...base, letter: 'B', passSpread: 2 });
    expect(hold.cause).toBe('evaluations_disagree');
    expect(hold.reason).not.toMatch(/photo|clear/i);
  });

  it('reports unconfirmed damage ahead of a holder or soft photos', () => {
    expect(explainUncertaintyHold({ ...base, structuralUncertainty: 2, caseType: 'penny_sleeve' }).cause).toBe('possible_damage_unconfirmed');
  });

  it('blames the sleeve, not the photos, for a sleeved card', () => {
    const hold = explainUncertaintyHold({ ...base, caseType: 'penny_sleeve' });
    expect(hold.cause).toBe('holder');
    expect(hold.advice).toMatch(/outside the sleeve or holder/);
  });

  it('falls back to image quality only when nothing more specific applies', () => {
    const hold = explainUncertaintyHold({ ...base, letter: 'D' });
    expect(hold.cause).toBe('image_quality');
    expect(hold.reason).toBe('the photos are not clear enough to confirm a 10');
  });

  it('uses no em dashes or the word AI in anything a customer reads', () => {
    for (const hold of [
      explainUncertaintyHold({ ...base, clippedCorners: ['front top-left'] }),
      explainUncertaintyHold({ ...base, structuralUncertainty: 2 }),
      explainUncertaintyHold({ ...base, passSpread: 3 }),
      explainUncertaintyHold({ ...base, caseType: 'top_loader' }),
      explainUncertaintyHold(base),
    ]) expect(`${hold.reason} ${hold.advice ?? ''}`).not.toMatch(/—|–|\bAI\b/);
  });
});
