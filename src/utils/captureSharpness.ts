/**
 * Sharpness scoring for the web camera's burst capture (Sept 2026).
 *
 * The shutter used to keep ONE preview frame, taken the instant the button was
 * pressed — which is exactly when the phone moves. Of 20 recent mobile-web
 * crops reviewed Sept 25, several were badly motion-blurred. The camera now
 * grabs a short burst and keeps the sharpest frame by this score.
 *
 * Score = variance of the 3x3 Laplacian over the frame's central region (where
 * the guide, and so the card, is), on luma at a small fixed size. Only used to
 * RANK frames of the same scene, so no calibration against the grading
 * thresholds in imageQuality.ts is needed.
 */

/** Laplacian variance of a luma buffer. Higher = sharper. Pure. */
export function laplacianVariance(luma: Float32Array | number[], width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        -luma[i - width - 1] - luma[i - width] - luma[i - width + 1]
        - luma[i - 1] + 8 * luma[i] - luma[i + 1]
        - luma[i + width - 1] - luma[i + width] - luma[i + width + 1];
      sum += lap * lap;
      count++;
    }
  }
  return count ? sum / count : 0;
}

/** Luma of an RGBA buffer. Pure. */
export function rgbaToLuma(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; p < luma.length; i += 4, p++) {
    luma[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return luma;
}

/**
 * Browser: luma of `source` scaled so its long edge is `maxEdge`, optionally
 * restricted to a centered region (fractions of width/height).
 */
export function sourceLuma(
  source: CanvasImageSource & { width?: number; height?: number },
  srcW: number,
  srcH: number,
  maxEdge: number,
  region: { w: number; h: number } = { w: 1, h: 1 },
): { luma: Float32Array; width: number; height: number } | null {
  const rw = Math.max(1, Math.round(srcW * region.w));
  const rh = Math.max(1, Math.round(srcH * region.h));
  const rx = Math.round((srcW - rw) / 2);
  const ry = Math.round((srcH - rh) / 2);
  const scale = Math.min(1, maxEdge / Math.max(rw, rh));
  const w = Math.max(1, Math.round(rw * scale));
  const h = Math.max(1, Math.round(rh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, rx, ry, rw, rh, 0, 0, w, h);
  return { luma: rgbaToLuma(ctx.getImageData(0, 0, w, h).data, w, h), width: w, height: h };
}
