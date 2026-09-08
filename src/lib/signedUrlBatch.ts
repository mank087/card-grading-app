import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Batch-create signed URLs without tripping Supabase's hard limit of 1,000 paths
 * per createSignedUrls request ("body/paths must NOT have more than 1000 items").
 *
 * Collections past 500 cards (front + back = 2 paths each) exceed the limit, the
 * whole batch 400s, and callers' fallback branches null out every image ("No image"
 * across the entire collection page — hit in production at 778 cards, July 2026).
 *
 * This helper: drops null/undefined paths, de-duplicates, chunks requests, and
 * returns a path → signedUrl Map. Individual path failures are skipped (same
 * behavior callers already had); only a whole-chunk error is thrown.
 */
const CHUNK_SIZE = 500;

/** 24h. Long expiry is deliberate — see MEMO/CDN note on createSignedImageMap. */
export const DEFAULT_SIGNED_URL_TTL = 86400;

export async function createSignedUrlMap(
  storageClient: SupabaseClient['storage'],
  bucket: string,
  paths: Array<string | null | undefined>,
  expiresInSeconds: number
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const urlMap = new Map<string, string>();

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const { data, error } = await storageClient.from(bucket).createSignedUrls(chunk, expiresInSeconds);
    if (error) throw error;
    data?.forEach(item => {
      if (item.path && item.signedUrl) urlMap.set(item.path, item.signedUrl);
    });
  }
  return urlMap;
}

/**
 * Thumbnail path convention for the private "cards" bucket.
 *
 *   <userId>/<cardId>/front.jpg  →  <userId>/<cardId>/front_thumb.jpg
 *   <userId>/<cardId>/back.png   →  <userId>/<cardId>/back_thumb.jpg
 *
 * Thumbs are ≤480px wide (~30-40 KB vs ~800 KB for the original) and are always
 * written as .jpg regardless of the original's extension. They are generated at
 * grade time for new cards and backfilled for older ones, so a thumb may simply
 * not exist — every consumer must fall back to the original.
 *
 * NOTE: intentionally NOT imported from src/lib/images/* — this module is used by
 * request-path routes and must stay dependency-free. Keep the two in sync.
 */
export function thumbPathFor(originalPath: string): string {
  const slash = originalPath.lastIndexOf('/');
  const dir = slash === -1 ? '' : originalPath.slice(0, slash + 1);
  const file = slash === -1 ? originalPath : originalPath.slice(slash + 1);

  // Strip the extension (last dot in the FILE name only, so dotted folders are safe).
  const dot = file.lastIndexOf('.');
  const stem = dot > 0 ? file.slice(0, dot) : file;

  // Already a thumb? Leave it alone so double-application is a no-op.
  if (stem.endsWith('_thumb')) return `${dir}${stem}.jpg`;

  return `${dir}${stem}_thumb.jpg`;
}

export interface SignedImagePair {
  /** Signed URL for the full-resolution original. */
  url: string;
  /** Signed URL for the ≤480px thumbnail, or null when no thumb exists yet. */
  thumbUrl: string | null;
}

export interface CreateSignedImageMapOptions {
  /** Seconds. Defaults to 24h so repeat views within a day share CDN cache entries. */
  expiresIn?: number;
  /** Set false to skip signing thumbs entirely (thumbUrl always null). */
  preferThumb?: boolean;
}

/* ------------------------------------------------------------------ *
 * In-process signature memo.
 *
 * Supabase's CDN caches on the full URL including the JWT, so a freshly
 * signed token is always a cache MISS. Re-using one signature for a while
 * lets repeat views (tab switches, back-navigation, pagination re-renders)
 * hit the CDN instead of Supabase egress.
 *
 * This memo is per-lambda-instance ONLY: it helps warm lambdas and does
 * nothing on a cold start, and it is not shared between regions or
 * concurrent instances. The real cache win comes from the 24h expiry
 * combined with the 20-minute bucketing below, which makes independent
 * lambdas converge on the SAME signature for the same path.
 * ------------------------------------------------------------------ */
const MEMO_BUCKET_SECONDS = 20 * 60; // 20 minutes
const MEMO_MAX_ENTRIES = 5000;

const signatureMemo = new Map<string, string>();

