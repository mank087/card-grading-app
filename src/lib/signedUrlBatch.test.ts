import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  thumbPathFor,
  createSignedImageMap,
  createSignedUrlMap,
  pickDisplayUrls,
  __resetSignedUrlMemo,
  __signedUrlMemoSize,
} from './signedUrlBatch';

/**
 * Minimal stand-in for supabase.storage. Records every path it was asked to
 * sign so tests can assert on batching/memoization, and refuses to sign any
 * path listed in `missing` (which is how Supabase reports a thumbnail that has
 * not been generated yet: a per-item error, not a request failure).
 */
function fakeStorage(opts: { missing?: string[]; failChunk?: boolean } = {}) {
  const missing = new Set(opts.missing ?? []);
  const calls: string[][] = [];
  const createSignedUrls = vi.fn(async (paths: string[]) => {
    calls.push(paths);
    if (opts.failChunk) return { data: null, error: new Error('boom') };
    return {
      data: paths.map(p =>
        missing.has(p)
          ? { path: p, signedUrl: null, error: 'Object not found' }
          : { path: p, signedUrl: `https://cdn.test/${p}?token=sig`, error: null }
      ),
      error: null,
    };
  });
  const storage = { from: () => ({ createSignedUrls }) } as any;
  return { storage, calls, createSignedUrls };
}

beforeEach(() => {
  __resetSignedUrlMemo();
});

describe('thumbPathFor', () => {
  it('maps front.jpg / back.jpg to their _thumb siblings in the same folder', () => {
    expect(thumbPathFor('user-1/card-9/front.jpg')).toBe('user-1/card-9/front_thumb.jpg');
    expect(thumbPathFor('user-1/card-9/back.jpg')).toBe('user-1/card-9/back_thumb.jpg');
  });

  it('normalises any extension to .jpg', () => {
    expect(thumbPathFor('u/c/front.png')).toBe('u/c/front_thumb.jpg');
    expect(thumbPathFor('u/c/front.HEIC')).toBe('u/c/front_thumb.jpg');
    expect(thumbPathFor('u/c/front.jpeg')).toBe('u/c/front_thumb.jpg');
  });

  it('handles an extensionless file name', () => {
    expect(thumbPathFor('u/c/front')).toBe('u/c/front_thumb.jpg');
  });

  it('handles a bare file name with no folder', () => {
    expect(thumbPathFor('front.jpg')).toBe('front_thumb.jpg');
  });

  it('does not mistake a dotted folder for an extension', () => {
    expect(thumbPathFor('user.name/card.v2/front.jpg')).toBe('user.name/card.v2/front_thumb.jpg');
  });

  it('is idempotent — applying it to a thumb path returns the same thumb path', () => {
    const once = thumbPathFor('u/c/front.jpg');
    expect(thumbPathFor(once)).toBe(once);
  });

  it('preserves a dotfile-style name rather than emptying the stem', () => {
    expect(thumbPathFor('u/c/.front')).toBe('u/c/.front_thumb.jpg');
  });
});

