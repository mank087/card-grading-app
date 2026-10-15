import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeOrientation } from './normalizeCardImage';

/** A 60x40 image: left half red, right half blue, with the given EXIF orientation tag. */
async function tagged(orientation: number): Promise<Buffer> {
  const left = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const base = sharp({ create: { width: 60, height: 40, channels: 3, background: '#0000ff' } })
    .composite([{ input: left, left: 0, top: 0 }]);
  return base.jpeg().withMetadata({ orientation }).toBuffer();
}

const pixel = async (buf: Buffer, x: number, y: number) => {
  const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const { width } = await sharp(buf).metadata();
  const i = (y * width! + x) * 3;
  return [data[i], data[i + 1], data[i + 2]].map(v => (v > 128 ? 1 : 0)).join('');
};

describe('normalizeOrientation', () => {
  it('returns the same buffer for an untagged or upright photo', async () => {
    const plain = await sharp({ create: { width: 20, height: 30, channels: 3, background: '#808080' } }).jpeg().toBuffer();
    const r = await normalizeOrientation(plain);
    expect(r).toEqual({ buffer: plain, orientation: 1, rotated: false });
    const upright = await tagged(1);
    expect((await normalizeOrientation(upright)).rotated).toBe(false);
  });

  it('rotates a tagged photo so its pixels are upright and the tag is gone', async () => {
    const r = await normalizeOrientation(await tagged(6)); // 90° clockwise
    expect(r.orientation).toBe(6);
    expect(r.rotated).toBe(true);
    const meta = await sharp(r.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([40, 60]);
    expect(meta.orientation ?? 1).toBe(1);
    // The red half was on the left; after a 90° clockwise turn it is on top.
    expect(await pixel(r.buffer, 20, 5)).toBe('100');
    expect(await pixel(r.buffer, 20, 55)).toBe('001');
  });

  it('handles every reflected orientation without throwing', async () => {
    for (const o of [2, 3, 4, 5, 7, 8]) {
      const r = await normalizeOrientation(await tagged(o));
      expect(r.rotated).toBe(true);
      expect((await sharp(r.buffer).metadata()).orientation ?? 1).toBe(1);
    }
  });
});
