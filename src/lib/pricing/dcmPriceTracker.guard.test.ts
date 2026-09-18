/**
 * Phase 2C: the sports (PriceCharting/SportsCardsPro) writer family, plus the
 * owner-pick precedence rule for it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from './__testSupport__/fakeSupabase';

const CARD = '33333333-3333-4333-8333-333333333333';

let db: FakeSupabase;
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => db }));

const searchSportsCardPrices = vi.fn();
const getProductPrices = vi.fn();
vi.mock('@/lib/priceCharting', () => ({
  searchSportsCardPrices: (...a: any[]) => searchSportsCardPrices(...a),
  getProductPrices: (...a: any[]) => getProductPrices(...a),
  normalizePrices: (raw: any) => raw,
  isPriceChartingEnabled: () => true,
}));
vi.mock('@/lib/sportsCardMatcher', () => ({
  getLocalSportsProductById: vi.fn().mockResolvedValue(null),
  productToNormalizedPrices: (row: any) => row,
}));
vi.mock('@/lib/pricing/dcmEstimate', () => ({
  estimateDcmValue: () => ({ estimate: 400, lowData: false }),
}));

const {
  fetchAndCacheDcmPrice, refreshDcmPriceByProductId, getDcmPriceWithCache, batchRefreshDcmPrices,
} = await import('./dcmPriceTracker');

const PRICES = {
  raw: 100, productId: 'auto-9', productName: 'Mantle 1960 Topps #350',
  psa: { '9': 500 }, bgs: {}, sgc: {},
};

function seed(extra: Record<string, any> = {}) {
  db = createFakeSupabase({
    rows: [{
      id: CARD, category: 'Baseball', identity_revision: 3, pricing_selection_revision: 1,
      conversational_decimal_grade: 9, conversational_card_info: { player_or_character: 'Mickey Mantle' },
      dcm_price_estimate: null, dcm_price_updated_at: null, dcm_price_product_id: 'auto-9',
      dcm_selected_product_id: null, ...extra,
    }],
  });
  return db;
}

function pricingCard(extra: Record<string, any> = {}) {
  return {
    id: CARD, category: 'Baseball', conversational_decimal_grade: 9,
    conversational_card_info: { player_or_character: 'Mickey Mantle', set_name: 'Topps', year: '1960' },
    identity_revision: 3, pricing_selection_revision: 1, ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  searchSportsCardPrices.mockResolvedValue({ prices: PRICES, matchConfidence: 'high', queryUsed: 'q' });
  getProductPrices.mockResolvedValue(PRICES);
  seed();
});

describe('fetchAndCacheDcmPrice revision guard', () => {
  it('writes with both revisions in the WHERE clause', async () => {
    const result = await fetchAndCacheDcmPrice(pricingCard());

    expect(result?.estimate).toBe(400);
    expect(db.lastUpdateFilters()).toEqual({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(400);
  });

  it('drops the price when the identity changes between the read and the write', async () => {
    db = createFakeSupabase({
      rows: [{ ...seed().rows.get(CARD) }],
      beforeUpdate: fake => { fake.rows.get(CARD)!.identity_revision = 4; },
    });

    const result = await fetchAndCacheDcmPrice(pricingCard());

    expect(result).toBeNull();
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
  });

  it('writes unguarded when the caller supplied no revisions', async () => {
    const result = await fetchAndCacheDcmPrice({
      id: CARD, category: 'Baseball', conversational_decimal_grade: 9,
      conversational_card_info: { player_or_character: 'Mickey Mantle' },
    });
    expect(result?.estimate).toBe(400);
    expect(db.lastUpdateFilters()).toEqual({ id: CARD });
  });
});

describe('refreshDcmPriceByProductId revision guard', () => {
  it('guards the write and drops a stale one', async () => {
    db = createFakeSupabase({
      rows: [{ ...seed().rows.get(CARD) }],
      beforeUpdate: fake => { fake.rows.get(CARD)!.pricing_selection_revision = 5; },
    });

    const result = await refreshDcmPriceByProductId(CARD, 'owner-1', 9, {
      identity_revision: 3, pricing_selection_revision: 1,
    });

    expect(result).toBeNull();
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
  });
});

describe('owner-selection precedence (sports)', () => {
  it('getDcmPriceWithCache reprices the owner pick and never searches', async () => {
    await getDcmPriceWithCache(CARD, {
      category: 'Baseball',
      conversational_decimal_grade: 9,
      conversational_card_info: { player_or_character: 'Mickey Mantle' },
      identity_revision: 3,
      pricing_selection_revision: 1,
      dcm_selected_product_id: 'owner-1',
    }, { forceNewSearch: true });

    expect(getProductPrices).toHaveBeenCalledWith('owner-1');
    expect(searchSportsCardPrices).not.toHaveBeenCalled();
  });

  it('getDcmPriceWithCache searches when there is no owner pick', async () => {
    await getDcmPriceWithCache(CARD, {
      category: 'Baseball',
      conversational_decimal_grade: 9,
      conversational_card_info: { player_or_character: 'Mickey Mantle' },
      identity_revision: 3,
      pricing_selection_revision: 1,
    }, { forceNewSearch: true });

    expect(searchSportsCardPrices).toHaveBeenCalled();
  });

  it('batchRefreshDcmPrices prefers the owner pick over the automatic product id', async () => {
    seed({ dcm_selected_product_id: 'owner-1', dcm_price_product_id: 'auto-9' });

    await batchRefreshDcmPrices([CARD], { force: true, delayMs: 0, forceNewSearch: true });

    expect(getProductPrices).toHaveBeenCalledWith('owner-1');
    expect(searchSportsCardPrices).not.toHaveBeenCalled();
    // and it leaves the pick itself untouched
    expect(db.rows.get(CARD)!.dcm_selected_product_id).toBe('owner-1');
  });

  it('batchRefreshDcmPrices guards its write on the revisions it read', async () => {
    seed({ dcm_selected_product_id: 'owner-1' });
    await batchRefreshDcmPrices([CARD], { force: true, delayMs: 0 });

    expect(db.lastUpdateFilters()).toEqual({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    });
  });
});