function memoKey(bucket: string, path: string, expiresIn: number): string {
  const slot = Math.floor(Date.now() / 1000 / MEMO_BUCKET_SECONDS);
  return `${bucket}|${path}|${expiresIn}|${slot}`;
}

function memoGet(bucket: string, path: string, expiresIn: number): string | undefined {
  return signatureMemo.get(memoKey(bucket, path, expiresIn));
}

function memoSet(bucket: string, path: string, expiresIn: number, url: string): void {
  const key = memoKey(bucket, path, expiresIn);
  // Map preserves insertion order — deleting the first key drops the oldest.
  if (signatureMemo.size >= MEMO_MAX_ENTRIES && !signatureMemo.has(key)) {
    const oldest = signatureMemo.keys().next();
    if (!oldest.done) signatureMemo.delete(oldest.value);
  }
  signatureMemo.set(key, url);
}

/** Test seam — clears the in-process memo. */
export function __resetSignedUrlMemo(): void {
  signatureMemo.clear();
}

/** Test seam — current memo size. */
export function __signedUrlMemoSize(): number {
  return signatureMemo.size;
}

/**
 * Sign originals AND their thumbnails in one batched pass.
 *
 * Returns a Map keyed by the ORIGINAL path (so callers keep using card.front_path
 * as the lookup key) whose value carries both URLs. A thumb that does not exist
 * yet simply fails to sign and yields `thumbUrl: null` — callers fall back to
 * `url`.
 *
 * Only whole-chunk failures throw; per-path failures are silently skipped, same
 * as createSignedUrlMap.
 */
export async function createSignedImageMap(
  storageClient: SupabaseClient['storage'],
  bucket: string,
  paths: Array<string | null | undefined>,
  options: CreateSignedImageMapOptions = {}
): Promise<Map<string, SignedImagePair>> {
  const { expiresIn = DEFAULT_SIGNED_URL_TTL, preferThumb = true } = options;

  const originalSet = new Set(paths.filter((p): p is string => !!p));
  const originals = Array.from(originalSet);
  const result = new Map<string, SignedImagePair>();
  if (originals.length === 0) return result;

  // original path -> thumb path (only when thumbs are wanted)
  const thumbOf = new Map<string, string>();
  if (preferThumb) {
    for (const p of originals) thumbOf.set(p, thumbPathFor(p));
  }

  // Everything we need signed, minus anything a warm lambda already holds.
  const wanted = new Set<string>(originals);
  if (preferThumb) for (const t of thumbOf.values()) wanted.add(t);

  const signed = new Map<string, string>();
  const toSign: string[] = [];
  for (const p of wanted) {
    const cached = memoGet(bucket, p, expiresIn);
    if (cached) signed.set(p, cached);
    else toSign.push(p);
  }

  for (let i = 0; i < toSign.length; i += CHUNK_SIZE) {
    const chunk = toSign.slice(i, i + CHUNK_SIZE);
    const { data, error } = await storageClient.from(bucket).createSignedUrls(chunk, expiresIn);
    // A chunk that contains a missing thumb should NOT take the originals down
    // with it, so a chunk error is fatal only when the chunk was all originals.
    if (error) {
      const chunkHasThumb = preferThumb && chunk.some(p => !originalSet.has(p));
      if (!chunkHasThumb) throw error;
      continue;
    }
    data?.forEach(item => {
      if (item.path && item.signedUrl) {
        signed.set(item.path, item.signedUrl);
        memoSet(bucket, item.path, expiresIn, item.signedUrl);
      }
    });
  }

  for (const original of originals) {
    const url = signed.get(original);
    if (!url) continue; // original failed to sign — caller treats as missing image
    const thumbPath = thumbOf.get(original);
    const thumbUrl = thumbPath ? signed.get(thumbPath) ?? null : null;
    result.set(original, { url, thumbUrl });
  }

  return result;
}

/**
 * Convenience for list surfaces: display URL (thumb when present, original
 * otherwise) plus the full-resolution URL, for one path.
 */
export function pickDisplayUrls(
  map: Map<string, SignedImagePair>,
  path: string | null | undefined
): { display: string | null; full: string | null } {
  if (!path) return { display: null, full: null };
  const entry = map.get(path);
  if (!entry) return { display: null, full: null };
  return { display: entry.thumbUrl ?? entry.url, full: entry.url };
}
