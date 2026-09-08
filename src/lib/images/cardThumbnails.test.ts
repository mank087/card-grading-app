import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { thumbPath, makeThumbnail, objectPathFromStorageUrl, ensureCardThumbnails, THUMB_WIDTH } from './cardThumbnails';

/** A noisy JPEG roughly the shape/size of a real card photo. */
async function testCardImage(width = 1800, height = 2520): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i += channels) {
    raw[i] = (i * 7) % 255;
    raw[i + 1] = (i * 13) % 255;
    raw[i + 2] = (i * 29) % 255;
  }
  return sharp(raw, { raw: { width, height, channels } }).jpeg({ quality: 92 }).toBuffer();
}

describe('thumbPath', () => {
  it('maps front/back originals to _thumb.jpg in the same folder', () => {
    expect(thumbPath('user-1/card-2/front.jpg')).toBe('user-1/card-2/front_thumb.jpg');
    expect(thumbPath('user-1/card-2/back.jpg')).toBe('user-1/card-2/back_thumb.jpg');
  });

  it('always produces .jpg regardless of the original extension', () => {
    expect(thumbPath('u/c/front.png')).toBe('u/c/front_thumb.jpg');
    expect(thumbPath('u/c/front.HEIC')).toBe('u/c/front_thumb.jpg');
    expect(thumbPath('u/c/front.jpeg')).toBe('u/c/front_thumb.jpg');
    expect(thumbPath('u/c/front')).toBe('u/c/front_thumb.jpg');
  });

  it('handles a bare filename and nested folders', () => {
    expect(thumbPath('front.jpg')).toBe('front_thumb.jpg');
    expect(thumbPath('a/b/c/d/back.jpg')).toBe('a/b/c/d/back_thumb.jpg');
  });

  it('is idempotent and safe on empty input', () => {
    const once = thumbPath('u/c/front.jpg');
    expect(thumbPath(once)).toBe(once);
    expect(thumbPath('')).toBe('');
  });
});

describe('makeThumbnail', () => {
  it('resizes to 480px wide and returns a JPEG', async () => {
    const original = await testCardImage();
    const thumb = await makeThumbnail(original);
    const meta = await sharp(thumb).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(THUMB_WIDTH);
  });

  it('stays under 40 KB and far below the original', async () => {
    const original = await testCardImage();
    const thumb = await makeThumbnail(original);
    expect(thumb.length).toBeLessThan(40 * 1024);
    expect(thumb.length).toBeLessThan(original.length);
  });

  it('does not enlarge an already-small image', async () => {
    const small = await testCardImage(200, 280);
    const meta = await sharp(await makeThumbnail(small)).metadata();
    expect(meta.width).toBe(200);
  });

  it('strips metadata', async () => {
    const original = await testCardImage(600, 840);
    const meta = await sharp(await makeThumbnail(original)).metadata();
    expect(meta.exif).toBeUndefined();
  });
});

describe('objectPathFromStorageUrl', () => {
  it('extracts the object path from a signed URL', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/cards/user-1/card-2/front.jpg?token=xyz';
    expect(objectPathFromStorageUrl(url)).toBe('user-1/card-2/front.jpg');
  });

  it('handles public URLs and percent-encoding', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/cards/user%201/front.jpg';
    expect(objectPathFromStorageUrl(url)).toBe('user 1/front.jpg');
  });

  it('returns null for a different bucket or a non-storage URL', () => {
    expect(objectPathFromStorageUrl('https://abc.supabase.co/storage/v1/object/sign/org-assets/x.png')).toBeNull();
    expect(objectPathFromStorageUrl('https://example.com/front.jpg')).toBeNull();
    expect(objectPathFromStorageUrl('not a url')).toBeNull();
  });
});

describe('ensureCardThumbnails', () => {
  const stubStorage = (uploads: Array<{ path: string; size: number; opts: any }>, fail = false) => ({
    async upload(path: string, body: Buffer, opts: any) {
      if (fail) return { error: { message: 'boom' } };
      uploads.push({ path, size: body.length, opts });
      return { error: null };
    },
    async createSignedUrl() {
      return { data: null, error: { message: 'no network in tests' } };
    },
  });

  it('uploads both faces from supplied buffers with the right options', async () => {
    const uploads: Array<{ path: string; size: number; opts: any }> = [];
    const buf = await testCardImage(600, 840);
    const res = await ensureCardThumbnails(stubStorage(uploads) as any, {
      frontPath: 'u/c/front.jpg',
      backPath: 'u/c/back.jpg',
      frontBuffer: buf,
      backBuffer: buf,
    });
    expect(res).toEqual({ front: true, back: true });
    expect(uploads.map(u => u.path)).toEqual(['u/c/front_thumb.jpg', 'u/c/back_thumb.jpg']);
    expect(uploads[0].opts).toMatchObject({ upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
  });

  it('never throws when the upload fails or the buffer is unusable', async () => {
    const uploads: Array<{ path: string; size: number; opts: any }> = [];
    const buf = await testCardImage(600, 840);
    await expect(
      ensureCardThumbnails(stubStorage(uploads, true) as any, { frontPath: 'u/c/front.jpg', frontBuffer: buf })
    ).resolves.toEqual({ front: false, back: false });

    await expect(
      ensureCardThumbnails(stubStorage(uploads) as any, {
        frontPath: 'u/c/front.jpg',
        frontBuffer: Buffer.from('not an image'),
      })
    ).resolves.toEqual({ front: false, back: false });

    // Missing paths and missing buffers are no-ops, not errors.
    await expect(ensureCardThumbnails(stubStorage(uploads) as any, {})).resolves.toEqual({ front: false, back: false });
  });
});
