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
