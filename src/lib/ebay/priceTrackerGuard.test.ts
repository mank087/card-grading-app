/**
 * Phase 2C: the eBay comps writer family (fetchAndCacheCardPrice).
 *
 * A separate file from any existing eBay suite so it stays readable next to the
 * other Phase 2C guard tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/lib/pricing/__testSupport__/fakeSupabase';

const CARD = '44444444-4444-4444-8444-444444444444';

let db: FakeSupabase;
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => db }));

const searchEbayPricesWithFallback = vi.fn();
vi.mock('./browseApi', () => ({
  searchEbayPricesWithFallback: (...a: any[]) => searchEbayPricesWithFallback(...a),
  searchPokemonPricesWithFallback: (...a: any[]) => searchEbayPricesWithFallback(...a),
  searchMTGPricesWithFallback: (...a: any[]) => searchEbayPricesWithFallback(...a),
  searchLorcanaPricesWithFallback: (...a: any[]) => searchEbayPricesWithFallback(...a),
  searchOtherPricesWithFallback: (...a: any[]) => searchEbayPricesWithFallback(...a),
}));

const { fetchAndCacheCardPrice } = await import('./priceTracker');

const RESULT = {
  lowestPrice: 10, medianPrice: 25, averagePrice: 26, highestPrice: 40, total: 12,
  queryUsed: 'mantle 1960 topps', queryStrategy: 'primary',
};

function seed(extra: Record<string, any> = {}) {
  db = createFakeSupabase({
    rows: [{
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
      ebay_price_median: null, dcm_price_estimate: 500, ...extra,
    }],
  });
  return db;
}

function card(extra: Record<string, any> = {}) {
  return {
    id: CARD,
    category: 'Baseball',
    conversational_card_info: { player_or_character: 'Mickey Mantle', set_name: 'Topps', year: '1960' },
    identity_revision: 3,
    pricing_selection_revision: 1,
    ...extra,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  searchEbayPricesWithFallback.mockResolvedValue(RESULT);
  seed();
});

describe('fetchAndCacheCardPrice revision guard', () => {
  it('writes comps with both revisions in the WHERE clause', async () => {
    const cached = await fetchAndCacheCardPrice(card());

    expect(cached?.median_price).toBe(25);
    const compWrite = db.updates.find(u => 'ebay_price_median' in (u.payload || {}))!;
    expect(Object.fromEntries(compWrite.filters)).toEqual({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    });
    expect(db.rows.get(CARD)!.ebay_price_median).toBe(25);
  });

  it('drops the comps, and the history snapshot, when the identity moved mid-flight', async () => {
    db = createFakeSupabase({
      rows: [{ ...seed().rows.get(CARD) }],
      beforeUpdate: fake => { fake.rows.get(CARD)!.identity_revision = 4; },
    });

    const cached = await fetchAndCacheCardPrice(card());

    expect(cached).toBeNull();
    expect(db.rows.get(CARD)!.ebay_price_median).toBeNull();
    // No card_price_history insert either: it would record the old card's comps.
    expect(db.queries.some(q => q.table === 'card_price_history')).toBe(false);
  });

  it('writes unguarded when the caller supplied no revisions', async () => {
    const cached = await fetchAndCacheCardPrice({
      id: CARD,
      category: 'Baseball',
      conversational_card_info: { player_or_character: 'Mickey Mantle' },
    } as any);

    expect(cached?.median_price).toBe(25);
    const compWrite = db.updates.find(u => 'ebay_price_median' in (u.payload || {}))!;
    expect(Object.fromEntries(compWrite.filters)).toEqual({ id: CARD });
  });
});
