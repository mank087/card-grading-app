/**
 * Corner close-up tiles for the card detail pages.
 *
 * The old tiles zoomed the outer 20% of the RAW photo. Customer photos are phone
 * shots on a mat where the card covers ~45-55% of the frame, so every tile was
 * mat. The grading engine already locates the card: its geometry gate
 * (zoomInspection.detectCardGeometry) stores both faces' corner quads in
 * `cards.capture_quality` (captureQualityLog.ts):
 *
 *   capture_quality.front.quad = [{x,y} TL, TR, BR, BL]   normalized 0-1000
 *   capture_quality.front.fill_percent = 0-100
 *
 * This turns that reading into one crop per corner, centred just inside the
 * detected card corner. Pure math — no image dimensions needed: every value is
 * a fraction of the image, and `size` is a fraction of the image WIDTH so the
 * renderer can keep square pixels (see CornerZoomCrops for how).
 *
 * No usable quad → null (the caller hides the tiles), with one exception: a
 * recorded fill of FULL_FRAME_FILL_PERCENT or more means the card IS most of
 * the frame, so the frame corners are the card corners and the old crop is
 * honest. Cards graded before capture_quality existed get no tiles: showing
 * four squares of mat under "Corner Close-ups" misrepresents condition
 * evidence, while hiding them loses nothing — the full photo is right above.
 *
 * dcm-mobile/lib/cornerTiles.ts is a copy of this file (separate package).
 */

export type TilePt = { x: number; y: number };

export interface CornerTile {
  key: 'tl' | 'tr' | 'bl' | 'br';
  label: 'Top Left' | 'Top Right' | 'Bottom Left' | 'Bottom Right';
  /** Tile centre as a fraction of image width / height (0-1). */
  cx: number;
  cy: number;
  /** Tile side as a fraction of the image WIDTH. */
  size: number;
}

/** Tile side as a share of the card's width (the engine's own crops use 0.30). */
export const TILE_CARD_WIDTH_SHARE = 0.28;
/** How far the tile centre moves from the corner toward the card centre. */
export const INWARD_SHIFT = 0.12;
/** At or above this recorded fill, frame corners stand in for card corners. */
export const FULL_FRAME_FILL_PERCENT = 85;

const FULL_FRAME_QUAD: TilePt[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

/** Same sanity check the engine applies (zoomInspection.quadPlausible). */
export function quadPlausible(quad: unknown, minFrac = 0.10, maxFrac = 0.95): quad is TilePt[] {
  if (!Array.isArray(quad) || quad.length !== 4) return false;
  const q = quad as TilePt[];
  if (!q.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 1000)) return false;
  // TL → TR → BR → BL must form a convex, consistently ordered polygon.
  if (!q.every((a, i) => {
    const b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0;
  })) return false;
  const area = Math.abs((q[0].x * (q[1].y - q[3].y) + q[1].x * (q[2].y - q[0].y) + q[2].x * (q[3].y - q[1].y) + q[3].x * (q[0].y - q[2].y)) / 2);
  const frac = area / (1000 * 1000);
  return frac >= minFrac && frac <= maxFrac;
}

/** Tiles from a plausible normalized quad (TL, TR, BR, BL). */
export function tilesFromQuad(quad: TilePt[]): CornerTile[] {
  const [tl, tr, br, bl] = quad.map(p => ({ x: p.x / 1000, y: p.y / 1000 }));
  const mx = (tl.x + tr.x + br.x + bl.x) / 4;
  const my = (tl.y + tr.y + br.y + bl.y) / 4;
  // Horizontal extent in image-width units (aspect-free; photos are near-upright).
  const cardWidth = (Math.abs(tr.x - tl.x) + Math.abs(br.x - bl.x)) / 2;
  const size = cardWidth * TILE_CARD_WIDTH_SHARE;
  const tile = (key: CornerTile['key'], label: CornerTile['label'], c: TilePt): CornerTile => ({
    key,
    label,
    cx: c.x + (mx - c.x) * INWARD_SHIFT,
    cy: c.y + (my - c.y) * INWARD_SHIFT,
    size,
  });
  return [
    tile('tl', 'Top Left', tl),
    tile('tr', 'Top Right', tr),
    tile('bl', 'Bottom Left', bl),
    tile('br', 'Bottom Right', br),
  ];
}

function parseCaptureQuality(captureQuality: unknown): any {
  if (typeof captureQuality !== 'string') return captureQuality;
  try { return JSON.parse(captureQuality); } catch { return null; }
}

/**
 * The corner-geometry slice of `capture_quality` (quad + fill per face), for
 * payloads that should not carry the rest of the gate record.
 */
export function pickCornerGeometry(captureQuality: unknown): { front: { quad: unknown; fill_percent: unknown } | null; back: { quad: unknown; fill_percent: unknown } | null } | null {
  const cq = parseCaptureQuality(captureQuality);
  if (!cq || typeof cq !== 'object') return null;
  const face = (f: any) => (f && typeof f === 'object' ? { quad: f.quad ?? null, fill_percent: f.fill_percent ?? null } : null);
  return { front: face(cq.front), back: face(cq.back) };
}

/**
 * Tiles for one face from a card's `capture_quality`, or null when the card's
 * corners are unknown (the caller then shows no tiles).
 */
export function resolveCornerTiles(captureQuality: unknown, side: 'front' | 'back'): CornerTile[] | null {
  const cq = parseCaptureQuality(captureQuality);
  const face = cq && typeof cq === 'object' ? cq[side] : null;
  if (!face || typeof face !== 'object') return null;
  if (quadPlausible(face.quad)) return tilesFromQuad(face.quad);
  const fill = Number(face.fill_percent);
  if (face.fill_percent != null && Number.isFinite(fill) && fill >= FULL_FRAME_FILL_PERCENT) {
    return tilesFromQuad(FULL_FRAME_QUAD);
  }
  return null;
}
