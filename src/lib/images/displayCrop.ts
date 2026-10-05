/**
 * Display crop (Oct 2026, phase 1): a straightened, trimmed copy of each card
 * photo for SHOWING the card. The original upload is never modified.
 *
 * Why: since the Oct 3 camera release, app photos are taken from farther away
 * so the lens can focus (median card fill: iOS camera 65% -> 47%, Android
 * 71% -> 57%). Card pages, the collection and the app showed the whole photo,
 * table and all.
 *
 * Input is the card outline the capture gate already detects on every grade
 * (cards.capture_quality.front|back.quad: TL, TR, BR, BL in 0-1000
 * coordinates of the raw image, the same coordinates the zoom crops use).
 * When that outline is not clearly a card fully inside the photo, the face is
 * skipped and the original keeps being shown. Grading never reads these
 * copies; see displayPath.ts for the read side.
 */
import sharp from 'sharp';
import type { DisplayCropRecord, Face } from './displayPath';

export const DISPLAY_CROP_VERSION = 'dc-1';

/** Margin around the card, as a share of its width/height. The detected outline is
 *  often a few percent INSIDE the real edge (Oct 2026 sample), so this is generous. */
const MARGIN = 0.08;
/** Output long edge. Display only; the original keeps full resolution. */
const MAX_EDGE = 2000;
/** Card already fills this share of the photo: nothing worth trimming. */
const MIN_USEFUL_TRIM = 0.9;
/** Outline must cover at least this share of the photo to be trusted. */
const MIN_FILL = 0.08;
/** Straighten only when tilted at least this much; refuse beyond the max. */
const MIN_TILT_DEG = 0.8;
const MAX_TILT_DEG = 12;
/** Standard card short/long side ratio is 2.5/3.5 = 0.714. */
const ASPECT_MIN = 0.6;
const ASPECT_MAX = 0.84;

export interface Pt { x: number; y: number }

export type CropPlan =
  | { ok: true; angleDeg: number; box: { left: number; top: number; width: number; height: number }; outW: number; outH: number }
  | { ok: false; reason: string };

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Pure: decide whether and how to crop. `w`/`h` are the raw image size.
 * The returned box is in the coordinates of the image AFTER rotating by
 * `angleDeg` (sharp rotates clockwise for positive angles and expands the
 * canvas to fit).
 */
