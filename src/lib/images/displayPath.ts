/**
 * Which stored photo to SHOW for a card face (Oct 2026, display crop phase 1).
 *
 * Grading writes a straightened, trimmed copy of each photo next to the
 * original (`front_display.jpg`) when the card's outline was detected with
 * confidence, and records it under cards.capture_quality.display. The original
 * is never modified and stays what grading, reviews and regrades read.
 *
 * Client-safe: no sharp, no storage. Every display surface asks this helper;
 * a card without a display copy (older card, uncertain outline, skipped face)
 * simply shows its original.
 */

export type Face = 'front' | 'back';

export interface DisplayCropFace {
  path: string;
  width: number;
  height: number;
}

export interface DisplayCropRecord {
  version: string;
  made_at: string;
  front?: DisplayCropFace | { skipped: string };
  back?: DisplayCropFace | { skipped: string };
}

interface CardWithPhotos {
  front_path?: string | null;
  back_path?: string | null;
  capture_quality?: unknown;
  /** Lightweight select of capture_quality->display (list queries). */
  display_crop?: unknown;
}

function parse(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** The display copy recorded for a face, or null. */
export function displayCropFor(card: CardWithPhotos | null | undefined, face: Face): DisplayCropFace | null {
  const cq = parse(card?.capture_quality);
  const display = (parse(card?.display_crop) ?? parse(cq?.display)) as DisplayCropRecord | null;
  const entry = display?.[face] as DisplayCropFace | { skipped: string } | undefined;
  if (!entry || !('path' in entry) || typeof entry.path !== 'string' || !entry.path) return null;
  // Only trust a copy stored beside this card's own original.
  const original = face === 'front' ? card?.front_path : card?.back_path;
  if (!original) return null;
  const dir = original.slice(0, original.lastIndexOf('/') + 1);
  if (!entry.path.startsWith(dir)) return null;
  return entry;
}

/** Storage path to show for a face: the display copy when there is one, else the original. */
export function displayImagePath(card: CardWithPhotos | null | undefined, face: Face): string | null {
  const crop = displayCropFor(card, face);
  if (crop) return crop.path;
  const original = face === 'front' ? card?.front_path : card?.back_path;
  return original || null;
}
