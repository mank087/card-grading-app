import { staticFile } from 'remotion';

/**
 * Resolve a scene asset reference to something Remotion can load.
 *
 * Scenes carry assets one of three ways:
 *  - `data:…`     inline base64, straight from the Lab (preview + small scenes)
 *  - `http(s)://` remote URL
 *  - `lab-assets/…` a file the render server extracted into slabby/public/
 *
 * The third form exists because inline base64 makes the props payload 10-15MB,
 * which Remotion re-serialises every frame — renders that should take ~2
 * minutes were estimating 4+ hours. Extracted files are read once.
 *
 * Leaves the first two untouched, so the Lab's live preview (where assets are
 * still data URLs) is unaffected.
 */
export function assetSrc(src: string): string {
  if (!src) return src;
  if (src.startsWith('data:') || /^https?:\/\//i.test(src) || src.startsWith('blob:')) return src;
  // Absolute paths already served from public/ (e.g. '/sfx/pop.wav')
  if (src.startsWith('/')) return src;
  return staticFile(src);
}
