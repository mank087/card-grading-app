/**
 * Card thumbnails, generated from bytes we already hold.
 *
 * The grading pipeline downloads the front/back originals once per grade
 * (see originalImages.ts). While those buffers are in memory we can produce a
 * 480px-wide JPEG thumbnail for free and store it next to the original, so the
 * collection grid, pop report, and mobile lists can stop pulling ~800 KB
 * originals to render a 200px tile.
 *
 * HARD RULE: nothing in this module may ever fail a grade. Every path is
 * try/caught and logs with a `[thumbs]` prefix.
 */

import sharp from 'sharp';

/** Width of a generated thumbnail. ~25-40 KB at q72 mozjpeg for a card photo. */
export const THUMB_WIDTH = 480;

export interface ThumbnailResult {
  front: boolean;
  back: boolean;
}

/**
 * Minimal shape of `supabaseClient.storage.from('cards')`. Declared structurally
 * so tests (and the backfill script) can pass a stub without a live client.
 */
export interface ThumbnailStorage {
  upload(
    path: string,
    body: Buffer,
    options?: { upsert?: boolean; contentType?: string; cacheControl?: string }
  ): Promise<{ error: { message: string } | null } | any>;
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: any }>;
}

/**
 * `folder/front.jpg` → `folder/front_thumb.jpg`. Any extension is accepted;
 * thumbnails are always `.jpg` because we always re-encode as JPEG.
 */
export function thumbPath(originalPath: string): string {
  const clean = String(originalPath || '').trim();
  if (!clean) return '';
  const slash = clean.lastIndexOf('/');
  const dir = slash >= 0 ? clean.slice(0, slash + 1) : '';
  const file = slash >= 0 ? clean.slice(slash + 1) : clean;
  const dot = file.lastIndexOf('.');
  const stem = dot > 0 ? file.slice(0, dot) : file;
  // Idempotent: thumbPath(thumbPath(x)) === thumbPath(x).
  const base = stem.endsWith('_thumb') ? stem : `${stem}_thumb`;
  return `${dir}${base}.jpg`;
}

/**
 * 480px-wide, EXIF-rotated, metadata-stripped JPEG. `withoutEnlargement` keeps
 * an already-small original from being upscaled (that only adds bytes).
 */
export async function makeThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: 'none' })
    .rotate() // honour EXIF orientation, then drop the tag with the metadata
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

/**
 * Parse the object path out of a Supabase storage URL (signed, public, or
 * authenticated). Returns null for anything that is not a URL into `bucket`,
 * which is how a caller detects "these are not storage URLs, skip thumbnails".
 */
export function objectPathFromStorageUrl(url: string, bucket = 'cards'): string | null {
  try {
    const { pathname } = new URL(url);
    const marker = `/storage/v1/object/`;
    const at = pathname.indexOf(marker);
    if (at < 0) return null;
    let rest = pathname.slice(at + marker.length); // e.g. "sign/cards/user/card/front.jpg"
    for (const prefix of ['sign/', 'public/', 'authenticated/']) {
      if (rest.startsWith(prefix)) { rest = rest.slice(prefix.length); break; }
    }
    if (!rest.startsWith(`${bucket}/`)) return null;
    const objectPath = rest.slice(bucket.length + 1);
    return objectPath ? decodeURIComponent(objectPath) : null;
  } catch {
    return null;
  }
}

async function uploadOne(
  storage: ThumbnailStorage,
  originalPath: string,
  buffer: Buffer
): Promise<boolean> {
  const thumb = await makeThumbnail(buffer);
  const target = thumbPath(originalPath);
  const { error } = await storage.upload(target, thumb, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  });
  if (error) {
    console.warn(`[thumbs] upload failed for ${target}: ${error.message}`);
    return false;
  }
  console.log(`[thumbs] wrote ${target} (${Math.round(thumb.length / 1024)} KB)`);
  return true;
}

async function downloadOriginal(storage: ThumbnailStorage, path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await storage.createSignedUrl(path, 120);
    if (error || !data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err: any) {
    console.warn(`[thumbs] could not download ${path}: ${err?.message}`);
    return null;
  }
}

/**
 * Create/refresh both thumbnails. Prefers buffers already in memory; only falls
 * back to a download for a face whose buffer was not supplied.
 *
 * NEVER THROWS.
 */
export async function ensureCardThumbnails(
  storage: ThumbnailStorage,
  opts: {
    frontPath?: string | null;
    backPath?: string | null;
    frontBuffer?: Buffer | null;
    backBuffer?: Buffer | null;
  }
): Promise<ThumbnailResult> {
  const result: ThumbnailResult = { front: false, back: false };
  try {
    const faces: Array<['front' | 'back', string | null | undefined, Buffer | null | undefined]> = [
      ['front', opts.frontPath, opts.frontBuffer],
      ['back', opts.backPath, opts.backBuffer],
    ];
    for (const [face, path, supplied] of faces) {
      try {
        if (!path) continue;
        const buffer = supplied ?? (await downloadOriginal(storage, path));
        if (!buffer || buffer.length === 0) continue;
        result[face] = await uploadOne(storage, path, buffer);
      } catch (err: any) {
        console.warn(`[thumbs] ${face} thumbnail failed for ${path}: ${err?.message}`);
      }
    }
  } catch (err: any) {
    console.warn(`[thumbs] ensureCardThumbnails failed: ${err?.message}`);
  }
  return result;
}

/**
 * Grading-path hook: derive the storage paths from the signed URLs the grader
 * was handed, then write thumbnails from the buffers already downloaded for the
 * zoom passes. Fire-and-forget (`void`); it can never reject.
 */
export async function ensureThumbnailsFromSignedUrls(
  frontImageUrl: string,
  backImageUrl: string,
  buffers: { front?: Buffer | null; back?: Buffer | null }
): Promise<ThumbnailResult> {
  const none: ThumbnailResult = { front: false, back: false };
  try {
    const frontPath = objectPathFromStorageUrl(frontImageUrl);
    const backPath = objectPathFromStorageUrl(backImageUrl);
    if (!frontPath && !backPath) return none;
    // Imported lazily: supabaseAdmin throws at module load when the service-role
    // env is absent (scripts, tests, local tooling), and that must not be a
    // hazard for the grading module that imports this file.
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const storage = supabaseAdmin.storage.from('cards') as unknown as ThumbnailStorage;
    return await ensureCardThumbnails(storage, {
      frontPath,
      backPath,
      frontBuffer: buffers.front ?? null,
      backBuffer: buffers.back ?? null,
    });
  } catch (err: any) {
    console.warn(`[thumbs] skipped: ${err?.message}`);
    return none;
  }
}
