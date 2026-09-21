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
  /**
   * WHICH quote produced `low` / `high` — "Raw", "PSA 10", "BGS 9.5".
   *
   * ADDITIVE (card detail V2 review finding 2). The three numbers pool a raw
   * copy with every graded tier, so "Low $704 · High $3,538" read as a sale
   * range for THIS card unless the ends are named. Null when the source is not
   * identifiable (it never is for an empty pool, which returns null anyway).
   */
  lowLabel: string | null;
  highLabel: string | null;
}

/** 'psa' -> 'PSA'. The four graders the lookup returns. */
const TIER_LABELS: Record<string, string> = {
  psa: 'PSA',
  bgs: 'BGS',
  sgc: 'SGC',
  cgc: 'CGC',
};

interface Quote {
  price: number;
  label: string;
}

/**
 * Every priced quote in the match, each carrying the name of the tier it came
 * from. Order is raw first, then PSA/BGS/SGC/CGC in the order the tier object
 * enumerates its grades — the same set `computeMarketRange` has always pooled.
 */
function collectQuotes(prices: any): Quote[] {
  const quotes: Quote[] = [];
  if (prices?.raw && prices.raw > 0) quotes.push({ price: prices.raw, label: 'Raw' });
  for (const key of ['psa', 'bgs', 'sgc', 'cgc'] as const) {
    const tier = prices?.[key];
    if (!tier) continue;
    for (const [grade, price] of Object.entries(tier)) {
      if (typeof price === 'number' && price > 0) {
        quotes.push({ price, label: `${TIER_LABELS[key]} ${grade}` });
      }
    }
  }
  return quotes;
}

export function computeMarketRange(prices: any): MarketRange | null {
  if (!prices) return null;

  const quotes = collectQuotes(prices);
  if (quotes.length === 0) return null;

  const allPrices = quotes.map((q) => q.price);
  const sortedQuotes = [...quotes].sort((a, b) => a.price - b.price);
  const sortedPrices = sortedQuotes.map((q) => q.price);

  const lowQuote = sortedQuotes[0];
  const highQuote = sortedQuotes[sortedQuotes.length - 1];
  const mid = Math.floor(sortedPrices.length / 2);
  const median = sortedPrices.length % 2 !== 0
    ? sortedPrices[mid]
    : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
  const average = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

  return {
    low: Math.round(lowQuote.price * 100) / 100,
    high: Math.round(highQuote.price * 100) / 100,
    median: Math.round(median * 100) / 100,
    average: Math.round(average * 100) / 100,
    salesVolume: prices.salesVolume,
    lowLabel: lowQuote.label,
    highLabel: highQuote.label,
  };
}
