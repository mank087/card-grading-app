/** Media API image uploads. No external-URL fallback is allowed at publish time. */
export interface HostedListingImage {
  sourceUrl: string;
  imageUrl: string;
  imageId: string | null;
  expirationDate: string | null;
}

export class ImageHostingError extends Error {
  constructor(
    public readonly kind: 'authorization' | 'invalid_image' | 'temporary' | 'invalid_response' | 'service',
    public readonly photoIndex: number,
    public readonly httpStatus?: number,
    public readonly ebayErrorId?: number,
  ) {
    super(kind === 'authorization'
      ? 'eBay could not authorize photo uploads. Reconnect your eBay account and try again.'
      : kind === 'service'
        ? 'eBay photo hosting is unavailable. Please try again shortly. No listing was created.'
      : kind === 'invalid_image'
        ? `eBay could not accept photo ${photoIndex + 1}. Re-upload that photo and try again.`
        : `Photo ${photoIndex + 1} could not be uploaded to eBay. Please try again. No listing was created.`);
  }
}

function httpsUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch { return null; }
}

/** Always create a fresh resource, even for an existing EPS URL: it may have expired. */
export async function hostListingImages(
  config: { accessToken: string; sandbox?: boolean },
  urls: string[],
): Promise<HostedListingImage[]> {
  if (!urls.length || urls.length > 24) throw new ImageHostingError('invalid_image', 0);
  urls.forEach((url, i) => {
    if (!httpsUrl(url)) throw new ImageHostingError('invalid_image', i);
  });
  // Media images use apim. Production api.ebay.com returns an empty 404 for
  // this resource even though other eBay APIs (and the sandbox alias) work there.
  const base = `https://${config.sandbox ? 'apim.sandbox.ebay.com' : 'apim.ebay.com'}/commerce/media/v1_beta`;
  const controller = new AbortController();
  const deadline = Date.now() + 25_000;
  const timer = setTimeout(() => controller.abort(), 25_000);
  const results: HostedListingImage[] = new Array(urls.length);
  let next = 0;
  let failure: ImageHostingError | undefined;

  async function request(path: string, index: number, sourceUrl?: string): Promise<{ data: any; location: string | null }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${base}${path}`, {
          method: sourceUrl ? 'POST' : 'GET',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: 'application/json',
            ...(sourceUrl ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(sourceUrl ? { body: JSON.stringify({ imageUrl: sourceUrl }) } : {}),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
          redirect: 'error',
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          const retryAfter = response.headers.get('retry-after');
          const delay = retryAfter
            ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now())
            : 400;
          const payload = await response.json().catch(() => ({}));
          const errors: Array<{ errorId?: number; domain?: string }> = Array.isArray(payload?.errors) ? payload.errors : [];
          // Retain safe diagnostic codes, never tokens/URLs or raw provider text.
          const ebayErrorId = errors.find(e => Number.isFinite(e?.errorId))?.errorId;
          const oauthError = errors.some(e => e?.domain === 'OAuth');
          const imageError = errors.some(e => [190201, 190202, 190203, 190204].includes(e?.errorId ?? 0));
          // Respect Retry-After rather than retrying early when it exceeds our budget.
          if (retryable && attempt === 0 && Number.isFinite(delay) && delay >= 0 && Date.now() + delay + 1000 < deadline) {
            await new Promise<void>(resolve => {
              const done = () => { clearTimeout(wait); controller.signal.removeEventListener('abort', done); resolve(); };
              const wait = setTimeout(done, delay);
              controller.signal.addEventListener('abort', done, { once: true });
              if (controller.signal.aborted) done();
            });
            if (!controller.signal.aborted) continue;
          }
          throw new ImageHostingError(response.status === 401 || response.status === 403 || oauthError
            ? 'authorization' : retryable ? 'temporary' : imageError ? 'invalid_image' : 'service', index, response.status, ebayErrorId);
        }
        return { data: await response.json().catch(() => ({})), location: response.headers.get('location') };
      } catch (error) {
        if (error instanceof ImageHostingError) throw error;
        // A timeout can leave an unused EPS resource, but no listing has been created.
        if (attempt === 0 && !controller.signal.aborted && Date.now() + 1000 < deadline) continue;
        throw new ImageHostingError('temporary', index);
      }
    }
    throw new ImageHostingError('temporary', index);
  }

  async function upload(index: number): Promise<HostedListingImage> {
    const created = await request('/image/create_image_from_url', index, urls[index]);
    // Extract only the ID; never send a seller token to a returned arbitrary URL.
    const location = httpsUrl(created.location);
    const imageId = location?.pathname.match(/^\/commerce\/media\/v1_beta\/image\/([^/]+)$/)?.[1] ?? null;
    let data = created.data;
    if (!data.imageUrl && imageId) data = (await request(`/image/${encodeURIComponent(decodeURIComponent(imageId))}`, index)).data;
    const imageUrl = httpsUrl(data.imageUrl);
    const expiry = typeof data.expirationDate === 'string' ? Date.parse(data.expirationDate) : null;
    if (!imageUrl || !/(^|\.)ebayimg\.com$/i.test(imageUrl.hostname) ||
        (data.expirationDate != null && (expiry === null || !Number.isFinite(expiry) || expiry <= Date.now()))) {
      throw new ImageHostingError('invalid_response', index);
    }
    return { sourceUrl: urls[index], imageUrl: imageUrl.href, imageId,
      expirationDate: data.expirationDate ?? null };
  }

  async function worker() {
    while (!failure && !controller.signal.aborted) {
      const index = next++;
      if (index >= urls.length) return;
      try { results[index] = await upload(index); }
      catch (error) {
        failure ??= error instanceof ImageHostingError ? error : new ImageHostingError('temporary', index);
        controller.abort();
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(3, urls.length) }, worker));
    if (failure) throw failure;
    if (results.filter(Boolean).length !== urls.length) throw new ImageHostingError('temporary', Math.min(next, urls.length - 1));
    return results;
  } finally { clearTimeout(timer); }
}
