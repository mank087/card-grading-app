/**
 * Phase 2C: the batch/cron writer family.
 *
 * refreshCardPrice is the per-card logic behind the weekly cron, the manual
 * portfolio refresh and the single-card detail-page refresh, so these three
 * tests cover all three callers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from './__testSupport__/fakeSupabase';

const CARD = '22222222-2222-4222-8222-222222222222';

let db: FakeSupabase;

vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => db }));

const getPokemonPricesForProductId = vi.fn();
const searchPokemonCardPrices = vi.fn();
vi.mock('@/lib/pokemonPricing', () => ({
  getPokemonPricesForProductId: (...a: any[]) => getPokemonPricesForProductId(...a),
  searchPokemonCardPrices: (...a: any[]) => searchPokemonCardPrices(...a),
  estimatePokemonDcmValue: () => 250,
}));
const fetchAndCacheCardPrice = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/ebay/priceTracker', () => ({
  fetchAndCacheCardPrice: (...a: any[]) => fetchAndCacheCardPrice(...a),
}));
// Unused by these tests, but imported by the module under test.
vi.mock('@/lib/mtgPricing', () => ({ getMTGPricesForProductId: vi.fn(), searchMTGCardPrices: vi.fn(), estimateMTGDcmValue: vi.fn() }));
vi.mock('@/lib/lorcanaPricing', () => ({ getLorcanaPricesForProductId: vi.fn(), searchLorcanaCardPrices: vi.fn(), estimateLorcanaDcmValue: vi.fn() }));
vi.mock('@/lib/onepiecePricing', () => ({ getOnePiecePricesForProductId: vi.fn(), searchOnePieceCardPrices: vi.fn(), estimateOnePieceDcmValue: vi.fn() }));
vi.mock('@/lib/otherPricing', () => ({ getOtherPricesForProductId: vi.fn(), searchOtherCardPrices: vi.fn(), estimateOtherDcmValue: vi.fn() }));
vi.mock('@/lib/priceCharting', () => ({ searchSportsCardPrices: vi.fn(), getProductPrices: vi.fn(), normalizePrices: vi.fn() }));
vi.mock('@/lib/pricing/dcmPriceTracker', () => ({ calculateDcmEstimate: () => ({ estimate: 1 }) }));

const { refreshCardPrice, REFRESH_CARD_SELECT } = await import('./batchPriceRefresh');

const CARD_INFO = { player_or_character: 'Charizard', set_name: 'Base Set', card_number: '4' };
const PRICES = { raw: 80, productId: 'auto-9', productName: 'Charizard Base Set #4' };

function seed(extra: Record<string, any> = {}) {
  db = createFakeSupabase({
    rows: [{
      id: CARD, category: 'Pokemon', identity_revision: 3, pricing_selection_revision: 1,
      dcm_price_estimate: null, dcm_price_product_id: 'auto-9',
      dcm_selected_product_id: null, dcm_selected_product_name: null, ...extra,
    }],
  });
  return db;
}

function cardArg(extra: Record<string, any> = {}) {
  return {
    id: CARD, category: 'Pokemon', identity_revision: 3, pricing_selection_revision: 1,
    dcm_price_product_id: 'auto-9', ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getPokemonPricesForProductId.mockResolvedValue(PRICES);
  searchPokemonCardPrices.mockResolvedValue({ prices: { ...PRICES, productId: 'search-3' }, matchConfidence: 'medium', queryUsed: 'q' });
  fetchAndCacheCardPrice.mockResolvedValue(null);
  seed();
});

describe('refreshCardPrice revision guard', () => {
  it('writes the price with both revisions in the WHERE clause', async () => {
    const result = await refreshCardPrice(cardArg(), CARD_INFO, 'pokemon', 9);

    expect(result).toMatchObject({ success: true, source: 'pricecharting-id', estimate: 250 });
    expect(db.lastUpdateFilters()).toEqual({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(250);
  });

  it('writes nothing when the identity changes between the read and the write', async () => {
    // The owner corrects the card while PriceCharting is being queried.
    db = createFakeSupabase({
      rows: [{ ...seed().rows.get(CARD) }],
      beforeUpdate: fake => { fake.rows.get(CARD)!.identity_revision = 4; },
    });

    const result = await refreshCardPrice(cardArg(), CARD_INFO, 'pokemon', 9);

    expect(result.stale).toBe(true);
    // Stale is not a failure: the cron must not count it or retry it.
    expect(result.success).toBe(true);
    expect(result.estimate).toBeNull();
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
    expect(db.rows.get(CARD)!.dcm_price_updated_at).toBeUndefined();
  });

  it('writes nothing when the product selection changes mid-flight', async () => {
    db = createFakeSupabase({
      rows: [{ ...seed().rows.get(CARD) }],
      beforeUpdate: fake => { fake.rows.get(CARD)!.pricing_selection_revision = 2; },
    });
    const result = await refreshCardPrice(cardArg(), CARD_INFO, 'pokemon', 9);
    expect(result.stale).toBe(true);
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
  });

  it('writes unguarded when the caller did not select the revision columns', async () => {
    const result = await refreshCardPrice(
      { id: CARD, category: 'Pokemon', dcm_price_product_id: 'auto-9' }, CARD_INFO, 'pokemon', 9,
    );
    expect(result.success).toBe(true);
    expect(db.lastUpdateFilters()).toEqual({ id: CARD });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(250);
  });

  it('guards the no-match marker too, so a corrected card is not muted for a week', async () => {
    getPokemonPricesForProductId.mockResolvedValue(null);
    searchPokemonCardPrices.mockResolvedValue({ prices: null, matchConfidence: 'none', queryUsed: 'q' });
    fetchAndCacheCardPrice.mockRejectedValue(new Error('ebay down'));
    db = createFakeSupabase({
      rows: [{ ...seed().rows.get(CARD) }],
      beforeUpdate: fake => { fake.rows.get(CARD)!.identity_revision = 4; },
    });

    const result = await refreshCardPrice(cardArg(), CARD_INFO, 'pokemon', 9);

    expect(result.source).toBe('no-match');
    expect(db.rows.get(CARD)!.dcm_price_match_confidence).toBeUndefined();
    expect(Object.fromEntries(db.updates[0].filters)).toEqual({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    });
  });

  it('carries the revisions into the eBay fallback', async () => {
    getPokemonPricesForProductId.mockResolvedValue(null);
    searchPokemonCardPrices.mockResolvedValue({ prices: null, matchConfidence: 'none', queryUsed: 'q' });

    await refreshCardPrice(cardArg(), CARD_INFO, 'pokemon', 9);

    expect(fetchAndCacheCardPrice).toHaveBeenCalledWith(expect.objectContaining({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    }));
  });
});

describe('owner-selection precedence', () => {
  it('prices the product the owner picked, not the last automatic match', async () => {
    await refreshCardPrice(
      cardArg({ dcm_selected_product_id: 'owner-1' }), CARD_INFO, 'pokemon', 9,
    );

    expect(getPokemonPricesForProductId).toHaveBeenCalledWith('owner-1');
    expect(getPokemonPricesForProductId).not.toHaveBeenCalledWith('auto-9');
  });

  it('never replaces or clears the owner pick', async () => {
    seed({ dcm_selected_product_id: 'owner-1', dcm_selected_product_name: 'Owner choice' });
    await refreshCardPrice(cardArg({ dcm_selected_product_id: 'owner-1' }), CARD_INFO, 'pokemon', 9);

    const payload = db.updates[0].payload!;
    expect(payload).not.toHaveProperty('dcm_selected_product_id');
    expect(payload).not.toHaveProperty('dcm_selected_product_name');
    expect(payload).not.toHaveProperty('dcm_selected_at');
    expect(db.rows.get(CARD)!.dcm_selected_product_id).toBe('owner-1');
    expect(db.rows.get(CARD)!.dcm_selected_product_name).toBe('Owner choice');
  });

  it('does not fall back to an automatic search when the picked product has no price', async () => {
    getPokemonPricesForProductId.mockResolvedValue(null);

    const result = await refreshCardPrice(
      cardArg({ dcm_selected_product_id: 'owner-1' }), CARD_INFO, 'pokemon', 9,
    );

    expect(result).toMatchObject({ success: false, source: 'owner-pick-unavailable' });
    expect(searchPokemonCardPrices).not.toHaveBeenCalled();
    expect(db.updates).toHaveLength(0);
  });

  it('still searches when there is no owner pick', async () => {
    getPokemonPricesForProductId.mockResolvedValue(null);
    await refreshCardPrice(cardArg(), CARD_INFO, 'pokemon', 9);
    expect(searchPokemonCardPrices).toHaveBeenCalled();
  });
});

describe('REFRESH_CARD_SELECT', () => {
  it('carries the revisions and the owner pick, so no caller can lose the guard', () => {
    for (const column of [
      'identity_revision', 'pricing_selection_revision',
      'dcm_selected_product_id', 'dcm_price_product_id', 'conversational_card_info',
    ]) {
      expect(REFRESH_CARD_SELECT).toContain(column);
    }
  });
});