export function planDisplayCrop(quadNorm: unknown, w: number, h: number): CropPlan {
  if (!Array.isArray(quadNorm) || quadNorm.length !== 4) return { ok: false, reason: 'no_outline' };
  const qn = quadNorm as Pt[];
  if (!qn.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))) return { ok: false, reason: 'bad_outline' };
  // A card touching or crossing the photo edge cannot be trimmed safely.
  if (!qn.every(p => p.x > 2 && p.x < 998 && p.y > 2 && p.y < 998)) return { ok: false, reason: 'touches_edge' };
  // Same ordering test the zoom crops use: TL -> TR -> BR -> BL, convex.
  if (!qn.every((a, i) => {
    const b = qn[(i + 1) % 4], c = qn[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0;
  })) return { ok: false, reason: 'not_convex' };

  const q = qn.map(p => ({ x: (p.x / 1000) * w, y: (p.y / 1000) * h }));
  const [tl, tr, br, bl] = q;
  const area = Math.abs((q[0].x * (q[1].y - q[3].y) + q[1].x * (q[2].y - q[0].y) + q[2].x * (q[3].y - q[1].y) + q[3].x * (q[0].y - q[2].y)) / 2);
  const fill = area / (w * h);
  if (fill < MIN_FILL) return { ok: false, reason: 'outline_too_small' };

  const top = dist(tl, tr), bottom = dist(bl, br), left = dist(tl, bl), right = dist(tr, br);
  const horiz = (top + bottom) / 2, vert = (left + right) / 2;
  // Opposite sides should be close in length (mild perspective is fine).
  if (Math.min(top, bottom) / Math.max(top, bottom) < 0.85 || Math.min(left, right) / Math.max(left, right) < 0.85) {
    return { ok: false, reason: 'skewed_outline' };
  }
  const aspect = Math.min(horiz, vert) / Math.max(horiz, vert);
  if (aspect < ASPECT_MIN || aspect > ASPECT_MAX) return { ok: false, reason: 'not_card_shaped' };

  // Tilt of the horizontal edges (degrees, positive = clockwise on screen).
  const tiltTop = Math.atan2(tr.y - tl.y, tr.x - tl.x);
  const tiltBottom = Math.atan2(br.y - bl.y, br.x - bl.x);
  const tilt = ((tiltTop + tiltBottom) / 2) * (180 / Math.PI);
  if (Math.abs(tilt) > MAX_TILT_DEG) return { ok: false, reason: 'too_tilted' };
  const angleDeg = Math.abs(tilt) >= MIN_TILT_DEG ? -tilt : 0;

  // Rotate the outline the way sharp rotates the image (about the centre,
  // canvas expanded to the rotated bounding box).
  const a = (angleDeg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const outW = Math.round(Math.abs(w * cos) + Math.abs(h * sin));
  const outH = Math.round(Math.abs(w * sin) + Math.abs(h * cos));
  const rot = q.map(p => {
    const x = p.x - w / 2, y = p.y - h / 2;
    return { x: x * cos - y * sin + outW / 2, y: x * sin + y * cos + outH / 2 };
  });
  const xs = rot.map(p => p.x), ys = rot.map(p => p.y);
  const cardW = Math.max(...xs) - Math.min(...xs), cardH = Math.max(...ys) - Math.min(...ys);
  const mx = cardW * MARGIN, my = cardH * MARGIN;
  // Keep the crop inside what was originally photographed (the rotated canvas
  // corners are padding, not photo).
  const inset = Math.ceil(Math.abs(Math.sin(a)) * Math.max(w, h) * 0.02);
  const x0 = Math.max(inset, Math.floor(Math.min(...xs) - mx));
  const y0 = Math.max(inset, Math.floor(Math.min(...ys) - my));
  const x1 = Math.min(outW - inset, Math.ceil(Math.max(...xs) + mx));
  const y1 = Math.min(outH - inset, Math.ceil(Math.max(...ys) + my));
  const box = { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  if (box.width < 200 || box.height < 200) return { ok: false, reason: 'too_small' };
  // Not worth a second copy when the trim is negligible and nothing is straightened.
  if (angleDeg === 0 && (box.width * box.height) / (w * h) > MIN_USEFUL_TRIM) return { ok: false, reason: 'already_tight' };
  return { ok: true, angleDeg, box, outW, outH };
}

/** `folder/front.jpg` -> `folder/front_display.jpg`. */
export function displayPathFor(originalPath: string): string {
  const slash = originalPath.lastIndexOf('/');
  const dir = slash >= 0 ? originalPath.slice(0, slash + 1) : '';
  const file = slash >= 0 ? originalPath.slice(slash + 1) : originalPath;
  const dot = file.lastIndexOf('.');
  const stem = dot > 0 ? file.slice(0, dot) : file;
  return `${dir}${stem}_display.jpg`;
}

/** Render the display copy, or explain why not. Never throws. */
export async function renderDisplayCrop(buffer: Buffer, quadNorm: unknown): Promise<{ ok: true; jpeg: Buffer; width: number; height: number } | { ok: false; reason: string }> {
  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (!meta.width || !meta.height) return { ok: false, reason: 'unreadable' };
    // The outline is measured on the raw pixels; an orientation tag would put it in other coordinates.
    if (meta.orientation && meta.orientation !== 1) return { ok: false, reason: 'exif_orientation' };
    const plan = planDisplayCrop(quadNorm, meta.width, meta.height);
    if (!plan.ok) return plan;
    let img = sharp(buffer, { failOn: 'none' });
    if (plan.angleDeg !== 0) {
      const rotated = await img.rotate(plan.angleDeg, { background: '#ffffff' }).toBuffer({ resolveWithObject: true });
      // Use sharp's actual canvas size; it can differ from the estimate by a pixel.
      const dx = (rotated.info.width - plan.outW) / 2, dy = (rotated.info.height - plan.outH) / 2;
      const box = {
        left: Math.max(0, Math.round(plan.box.left + dx)), top: Math.max(0, Math.round(plan.box.top + dy)),
        width: plan.box.width, height: plan.box.height,
      };
      box.width = Math.min(box.width, rotated.info.width - box.left);
      box.height = Math.min(box.height, rotated.info.height - box.top);
      img = sharp(rotated.data, { failOn: 'none' }).extract(box);
    } else {
      img = img.extract(plan.box);
    }
    const { data, info } = await img
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, jpeg: data, width: info.width, height: info.height };
  } catch (e: any) {
    return { ok: false, reason: `error:${String(e?.message || e).slice(0, 80)}` };
  }
}

