/**
 * Phase 2C: the admin-correction pricing refresh. Guarded write, and on a
 * material correction the old card's comps must not be left on display.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/lib/pricing/__testSupport__/fakeSupabase';

const CARD = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

const fetchAndCacheDcmPrice = vi.fn();
const fetchCardPrice = vi.fn();
const savePriceSnapshot = vi.fn();

vi.mock('@/lib/pricing/dcmPriceTracker', () => ({
  fetchAndCacheDcmPrice: (...a: any[]) => fetchAndCacheDcmPrice(...a),
  isSportsCardCategory: (c: string) => ['Baseball', 'Football', 'Basketball'].includes(c),
}));
vi.mock('@/lib/ebay/priceTracker', () => ({
  fetchCardPrice: (...a: any[]) => fetchCardPrice(...a),
  savePriceSnapshot: (...a: any[]) => savePriceSnapshot(...a),
}));

const { refreshPricesAfterDetails } = await import('./detailsPricing');

const SNAP = {
  card_id: CARD, card_type: 'sports', lowest_price: 10, median_price: 30,
  average_price: 31, highest_price: 60, listing_count: 8, query_used: 'q', query_strategy: 's',
};

function seed(extra: Record<string, any> = {}, beforeUpdate?: (f: FakeSupabase) => void) {
  return createFakeSupabase({
    rows: [{
      id: CARD, category: 'Baseball', identity_revision: 2, pricing_selection_revision: 0,
      conversational_decimal_grade: 8,
      conversational_card_info: { player_or_character: 'Mickey Mantle' },
      ebay_price_median: 999, ebay_price_updated_at: '2026-01-01T00:00:00.000Z',
      ...extra,
    }],
    beforeUpdate,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchAndCacheDcmPrice.mockResolvedValue({ estimate: 500 });
  fetchCardPrice.mockResolvedValue(SNAP);
  savePriceSnapshot.mockResolvedValue(undefined);
});

describe('refreshPricesAfterDetails', () => {
  it('guards the comps write on the revisions it read', async () => {
    const db = seed();

    const result = await refreshPricesAfterDetails(db as any, CARD);

    expect(result.ebayMedian).toBe(30);
    expect(db.lastUpdateFilters()).toEqual({
      id: CARD, identity_revision: 2, pricing_selection_revision: 0,
    });
    expect(db.rows.get(CARD)!.ebay_price_median).toBe(30);
  });

  it('passes the revisions to the DCM refresh so its write is guarded too', async () => {
    const db = seed();
    await refreshPricesAfterDetails(db as any, CARD);
    expect(fetchAndCacheDcmPrice).toHaveBeenCalledWith(expect.objectContaining({
      identity_revision: 2, pricing_selection_revision: 0,
    }));
  });

  it('clears the old comps first on a material correction', async () => {
    const db = seed();
    fetchCardPrice.mockResolvedValue({ ...SNAP, listing_count: 0, median_price: null });

    const result = await refreshPricesAfterDetails(db as any, CARD, { materialChange: true });

    // The eBay search found nothing, and the wrong card's comps are gone rather
    // than left on the page as if they were current.
    expect(result.ebayMedian).toBeNull();
    const row = db.rows.get(CARD)!;
    expect(row.ebay_price_median).toBeNull();
    expect(row.ebay_price_updated_at).toBeNull();
  });

  it('keeps the previous comps when nothing new is found and the change was cosmetic', async () => {
    const db = seed();
    fetchCardPrice.mockResolvedValue({ ...SNAP, listing_count: 0, median_price: null });

    await refreshPricesAfterDetails(db as any, CARD);

    expect(db.rows.get(CARD)!.ebay_price_median).toBe(999);
    expect(db.updates).toHaveLength(0);
  });

  it('stops without pricing at all when the card moved on before the clear', async () => {
    const db = seed({}, fake => { fake.rows.get(CARD)!.identity_revision = 3; });

    const result = await refreshPricesAfterDetails(db as any, CARD, { materialChange: true });

    expect(result.errors).toContain('stale_identity');
    expect(fetchAndCacheDcmPrice).not.toHaveBeenCalled();
    expect(fetchCardPrice).not.toHaveBeenCalled();
    expect(db.rows.get(CARD)!.ebay_price_median).toBe(999);
  });
});
