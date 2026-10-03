import { computeGuideLayoutPx } from './cameraGuideGeometry';
import { computeViewportCropRect, type ViewportGuideContext } from './guideCrop';
import type { StreamTransform } from './captureAlignment';

export type CaptureRegion = { x: number; y: number; width: number; height: number };
export const MIN_CAPTURE_EDGE = 1000;

/** Guide content only: padding/background must not inflate the resolution estimate. */
export function getCaptureRegion(
  width: number, height: number, viewW: number, viewH: number,
  orientation: 'portrait' | 'landscape',
  transform: StreamTransform = { scale: 1, offsetX: 0, offsetY: 0 },
  output = { width, height },
): CaptureRegion {
  const guide = computeGuideLayoutPx(viewW, viewH, orientation);
  const context: ViewportGuideContext = {
    viewW, viewH, guideW: guide.width, guideH: guide.height,
    guideCenterOffsetY: guide.centerOffsetY, streamW: width, streamH: height, streamTransform: transform,
  };
  const crop = computeViewportCropRect(output.width, output.height, context, 0);
  return { x: crop.cropX, y: crop.cropY, width: crop.cropW, height: crop.cropH };
}

/** Reject partial guide coverage before clamping can conceal a clipped still. */
export function mapCaptureRegion(region: CaptureRegion, t: StreamTransform, width: number, height: number): CaptureRegion | null {
  const mapped = { x: region.x * t.scale + t.offsetX, y: region.y * (t.scaleY ?? t.scale) + t.offsetY,
    width: region.width * t.scale, height: region.height * (t.scaleY ?? t.scale) };
  if (![mapped.x, mapped.y, mapped.width, mapped.height].every(Number.isFinite) ||
    mapped.width < 16 || mapped.height < 16 || mapped.x < 0 || mapped.y < 0 ||
    mapped.x + mapped.width > width || mapped.y + mapped.height > height) return null;
  return mapped;
}

export interface CaptureCandidateScore {
  sharpness: number;
  width: number;
  height: number;
}

/** Relative ranking only, at equal card-region sample dimensions (not a grading threshold). */
export function preferStill(preview: CaptureCandidateScore, still: CaptureCandidateScore): boolean {
  if (![preview.sharpness, still.sharpness, still.width, still.height].every(Number.isFinite)) return false;
  if (still.sharpness <= 0 || still.width < preview.width * 0.95 || still.height < preview.height * 0.95) return false;
  // A higher-resolution still may have a different tone curve; tolerate small score noise,
  // but never replace the burst winner with a materially softer still.
  return still.sharpness >= preview.sharpness * 0.9;
}
