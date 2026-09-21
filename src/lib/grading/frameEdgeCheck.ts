/**
 * Is the card really cut off by the edge of the photo? Ask the pixels.
 *
 * WHY. frameClipping.ts decides "out of frame" from a card outline that a model
 * estimates, and that outline is only accurate to a few percent. It is then asked to
 * be right to a fraction of one. The cost of being wrong is high: two flagged corners
 * force image confidence to D, which blocks a 10.
 *
 * The case that exposed it (owner report, Sept 21 2026): a Toxtricity scanned on a
 * flatbed, all three evaluations 10/10/10, every one of 40 magnified regions inspected,
 * no holder. The outline put both bottom corners of the back at y = 1000 of 1000, so the
 * card was called clipped, given a D and held at 9. The scan shows the whole card with
 * white margin beneath it. The best input a customer can provide was punished for an
 * estimate that was off by about 3%.
 *
 * THE TEST. A card that runs off one side of a photo has CARD at the very edge of the
 * image there. A complete card has BACKGROUND there: the same desk, mat or scanner lid
 * visible along the other sides. So for each side the outline flags, the outermost strip
 * of the image is compared with the background seen along the sides where the outline
 * says the card sits well inside. If the strip looks like that background, the card is
 * not clipped on that side, whatever the outline says.
 *
 * It only ever REMOVES a flag. When it cannot tell (no side has a usable margin, the
 * image cannot be read), the flag stands, exactly as before.
 */

import sharp from 'sharp';
import type { QuadPoint } from './frameClipping';

type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
/** Quad indices (TL, TR, BR, BL) of the two corners on each side. */
const SIDE_CORNERS: Record<Side, [number, number]> = { top: [0, 1], right: [1, 2], bottom: [2, 3], left: [3, 0] };
const CORNER_NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

const WORK_EDGE = 900;          // analysis resolution, long edge
const STRIP_FRACTION = 0.008;   // the outermost 0.8% of the image is "the edge"
const MIN_MARGIN = 18;          // of 1000: a side needs this much room to show background
const SEGMENTS = 12;            // the flagged edge is judged piece by piece, not as one average
const MAX_COLOR_DISTANCE = 24;  // RGB distance at which a segment stops looking like background
const MIN_MATCHING = 0.92;      // share of segments that must look like background to clear a side
const SIDE_AGREEMENT = 45;      // two sides whose average colours are this close are showing the same background
/**
 * Why segments, and why the reference is only the outermost sliver of the OTHER sides
 * (first version, checked by eye on 9 cleared sides, Sept 21 2026: 3 were wrong).
 *  - The reference used to be the whole margin the outline claimed. The outline is the
 *    unreliable thing, so that "margin" sometimes contained card, and a cut-off card then
 *    matched it.
 *  - One average over the flagged edge hid a cut-off card: red panel + green field + white
 *    text averaged out close to a brown table. Piece by piece they match nothing.
 */

function distanceTo(side: Side, p: QuadPoint): number {
  if (side === 'left') return p.x;
  if (side === 'right') return 1000 - p.x;
  if (side === 'top') return p.y;
  return 1000 - p.y;
}

interface Region { left: number; top: number; width: number; height: number }
interface Stats { mean: [number, number, number]; spread: number }

interface Pixels { data: Buffer; width: number; height: number; channels: number }

/**
 * Mean colour and texture of one region, computed from the raw pixels.
 * NOT sharp's stats(): that reports on the whole input image and ignores extract(), so
 * every region came back identical and every strip "matched" the background perfectly.
 * The first replay cleared 99 of 107 cards with a colour distance of exactly 0 on all 139
 * sides, including a card known to run off the frame. Caught by looking, Sept 21 2026.
 */
