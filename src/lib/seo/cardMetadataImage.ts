/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * A `cards` row fetched with an explicit (non-literal) column list.
 * supabase-js cannot infer the shape of a runtime-built select string, so the
 * detail pages narrow the result to this loose row type.
 */
export type CardMetadataRow = Record<string, any>;

/**
 * Signed-URL lifetime for OG/Twitter card images: 24 hours.
 * The detail pages are rendered on demand (no `revalidate` / `generateStaticParams`),
 * so nothing caches the tag for longer than this.
 */
const OG_IMAGE_TTL_SECONDS = 86400;

/**
 * Derive the thumbnail path for a stored card photo.
 * Convention: `<folder>/front.jpg` -> `<folder>/front_thumb.jpg`.
 * Returns null when the path has no extension to hang `_thumb` off of.
 */
function thumbPathFor(path: string): string | null {
  const lastSlash = path.lastIndexOf('/');
  const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '';
  const file = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  return `${dir}${file.slice(0, dot)}_thumb${file.slice(dot)}`;
}

/**
 * Build a shareable image URL for a card's OpenGraph/Twitter tags.
 *
 * - Only PUBLIC cards get an image. `visibility` defaults to private, so a null
 *   or unknown value never leaks a photo into a share preview.
 * - The "cards" bucket is private, so the URL is signed server-side (24h).
 * - Prefers the `_thumb` variant and falls back to the original when the
 *   thumbnail does not exist.
 *
 * Returns null when no image should be emitted; callers should then omit
 * `openGraph.images` / `twitter.images` entirely (matching prior behaviour).
 */
export async function getCardOgImageUrl(
  frontPath: string | null | undefined,
  visibility: string | null | undefined
): Promise<string | null> {
  if (!frontPath) return null;
  if ((visibility || 'private') !== 'public') return null;

  try {
    const storage = supabaseServer().storage.from('cards');

    const thumbPath = thumbPathFor(frontPath);
    if (!thumbPath) {
      const { data } = await storage.createSignedUrl(frontPath, OG_IMAGE_TTL_SECONDS);
      return data?.signedUrl ?? null;
    }

    // One round trip signs both candidates; thumbnails do not exist for every
    // card, so the original is always signed as the fallback.
    const { data } = await storage.createSignedUrls([thumbPath, frontPath], OG_IMAGE_TTL_SECONDS);
    const signedFor = (path: string) =>
      data?.find((entry) => entry.path === path && !entry.error)?.signedUrl ?? null;

    return signedFor(thumbPath) ?? signedFor(frontPath);
  } catch {
    // Never let a share-preview image break metadata generation.
    return null;
  }
}
