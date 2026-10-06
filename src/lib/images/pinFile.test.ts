import { pinFile } from './pinFile';

describe('pinFile', () => {
  it('returns an in-memory copy with the same bytes, name and type', async () => {
    const original = new File([new Uint8Array([1, 2, 3, 4])], 'card.jpg', { type: 'image/jpeg', lastModified: 1700000000000 });
    const pinned = await pinFile(original);
    expect(pinned).not.toBe(original);
    expect(pinned.name).toBe('card.jpg');
    expect(pinned.type).toBe('image/jpeg');
    expect(pinned.lastModified).toBe(1700000000000);
    expect(Array.from(new Uint8Array(await pinned.arrayBuffer()))).toEqual([1, 2, 3, 4]);
  });

  it('hands back the original when the bytes cannot be read, so the caller reports the error', async () => {
    const unreadable = new File([], 'x.jpg', { type: 'image/jpeg' });
    Object.defineProperty(unreadable, 'arrayBuffer', { value: () => Promise.reject(new DOMException('not readable', 'NotReadableError')) });
    expect(await pinFile(unreadable)).toBe(unreadable);
  });
});
