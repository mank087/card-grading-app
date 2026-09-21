/**
 * The low / median / average / high a category price lookup prints in its
 * Market Value panel. Lifted out of PokemonPriceLookup so the card detail hero
 * can show the same numbers, and so the maths can be tested on its own.
 */

/** Low / median / average / high across every price the match returned (raw and all graded tiers). */
export interface MarketRange {
  low: number;
  high: number;
  median: number;
  average: number;
  salesVolume?: any;
}

export function computeMarketRange(prices: any): MarketRange | null {
  if (!prices) return null;
  const raw = prices.raw;

  const allPrices: number[] = [];
  if (raw && raw > 0) allPrices.push(raw);
  for (const tier of [prices.psa, prices.bgs, prices.sgc, prices.cgc]) {
    if (!tier) continue;
    Object.values(tier).forEach((price: any) => { if (price && price > 0) allPrices.push(price); });
  }

  if (allPrices.length === 0) return null;

  const sortedPrices = [...allPrices].sort((a, b) => a - b);
  const low = sortedPrices[0];
  const high = sortedPrices[sortedPrices.length - 1];
  const mid = Math.floor(sortedPrices.length / 2);
  const median = sortedPrices.length % 2 !== 0
    ? sortedPrices[mid]
    : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
  const average = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

  return {
    low: Math.round(low * 100) / 100,
    high: Math.round(high * 100) / 100,
    median: Math.round(median * 100) / 100,
    average: Math.round(average * 100) / 100,
    salesVolume: prices.salesVolume,
  };
}
