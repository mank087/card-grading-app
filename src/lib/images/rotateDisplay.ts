/**
 * Owner-requested rotation of a card photo for display (Oct 2026).
 *
 * A photo taken sideways (a landscape back, a phone held the wrong way) grades
 * fine but shows sideways everywhere the card is displayed. The owner can now
 * turn each face in 90° steps. The rotation is applied to the DISPLAY copy
 * (`<face>_display*.jpg`, see displayCrop.ts), which every display surface
 * already reads through displayPath.ts; the stored original is never changed
 * and grading keeps reading the original.
 *
 * Each turn writes a new file (`<face>_display_r<N>.jpg` + thumbnail) rather
 * than overwriting, so cached URLs for the previous orientation cannot show
 * the old image. The record carries the cumulative `rotation` so a later
 * regrade, which rebuilds the display copy from the original, can re-apply it
 * (createDisplayCrops).
 */
import sharp from 'sharp';
import { displayCropFor, type Face } from './displayPath';
import type { DisplayCropStorage } from './displayCrop';

export type RotateDirection = 'cw' | 'ccw';

export interface RotatableCard {
  id: string;
  front_path?: string | null;
  back_path?: string | null;
  capture_quality?: unknown;
}

export interface RotateStorage extends DisplayCropStorage {
  download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
}

export interface RotateOutcome {
  path: string;
  width: number;
  height: number;
  rotation: number;
  display: Record<string, unknown>;
}

const parse = (v: unknown): Record<string, any> => {
  if (!v) return {};
  if (typeof v === 'string') { try { return JSON.parse(v) || {}; } catch { return {}; } }
  return typeof v === 'object' ? { ...(v as Record<string, any>) } : {};
};

/** `folder/back_display.jpg` or `folder/back_display_r3.jpg` -> `folder/back_display_r4.jpg`. */
export function nextRotatedPath(originalPath: string, face: Face, currentDisplayPath: string | null): string {
  const dir = originalPath.slice(0, originalPath.lastIndexOf('/') + 1);
  const m = currentDisplayPath ? /_display_r(\d+)\.jpg$/.exec(currentDisplayPath) : null;
  const n = m ? Number(m[1]) + 1 : 1;
  return `${dir}${face}_display_r${n}.jpg`;
}

/** Turn one face 90° and record it. Returns the new display record to store under capture_quality. */
export async function rotateCardFace(storage: RotateStorage, card: RotatableCard, face: Face, direction: RotateDirection): Promise<RotateOutcome> {
  const originalPath = face === 'front' ? card.front_path : card.back_path;
  if (!originalPath) throw new Error(`no ${face} photo`);
  const current = displayCropFor(card, face);
  const sourcePath = current?.path ?? originalPath;
  const { data, error } = await storage.download(sourcePath);
  if (error || !data) throw new Error(`could not load ${face} photo (${error?.message ?? 'empty'})`);
  const input = Buffer.from(await data.arrayBuffer());
  const angle = direction === 'cw' ? 90 : -90;
  // .rotate(angle) ignores EXIF; the display copy has none and an original's tag
  // was already applied by the grading download, so the pixels are the truth here.
  const out = await sharp(input, { failOn: 'none' }).rotate(angle).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const target = nextRotatedPath(originalPath, face, current?.path ?? null);
  const up = await storage.upload(target, out.data, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
  if (up?.error) throw new Error(`upload failed: ${up.error.message}`);
  try {
    const { makeThumbnail, thumbPath } = await import('./cardThumbnails');
    await storage.upload(thumbPath(target), await makeThumbnail(out.data), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
  } catch { /* the grid falls back to the display copy itself */ }
  const prevRotation = Number((current as any)?.rotation ?? 0) || 0;
  const rotation = ((prevRotation + angle) % 360 + 360) % 360;
  const cq = parse(card.capture_quality);
  const display = { ...(parse(cq.display)), version: parse(cq.display).version ?? 'dc-2', made_at: parse(cq.display).made_at ?? new Date().toISOString(),
    [face]: { path: target, width: out.info.width, height: out.info.height, rotation, rotated_at: new Date().toISOString() } };
  return { path: target, width: out.info.width, height: out.info.height, rotation, display };
}
