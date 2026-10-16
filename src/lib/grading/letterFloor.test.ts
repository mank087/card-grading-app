import { describe, expect, it } from 'vitest';
import { applyLetterFloor, letterFloorEnabled, LETTER_FLOOR_MIN_BLUR, LETTER_FLOOR_MIN_FILL, type LetterFloorInput } from './letterFloor';

const clean = (over: Partial<LetterFloorInput> = {}): LetterFloorInput => ({
  letter: 'B',
  imageQuality: { focus_ok: true, glare_present: false, lighting_ok: true },
  caseType: 'none',
  fill: { front: 56, back: 55 },
  blur: { front: 7865, back: 7119 },
  clippedCorners: [],
  ...over,
});

describe('letter A floor', () => {
  it('is on by default and off only when told', () => {
    expect(letterFloorEnabled({})).toBe(true);
    expect(letterFloorEnabled({ LETTER_A_FLOOR_V1: '0' })).toBe(false);
    expect(letterFloorEnabled({ LETTER_A_FLOOR_V1: 'off' })).toBe(false);
  });

  it('raises a B to A when every objective condition holds (Matt Wells shape)', () => {
    expect(applyLetterFloor(clean())).toEqual({ letter: 'A', applied: true, blockedBy: '' });
  });

  it('never raises C or D, and leaves A alone', () => {
    expect(applyLetterFloor(clean({ letter: 'C' }))).toMatchObject({ letter: 'C', applied: false });
    expect(applyLetterFloor(clean({ letter: 'D' }))).toMatchObject({ letter: 'D', applied: false });
    expect(applyLetterFloor(clean({ letter: 'A' }))).toMatchObject({ letter: 'A', applied: false });
    expect(applyLetterFloor(clean({ letter: 'b' })).letter).toBe('A'); // case-insensitive
  });

  it('keeps B when the model flagged glare, soft focus or poor light', () => {
    expect(applyLetterFloor(clean({ imageQuality: { focus_ok: true, glare_present: true, lighting_ok: true } })).blockedBy).toMatch(/glare/);
    expect(applyLetterFloor(clean({ imageQuality: { focus_ok: false, glare_present: false, lighting_ok: true } })).blockedBy).toMatch(/focus/);
    expect(applyLetterFloor(clean({ imageQuality: { focus_ok: true, glare_present: false, lighting_ok: false } })).blockedBy).toMatch(/lighting/);
    expect(applyLetterFloor(clean({ imageQuality: null })).applied).toBe(false);
  });

  it('keeps B for any holder, a clipped corner, a small card or soft pixels, and when a measure is missing', () => {
    expect(applyLetterFloor(clean({ caseType: 'penny_sleeve' })).blockedBy).toMatch(/holder/);
    expect(applyLetterFloor(clean({ caseType: 'top_loader' })).applied).toBe(false);
    expect(applyLetterFloor(clean({ clippedCorners: ['front top-left'] })).blockedBy).toMatch(/out of frame/);
    expect(applyLetterFloor(clean({ fill: { front: 56, back: LETTER_FLOOR_MIN_FILL - 1 } })).blockedBy).toMatch(/back fill/);
    expect(applyLetterFloor(clean({ blur: { front: LETTER_FLOOR_MIN_BLUR - 1, back: 9000 } })).blockedBy).toMatch(/front blur/);
    expect(applyLetterFloor(clean({ fill: { front: null, back: 55 } })).blockedBy).toMatch(/unmeasured/);
    expect(applyLetterFloor(clean({ blur: { front: 9000, back: null } })).blockedBy).toMatch(/unmeasured/);
  });

  it('the Slowpoke shape (top loader, soft, 35% fill) stays where the model put it', () => {
    expect(applyLetterFloor(clean({ letter: 'C', caseType: 'top_loader', fill: { front: 33, back: 35 }, blur: { front: 1487, back: 1052 }, imageQuality: { focus_ok: false, glare_present: true, lighting_ok: false } })).letter).toBe('C');
  });
});
