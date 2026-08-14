'use client';

/**
 * Public, read-only market-value detail for org card pages.
 *
 * Renders the same substance as the consumer PriceChartingLookup — market
 * price range, price-by-grade chart, PSA/BGS/SGC tables, source attribution,
 * match-confidence glossary — but purely from the pricing payload already
 * persisted on the card (cards.dcm_cached_prices). No API calls, no auth, no
 * writes: a logged-out visitor must never trigger a priced lookup or spend
 * PriceCharting quota. Owner tooling (refresh, manual search, variant
 * selection) is deliberately absent.
 *
 * Themed with the org's brand color so it matches the rest of the page.
 */

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// Recharts is heavy and this is a public SEO page — keep it out of the
// initial bundle and off the server render.
const PriceByGradeChart = dynamic(() => import('./PriceByGradeChart'), {
  ssr: false,
  loading: () => <div className="h-[180px] rounded-lg bg-gray-50 animate-pulse" />,
});

/** Shape of cards.dcm_cached_prices (written by /api/pricing/*). */
export interface CachedPricePayload {
  prices?: {
    raw?: number | null;
    psa?: Record<string, number>;
    bgs?: Record<string, number>;
    sgc?: Record<string, number>;
    setName?: string | null;
    productName?: string | null;
    productId?: string | null;
    salesVolume?: number | string | null;
    lastUpdated?: string | null;
    isFallback?: boolean;
    exactMatchName?: string | null;
  } | null;
  queryUsed?: string | null;
  estimatedValue?: number | null;
  matchConfidence?: string | null;
}

interface Props {
  cached: CachedPricePayload | null;
  /** DCM whole grade — plots the store's own grade on the chart. */
  dcmGrade?: number | null;
  /** Persisted DCM estimate (cards.dcm_price_estimate). */
  dcmEstimate?: number | null;
  brand: string;
  /** Sports cards price on SportsCardsPro; everything else on PriceCharting. */
  isSportsCard: boolean;
  /** Prefilled search used when an exact product URL can't be derived. */
  searchFallbackUrl: string;
  /**
   * Who graded this card — the org's name, so the chart reads "Apex 9"
   * rather than "DCM 9". Falls back to DCM for non-org cards.
   */
  graderName?: string | null;
}

/**
 * Chart axis labels are tight, so long org names are shortened to their first
 * word ("Apex Grading Company" → "Apex") and hard-capped. Names that are one
 * long word get truncated rather than wrapping the axis.
 */
