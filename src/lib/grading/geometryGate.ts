/**
 * Geometry gate request/response helpers (card outline, Oct 2026).
 *
 * ROOT CAUSE THIS FIXES (measured Oct 12 2026, 41 hand-checked card fronts):
 * the gate used to send the full-resolution photo and ask for corners in
 * NORMALIZED 0-1000 coordinates. gpt-5.6-luna intermittently returns y values
 * multiplied by ~0.89 on 3:4 photos (~0.92 on 5:7) while x stays right — the
 * outline is uniformly squashed toward the top of the photo (McGwire ed0ea559:
 * card y 353-702, outline 324-646; ratio 0.92 on BOTH edges). 16 of 42 recent
 * fronts had it. Our coordinate math (y/1000*H) was correct; the model's
 * normalized frame was not. Rewording the request in 0-1000 terms did not help
 * (bottom-edge error 4.9% of card height, same as production).
 *
 * THE FIX: send a copy we downscaled ourselves to a size the vision encoder
 * will not resample (long edge ≤1024, short edge ≤768 — detail:'high' keeps it
 * as is), state its exact pixel size, and ask for PIXEL coordinates in that
 * image. Converting back to 0-1000 is then our arithmetic, not the model's.
 * Same 41 fronts: bottom-edge error 4.9% → 0.6% of card height, faces with any
 * edge off by >6%: 17 → 2 (two independent runs agreed).
 *
 * Output contract is unchanged: quads stay [TL, TR, BR, BL] in 0-1000
 * coordinates of the RAW (un-rotated) original, which is what the zoom crops,
 * CV centering and display crop all read.
 */
import sharp from 'sharp';
import { CARD_ASPECT } from '../images/displayCrop';

export type Pt = { x: number; y: number };

/** The gate copy fits inside this box, so detail:'high' sends it unresampled. */
export const GATE_MAX_LONG_EDGE = 1024;
export const GATE_MAX_SHORT_EDGE = 768;

export interface GateImage {
  /** JPEG bytes of the downscaled copy, base64. */
  b64: string;
  /** Size of the copy the model sees (pixel coordinates are in this frame). */
  width: number;
  height: number;
}

/** Size of the gate copy for a raw image of w x h (never enlarged). */
export function gateSize(w: number, h: number): { width: number; height: number } {
  const long = Math.max(w, h), short = Math.min(w, h);
  const scale = Math.min(1, GATE_MAX_LONG_EDGE / long, GATE_MAX_SHORT_EDGE / short);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Downscale for the gate. Raw pixel orientation is kept on purpose (no EXIF
 * auto-rotate, metadata stripped): every consumer of the quad reads raw pixels.
 */
export async function prepareGateImage(buf: Buffer): Promise<GateImage> {
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  if (!meta.width || !meta.height) throw new Error('Geometry gate: unreadable image');
  const size = gateSize(meta.width, meta.height);
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .resize(size.width, size.height, { fit: 'fill' })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  return { b64: data.toString('base64'), width: info.width, height: info.height };
}

export function geometryGateSystemPrompt(front: { width: number; height: number }, back: { width: number; height: number }): string {
  return 'You locate a trading card in each photo. Reply ONLY with JSON:\n' +
    '{"front_fill_percent": <0-100>, "front_corners": [{"x":<px>,"y":<px>} x4], "back_fill_percent": <0-100>, "back_corners": [{"x":<px>,"y":<px>} x4]}\n' +
    'fill_percent = share of the image area covered by the card itself (not sleeve/holder/background).\n' +
    'corners = the four outer corners of the PHYSICAL card (the cut edge of the card stock, including its whole border — not a sleeve, toploader, stand or holder, and not an inner printed frame), ' +
    `as PIXEL coordinates in the image exactly as given: Photo 1 is ${front.width} px wide and ${front.height} px tall, Photo 2 is ${back.width} px wide and ${back.height} px tall; x from the left edge, y from the top edge. ` +
    'Order [top-left, top-right, bottom-right, bottom-left]. Check the bottom corners as carefully as the top ones: the card ends where its bottom border meets the background.';
}

/**
 * Pixel corners from the model (in a w x h gate image) → [TL, TR, BR, BL] in
 * 0-1000 coordinates. Returns undefined unless there are exactly four finite
 * points. Points a hair outside the frame are clamped; the caller's
 * plausibility check still decides whether the quad is usable.
 */
export function pixelCornersToNorm(corners: unknown, w: number, h: number): Pt[] | undefined {
  if (!Array.isArray(corners) || corners.length !== 4 || !(w > 0) || !(h > 0)) return undefined;
  const pts = corners.map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }));
  if (!pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return undefined;
  // More than 2% outside the image is not a rounding slip — refuse rather than clamp.
  if (!pts.every(p => p.x >= -0.02 * w && p.x <= 1.02 * w && p.y >= -0.02 * h && p.y <= 1.02 * h)) return undefined;
  const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
  return pts.map(p => ({ x: clamp((p.x / w) * 1000), y: clamp((p.y / h) * 1000) }));
}

/** Short side / long side of a 0-1000 quad measured in the raw image's pixels (W x H). */
export function quadPixelAspect(quadNorm: Pt[] | undefined | null, W: number, H: number): number | null {
  if (!Array.isArray(quadNorm) || quadNorm.length !== 4 || !(W > 0) || !(H > 0)) return null;
  const q = quadNorm.map(p => ({ x: (p.x / 1000) * W, y: (p.y / 1000) * H }));
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const width = (d(q[0], q[1]) + d(q[3], q[2])) / 2;
  const height = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
  if (!(width > 0) || !(height > 0)) return null;
  return Math.min(width, height) / Math.max(width, height);
}

/**
 * Measurement tolerance on card shape (short/long within 6% of 2.5x3.5).
 * Oct 12 2026 set, 84 faces: the old 0-1000 gate's quads exceeded it on 33;
 * the pixel gate's on 2-5 (toploader edges, a card held in a hand). Yu-Gi-Oh
 * (0.686, -4%) and mild perspective pass. Tighter than the display crop's 8%
 * because the cost of failing is only a skipped shadow measurement, while a
 * squashed outline on a 5:7 photo (y x0.92 → 0.77, +8%) must not pass.
 */
export const MEASURE_ASPECT_TOLERANCE = 0.06;

/**
 * Card-shape sanity check on a quad (portrait or landscape). A quad that fails
 * it is still a usable LOCATION for zoom crops, but its edges are not
 * trustworthy enough to MEASURE from (CV centering), so measurement is skipped
 * rather than reported wrong.
 */
export function quadIsCardShaped(quadNorm: Pt[] | undefined | null, W: number, H: number, tolerance = MEASURE_ASPECT_TOLERANCE): boolean {
  const aspect = quadPixelAspect(quadNorm, W, H);
  return aspect != null && Math.abs(aspect - CARD_ASPECT) / CARD_ASPECT <= tolerance;
}