export interface DisplayCropStorage {
  upload(path: string, body: Buffer, options?: { upsert?: boolean; contentType?: string; cacheControl?: string }): Promise<{ error: { message: string } | null } | any>;
}

/**
 * Make and upload both faces' display copies. Returns the record to store
 * under capture_quality.display. Never throws; a face that cannot be cropped
 * is recorded as skipped and keeps showing its original.
 */
export async function createDisplayCrops(
  storage: DisplayCropStorage,
  faces: Record<Face, { path: string | null | undefined; buffer: Buffer | null | undefined; quad: unknown }>,
): Promise<DisplayCropRecord> {
  const record: DisplayCropRecord = { version: DISPLAY_CROP_VERSION, made_at: new Date().toISOString() };
  for (const face of ['front', 'back'] as const) {
    try {
      const { path, buffer, quad } = faces[face];
      if (!path || !buffer) { record[face] = { skipped: 'no_photo' }; continue; }
      const out = await renderDisplayCrop(buffer, quad);
      if (!out.ok) { record[face] = { skipped: out.reason }; continue; }
      const target = displayPathFor(path);
      const { error } = await storage.upload(target, out.jpeg, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) { record[face] = { skipped: `upload:${String(error.message).slice(0, 60)}` }; continue; }
      // Grid views prefer `<path>_thumb.jpg` (signedUrlBatch.thumbPathFor); write
      // the display copy's thumbnail so the collection shows the trimmed card too.
      // A failed thumbnail only means the grid falls back to the display copy itself.
      try {
        const { makeThumbnail, thumbPath } = await import('./cardThumbnails');
        await storage.upload(thumbPath(target), await makeThumbnail(out.jpeg), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
      } catch { /* display copy still usable */ }
      record[face] = { path: target, width: out.width, height: out.height };
    } catch (e: any) {
      record[face] = { skipped: `error:${String(e?.message || e).slice(0, 60)}` };
    }
  }
  return record;
}

/** Most a grade will wait for the display copies before saving without them. */
const GRADE_TIMEOUT_MS = 12_000;

/**
 * Grading-path hook: build the display copies from the photo bytes this grade
 * already downloaded and the outline it just measured. Returns the record to
 * store with the capture-quality reading, or null. Never throws, never waits
 * longer than GRADE_TIMEOUT_MS; a miss only means the original is shown.
 */
export async function makeDisplayCropsForGrade(
  loadOriginals: () => Promise<{ front: Buffer; back: Buffer }>,
  frontImageUrl: string,
  backImageUrl: string,
  capture: { front: { quad: unknown }; back: { quad: unknown } },
): Promise<DisplayCropRecord | null> {
  const work = (async () => {
    const { objectPathFromStorageUrl } = await import('./cardThumbnails');
    const frontPath = objectPathFromStorageUrl(frontImageUrl);
    const backPath = objectPathFromStorageUrl(backImageUrl);
    if (!frontPath && !backPath) return null;
    // A grade run without the service key (calibration runner, scripts) must not write.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const images = await loadOriginals();
    // Lazy for the same reason as the thumbnails: supabaseAdmin throws at load without its env.
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const storage = supabaseAdmin.storage.from('cards') as unknown as DisplayCropStorage;
    return createDisplayCrops(storage, {
      front: { path: frontPath, buffer: images.front, quad: capture.front.quad },
      back: { path: backPath, buffer: images.back, quad: capture.back.quad },
    });
  })().catch((e: any) => {
    console.warn('[display-crop] skipped:', e?.message || e);
    return null;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), GRADE_TIMEOUT_MS); });
  const result = await Promise.race([work, timeout]);
  if (timer) clearTimeout(timer);
  return result;
}
