/**
 * Phase 2C: the per-category pricing routes cache by card id. This one stands in
 * for all six (pokemon/mtg/lorcana/onepiece/other/pricecharting) — they share
 * the same savePriceCache shape and the same 409 contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/lib/pricing/__testSupport__/fakeSupabase';

const CARD = 'abababab-abab-4bab-8bab-abababababab';

let db: FakeSupabase;
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => db }));

const searchPokemonCardPrices = vi.fn();
vi.mock('@/lib/pokemonPricing', () => ({
  searchPokemonCardPrices: (...a: any[]) => searchPokemonCardPrices(...a),
  estimatePokemonDcmValue: () => 210,
  isPokemonPricingEnabled: () => true,
  getAvailablePokemonVariants: vi.fn().mockResolvedValue([]),
  getPokemonPricesForProductId: vi.fn(),
}));

const { POST } = await import('./route');

const PRICES = { raw: 60, productId: 'pc-1', productName: 'Charizard', psa: { '10': 900 } };

function seed(extra: Record<string, any> = {}) {
  db = createFakeSupabase({
    rows: [{
      id: CARD, identity_revision: 2, pricing_selection_revision: 0,
      dcm_price_estimate: null, dcm_cached_prices: null, dcm_prices_cached_at: null, ...extra,
    }],
  });
  return db;
}

const request = (body: Record<string, unknown>) => ({ json: async () => body } as any);

const BASE = { pokemonName: 'Charizard', dcmGrade: 9, cardId: CARD, forceRefresh: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  searchPokemonCardPrices.mockResolvedValue({ prices: PRICES, matchConfidence: 'high', queryUsed: 'q' });
  seed();
});

describe('POST /api/pricing/pokemon cache write', () => {
  it('guards the cache write on both revisions the client sent', async () => {
    const response = await POST(request({ ...BASE, identity_revision: 2, pricing_selection_revision: 0 }));

    expect(response.status).toBe(200);
    expect(db.lastUpdateFilters()).toEqual({
      id: CARD, identity_revision: 2, pricing_selection_revision: 0,
    });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(210);
  });

  it('answers 409 price_write_stale when the card was corrected mid-fetch', async () => {
    seed({ identity_revision: 3 });

    const response = await POST(request({ ...BASE, identity_revision: 2, pricing_selection_revision: 0 }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('price_write_stale');
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
    expect(db.rows.get(CARD)!.dcm_cached_prices).toBeNull();
  });

  it('writes unguarded for a client that sends no revisions', async () => {
    seed({ identity_revision: 8 });

    const response = await POST(request(BASE));

    expect(response.status).toBe(200);
    expect(db.lastUpdateFilters()).toEqual({ id: CARD });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(210);
  });
});
