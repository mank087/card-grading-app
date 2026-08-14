/**
 * Enterprise logo sizing for the MODERN label family.
 *
 * Heritage sizes its bottom-centre mark against the fitted text stack
 * (heritageMarkBox); modern labels are a different problem. The mark sits in a
 * square slot on the left of a single row, so growing it is bounded by the
 * label's HEIGHT first — the slot is already 55% of it — and it steals width
 * from the text region, which the text fitter then absorbs by shrinking fonts.
 *
 * The cap below keeps the mark inside the label's vertical padding, which in
 * practice limits the useful range to about 1.5x. A store that sets 200% in
 * Brand Setup gets the largest mark this layout can hold rather than one that
 * bleeds past the edge; the Heritage style is where a big square logo really
 * has room to breathe.
 */

/** The mark may occupy at most this fraction of the label's height. */
const MAX_HEIGHT_FRACTION = 0.82;

/** The print slot's share of label height at scale 1 (LOGO_SIZE = 55% of it). */
const BASE_HEIGHT_FRACTION = 0.55;

/**
 * The largest multiplier the modern layout can actually honour, ~1.49.
 *
 * Screen and print start from different base slot sizes (the web label is
 * taller relative to its logo than the 2.8x0.8 print label), so a shared PIXEL
 * cap would cap them at different effective sizes and the preview would lie.
 * Both sides clamp the MULTIPLIER to this instead.
 */
export const MODERN_LOGO_MAX_SCALE = MAX_HEIGHT_FRACTION / BASE_HEIGHT_FRACTION;

/** The multiplier the modern label will actually apply for a requested scale. */
export function modernLogoScale(scale: number | undefined): number {
  const s = Number.isFinite(scale) && (scale as number) > 0 ? (scale as number) : 1;
  return Math.min(s, MODERN_LOGO_MAX_SCALE);
}

/**
 * @param baseSize   the stock slot size, in the caller's own units
 * @param labelHeight the label's height in those same units
 * @param scale      the org's Brand Setup multiplier (1 = stock)
 */
export function modernLogoSize(baseSize: number, labelHeight: number, scale: number | undefined): number {
  const s = modernLogoScale(scale);
  if (s === 1) return baseSize;
  // Clamp by multiplier AND by the label's own height: the multiplier ceiling
  // is derived from the print slot's proportions, so a caller whose base slot
  // is proportionally larger still can't overflow its label.
  return Math.min(baseSize * s, labelHeight * MAX_HEIGHT_FRACTION);
}
