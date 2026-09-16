import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hostListingImages, ImageHostingError } from './imageHosting';

const source = 'https://storage.example/photos/front.jpg';
const eps = 'https://i.ebayimg.com/images/g/front/s-l1600.jpg';
const config = { accessToken: 'test-token', sandbox: false };
const fetchMock = vi.fn();
function created(url = eps, extra = {}) {
  return new Response(JSON.stringify({ imageUrl: url, expirationDate: '2099-01-01T00:00:00Z', ...extra }), {
    status: 201, headers: { location: 'https://apim.ebay.com/commerce/media/v1_beta/image/123' },
  });
}
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Media API listing photos', () => {
  it('uploads over REST with the seller token and preserves the source and receipt', async () => {
    fetchMock.mockResolvedValueOnce(created());
    const photos = await hostListingImages(config, [source]);
    expect(fetchMock).toHaveBeenCalledWith('https://api.ebay.com/commerce/media/v1_beta/image/create_image_from_url', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ imageUrl: source }),
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(photos).toEqual([{ sourceUrl: source, imageUrl: eps, imageId: '123', expirationDate: '2099-01-01T00:00:00Z' }]);
  });

  it('uses sandbox and resolves Location-only responses without trusting their host', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201, headers: {
      location: 'https://untrusted.example/commerce/media/v1_beta/image/123',
    } })).mockResolvedValueOnce(created());
    await hostListingImages({ ...config, sandbox: true }, [source]);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.sandbox.ebay.com/commerce/media/v1_beta/image/123');
  });

  it('keeps selected photo order when uploads finish out of order', async () => {
    let finish!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(r => { finish = r; }))
      .mockResolvedValueOnce(created('https://i.ebayimg.com/back.jpg'));
    const pending = hostListingImages(config, [source, source.replace('front', 'back')]);
    finish(created());
    expect((await pending).map(x => x.imageUrl)).toEqual([eps, 'https://i.ebayimg.com/back.jpg']);
  });

  it('rejects the entire photo batch on partial failure instead of returning original URLs', async () => {
    fetchMock.mockResolvedValueOnce(created()).mockResolvedValueOnce(new Response('{}', { status: 400 }));
    await expect(hostListingImages(config, [source, source + '?back'])).rejects.toMatchObject({ kind: 'invalid_image', photoIndex: 1 });
  });

  it.each([401, 403])('surfaces authorization HTTP %s without retrying', async status => {
    fetchMock.mockResolvedValue(new Response('{}', { status }));
    await expect(hostListingImages(config, [source])).rejects.toMatchObject({ kind: 'authorization' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])('retries a transient HTTP %s response', async status => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status, headers: { 'retry-after': '0' } })).mockResolvedValueOnce(created());
    await expect(hostListingImages(config, [source])).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not ignore a Retry-After beyond the total budget', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '120' } }));
    await expect(hostListingImages(config, [source])).rejects.toMatchObject({ kind: 'temporary' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds network retries', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(hostListingImages(config, [source])).rejects.toBeInstanceOf(ImageHostingError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    { imageUrl: source },
    { imageUrl: 'https://i.ebayimg.com.attacker.example/a.jpg' },
    { imageUrl: eps, expirationDate: '2020-01-01T00:00:00Z' },
    { imageUrl: eps, expirationDate: 'invalid' },
  ])('rejects invalid hosted metadata %j', async body => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 201 }));
    await expect(hostListingImages(config, [source])).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('does not blindly reuse an old EPS URL', async () => {
    fetchMock.mockResolvedValueOnce(created());
    await hostListingImages(config, [eps]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('limits concurrent uploads to three and stops hung requests at the total deadline', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const pending = hostListingImages(config, Array(8).fill(source));
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'temporary' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(25_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('validates all input before any upload', async () => {
    await expect(hostListingImages(config, [source, 'http://storage.example/a.jpg'])).rejects.toMatchObject({ kind: 'invalid_image' });
    await expect(hostListingImages(config, [])).rejects.toBeInstanceOf(ImageHostingError);
    await expect(hostListingImages(config, Array(25).fill(source))).rejects.toBeInstanceOf(ImageHostingError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
