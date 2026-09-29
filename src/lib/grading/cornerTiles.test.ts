import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { FULL_FRAME_FILL_PERCENT, pickCornerGeometry, quadPlausible, resolveCornerTiles, tilesFromQuad } from './cornerTiles';

// Real capture_quality reading (sports card 30a46b4e, Sept 28 2026): phone photo
// on a mat, card fills ~50% of the frame — the case the old tiles got wrong.
const matPhoto = {
  gate_version: 'cq-2',
  zoom_outcome: 'card_relative',
  front: { fill_percent: 50, quad: [{ x: 155, y: 101 }, { x: 850, y: 103 }, { x: 870, y: 819 }, { x: 136, y: 820 }] },
  back: { fill_percent: 46, quad: [{ x: 161, y: 118 }, { x: 832, y: 127 }, { x: 852, y: 811 }, { x: 141, y: 801 }] },
};

/** Does the tile (centre ± size/2 horizontally) contain x? */
const coversX = (t: { cx: number; size: number }, x: number) => x > t.cx - t.size / 2 && x < t.cx + t.size / 2;

describe('corner close-up tiles', () => {
  it('centres each tile just inside the detected card corner, not the frame corner', () => {
    const tiles = resolveCornerTiles(matPhoto, 'front')!;
    expect(tiles.map(t => t.key)).toEqual(['tl', 'tr', 'bl', 'br']);
    const [tl, tr, bl, br] = tiles;
    // Card is ~70% of the frame wide → tile spans ~0.28 × 0.70 ≈ 0.20 of the width.
    expect(tl.size).toBeCloseTo(0.28 * ((0.850 - 0.155 + 0.870 - 0.136) / 2), 6);
    // Each tile contains its card corner, pulled slightly toward the card centre.
    expect(coversX(tl, 0.155)).toBe(true);
    expect(tl.cx).toBeGreaterThan(0.155);
    expect(tl.cy).toBeGreaterThan(0.101);
    expect(coversX(tr, 0.850)).toBe(true);
    expect(tr.cx).toBeLessThan(0.850);
    expect(coversX(bl, 0.136)).toBe(true);
    expect(bl.cy).toBeLessThan(0.820);
    expect(coversX(br, 0.870)).toBe(true);
    expect(br.cy).toBeLessThan(0.819);
    // The old tiles covered x ∈ [0, 0.2] — nearly all mat. The new TL tile's
    // left edge sits within one tile of the card edge, never at the frame edge.
    expect(tl.cx - tl.size / 2).toBeGreaterThan(0.05);
  });

  it('uses the face it is asked for', () => {
    const back = resolveCornerTiles(matPhoto, 'back')!;
    expect(coversX(back[0], 0.161)).toBe(true);
    expect(back[0].cy).toBeGreaterThan(0.118);
  });

  it('shifts by a fixed share of the corner-to-centre vector', () => {
    const [tl] = tilesFromQuad([{ x: 200, y: 200 }, { x: 800, y: 200 }, { x: 800, y: 800 }, { x: 200, y: 800 }]);
    // centre (0.5, 0.5); shift 12% of (0.3, 0.3) = 0.036
    expect(tl.cx).toBeCloseTo(0.236, 6);
    expect(tl.cy).toBeCloseTo(0.236, 6);
    expect(tl.size).toBeCloseTo(0.168, 6);
  });

  it('hides the tiles when the corners are unknown and the card may not fill the frame', () => {
    expect(resolveCornerTiles(null, 'front')).toBeNull();
    expect(resolveCornerTiles(undefined, 'back')).toBeNull();
    expect(resolveCornerTiles({ front: { fill_percent: 48, quad: null } }, 'front')).toBeNull();
    expect(resolveCornerTiles({ front: { fill_percent: null, quad: null } }, 'front')).toBeNull();
    expect(resolveCornerTiles({ front: matPhoto.front }, 'back')).toBeNull();
    // Out-of-order / degenerate quads are rejected like the engine rejects them.
    expect(resolveCornerTiles({ front: { fill_percent: 50, quad: [...matPhoto.front.quad].reverse() } }, 'front')).toBeNull();
    expect(resolveCornerTiles('not json', 'front')).toBeNull();
  });

  it('falls back to the frame corners only when the card fills the frame', () => {
    const tiles = resolveCornerTiles({ front: { fill_percent: FULL_FRAME_FILL_PERCENT + 2, quad: null } }, 'front')!;
    expect(tiles).toHaveLength(4);
    expect(tiles[0].cx).toBeCloseTo(0.06, 6);
    expect(tiles[3].cx).toBeCloseTo(0.94, 6);
  });

  it('accepts capture_quality delivered as a JSON string', () => {
    expect(resolveCornerTiles(JSON.stringify(matPhoto), 'front')).toEqual(resolveCornerTiles(matPhoto, 'front'));
  });

  it('matches the engine plausibility bounds', () => {
    expect(quadPlausible(matPhoto.front.quad)).toBe(true);
    expect(quadPlausible([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }])).toBe(false); // > 95%
    expect(quadPlausible([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(false);
  });

  it('the dcm-mobile copy matches this file', () => {
    const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter(l => !/dcm-mobile\/lib\/cornerTiles\.ts is a copy|COPY of src\/lib\/grading\/cornerTiles\.ts/.test(l))
      .join('\n');
    expect(read('../../../dcm-mobile/lib/cornerTiles.ts')).toBe(read('./cornerTiles.ts'));
  });

  it('trims capture_quality to the corner geometry for public payloads', () => {
    expect(pickCornerGeometry(matPhoto)).toEqual({
      front: { quad: matPhoto.front.quad, fill_percent: 50 },
      back: { quad: matPhoto.back.quad, fill_percent: 46 },
    });
    expect(pickCornerGeometry(null)).toBeNull();
    expect(resolveCornerTiles(pickCornerGeometry(matPhoto), 'front')).toEqual(resolveCornerTiles(matPhoto, 'front'));
  });
});
