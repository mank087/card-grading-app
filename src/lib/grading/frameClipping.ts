/**
 * Out-of-frame detection. The geometry gate returns each face's corner quad in
 * 0–1000 normalised image coordinates (TL, TR, BR, BL). A corner sitting ON the
 * photo border means the card runs out of the picture there — that corner (and
 * the edges meeting it) cannot be inspected, however confident the model sounds.
 *
 * Owner-verified Sept 17 2026: a card photographed with its front top-left corner
 * out of frame (quad corner at y=0) was graded 9–10 with image confidence B.
 */
export type QuadPoint = { x: number; y: number };

const CORNER_NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
/** Within 0.6% of the border. Located corners of fully framed cards sit far inside this. */
const BORDER_TOLERANCE = 6;

export function clippedCorners(quad: QuadPoint[] | null | undefined, face: 'front' | 'back'): string[] {
  if (!Array.isArray(quad) || quad.length !== 4) return [];
  return quad.flatMap((p, i) => {
    const onBorder = [p?.x, p?.y].some(v => typeof v === 'number' && (v <= BORDER_TOLERANCE || v >= 1000 - BORDER_TOLERANCE));
    return onBorder ? [`${face} ${CORNER_NAMES[i]}`] : [];
  });
}

/** One clipped corner caps image confidence at C; two or more at D. Never raises it. */
export function confidenceWithClipping(letter: string | null | undefined, clipped: string[]): string {
  const current = String(letter || 'B').toUpperCase();
  if (clipped.length === 0) return current;
  const floor = clipped.length >= 2 ? 'D' : 'C';
  return current > floor ? current : floor; // 'A' < 'B' < 'C' < 'D'
}
