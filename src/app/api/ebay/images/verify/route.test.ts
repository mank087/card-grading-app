import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), maybeSingle: vi.fn(),
  connection: vi.fn(), refresh: vi.fn(), host: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
vi.mock('@/lib/ebay/auth', () => ({ getConnectionForUser: mocks.connection, refreshTokenIfNeeded: mocks.refresh }));
vi.mock('@/lib/ebay/imageHosting', async importOriginal => ({ ...await importOriginal<object>(), hostListingImages: mocks.host }));
import { POST } from './route';

const cardId = '03b7b378-4262-491e-b4cb-9e7c2089a8aa';
const base = `https://test.supabase.co/storage/v1/object/public/ebay-listing-images/owner/${cardId}/123/`;
function request(imageUrls = [base + 'front.jpeg'], authorized = true) {
  return new NextRequest('https://dcmgrading.com/api/ebay/images/verify', {
    method: 'POST', headers: authorized ? { Authorization: 'Bearer session' } : {},
    body: JSON.stringify({ cardId, imageUrls }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.maybeSingle };
  mocks.from.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({ data: { id: cardId }, error: null });
  mocks.connection.mockResolvedValue({ access_token: 'seller-token', is_sandbox: false });
  mocks.refresh.mockImplementation(async connection => connection);
  mocks.host.mockImplementation(async (_, urls) => urls.map((sourceUrl: string) => ({ sourceUrl, imageUrl: 'https://i.ebayimg.com/image.jpg' })));
});
describe('photo-only verification', () => {
  it('requires a valid session before accessing the seller connection', async () => {
    expect((await POST(request(undefined, false))).status).toBe(401);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.connection).not.toHaveBeenCalled();
  });
  it.each(['https://elsewhere.example/image.jpg', base.replace('/owner/', '/other/'), base + '%2e%2e/secret.jpg'])('rejects unowned or encoded sources: %s', async url => {
    expect((await POST(request([url]))).status).toBe(400);
    expect(mocks.host).not.toHaveBeenCalled();
  });
  it('requires ownership of the card even for an owned storage path', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.from().eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(mocks.host).not.toHaveBeenCalled();
  });
  it('uploads all five photos in order without writing any listing', async () => {
    const urls = ['front', 'back', 'raw-front', 'raw-back', 'mini-report'].map(name => base + name + '.jpeg');
    const response = await POST(request(urls));
    expect(response.status).toBe(200);
    expect((await response.json()).photos.map((p: {sourceUrl: string}) => p.sourceUrl)).toEqual(urls);
    expect(mocks.host).toHaveBeenCalledWith({ accessToken: 'seller-token', sandbox: false }, urls);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith('cards');
  });
});