function stats(image: Pixels, region: Region): Stats | null {
  const left = Math.max(0, region.left), top = Math.max(0, region.top);
  const right = Math.min(image.width, region.left + region.width), bottom = Math.min(image.height, region.top + region.height);
  if (right - left < 2 || bottom - top < 2) return null;
  const sum = [0, 0, 0], sq = [0, 0, 0]; let n = 0;
  for (let y = top; y < bottom; y++) {
    let i = (y * image.width + left) * image.channels;
    for (let x = left; x < right; x++, i += image.channels) {
      for (let c = 0; c < 3; c++) { const v = image.data[i + c]; sum[c] += v; sq[c] += v * v; }
      n++;
    }
  }
  const mean: [number, number, number] = [sum[0] / n, sum[1] / n, sum[2] / n];
  const spread = [0, 1, 2].reduce((acc, c) => acc + Math.sqrt(Math.max(0, sq[c] / n - mean[c] * mean[c])), 0) / 3;
  return { mean, spread };
}

const colorDistance = (a: Stats, b: Stats) => Math.hypot(a.mean[0] - b.mean[0], a.mean[1] - b.mean[1], a.mean[2] - b.mean[2]);

/** The band of image between the photo's edge and the card, along one side, clear of the corners. */
function marginRegion(side: Side, quad: QuadPoint[], W: number, H: number, depthUnits: number): Region {
  const [a, b] = SIDE_CORNERS[side];
  const horizontal = side === 'top' || side === 'bottom';
  const lo = Math.min(horizontal ? quad[a].x : quad[a].y, horizontal ? quad[b].x : quad[b].y);
  const hi = Math.max(horizontal ? quad[a].x : quad[a].y, horizontal ? quad[b].x : quad[b].y);
  const inset = (hi - lo) * 0.12;
  const from = (lo + inset) / 1000, to = (hi - inset) / 1000;
  const depth = depthUnits / 1000;
  if (horizontal) {
    const height = Math.max(2, Math.round(H * depth));
    return { left: Math.round(W * from), top: side === 'top' ? 0 : H - height, width: Math.max(2, Math.round(W * (to - from))), height };
  }
  const width = Math.max(2, Math.round(W * depth));
  return { left: side === 'left' ? 0 : W - width, top: Math.round(H * from), width, height: Math.max(2, Math.round(H * (to - from))) };
}

/** A strip cut into SEGMENTS pieces along its length, each with its own colour. */
function segments(image: Pixels, region: Region, side: Side): Stats[] {
  const horizontal = side === 'top' || side === 'bottom';
  const length = horizontal ? region.width : region.height;
  const step = length / SEGMENTS;
  const out: Stats[] = [];
  for (let k = 0; k < SEGMENTS; k++) {
    const piece: Region = horizontal
      ? { left: Math.round(region.left + k * step), top: region.top, width: Math.max(2, Math.round(step)), height: region.height }
      : { left: region.left, top: Math.round(region.top + k * step), width: region.width, height: Math.max(2, Math.round(step)) };
    const s = stats(image, piece);
    if (s) out.push(s);
  }
  return out;
}

export interface EdgeCheckResult {
  /** Corner labels that remain out of frame after looking at the pixels. */
  clipped: string[];
  /** Corner labels the outline flagged that the pixels cleared. */
  cleared: string[];
  /** Per flagged side, for the audit record: colorDistance is the WORST segment, textureRatio the share of segments that matched. */
  sides: Array<{ side: Side; verdict: 'background' | 'card' | 'unknown'; colorDistance?: number; textureRatio?: number }>;
}

/**
 * Re-examine the corners `flagged` on one face. `flagged` are labels such as
 * "back bottom-left", as produced by clippedCorners(). Never throws.
 */
