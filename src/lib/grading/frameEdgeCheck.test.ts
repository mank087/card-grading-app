import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { verifyClippedCorners } from './frameEdgeCheck';

const W = 600, H = 840;
type Rect = { left: number; top: number; width: number; height: number; color: string };

/** A photo: a background colour with rectangles painted on it. */
async function photo(background: string, rects: Rect[]): Promise<Buffer> {
  const layers = await Promise.all(rects.map(async r => ({
    input: await sharp({ create: { width: r.width, height: r.height, channels: 3, background: r.color } }).png().toBuffer(),
    left: r.left, top: r.top,
  })));
  return sharp({ create: { width: W, height: H, channels: 3, background } }).composite(layers).jpeg({ quality: 95 }).toBuffer();
}

/** An outline that (wrongly or rightly) puts both bottom corners on the photo's bottom edge. */
const bottomOnBorder = [{ x: 50, y: 40 }, { x: 950, y: 40 }, { x: 950, y: 1000 }, { x: 50, y: 1000 }];
const bottomFlags = ['back bottom-right', 'back bottom-left'];

describe('pixel check on a corner the outline calls out of frame', () => {
  it('clears a complete card: the owner-reported scan, white margin under a blue card', async () => {
    // Toxtricity, Sept 21 2026: 10/10/10, flatbed scan, held at 9 with a D because the
    // outline put the bottom corners at y=1000. The card ends well above the edge.
    const scan = await photo('#ffffff', [{ left: 30, top: 34, width: 540, height: 780, color: '#1c2a9a' }]);
    const out = await verifyClippedCorners(scan, bottomOnBorder, 'back', bottomFlags);
    expect(out.clipped).toEqual([]);
    expect(out.cleared).toEqual(bottomFlags);
  });

  it('keeps the flag when the card really runs off that side', async () => {
    const cutOff = await photo('#8a5a2b', [{ left: 60, top: 120, width: 480, height: 720, color: '#f2f2f2' }]);
    const out = await verifyClippedCorners(cutOff, bottomOnBorder, 'back', bottomFlags);
    expect(out.clipped).toEqual(bottomFlags);
    expect(out.cleared).toEqual([]);
  });

  it('is not fooled by an average: a cut-off card of several colours matches no background piece by piece', async () => {
    // "RICKY WATTERS": a red panel, green field and white text ran to the photo's edge and
    // averaged out close to the brown table. The first version cleared it.
    const multi = await photo('#7b5a3a', [
      { left: 60, top: 120, width: 160, height: 720, color: '#c8202a' },
      { left: 220, top: 120, width: 160, height: 720, color: '#2f8f4e' },
      { left: 380, top: 120, width: 160, height: 720, color: '#f4f4f4' },
    ]);
    expect((await verifyClippedCorners(multi, bottomOnBorder, 'back', bottomFlags)).clipped).toEqual(bottomFlags);
  });

  it('does not take one side\'s word for what the background is', async () => {
    // The white-bordered Jordan: off the TOP and the LEFT of the photo. The outline claimed
    // room on the left, so the left sliver (card border) posed as background and the clipped
    // top matched it. Bottom and right agree on "wood"; white agrees with nobody.
    const jordan = await photo('#7a4a22', [{ left: 0, top: 0, width: 520, height: 760, color: '#fbfbfb' }]);
    const outline = [{ x: 40, y: 0 }, { x: 870, y: 0 }, { x: 870, y: 900 }, { x: 40, y: 900 }];
    const out = await verifyClippedCorners(jordan, outline, 'front', ['front top-left', 'front top-right']);
    expect(out.clipped).toEqual(['front top-left', 'front top-right']);
  });

  it('leaves the flag alone when no two sides can vouch for the background', async () => {
    const fillsFrame = await photo('#ffffff', [{ left: 4, top: 4, width: 592, height: 832, color: '#1c2a9a' }]);
    const tight = [{ x: 6, y: 5 }, { x: 994, y: 5 }, { x: 994, y: 996 }, { x: 6, y: 996 }];
    const flags = ['front top-left', 'front top-right', 'front bottom-right', 'front bottom-left'];
    expect((await verifyClippedCorners(fillsFrame, tight, 'front', flags)).clipped).toEqual(flags);
  });

  it('only ever looks at its own face, and never throws on bad input', async () => {
    const scan = await photo('#ffffff', [{ left: 30, top: 34, width: 540, height: 780, color: '#1c2a9a' }]);
    expect((await verifyClippedCorners(scan, bottomOnBorder, 'front', bottomFlags)).clipped).toEqual([]);
    expect((await verifyClippedCorners(null, bottomOnBorder, 'back', bottomFlags)).clipped).toEqual(bottomFlags);
    expect((await verifyClippedCorners(Buffer.from('not an image'), bottomOnBorder, 'back', bottomFlags)).clipped).toEqual(bottomFlags);
    expect((await verifyClippedCorners(scan, null, 'back', bottomFlags)).clipped).toEqual(bottomFlags);
  });

  it('measures regions, not the whole image', async () => {
    // sharp's stats() ignores extract(): the first build measured the whole photo every time,
    // so every strip matched every background with a distance of exactly 0 and 99 of 107
    // production cards were "cleared", a known clipped card among them.
    const cutOff = await photo('#8a5a2b', [{ left: 60, top: 120, width: 480, height: 720, color: '#f2f2f2' }]);
    const side = (await verifyClippedCorners(cutOff, bottomOnBorder, 'back', bottomFlags)).sides[0];
    expect(side.verdict).toBe('card');
    expect(side.colorDistance).toBeGreaterThan(50);
  });
});
