import { alignmentError, candidateTransforms, chooseStillTransform, type StreamTransform } from './captureAlignment';
import { laplacianVariance } from './captureSharpness';
import { computeViewportCropRect } from './guideCrop';
import { computeGuideLayoutPx, GUIDE_FILL_FRACTION } from './cameraGuideGeometry';

// A deterministic "card on a table" scene over normalized coords (any u,v).
function makeScene(seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const rects = Array.from({ length: 40 }, () => {
    const w = 0.05 + rnd() * 0.25, h = 0.05 + rnd() * 0.25;
    return { x: rnd() * 1.4 - 0.2, y: rnd() * 1.4 - 0.2, w, h, v: rnd() * 255 };
  });
  return (u: number, v: number) => {
    let val = 40 + 20 * Math.sin(u * 9) * Math.cos(v * 7);
    for (const r of rects) if (u >= r.x && u < r.x + r.w && v >= r.y && v < r.y + r.h) val = r.v;
    return val;
  };
}

const PHOTO = { width: 400, height: 300 }; // 4:3 still
const STREAM = { width: 320, height: 180 }; // 16:9 preview

function render(w: number, h: number, f: (x: number, y: number) => number) {
  const luma = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) luma[y * w + x] = f(x + 0.5, y + 0.5);
  return { luma, width: w, height: h };
}

/** The still, with a different exposure (the photo pipeline's tone curve). */
function still(scene: (u: number, v: number) => number) {
  return render(PHOTO.width, PHOTO.height, (x, y) => 0.8 * scene(x / PHOTO.width, y / PHOTO.height) + 25);
}

/** The preview as the device produced it under true transform t. */
function preview(scene: (u: number, v: number) => number, t: StreamTransform, shift = 0) {
  const sy = t.scaleY ?? t.scale;
  return render(STREAM.width, STREAM.height, (x, y) =>
    scene((x * t.scale + t.offsetX) / PHOTO.width + shift, (y * sy + t.offsetY) / PHOTO.height));
}

function score(pv: ReturnType<typeof render>, st: ReturnType<typeof render>) {
  return candidateTransforms(STREAM.width, STREAM.height, PHOTO.width, PHOTO.height)
    .map((c) => ({ ...c, error: alignmentError(pv, st, STREAM, PHOTO, c.transform) }));
}

describe('still-to-preview alignment', () => {
  const scene = makeScene();
  const st = still(scene);

  for (const truth of candidateTransforms(STREAM.width, STREAM.height, PHOTO.width, PHOTO.height)) {
    it(`recovers the ${truth.model} model despite an exposure difference`, () => {
      const chosen = chooseStillTransform(score(preview(scene, truth.transform), st));
      expect(chosen?.model).toBe(truth.model);
      expect(chosen!.error).toBeLessThan(0.1);
    });
  }

  it('rejects the still when the scene moved between preview and shutter', () => {
    const t = candidateTransforms(STREAM.width, STREAM.height, PHOTO.width, PHOTO.height)[0].transform;
    expect(chooseStillTransform(score(preview(scene, t, 0.15), st))).toBeNull();
  });

  it('rejects the still when the scene is too plain to tell the models apart', () => {
    const flat = () => 128;
    const t = candidateTransforms(STREAM.width, STREAM.height, PHOTO.width, PHOTO.height)[0].transform;
    expect(chooseStillTransform(score(preview(flat, t), still(flat)))).toBeNull();
  });

  it('collapses to one model when stream and photo share an aspect ratio', () => {
    expect(candidateTransforms(1920, 1080, 3840, 2160)).toHaveLength(1);
  });
});

describe('burst sharpness score', () => {
  it('ranks a blurred frame below the sharp one', () => {
    const scene = makeScene(3);
    const sharp = render(200, 200, (x, y) => scene(x / 200, y / 200));
    const blurred = render(200, 200, (x, y) => {
      let s = 0;
      for (let d = -4; d <= 4; d++) s += scene((x + d) / 200, y / 200); // horizontal motion blur
      return s / 9;
    });
    expect(laplacianVariance(sharp.luma, 200, 200)).toBeGreaterThan(2 * laplacianVariance(blurred.luma, 200, 200));
  });
});

describe('guide crop with a non-uniform still transform', () => {
  it('scales the crop rectangle on each axis separately', () => {
    const base = { viewW: 390, viewH: 844, guideW: 300, guideH: 420, guideCenterOffsetY: 0, streamW: 1920, streamH: 1080 };
    const uniform = computeViewportCropRect(10000, 10000, { ...base, streamTransform: { scale: 2, offsetX: 0, offsetY: 0 } }, 0);
    const stretched = computeViewportCropRect(10000, 10000, { ...base, streamTransform: { scale: 2, scaleY: 3, offsetX: 0, offsetY: 0 } }, 0);
    expect(stretched.cropW).toBe(uniform.cropW);
    expect(Math.abs(stretched.cropH - uniform.cropH * 1.5)).toBeLessThanOrEqual(1);
  });
});

describe('guide size', () => {
  it('leaves margin around the guide on a phone screen', () => {
    const g = computeGuideLayoutPx(390, 844, 'portrait');
    expect(g.width).toBeLessThanOrEqual(390 * GUIDE_FILL_FRACTION);
    expect(g.width).toBeGreaterThan(390 * 0.6);
  });
});
