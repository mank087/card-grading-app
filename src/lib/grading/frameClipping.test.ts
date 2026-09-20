import { describe, expect, it } from 'vitest';
import { clippedCorners, confidenceWithClipping } from './frameClipping';

describe('out-of-frame detection', () => {
  // Real geometry-gate readings from the Sept 17 production replay.
  const framed = [{ x: 176, y: 182 }, { x: 900, y: 183 }, { x: 881, y: 887 }, { x: 177, y: 887 }];
  const cutOff = [{ x: 29, y: 0 }, { x: 914, y: 20 }, { x: 860, y: 816 }, { x: 29, y: 817 }];
  it('finds nothing on a fully framed card or a missing quad', () => {
    expect(clippedCorners(framed, 'front')).toEqual([]);
    expect(clippedCorners(null, 'back')).toEqual([]);
  });
  it('names the corner that sits on the photo border', () => {
    expect(clippedCorners(cutOff, 'front')).toEqual(['front top-left']);
    expect(clippedCorners([{ x: 29, y: 0 }, { x: 926, y: 0 }, { x: 873, y: 913 }, { x: 30, y: 913 }], 'front')).toEqual(['front top-left', 'front top-right']);
  });
  it('lowers confidence to C for one clipped corner, D for more, and never raises it', () => {
    expect(confidenceWithClipping('B', [])).toBe('B');
    expect(confidenceWithClipping('A', ['front top-left'])).toBe('C');
    expect(confidenceWithClipping('D', ['front top-left'])).toBe('D');
    expect(confidenceWithClipping(undefined, ['a', 'b'])).toBe('D');
  });
});

describe('tight framing is not a clipped card (production photos checked by eye, Sept 20 2026)', () => {
  it('leaves a complete card alone when one corner sits a few units inside the photo', () => {
    // Star Wars X-Wing: margin visible on every side; top-right corner at x=995.
    expect(clippedCorners([{ x: 20, y: 25 }, { x: 995, y: 25 }, { x: 985, y: 983 }, { x: 33, y: 987 }], 'front')).toEqual([]);
    // Zeraora V: fills the frame, every corner visible; top-left at y=6.
    expect(clippedCorners([{ x: 51, y: 6 }, { x: 973, y: 31 }, { x: 984, y: 972 }, { x: 72, y: 991 }], 'front')).toEqual([]);
  });

  it('still catches a card that runs off one side, even though neither corner clamps exactly', () => {
    // Odell Beckham Jr.: the card runs off the bottom of the photo; both bottom corners at y=996.
    expect(clippedCorners([{ x: 97, y: 194 }, { x: 842, y: 194 }, { x: 894, y: 996 }, { x: 92, y: 996 }], 'front'))
      .toEqual(['front bottom-right', 'front bottom-left']);
  });

  it('treats a corner within one unit of the border as clamped to it', () => {
    expect(clippedCorners([{ x: 1, y: 40 }, { x: 900, y: 40 }, { x: 900, y: 900 }, { x: 40, y: 900 }], 'back')).toEqual(['back top-left']);
    expect(clippedCorners([{ x: 2, y: 40 }, { x: 900, y: 40 }, { x: 900, y: 900 }, { x: 40, y: 900 }], 'back')).toEqual([]);
  });

  it('ignores a malformed quad', () => {
    expect(clippedCorners([{ x: 0, y: 0 }, null as any, { x: 5, y: 5 }, { x: 9, y: 9 }], 'front')).toEqual([]);
  });
});
