/**
 * Confidence letter A floor (Oct 16 2026).
 *
 * The evaluations almost never answer A: this week A was 1% of grades (39% in
 * July) while 45% of photo sets were objectively clean - both faces sharp, no
 * holder, Laplacian variance >= 4000, card >= 45% of the frame, and the
 * grading model's own image_quality flags saying focus ok, lighting ok, no
 * glare. The rubric rewrite (v9.46) moved A from 1 to 5 of 40 runs on those
 * sets; the model still writes B for "slight softness near the perimeter" on
 * nearly every phone photo.
 *
 * So the letter is settled from evidence when the evidence is unambiguous: a
 * B whose photos meet every objective condition becomes A (±0). Nothing else
 * changes - C and D are never raised (a C still blocks a 10), a B with any
 * failed condition stays B, and the grade itself is untouched (the letter is
 * a reliability indicator, not a score input). Measured on 240 grades from
 * Oct 13-16: 30 (13%) would move B -> A. LETTER_A_FLOOR_V1=0 switches it off.
 */

export const LETTER_FLOOR_MIN_BLUR = 4000;
export const LETTER_FLOOR_MIN_FILL = 45;

export function letterFloorEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.LETTER_A_FLOOR_V1 ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'off' || v === 'false');
}

export interface LetterFloorInput {
  letter: string | null | undefined;
  imageQuality: { focus_ok?: unknown; glare_present?: unknown; lighting_ok?: unknown } | null | undefined;
  caseType: string | null | undefined;
  /** Card fill of the frame per face, percent; null when the outline was not measured. */
  fill: { front: number | null; back: number | null };
  /** Laplacian variance of each original; null when unmeasurable. */
  blur: { front: number | null; back: number | null };
  clippedCorners: string[];
}

export interface LetterFloorResult {
  letter: string;
  applied: boolean;
  /** The first condition that failed, for the log; empty when applied. */
  blockedBy: string;
}

/** Pure. B -> A when every objective condition holds; anything else unchanged. */
export function applyLetterFloor(input: LetterFloorInput): LetterFloorResult {
  const letter = String(input.letter || 'B').toUpperCase();
  const keep = (why: string): LetterFloorResult => ({ letter, applied: false, blockedBy: why });
  if (letter !== 'B') return keep(letter === 'A' ? 'already A' : `letter ${letter} is never raised`);
  const iq = input.imageQuality || {};
  if (iq.focus_ok !== true) return keep('model focus_ok not true');
  if (iq.glare_present !== false) return keep('model glare_present not false');
  if (iq.lighting_ok !== true) return keep('model lighting_ok not true');
  const caseType = String(input.caseType || 'none').toLowerCase();
  if (caseType !== 'none') return keep(`holder ${caseType}`);
  if (input.clippedCorners.length > 0) return keep('corner out of frame');
  for (const face of ['front', 'back'] as const) {
    const fill = input.fill[face];
    if (typeof fill !== 'number' || fill < LETTER_FLOOR_MIN_FILL) return keep(`${face} fill ${fill ?? 'unmeasured'} < ${LETTER_FLOOR_MIN_FILL}`);
    const blur = input.blur[face];
    if (typeof blur !== 'number' || blur < LETTER_FLOOR_MIN_BLUR) return keep(`${face} blur ${blur == null ? 'unmeasured' : Math.round(blur)} < ${LETTER_FLOOR_MIN_BLUR}`);
  }
  return { letter: 'A', applied: true, blockedBy: '' };
}
