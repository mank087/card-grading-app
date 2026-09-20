/**
 * Out-of-frame detection. The geometry gate returns each face's corner quad in
 * 0–1000 normalised image coordinates (TL, TR, BR, BL). A card that runs out of
 * the picture cannot be inspected there, however confident the model sounds.
 *
 * Owner-verified Sept 17 2026: a card photographed with its front top-left corner
 * out of frame (quad corner at y=0) was graded 9–10 with image confidence B.
 *
 * REVISED Sept 20 2026. The first version flagged any corner within 0.6% of the
 * border, on the belief that fully framed cards "sit far inside this". They do
 * not: across 1,234 production cards the 5th-percentile card has its nearest
 * corner 0.4% from the border. The rule flagged 7.1% of all cards, and in 58% of
 * those flags every flagged corner was 2–6 units INSIDE the photo. Checked by eye,
 * that band is a mix — a complete card with margin on every side, a tight but
 * fully visible card, and one genuinely running off the bottom edge — so a smaller
 * tolerance alone would only trade one error for another.
 *
 * What separates them is shape, not distance:
 *   - a corner ON the border is cut off (the detector cannot place a point outside
 *     the photo, so a clipped corner clamps to the edge);
 *   - a whole EDGE at the border — both of its corners within the tolerance of the
 *     same side — means the card runs off that side, even though neither corner
 *     clamps exactly (the off-the-bottom card had both bottom corners at y=996);
 *   - ONE corner a few units inside, its neighbours well clear, is a slightly
 *     tilted or tightly framed card whose corners are all in the picture.
 */
export type QuadPoint = { x: number; y: number };

const CORNER_NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
/** A corner this close to the border has clamped to it. */
const ON_BORDER = 1;
/** An edge whose two corners are BOTH this close to the same side runs off that side. */
const EDGE_TOLERANCE = 6;

type Side = 'left' | 'right' | 'top' | 'bottom';
/** Quad index pairs sharing each side of the photo (TL=0, TR=1, BR=2, BL=3). */
const EDGES: Array<{ side: Side; corners: [number, number] }> = [
  { side: 'top', corners: [0, 1] },
  { side: 'right', corners: [1, 2] },
  { side: 'bottom', corners: [2, 3] },
  { side: 'left', corners: [3, 0] },
];

function distanceTo(side: Side, p: QuadPoint): number {
  if (side === 'left') return p.x;
  if (side === 'right') return 1000 - p.x;
  if (side === 'top') return p.y;
  return 1000 - p.y;
}

const valid = (p: QuadPoint | null | undefined): p is QuadPoint =>
  !!p && typeof p.x === 'number' && typeof p.y === 'number';

/** The first rule: any corner within 0.6% of the border. Still the one in force. */
const LEGACY_TOLERANCE = 6;

/**
 * `shapeRule` selects the revised rule described above. It is OFF unless
 * GRADING_EVIDENCE_V2=1. The revised rule only ever removes flags, but of four cards it
 * would release that were checked by eye, three had a corner touching the frame edge, and
 * the card outline itself comes from a model and is only accurate to a few percent. It
 * waits for the same measured-quality work as the letter override.
 */
export function clippedCorners(
  quad: QuadPoint[] | null | undefined,
  face: 'front' | 'back',
  shapeRule: boolean = process.env.GRADING_EVIDENCE_V2 === '1',
): string[] {
  if (!Array.isArray(quad) || quad.length !== 4 || !quad.every(valid)) return [];
  if (!shapeRule) {
    return quad.flatMap((p, i) => (['left', 'right', 'top', 'bottom'] as Side[]).some(side => distanceTo(side, p) <= LEGACY_TOLERANCE)
      ? [`${face} ${CORNER_NAMES[i]}`] : []);
  }
  const clipped = new Set<number>();

  quad.forEach((p, i) => {
    if ((['left', 'right', 'top', 'bottom'] as Side[]).some(side => distanceTo(side, p) <= ON_BORDER)) clipped.add(i);
  });
  for (const { side, corners: [a, b] } of EDGES) {
    if (distanceTo(side, quad[a]) <= EDGE_TOLERANCE && distanceTo(side, quad[b]) <= EDGE_TOLERANCE) {
      clipped.add(a); clipped.add(b);
    }
  }
  return [...clipped].sort((x, y) => x - y).map(i => `${face} ${CORNER_NAMES[i]}`);
}

/** One clipped corner caps image confidence at C; two or more at D. Never raises it. */
export function confidenceWithClipping(letter: string | null | undefined, clipped: string[]): string {
  const current = String(letter || 'B').toUpperCase();
  if (clipped.length === 0) return current;
  const floor = clipped.length >= 2 ? 'D' : 'C';
  return current > floor ? current : floor; // 'A' < 'B' < 'C' < 'D'
}
