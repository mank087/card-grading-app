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
