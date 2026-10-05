/**
 * Card-page photo URLs (Oct 2026, display crop phase 1).
 *
 * The category GET routes sign the ORIGINAL photos and hand those same URLs to
 * the grader. Only the response the page receives switches to the display
 * copy, so grading keeps reading the untouched originals. `front_original_url`
 * / `back_original_url` back the "View original photo" link.
 */
import { displayCropFor, type Face } from './displayPath';

interface Signer {
  storage: { from(bucket: string): { createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }> } };
}

export async function displayPhotoUrls(
  supabase: Signer,
  card: Record<string, any> | null | undefined,
  frontUrl: string | null,
  backUrl: string | null,
): Promise<{ front_url: string | null; back_url: string | null; front_original_url: string | null; back_original_url: string | null }> {
  const sign = async (face: Face, fallback: string | null) => {
    const crop = displayCropFor(card, face);
    if (!crop) return fallback;
    try {
      const { data } = await supabase.storage.from('cards').createSignedUrl(crop.path, 60 * 60);
      return data?.signedUrl || fallback;
    } catch {
      return fallback;
    }
  };
  const [front, back] = await Promise.all([sign('front', frontUrl), sign('back', backUrl)]);
  return { front_url: front, back_url: back, front_original_url: frontUrl, back_original_url: backUrl };
}
