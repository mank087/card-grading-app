import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  GATE_MAX_LONG_EDGE, GATE_MAX_SHORT_EDGE, gateSize, geometryGateSystemPrompt, pixelCornersToNorm,
  prepareGateImage, quadIsCardShaped, quadPixelAspect,
} from './geometryGate';

// Real readings, Oct 12 2026 audit (McGwire ed0ea559, 2056x2879 photo).
// Hand-checked card outline vs the outline the old 0-1000 gate stored: the stored
// y values are the true ones x0.92 (top AND bottom), x is right.
const MCGWIRE = { W: 2056, H: 2879 };
const MCGWIRE_TRUE = [{ x: 312, y: 353 }, { x: 664, y: 353 }, { x: 664, y: 702 }, { x: 312, y: 702 }];
const MCGWIRE_STORED_CQ2 = [{ x: 310, y: 324 }, { x: 653, y: 324 }, { x: 658, y: 646 }, { x: 309, y: 645 }];

describe('gateSize', () => {
  it('fits a 3:4 phone photo to 768x1024 (the high-detail box, so the model sees our pixels)', () => {
    expect(gateSize(2250, 3000)).toEqual({ width: 768, height: 1024 });
    expect(gateSize(3000, 2250)).toEqual({ width: 1024, height: 768 });
  });
  it('caps the short edge for square-ish photos', () => {
    const s = gateSize(3000, 2971);
    expect(Math.min(s.width, s.height)).toBeLessThanOrEqual(GATE_MAX_SHORT_EDGE);
    expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(GATE_MAX_LONG_EDGE);
  });
  it('keeps tall photos within the long edge and never enlarges', () => {
    expect(gateSize(1080, 1920)).toEqual({ width: 576, height: 1024 });
    expect(gateSize(600, 840)).toEqual({ width: 600, height: 840 });
  });
});

describe('prepareGateImage', () => {
  it('produces a JPEG of exactly the stated size', async () => {
    const buf = await sharp({ create: { width: 2056, height: 2879, channels: 3, background: '#224488' } }).jpeg().toBuffer();
    const g = await prepareGateImage(buf);
    expect({ width: g.width, height: g.height }).toEqual(gateSize(2056, 2879));
    const meta = await sharp(Buffer.from(g.b64, 'base64')).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual({ width: g.width, height: g.height });
  });
});

describe('geometryGateSystemPrompt', () => {
  it('states each photo\'s pixel size and asks for pixel coordinates of the physical card', () => {
    const p = geometryGateSystemPrompt({ width: 768, height: 1024 }, { width: 731, height: 1024 });
    expect(p).toContain('Photo 1 is 768 px wide and 1024 px tall');
    expect(p).toContain('Photo 2 is 731 px wide and 1024 px tall');
    expect(p).toContain('PIXEL coordinates');
    expect(p).not.toMatch(/NORMALIZED/);
  });
});

describe('pixelCornersToNorm', () => {
  it('converts gate-image pixels to 0-1000 of the original', () => {
    // McGwire's true outline as the model sees it in the 733x1027 gate copy.
    const g = gateSize(MCGWIRE.W, MCGWIRE.H);
    const px = MCGWIRE_TRUE.map(p => ({ x: (p.x / 1000) * g.width, y: (p.y / 1000) * g.height }));
    const q = pixelCornersToNorm(px, g.width, g.height)!;
    q.forEach((p, i) => {
      expect(Math.abs(p.x - MCGWIRE_TRUE[i].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y - MCGWIRE_TRUE[i].y)).toBeLessThanOrEqual(1);
    });
  });
  it('uses the height for y and the width for x (the squash was a y-only error)', () => {
    expect(pixelCornersToNorm([{ x: 0, y: 0 }, { x: 768, y: 0 }, { x: 768, y: 1024 }, { x: 0, y: 1024 }], 768, 1024))
      .toEqual([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]);
    expect(pixelCornersToNorm([{ x: 384, y: 512 }, { x: 400, y: 512 }, { x: 400, y: 600 }, { x: 384, y: 600 }], 768, 1024)![2])
      .toEqual({ x: 521, y: 586 });
  });
  it('clamps rounding slips just outside the frame, refuses points well outside', () => {
    expect(pixelCornersToNorm([{ x: -3, y: 10 }, { x: 770, y: 10 }, { x: 770, y: 1030 }, { x: -3, y: 1030 }], 768, 1024))
      .toEqual([{ x: 0, y: 10 }, { x: 1000, y: 10 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]);
    expect(pixelCornersToNorm([{ x: 0, y: 0 }, { x: 900, y: 0 }, { x: 900, y: 1000 }, { x: 0, y: 1000 }], 768, 1024)).toBeUndefined();
  });
  it('rejects malformed answers', () => {
    expect(pixelCornersToNorm(undefined, 768, 1024)).toBeUndefined();
    expect(pixelCornersToNorm([{ x: 1, y: 1 }], 768, 1024)).toBeUndefined();
    expect(pixelCornersToNorm([{ x: 1, y: 1 }, { x: 2, y: 'a' }, { x: 3, y: 3 }, { x: 4, y: 4 }], 768, 1024)).toBeUndefined();
    expect(pixelCornersToNorm([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }], 0, 1024)).toBeUndefined();
  });
});

describe('card-shape check', () => {
  it('passes the true McGwire outline and fails the squashed cq-2 one', () => {
    expect(quadPixelAspect(MCGWIRE_TRUE, MCGWIRE.W, MCGWIRE.H)).toBeCloseTo(0.719, 2);
    expect(quadIsCardShaped(MCGWIRE_TRUE, MCGWIRE.W, MCGWIRE.H)).toBe(true);
    expect(quadPixelAspect(MCGWIRE_STORED_CQ2, MCGWIRE.W, MCGWIRE.H)!).toBeGreaterThan(0.76);
    expect(quadIsCardShaped(MCGWIRE_STORED_CQ2, MCGWIRE.W, MCGWIRE.H)).toBe(false);
  });
  it('accepts landscape cards and measures in pixels, not 0-1000 units', () => {
    // A 3.5x2.5 landscape card filling the middle of a 3000x2250 photo.
    const q = [{ x: 200, y: 200 }, { x: 800, y: 200 }, { x: 800, y: 760 }, { x: 200, y: 760 }];
    expect(quadIsCardShaped(q, 3000, 2250)).toBe(true);
    // The same 0-1000 numbers on a portrait photo are not a card.
    expect(quadIsCardShaped(q, 2250, 3000)).toBe(false);
  });
  it('is false without a usable quad or image size', () => {
    expect(quadIsCardShaped(undefined, 100, 100)).toBe(false);
    expect(quadIsCardShaped(MCGWIRE_TRUE, 0, 0)).toBe(false);
    expect(quadPixelAspect(null, 100, 100)).toBeNull();
  });
});
