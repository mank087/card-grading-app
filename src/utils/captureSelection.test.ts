import { describe, expect, it } from 'vitest';
import { getCaptureRegion, mapCaptureRegion, preferStill, MIN_CAPTURE_EDGE } from './captureSelection';
import { alignmentError, candidateTransforms, chooseStillTransform } from './captureAlignment';
import { computeGuideLayoutPx, GUIDE_CHROME_BOTTOM } from './cameraGuideGeometry';
import { validateImageQuality } from './imageQuality';

describe('capture quality decisions', () => {
  const preview = { sharpness: 10, width: 1000, height: 1400 };
  it('keeps the sharper burst even when the still has more pixels', () => {
    expect(preferStill(preview, { sharpness: 6, width: 2000, height: 2800 })).toBe(false);
  });
  it('allows a sharp still of the same resolution', () => {
    expect(preferStill(preview, { ...preview, sharpness: 11 })).toBe(true);
  });
  it('rejects small, blank, and unmeasurable stills', () => {
    expect(preferStill(preview, { ...preview, height: 800 })).toBe(false);
    expect(preferStill(preview, { ...preview, sharpness: 0 })).toBe(false);
    expect(preferStill(preview, { ...preview, sharpness: NaN })).toBe(false);
  });
  it('warns for limited card detail even when the full preview is 4K', () => {
    const landscape = getCaptureRegion(3840, 2160, 390, 844, 'portrait');
    const portrait = getCaptureRegion(2160, 3840, 390, 844, 'portrait');
    expect(landscape.width).toBeLessThan(MIN_CAPTURE_EDGE);
    expect(Math.max(landscape.width, landscape.height)).toBeLessThan(1200);
    expect(portrait.width).toBeGreaterThan(landscape.width * 1.7);
    const hd = getCaptureRegion(1920, 1080, 390, 844, 'portrait');
    expect(Math.max(hd.width, hd.height)).toBeLessThan(MIN_CAPTURE_EDGE);
  });
  it('does not hide clipped guide content by clamping to a still boundary', () => {
    const region = { x: 100, y: 100, width: 200, height: 280 };
    expect(mapCaptureRegion(region, { scale: 2, scaleY: 3, offsetX: 10, offsetY: 5 }, 1000, 1200))
      .toEqual({ x: 210, y: 305, width: 400, height: 840 });
    expect(mapCaptureRegion(region, { scale: 2, offsetX: -250, offsetY: 0 }, 1000, 1200)).toBeNull();
    expect(mapCaptureRegion(region, { scale: 2, offsetX: 0, offsetY: 900 }, 1000, 1200)).toBeNull();
  });
  it('requires visual evidence even when preview and still share an aspect ratio', () => {
    const sample = { width: 32, height: 24, luma: new Float32Array(32 * 24).fill(128) };
    const stream = { width: 1920, height: 1080 }, photo = { width: 3840, height: 2160 };
    const candidates = candidateTransforms(stream.width, stream.height, photo.width, photo.height);
    expect(candidates).toHaveLength(1);
    expect(chooseStillTransform(candidates.map(c => ({ ...c, error: alignmentError(sample, sample, stream, photo, c.transform) })))).toBeNull();
  });
  it('keeps the guide above the phone camera action and shutter', () => {
    for (const [width, height] of [[390, 844], [375, 667], [844, 390]]) {
      const guide = computeGuideLayoutPx(width, height, 'portrait');
      const bottom = height / 2 + guide.centerOffsetY + guide.height / 2;
      expect(bottom).toBeLessThanOrEqual(height - GUIDE_CHROME_BOTTOM);
      expect(guide.width).toBeGreaterThan(0);
    }
  });
  it('reports unavailable quality measurements as unknown while allowing review', () => {
    const result = validateImageQuality({ width: 0, height: 0, data: new Uint8ClampedArray() } as ImageData);
    expect(result.status).toBe('unknown');
    expect(result.isValid).toBe(true);
  });
});