export async function verifyClippedCorners(
  image: Buffer | null | undefined,
  quad: QuadPoint[] | null | undefined,
  face: 'front' | 'back',
  flagged: string[],
): Promise<EdgeCheckResult> {
  const mine = flagged.filter(label => label.startsWith(face + ' '));
  const unchanged: EdgeCheckResult = { clipped: mine, cleared: [], sides: [] };
  if (!mine.length || !image?.length || !Array.isArray(quad) || quad.length !== 4) return unchanged;

  try {
    const base = sharp(image, { failOn: 'none' }).rotate().resize({ width: WORK_EDGE, height: WORK_EDGE, fit: 'inside', withoutEnlargement: true }).removeAlpha().raw();
    const { data, info } = await base.toBuffer({ resolveWithObject: true });
    const work: Pixels = { data, width: info.width, height: info.height, channels: info.channels };
    const [W, H] = [info.width, info.height];

    // Background, sampled piece by piece from the OUTERMOST sliver of each side where the
    // outline leaves real room. Pieces, because a wood table or woven cloth is many colours.
    const bySide: Array<{ side: Side; pieces: Stats[]; mean: Stats }> = [];
    for (const side of SIDES) {
      const [a, b] = SIDE_CORNERS[side];
      const room = Math.min(distanceTo(side, quad[a]), distanceTo(side, quad[b]));
      if (room < MIN_MARGIN) continue;
      const pieces = segments(work, marginRegion(side, quad, W, H, Math.min(room * 0.35, 10)), side);
      if (pieces.length < SEGMENTS / 2) continue;
      const mean: Stats = { mean: [0, 1, 2].map(c => pieces.reduce((t, p) => t + p.mean[c], 0) / pieces.length) as [number, number, number], spread: 0 };
      bySide.push({ side, pieces, mean });
    }
    // CORROBORATION. The outline's claim that a side has margin is itself unreliable: a
    // white-bordered Jordan ran off the top AND the left of its photo, the outline said the
    // left had room, the left sliver (card border) became "background", and the clipped top
    // matched it (checked by eye, Sept 21 2026). So a side only counts as background when at
    // least one OTHER side agrees with it. Bottom and right both said "wood"; the white left
    // side agreed with nobody. With fewer than two agreeing sides the flag stands.
    const agreeing = bySide.filter(a => bySide.some(b => b !== a && colorDistance(a.mean, b.mean) <= SIDE_AGREEMENT));
    if (agreeing.length < 2) return unchanged;
    const references: Stats[] = agreeing.flatMap(a => a.pieces);

    const flaggedIndex = new Set(mine.map(label => CORNER_NAMES.indexOf(label.slice(face.length + 1) as typeof CORNER_NAMES[number])));
    const sideVerdict = new Map<Side, 'background' | 'card' | 'unknown'>();
    const sides: EdgeCheckResult['sides'] = [];
    for (const side of SIDES) {
      const [a, b] = SIDE_CORNERS[side];
      const near = [a, b].filter(i => flaggedIndex.has(i) && distanceTo(side, quad[i]) <= 6);
      if (!near.length) continue;
      const pieces = segments(work, marginRegion(side, quad, W, H, STRIP_FRACTION * 1000), side);
      if (pieces.length < SEGMENTS / 2) { sideVerdict.set(side, 'unknown'); sides.push({ side, verdict: 'unknown' }); continue; }
      const distances = pieces.map(piece => Math.min(...references.map(ref => colorDistance(piece, ref))));
      const matching = distances.filter(d => d <= MAX_COLOR_DISTANCE).length / pieces.length;
      const verdict = matching >= MIN_MATCHING ? 'background' : 'card';
      sideVerdict.set(side, verdict);
      sides.push({ side, verdict, colorDistance: Math.round(Math.max(...distances)), textureRatio: Number(matching.toFixed(2)) });
    }

    // A corner is cleared only if EVERY side it was flagged against shows background.
    const cleared: string[] = [], clipped: string[] = [];
    for (const label of mine) {
      const i = CORNER_NAMES.indexOf(label.slice(face.length + 1) as typeof CORNER_NAMES[number]);
      const touching = SIDES.filter(side => SIDE_CORNERS[side].includes(i) && distanceTo(side, quad[i]) <= 6);
      const ok = touching.length > 0 && touching.every(side => sideVerdict.get(side) === 'background');
      (ok ? cleared : clipped).push(label);
    }
    return { clipped, cleared, sides };
  } catch {
    return unchanged;
  }
}