function shortGraderName(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'DCM';
  const firstWord = trimmed.split(/\s+/)[0];
  const candidate = firstWord.length >= 3 ? firstWord : trimmed;
  return candidate.length > 12 ? `${candidate.slice(0, 11)}…` : candidate;
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

/** Same slug rule the consumer lookup uses to build product URLs. */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[#]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .trim();
}

export function buildProductUrl(
  cached: CachedPricePayload | null,
  isSportsCard: boolean,
  fallbackUrl: string
): string {
  const host = isSportsCard ? 'https://www.sportscardspro.com' : 'https://www.pricecharting.com';
  const setSlug = slugify(cached?.prices?.setName || '');
  const productSlug = slugify(cached?.prices?.productName || '');
  if (setSlug && productSlug) return `${host}/game/${setSlug}/${productSlug}`;
  return fallbackUrl;
}

export default function OrgMarketValueDetails({
  cached,
  dcmGrade,
  dcmEstimate,
  brand,
  isSportsCard,
  searchFallbackUrl,
  graderName,
}: Props) {
  const prices = cached?.prices || null;
  const graderLabel = shortGraderName(graderName);

  // Low / median / average / high across every known price (raw + all
  // grading companies) — mirrors the consumer getMarketRange().
  const marketRange = useMemo(() => {
    if (!prices) return null;
    const all: number[] = [];
    if (prices.raw && prices.raw > 0) all.push(prices.raw);
    for (const company of [prices.psa, prices.bgs, prices.sgc]) {
      Object.values(company || {}).forEach(p => { if (p && p > 0) all.push(p); });
    }
    if (all.length === 0) return null;
    const sorted = [...all].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const average = all.reduce((s, p) => s + p, 0) / all.length;
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      low: round(sorted[0]),
      high: round(sorted[sorted.length - 1]),
      median: round(median),
      average: round(average),
      salesVolume: prices.salesVolume ?? null,
    };
  }, [prices]);

  // Grading premium: raw → PSA 10.
  const priceIncrease = useMemo(() => {
    const raw = prices?.raw;
    const psa10 = prices?.psa?.['10'];
    if (!raw || !psa10 || raw === 0) return null;
    return (((psa10 - raw) / raw) * 100).toFixed(0);
  }, [prices]);

  // Chart: raw, the store's DCM grade, then the best price per graded tier.
  const chartData = useMemo(() => {
    if (!prices) return [];
    const data: { grade: string; price: number; label: string; isSelf?: boolean }[] = [];
    if (prices.raw && prices.raw > 0) {
      data.push({ grade: 'Raw', price: prices.raw, label: 'Raw (Ungraded)' });
    }
    if (dcmEstimate && dcmEstimate > 0 && dcmGrade) {
      // This card's own grade, labelled with the grading brand.
      data.push({
        grade: 'SELF',
        price: dcmEstimate,
        label: `${graderLabel} ${Math.round(dcmGrade)}`,
        isSelf: true,
      });
    }
    for (const grade of ['7', '8', '9', '9.5', '10']) {
      const candidates = [prices.psa?.[grade], prices.bgs?.[grade], prices.sgc?.[grade]]
        .filter((p): p is number => typeof p === 'number' && p > 0);
      if (candidates.length > 0) {
        data.push({ grade, price: Math.max(...candidates), label: `Grade ${grade}` });
      }
    }
    return data.sort((a, b) => a.price - b.price);
  }, [prices, dcmGrade, dcmEstimate, graderLabel]);

  const gradeTables = useMemo(() => {
    const build = (company?: Record<string, number>) =>
      Object.entries(company || {})
        .filter(([, price]) => price > 0)
        .sort(([a], [b]) => Number(a) - Number(b));
    return {
      psa: build(prices?.psa),
      bgs: build(prices?.bgs),
      sgc: build(prices?.sgc),
    };
  }, [prices]);

  if (!prices) return null;

  const sourceName = isSportsCard ? 'SportsCardsPro' : 'PriceCharting';
  const productUrl = buildProductUrl(cached, isSportsCard, searchFallbackUrl);
  const hasGradeTables =
    gradeTables.psa.length > 0 || gradeTables.bgs.length > 0 || gradeTables.sgc.length > 0;

  const gradePriceColor = (grade: string) =>
    Number(grade) >= 9 ? 'text-emerald-600' : Number(grade) >= 7 ? 'text-blue-600' : 'text-gray-600';

  return (
    <div className="space-y-4">
      {/* Similar-card pricing notice */}
      {prices.isFallback && prices.exactMatchName && (
        <div className="rounded-lg p-3 border" style={{ backgroundColor: `${brand}0f`, borderColor: `${brand}44` }}>
          <p className="text-sm font-medium" style={{ color: brand }}>Using Similar Card Pricing</p>
          <p className="text-xs text-gray-600 mt-1">
            This exact card (<span className="font-medium">{prices.exactMatchName}</span>) doesn&apos;t have enough
            sales data yet. Pricing from a similar parallel is shown as a reference.
          </p>
        </div>
      )}

      {/* Market price range */}
      {marketRange && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Market Price Range</h4>
            {marketRange.salesVolume ? (
              <span className="text-xs text-gray-400">
                Sales Volume: <span className="font-medium text-gray-600">{marketRange.salesVolume}</span>
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {([
              ['Low', marketRange.low, 'text-green-600', false],
              ['Median', marketRange.median, 'text-blue-600', true],
              ['Average', marketRange.average, 'text-indigo-600', false],
              ['High', marketRange.high, 'text-purple-600', false],
            ] as const).map(([label, value, color, emphasize]) => (
              <div
                key={label}
                className={`bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden ${emphasize ? 'border-2' : 'border border-gray-100'}`}
                style={emphasize ? { borderColor: `${brand}66` } : undefined}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-base sm:text-xl font-bold truncate ${color}`}>{usd(value)}</p>
              </div>
            ))}
          </div>
          {priceIncrease && (
            <p className="text-center text-xs text-gray-500 mt-2">
              Grading premium: <span className="font-semibold text-emerald-600">+{priceIncrease}%</span> from raw to graded
            </p>
          )}
        </div>
      )}

      {/* Price by grade */}
      {chartData.length >= 2 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Price by Grade</h4>
            <p className="text-xs text-gray-500">Market prices from raw to graded</p>
          </div>
          <PriceByGradeChart data={chartData} brand={brand} />
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" />Raw</span>
            {dcmGrade && dcmEstimate ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: brand }} />Graded: {graderLabel}
              </span>
            ) : null}
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" />Graded: mail-away</span>
          </div>
        </div>
      )}

      {/* Per-company grade tables */}
      {hasGradeTables && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            ['PSA', gradeTables.psa],
            ['BGS', gradeTables.bgs],
            ['SGC', gradeTables.sgc],
          ] as const).map(([company, rows]) => rows.length > 0 && (
            <div key={company} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <span className="text-xs font-semibold text-gray-700 block mb-2">{company}</span>
              <div className="space-y-1">
                {rows.map(([grade, price]) => (
                  <div key={grade} className="flex justify-between text-xs">
                    <span className="text-gray-600">Grade {grade}</span>
                    <span className={`font-semibold ${gradePriceColor(grade)}`}>{usd(price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Source attribution + confidence glossary */}
      <div className="pt-1">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            Data from {sourceName}
            {prices.lastUpdated ? ` · ${prices.lastUpdated}` : ''}
          </span>
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: brand }}
          >
            View on {sourceName}
          </a>
        </div>

        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            How match confidence works
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2">
            <p className="font-medium text-gray-700">Match Confidence Levels:</p>
            <ul className="space-y-1.5 ml-1">
              <li className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">Best Match</span>
                <span>Card number, parallel type, and serial number all matched</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium whitespace-nowrap">Good Match</span>
                <span>Card number matched with either parallel or serial number</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium whitespace-nowrap">Partial Match</span>
                <span>Basic info matched (card number/set) or using similar card pricing</span>
              </li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}
