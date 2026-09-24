/**
 * Map a true still (ImageCapture.takePhoto) onto the preview the user framed.
 *
 * The web camera crops the photo to the on-screen guide, and the guide is drawn
 * over the PREVIEW stream. On Android Chrome the still has a different size and
 * often a different field of view, and the old code ASSUMED the preview was a
 * centered crop of the still (uniform scale = min ratio). Measured Sept 25 over
 * 30 days: Android stills had 52% low photo confidence against 40% for preview
 * grabs, the card filled a median 43% of the crop, and by eye many crops cut
 * the card's edges off — the assumption does not hold on many devices.
 *
 * Instead of assuming, measure: compare the still with the sharpest preview
 * frame under each plausible model and keep the one that matches. When none
 * matches convincingly (the hand moved between preview and shutter, or the
 * device did something unexpected), the caller uses the preview frame, whose
 * geometry is exactly what the user saw.
 */

export interface StreamTransform { scale: number; scaleY?: number; offsetX: number; offsetY: number }
export interface CandidateTransform { model: 'preview_inside_photo' | 'same_view_stretched' | 'photo_inside_preview'; transform: StreamTransform }

/** The field-of-view relationships a phone camera plausibly uses. Pure. */
export function candidateTransforms(streamW: number, streamH: number, photoW: number, photoH: number): CandidateTransform[] {
  const rx = photoW / streamW;
  const ry = photoH / streamH;
  const uniform = (s: number): StreamTransform => ({ scale: s, offsetX: (photoW - streamW * s) / 2, offsetY: (photoH - streamH * s) / 2 });
  const all: CandidateTransform[] = [
    // Preview is a centered crop of a wider-view photo (the old assumption).
    { model: 'preview_inside_photo', transform: uniform(Math.min(rx, ry)) },
    // Same view, sensor aspect differs: each axis scaled on its own.
    { model: 'same_view_stretched', transform: { scale: rx, scaleY: ry, offsetX: 0, offsetY: 0 } },
    // Photo is a centered crop of the preview's view.
    { model: 'photo_inside_preview', transform: uniform(Math.max(rx, ry)) },
  ];
  // Same aspect ratio: the three models coincide. Keep one so the ambiguity
  // rule in chooseStillTransform does not reject a clear match.
  if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.01) return [all[0]];
  return all;
}

/**
 * Mismatch between the preview and the still under `t`: mean absolute
 * difference of z-scored luma at grid points across the preview (z-scoring
 * absorbs the still's different exposure and tone curve). ~0.2 for the right
 * model on real photos; ~1.1 for unrelated content. Points the model maps outside the still
 * are skipped (the photo_inside_preview model legitimately loses the preview's
 * margins); if more than half fall outside, the model is rejected. Pure.
 */
export function alignmentError(
  preview: { luma: Float32Array; width: number; height: number },
  still: { luma: Float32Array; width: number; height: number },
  stream: { width: number; height: number },
  photo: { width: number; height: number },
  t: StreamTransform,
  grid = 40,
): number {
  const sy = t.scaleY ?? t.scale;
  const pairs: Array<[number, number]> = [];
  let outside = 0;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      // Stream coordinates of this grid point (cell centres).
      const x = ((gx + 0.5) / grid) * stream.width;
      const y = ((gy + 0.5) / grid) * stream.height;
      const px = x * t.scale + t.offsetX;
      const py = y * sy + t.offsetY;
      if (px < 0 || py < 0 || px >= photo.width || py >= photo.height) { outside++; continue; }
      const a = preview.luma[Math.min(preview.height - 1, Math.floor((y / stream.height) * preview.height)) * preview.width
        + Math.min(preview.width - 1, Math.floor((x / stream.width) * preview.width))];
      const b = still.luma[Math.min(still.height - 1, Math.floor((py / photo.height) * still.height)) * still.width
        + Math.min(still.width - 1, Math.floor((px / photo.width) * still.width))];
      pairs.push([a, b]);
    }
  }
  if (outside > grid * grid * 0.5 || pairs.length < 16) return Infinity;
  const stats = (k: 0 | 1) => {
    const m = pairs.reduce((s, p) => s + p[k], 0) / pairs.length;
    const sd = Math.sqrt(pairs.reduce((s, p) => s + (p[k] - m) ** 2, 0) / pairs.length) || 1;
    return { m, sd };
  };
  const A = stats(0), B = stats(1);
  return pairs.reduce((s, [a, b]) => s + Math.abs((a - A.m) / A.sd - (b - B.m) / B.sd), 0) / pairs.length;
}

/**
 * Below this the still is taken to show what the user framed. Calibrated Sept
 * 2026 on a real card photo on a textured table, with preview blur, sensor
 * noise, JPEG and a still exposure/contrast change: the right model scored
 * 0.17-0.26 aligned and 0.20-0.28 with 1% hand drift; 3% drift reached
 * 0.35-0.42; wrong models never scored below 0.41. Falling back to the preview
 * frame is always safe, so the threshold leans strict.
 */
export const MAX_ALIGNMENT_ERROR = 0.35;
/** The winner must beat the runner-up by this much, or the scene is too plain to tell them apart. */
export const MIN_ALIGNMENT_MARGIN = 0.05;

/** The best-matching model, or null when none is convincing. Pure. */
export function chooseStillTransform(scored: Array<CandidateTransform & { error: number }>): (CandidateTransform & { error: number }) | null {
  const sorted = [...scored].sort((a, b) => a.error - b.error);
  const [best, second] = sorted;
  if (!best || !(best.error <= MAX_ALIGNMENT_ERROR)) return null;
  if (second && second.error - best.error < MIN_ALIGNMENT_MARGIN) return null;
  return best;
}