describe('createSignedImageMap', () => {
  it('signs originals and thumbs in one batched call, keyed by the original path', async () => {
    const { storage, calls } = fakeStorage();
    const map = await createSignedImageMap(storage, 'cards', [
      'u/1/front.jpg',
      'u/1/back.jpg',
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].sort()).toEqual([
      'u/1/back.jpg',
      'u/1/back_thumb.jpg',
      'u/1/front.jpg',
      'u/1/front_thumb.jpg',
    ]);

    const front = map.get('u/1/front.jpg')!;
    expect(front.url).toContain('u/1/front.jpg');
    expect(front.thumbUrl).toContain('u/1/front_thumb.jpg');
  });

  it('yields thumbUrl:null when the thumb has not been generated yet', async () => {
    const { storage } = fakeStorage({ missing: ['u/1/front_thumb.jpg'] });
    const map = await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);

    const entry = map.get('u/1/front.jpg')!;
    expect(entry.url).toContain('u/1/front.jpg');
    expect(entry.thumbUrl).toBeNull();
  });

  it('drops nulls and de-duplicates paths', async () => {
    const { storage, calls } = fakeStorage();
    const map = await createSignedImageMap(storage, 'cards', [
      'u/1/front.jpg',
      'u/1/front.jpg',
      null,
      undefined,
    ]);
    expect(map.size).toBe(1);
    expect(calls[0]).toHaveLength(2); // original + thumb, once each
  });

  it('chunks at 500 paths per request', async () => {
    const { storage, calls } = fakeStorage();
    const paths = Array.from({ length: 400 }, (_, i) => `u/${i}/front.jpg`);
    await createSignedImageMap(storage, 'cards', paths);
    // 400 originals + 400 thumbs = 800 paths => 2 chunks
    expect(calls).toHaveLength(2);
    expect(calls[0]).toHaveLength(500);
    expect(calls[1]).toHaveLength(300);
  });

  it('skips thumbs entirely when preferThumb is false', async () => {
    const { storage, calls } = fakeStorage();
    const map = await createSignedImageMap(storage, 'cards', ['u/1/front.jpg'], {
      preferThumb: false,
    });
    expect(calls[0]).toEqual(['u/1/front.jpg']);
    expect(map.get('u/1/front.jpg')!.thumbUrl).toBeNull();
  });

  it('defaults to a 24h expiry and honours an override', async () => {
    const { storage, createSignedUrls } = fakeStorage();
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    expect(createSignedUrls).toHaveBeenLastCalledWith(expect.anything(), 86400);

    __resetSignedUrlMemo();
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg'], { expiresIn: 3600 });
    expect(createSignedUrls).toHaveBeenLastCalledWith(expect.anything(), 3600);
  });

  it('returns an empty map without calling storage when given no usable paths', async () => {
    const { storage, createSignedUrls } = fakeStorage();
    const map = await createSignedImageMap(storage, 'cards', [null, undefined]);
    expect(map.size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('throws when a chunk of originals fails outright', async () => {
    const { storage } = fakeStorage({ failChunk: true });
    await expect(
      createSignedImageMap(storage, 'cards', ['u/1/front.jpg'], { preferThumb: false })
    ).rejects.toThrow('boom');
  });
});

describe('createSignedImageMap memo', () => {
  it('does not re-sign the same path on a warm instance', async () => {
    const { storage, calls } = fakeStorage();

    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    expect(calls).toHaveLength(1);

    const map = await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    // Second call served entirely from the memo — no storage round-trip.
    expect(calls).toHaveLength(1);
    expect(map.get('u/1/front.jpg')!.url).toContain('u/1/front.jpg');
    expect(map.get('u/1/front.jpg')!.thumbUrl).toContain('front_thumb');
  });

  it('only re-signs the paths it has not already memoized', async () => {
    const { storage, calls } = fakeStorage();
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg', 'u/2/front.jpg']);

    expect(calls).toHaveLength(2);
    expect(calls[1].sort()).toEqual(['u/2/front.jpg', 'u/2/front_thumb.jpg']);
  });

  it('keys the memo by bucket, so the same path in another bucket re-signs', async () => {
    const { storage, calls } = fakeStorage();
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    await createSignedImageMap(storage, 'slabby-drafts', ['u/1/front.jpg']);
    expect(calls).toHaveLength(2);
  });

  it('keys the memo by expiry, so a different TTL re-signs', async () => {
    const { storage, calls } = fakeStorage();
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg'], { expiresIn: 3600 });
    expect(calls).toHaveLength(2);
  });

  it('re-signs once the 20-minute bucket rolls over', async () => {
    const { storage, calls } = fakeStorage();
    const start = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(start);
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    expect(calls).toHaveLength(1);

    // Still inside the same 20-minute slot.
    vi.spyOn(Date, 'now').mockReturnValue(start + 60_000);
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    expect(calls).toHaveLength(1);

    // Well past it.
    vi.spyOn(Date, 'now').mockReturnValue(start + 25 * 60_000);
    await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    expect(calls).toHaveLength(2);

    vi.restoreAllMocks();
  });

  it('caps at ~5,000 entries and drops the oldest first', async () => {
    const { storage } = fakeStorage();
    // 3,000 originals + 3,000 thumbs = 6,000 candidate entries > the 5,000 cap.
    const paths = Array.from({ length: 3000 }, (_, i) => `u/${i}/front.jpg`);
    await createSignedImageMap(storage, 'cards', paths);
    expect(__signedUrlMemoSize()).toBeLessThanOrEqual(5000);
    expect(__signedUrlMemoSize()).toBeGreaterThan(4000);
  });
});

describe('pickDisplayUrls', () => {
  it('prefers the thumb for display and always exposes the full original', async () => {
    const { storage } = fakeStorage();
    const map = await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    const { display, full } = pickDisplayUrls(map, 'u/1/front.jpg');
    expect(display).toContain('front_thumb.jpg');
    expect(full).toContain('u/1/front.jpg');
  });

  it('falls back to the original when no thumb exists', async () => {
    const { storage } = fakeStorage({ missing: ['u/1/front_thumb.jpg'] });
    const map = await createSignedImageMap(storage, 'cards', ['u/1/front.jpg']);
    const { display, full } = pickDisplayUrls(map, 'u/1/front.jpg');
    expect(display).toBe(full);
  });

  it('returns nulls for a missing or absent path', async () => {
    const map = new Map();
    expect(pickDisplayUrls(map, null)).toEqual({ display: null, full: null });
    expect(pickDisplayUrls(map, 'nope.jpg')).toEqual({ display: null, full: null });
  });
});

describe('createSignedUrlMap (unchanged legacy behaviour)', () => {
  it('still returns a plain path → url map and never signs thumbs', async () => {
    const { storage, calls } = fakeStorage();
    const map = await createSignedUrlMap(storage, 'cards', ['u/1/front.jpg', null], 3600);
    expect(calls[0]).toEqual(['u/1/front.jpg']);
    expect(map.get('u/1/front.jpg')).toContain('u/1/front.jpg');
  });
});
