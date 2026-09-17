/**
 * Phase 2C: the owner's product selection is written as a compare-and-set on
 * pricing_selection_revision, retried up to three times, and it clears the old
 * product's stored prices in the same UPDATE.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/lib/pricing/__testSupport__/fakeSupabase';
import { PRICING_INVALIDATION_COLUMNS } from '@/lib/identity/saveCardIdentity';

const CARD = '88888888-8888-4888-8888-888888888888';
const USER = '99999999-9999-4999-8999-999999999999';

let db: FakeSupabase;
let authUserId: string | null = USER;

vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => db }));
vi.mock('@/lib/serverAuth', () => ({
  verifyAuth: async () => ({ authenticated: authUserId !== null, userId: authUserId }),
}));

const { POST, DELETE } = await import('./route');

const PRICED = {
  dcm_price_estimate: 120, dcm_price_raw: 40, dcm_price_median: 100,
  dcm_price_product_id: 'auto-9', dcm_price_product_name: 'Auto match',
  dcm_cached_prices: { estimatedValue: 120 }, dcm_prices_cached_at: '2026-09-01T00:00:00.000Z',
  ebay_price_median: 110, ebay_price_updated_at: '2026-09-01T00:00:00.000Z',
  scryfall_price_usd: 9.5,
  dcm_price_at_grading: 75,
};

function seed(extra: Record<string, any> = {}, options: { beforeUpdate?: (f: FakeSupabase) => void } = {}) {
  db = createFakeSupabase({
    rows: [{
      id: CARD, user_id: USER, ownership_status: 'owned', pricing_selection_revision: 1,
      dcm_selected_product_id: null, dcm_selected_product_name: null, dcm_selected_at: null,
      ...PRICED, ...extra,
    }],
    beforeUpdate: options.beforeUpdate,
  });
  return db;
}

const postRequest = (body: Record<string, unknown>) => ({ json: async () => body } as any);
const deleteRequest = (cardId: string) => ({ url: `http://x/api/pricing/dcm-select?cardId=${cardId}` } as any);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  authUserId = USER;
  seed();
});

describe('POST /api/pricing/dcm-select', () => {
  it('writes the pick and the revision bump as one compare-and-set', async () => {
    const response = await POST(postRequest({ cardId: CARD, productId: 'p-1', productName: 'Green Prizm' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

    const write = db.updates[0];
    expect(Object.fromEntries(write.filters)).toEqual({ id: CARD, pricing_selection_revision: 1 });
    expect(write.payload).toMatchObject({
      dcm_selected_product_id: 'p-1',
      dcm_selected_product_name: 'Green Prizm',
      pricing_selection_revision: 2,
    });
    expect(db.rows.get(CARD)!.pricing_selection_revision).toBe(2);
  });

  it('drops the previous product prices in the same update', async () => {
    await POST(postRequest({ cardId: CARD, productId: 'p-1', productName: 'Green Prizm' }));

    const row = db.rows.get(CARD)!;
    for (const column of PRICING_INVALIDATION_COLUMNS) {
      if (column.startsWith('dcm_selected_')) continue;
      expect(row[column], column).toBeNull();
    }
    // The pick itself is written, not nulled.
    expect(row.dcm_selected_product_id).toBe('p-1');
    // Price-at-grading is history, not a current price: it must survive.
    expect(row.dcm_price_at_grading).toBe(75);
  });

  it('re-reads and retries when another write moved the revision first', async () => {
    let bumped = false;
    seed({}, {
      beforeUpdate: fake => {
        if (bumped) return;
        bumped = true;
        // Someone else's selection lands between our read and our write.
        fake.rows.get(CARD)!.pricing_selection_revision = 5;
      },
    });

    const response = await POST(postRequest({ cardId: CARD, productId: 'p-1', productName: 'Green Prizm' }));

    expect(response.status).toBe(200);
    expect(db.updates).toHaveLength(2);
    expect(Object.fromEntries(db.updates[1].filters)).toEqual({ id: CARD, pricing_selection_revision: 5 });
    expect(db.rows.get(CARD)!.pricing_selection_revision).toBe(6);
  });

  it('gives up with 409 after three failed attempts', async () => {
    let n = 0;
    seed({}, {
      beforeUpdate: fake => {
        // Every attempt is beaten by another writer.
        n += 1;
        fake.rows.get(CARD)!.pricing_selection_revision = 10 + n;
      },
    });

    const response = await POST(postRequest({ cardId: CARD, productId: 'p-1', productName: 'Green Prizm' }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('price_write_stale');
    expect(db.updates).toHaveLength(3);
    expect(db.rows.get(CARD)!.dcm_selected_product_id).toBeNull();
  });

  it('keeps the 2A sold-record lock', async () => {
    seed({ ownership_status: 'sold' });
    const response = await POST(postRequest({ cardId: CARD, productId: 'p-1', productName: 'Green Prizm' }));
    expect(response.status).toBe(423);
    expect(db.updates).toHaveLength(0);
  });

  it('keeps the existing request validation and auth checks', async () => {
    expect((await POST(postRequest({ cardId: CARD }))).status).toBe(400);
    authUserId = null;
    expect((await POST(postRequest({ cardId: CARD, productId: 'p', productName: 'n' }))).status).toBe(401);
    authUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect((await POST(postRequest({ cardId: CARD, productId: 'p', productName: 'n' }))).status).toBe(403);
  });
});

describe('DELETE /api/pricing/dcm-select', () => {
  it('clears the pick and the prices it produced, as a compare-and-set', async () => {
    seed({ dcm_selected_product_id: 'p-1', dcm_selected_product_name: 'Green Prizm', pricing_selection_revision: 4 });

    const response = await DELETE(deleteRequest(CARD));

    expect(response.status).toBe(200);
    expect(Object.fromEntries(db.updates[0].filters)).toEqual({ id: CARD, pricing_selection_revision: 4 });
    const row = db.rows.get(CARD)!;
    expect(row.dcm_selected_product_id).toBeNull();
    expect(row.dcm_price_estimate).toBeNull();
    expect(row.ebay_price_median).toBeNull();
    expect(row.pricing_selection_revision).toBe(5);
  });
});
