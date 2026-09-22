/**
 * ONE valuation object for the hero's value panel (review finding 5).
 *
 * The bug this replaces: the panel showed a LIVE amount from the category
 * price lookup while printing `value.updatedAt` — the STORED row's
 * `dcm_price_updated_at` — beside it, so a fresh live lookup read
 * "live lookup · Updated 3 days ago". Amount and freshness came from two
 * different places and could not be made to agree.
 *
 * The rule here is: the freshness belongs to the number that is shown, and it
 * is printed only when the source genuinely knows it.
 *
 *   basis 'live'        the lookup fetched fresh prices. It reports no
 *                       timestamp for the underlying price data, only "not
 *                       cached", so NO freshness is printed: the source label
 *                       already says "live lookup", and a fetch completing
 *                       says nothing about how old the prices behind it are.
 *   basis 'live-cached' the lookup served a cached match. It knows the cache
 *                       age in days, so that is what is printed, named as
 *                       cached. A fetch completing is never allowed to restamp
 *                       a cached price as new.
 *   basis 'stored'      the row's own resolved value and its own
 *                       `dcm_price_updated_at`. A null timestamp means UNKNOWN,
 *                       not stale (the eBay-fallback path never stamps it for
 *                       ~21k rows), so nothing is printed at all.
 */

import type { PriceSource } from '@/lib/pricing/resolveCardValue';

export type ValuationBasis = 'live' | 'live-cached' | 'stored';

/** What the lookup knows about the freshness of the number it just reported. */
export interface LiveValuationInput {
  /** Already through `assessValueTrust`; null means "no trusted live number". */
  amount: number | null;
  /** The lookup served this from its price cache rather than fetching. */
  isCached?: boolean;
  /** Cache age in days, as the lookup reports it. Null when it does not know. */
  cacheAgeDays?: number | null;
}

export interface StoredValuationInput {
  status: string;
  amount: number | null;
  source: PriceSource;
  /** cards.dcm_price_updated_at, or null when the row was never stamped. */
  updatedAt: string | null;
}

export interface Valuation {
  /** The number to print, or null for "Unavailable". */
  amount: number | null;
  /** "DCM estimate (live lookup)". Never null — it describes `amount`. */
  sourceLabel: string;
  /** "Cached · updated 3 days ago", a stored timestamp's wording, or null to print nothing. */
  freshnessLabel: string | null;
  /**
   * THE ONE LINE THE HERO PRINTS (review 2026-09-22, polish).
   *
   * The panel used to concatenate `sourceLabel` and `freshnessLabel`, which
   * read "DCM estimate (live lookup) · Cached · updated 4 days ago" — three
   * status words for one number, two of which contradict each other. This says
   * it once: "DCM estimate · from cached prices, 4 days old", "DCM estimate ·
   * fresh prices", "DCM estimate · stored value, updated Sep 18, 2026".
   *
   * The two fields above are kept because they are the tested primitives this
   * is assembled from; nothing renders them separately any more.
   */
  statusLabel: string;
  basis: ValuationBasis;
  /** The stored value is withheld and no live number replaced it. */
  isWithheld: boolean;
}

const SOURCE_LABEL: Record<PriceSource, string> = {
  'dcm-estimate': 'DCM estimate',
  'dcm-cached': 'DCM estimate (cached)',
  'scryfall-foil': 'Scryfall (foil)',
  scryfall: 'Scryfall',
  'ebay-median': 'eBay sold median',
  withheld: 'Withheld',
  none: 'No source',
};

/** "3 days ago" from a whole/fractional day count the lookup reported. */
function cacheAgeWording(days: number): string {
  if (days < 1) return 'Cached · updated today';
  const whole = Math.round(days);
  return `Cached · updated ${whole} day${whole === 1 ? '' : 's'} ago`;
}

/** "Updated 2 hours ago" from an ISO timestamp. Null for anything unparseable. */
export function formatStoredFreshness(iso: string, now: number = Date.now()): string | null {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 0) return null;
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * "Sep 18, 2026" — an actual date, not "4 days ago", for the stored value.
 *
 * Written out rather than left to `toLocaleDateString` so the string does not
 * depend on which ICU data the runtime shipped with. Null for anything
 * unparseable, which prints no date at all rather than "Invalid Date".
 */
export function formatStoredDate(iso: string): string | null {
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return null;
  return `${MONTHS[then.getUTCMonth()]} ${then.getUTCDate()}, ${then.getUTCFullYear()}`;
}

/** "from cached prices, 4 days old" / "…, updated today". */
function cachedWording(days: number | null): string {
  if (days === null) return 'from cached prices';
  if (days < 1) return 'from cached prices, updated today';
  const whole = Math.round(days);
  return `from cached prices, ${whole} day${whole === 1 ? '' : 's'} old`;
}

export function buildValuation(
  stored: StoredValuationInput,
  live: LiveValuationInput | null,
  now: number = Date.now(),
): Valuation {
  // A trusted live estimate wins over the stored number — and brings its own
  // freshness with it.
  if (live && live.amount !== null) {
    if (live.isCached) {
      const days = typeof live.cacheAgeDays === 'number' && Number.isFinite(live.cacheAgeDays)
        ? live.cacheAgeDays
        : null;
      return {
        amount: live.amount,
        sourceLabel: 'DCM estimate (live lookup)',
        freshnessLabel: days === null ? 'Cached price' : cacheAgeWording(days),
        statusLabel: `DCM estimate · ${cachedWording(days)}`,
        basis: 'live-cached',
        isWithheld: false,
      };
    }
    return {
      amount: live.amount,
      sourceLabel: 'DCM estimate (live lookup)',
      freshnessLabel: null,
      statusLabel: 'DCM estimate · fresh prices',
      basis: 'live',
      isWithheld: false,
    };
  }

  const isWithheld = stored.status === 'withheld';
  const sourceLabel =
    stored.amount !== null
      ? SOURCE_LABEL[stored.source] ?? 'No source'
      : 'No price source for this card yet';
  const storedDate =
    stored.amount !== null && stored.updatedAt ? formatStoredDate(stored.updatedAt) : null;

  return {
    amount: stored.amount,
    sourceLabel,
    freshnessLabel:
      stored.amount !== null && stored.updatedAt
        ? formatStoredFreshness(stored.updatedAt, now)
        : null,
    // No date on file means UNKNOWN, not stale (the eBay-fallback path never
    // stamps ~21k rows), so the line stops after the source rather than
    // inventing a freshness for it.
    statusLabel: storedDate ? `${sourceLabel} · stored value, updated ${storedDate}` : sourceLabel,
    basis: 'stored',
    isWithheld,
  };
}
