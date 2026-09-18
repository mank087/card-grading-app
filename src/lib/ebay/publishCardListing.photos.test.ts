import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: vi.fn() }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/ebay/auth', () => ({
  getConnectionForUser: vi.fn(async () => ({ access_token: 'token', is_sandbox: true })),
  refreshTokenIfNeeded: vi.fn(async c => c),
}));
vi.mock('@/lib/ebay/shippingDefaults', () => ({ rememberShippingDefaults: vi.fn() }));
vi.mock('@/lib/ebay/bulkService', () => ({ loadListingDefaults: vi.fn(), loadBrandingByOrg: vi.fn() }));
vi.mock('@/lib/ebay/businessPolicies', async importOriginal => ({
  ...await importOriginal<typeof import('./businessPolicies')>(),
  loadBusinessPolicyPrefs: vi.fn(async () => ({ useBusinessPolicies: false })),
}));
vi.mock('@/lib/ebay/imageHosting', async importOriginal => ({
  ...await importOriginal<typeof import('./imageHosting')>(), hostListingImages: vi.fn(),
}));
vi.mock('@/lib/ebay/tradingApi', async importOriginal => ({
  ...await importOriginal<typeof import('./tradingApi')>(),
  addFixedPriceItem: vi.fn(), addAuctionItem: vi.fn(),
}));

import { publishCardListing, type PublishCardListingInput } from './publishCardListing';
import { hostListingImages, ImageHostingError } from './imageHosting';
import { addAuctionItem, addFixedPriceItem } from './tradingApi';
import { CURRENT_DISCLAIMER_VERSION } from './disclaimerVersion';

const input = {
  userId: 'seller', cardId: 'card', title: 'Pikachu DCM 9', price: 20,
  grade: 9, postalCode: '10001', listingFormat: 'FIXED_PRICE',
  description: 'Graded card.', imageUrls: ['https://storage.example/front.jpg'], itemSpecifics: [],
} as unknown as PublishCardListingInput;
const receipt = { sourceUrl: input.imageUrls[0], imageUrl: 'https://i.ebayimg.com/front.jpg', imageId: '123', expirationDate: null };

function context() {
  const insert = vi.fn();
  const db = { from: vi.fn((table: string) => {
    let inserting = false;
    const chain: any = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'update']) chain[method] = vi.fn(() => chain);
    chain.insert = (value: unknown) => { inserting = true; insert(value); return chain; };
    chain.single = async () => ({ data: inserting ? { id: 'claim' } : { id: 'card', user_id: 'seller', category: 'Pokemon', serial: 'DCM123' }, error: null });
    chain.maybeSingle = async () => ({ data: { disclaimer_accepted_at: '2026-01-01', disclaimer_version: CURRENT_DISCLAIMER_VERSION }, error: null });
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === 'ebay_listings' ? [] : null, error: null }).then(resolve);
    return chain;
  }) };
  return { insert, ctx: { supabase: db as any, admin: db as any } };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hostListingImages).mockResolvedValue([receipt]);
  for (const fn of [addFixedPriceItem, addAuctionItem]) vi.mocked(fn).mockResolvedValue({ success: true, itemId: 'ebay-123' });
});

describe('shared single/bulk publisher photo gate', () => {
  it.each(['FIXED_PRICE', 'AUCTION'] as const)('never creates a %s listing or claim after photo failure', async listingFormat => {
    vi.mocked(hostListingImages).mockRejectedValueOnce(new ImageHostingError('temporary', 0));
    const { insert, ctx } = context();
    const result = await publishCardListing({ ...input, listingFormat, bulkItemId: 'optional-bulk-item' }, ctx);
    expect(result).toMatchObject({ ok: false, code: 'photo_upload_failed' });
    expect(insert).not.toHaveBeenCalled();
    expect(addFixedPriceItem).not.toHaveBeenCalled();
    expect(addAuctionItem).not.toHaveBeenCalled();
  });

  it('maps upload authorization failures to the existing bulk reconnect handling', async () => {
    vi.mocked(hostListingImages).mockRejectedValueOnce(new ImageHostingError('authorization', 0, 403));
    const { ctx } = context();
    expect(await publishCardListing(input, ctx)).toMatchObject({ ok: false, code: 'token_refresh_failed', status: 401 });
  });

  it.each(['FIXED_PRICE', 'AUCTION'] as const)('sends and persists hosted URLs for %s while preserving source receipts', async listingFormat => {
    const { insert, ctx } = context();
    expect(await publishCardListing({ ...input, listingFormat }, ctx)).toMatchObject({ ok: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ebay_image_urls: [receipt.imageUrl], ebay_photo_uploads: [receipt] }));
    const add = listingFormat === 'AUCTION' ? addAuctionItem : addFixedPriceItem;
    expect(add).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ imageUrls: [receipt.imageUrl] }), expect.anything(), expect.anything());
  });
});
