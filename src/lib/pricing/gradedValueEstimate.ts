/**
 * Grade-aware DCM value estimate for the PriceCharting-backed TCG categories
 * (Pokemon, MTG, Lorcana, One Piece, Other). One implementation, shared by the
 * server estimators in src/lib/*Pricing.ts and the client lookups in
 * src/components/pricing/*PriceLookup.tsx, so the number a customer sees is
 * the number that gets saved.
 *
 * The formula where a matching graded comp exists is unchanged:
 *   estimate = raw + (comp - raw) × multiplier(grade), multipliers 0.35–0.70.
 *
 * Fixed Sept 28 (customer report, two Mana Vaults):
 * - The `raw × 3` fallback used to fire for ANY grade with no matching comp. A
 *   grade-8 box topper with no PSA 8 listed was valued at 3× raw ($821.67),
 *   above its own PSA 10 ($354.44). Now:
 *     grade < 9  → at or below raw (scaled down for low grades) and never above
 *                  the cheapest known higher-grade comp (PSA, else other graders);
 *     grade >= 9 → the nearest known graded comp at or below the grade; raw × 3
 *                  (capped at the cheapest higher comp, floored at raw) when
 *                  only higher grades are known or there are no graded prices.
 * - For grades 9-10 the premium is floored at zero. A PSA 10 that sells below raw (thin or odd
 *   comps) no longer drags a grade-10 estimate under the ungraded price.
 * - Monotonic: a lower grade never estimates above a higher grade of the same
 *   product (each grade is capped by every higher whole grade's estimate).
 */

export interface GradedPriceTable {
  raw?: number | null;
  psa?: Record<string, number> | null;
  bgs?: Record<string, number> | null;
  sgc?: Record<string, number> | null;
  cgc?: Record<string, number> | null;
}

export type GradedValueMethod =
  /** raw + premium over the matching PSA comp */
  | 'comp'
  /** matching PSA comp, no raw price: comp × 0.70 */
  | 'comp-no-raw'
  /** grade >= 9, no matching comp: nearest known graded comp */
  | 'nearest-comp'
  /** grade < 9, no matching comp: at or below raw */
  | 'below-raw'
  /** grade >= 9 and the product has no graded prices at all */
  | 'raw-multiple';

export interface GradedValueEstimate {
  value: number;
  method: GradedValueMethod;
  /** Share of the graded premium applied, when a comp was used with raw */
  multiplier: number | null;
  /** The graded comp the estimate was built from, if any */
  compPrice: number | null;
  /** True when a higher grade's (lower) estimate capped this one */
  cappedByHigherGrade: boolean;
}

/** Legacy multiple used only when a high grade has no graded data whatsoever. */
const RAW_ONLY_HIGH_GRADE_MULTIPLE = 3;
/** Discount applied to the comp when there is no raw price (legacy). */
const NO_RAW_COMP_FACTOR = 0.70;

/** DCM market multiplier: how much of the graded premium over raw DCM commands. */
export function dcmPremiumMultiplier(grade: number): number {
  if (grade >= 9.5) return 0.70;
  if (grade >= 9) return 0.65;
  if (grade >= 8) return 0.55;
  if (grade >= 7) return 0.45;
  return 0.35;
}

/**
 * Share of raw for a grade below 9 with no graded comp. Raw is the typical
 * ungraded (near-mint-ish) sale, so a grade 8 is worth about raw and lower
 * grades progressively less, floored at half of raw.
 */
export function belowRawFactor(grade: number): number {
  if (grade >= 8) return 1;
  return Math.max(0.5, 1 - 0.1 * (8 - grade));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isPositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

interface Anchor { grade: number; price: number }

function anchorsOf(table: Record<string, number> | null | undefined): Anchor[] {
  if (!table) return [];
  return Object.entries(table)
    .map(([k, v]) => ({ grade: Number(k), price: v }))
    .filter(a => Number.isFinite(a.grade) && isPositive(a.price));
}

/** Every known graded price from every grader. */
function allGradedPrices(prices: GradedPriceTable): Anchor[] {
  return [
    ...anchorsOf(prices.psa), ...anchorsOf(prices.bgs),
    ...anchorsOf(prices.sgc), ...anchorsOf(prices.cgc),
  ];
}

/**
 * Comp anchors for interpolation: PSA when it has any, otherwise the other
 * graders merged (cheapest price per grade — the conservative choice).
 */
function compAnchors(prices: GradedPriceTable): Anchor[] {
  let anchors = anchorsOf(prices.psa);
  if (anchors.length === 0) {
    const byGrade = new Map<number, number>();
    for (const a of allGradedPrices(prices)) {
      const prev = byGrade.get(a.grade);
      if (prev === undefined || a.price < prev) byGrade.set(a.grade, a.price);
    }
    anchors = [...byGrade.entries()].map(([grade, price]) => ({ grade, price }));
  }
  return anchors.sort((a, b) => a.grade - b.grade);
}

/** Linear interpolation between anchors, clamped to the anchor range. */
function compAtGrade(anchors: Anchor[], grade: number): number {
  if (grade <= anchors[0].grade) return anchors[0].price;
  const last = anchors[anchors.length - 1];
  if (grade >= last.grade) return last.price;
  for (let i = 1; i < anchors.length; i++) {
    const lo = anchors[i - 1];
    const hi = anchors[i];
    if (grade <= hi.grade) {
      const t = (grade - lo.grade) / (hi.grade - lo.grade);
      return lo.price + t * (hi.price - lo.price);
    }
  }
  return last.price;
}

/** The estimate for one grade, before the monotonic cap. */
function baseEstimate(prices: GradedPriceTable, grade: number): Omit<GradedValueEstimate, 'cappedByHigherGrade'> | null {
  const raw = isPositive(prices.raw) ? prices.raw : null;
  const psa = prices.psa || {};

  // Matching comp: same lookup the estimators have always used.
  const rounded = String(Math.round(grade));
  const comp = isPositive(psa[rounded]) ? psa[rounded]
    : grade >= 9 && isPositive(psa['9.5']) ? psa['9.5']
    : null;

  if (comp !== null) {
    if (raw === null) {
      return { value: round2(comp * NO_RAW_COMP_FACTOR), method: 'comp-no-raw', multiplier: null, compPrice: comp };
    }
    const multiplier = dcmPremiumMultiplier(grade);
    // Floor only for 9-10: a PSA 7 that sells under raw is real signal that a
    // grade 7 is worth less than an ungraded near-mint copy.
    const premium = grade >= 9 ? Math.max(0, comp - raw) : comp - raw;
    return { value: round2(raw + premium * multiplier), method: 'comp', multiplier, compPrice: comp };
  }

  if (raw === null) return null;

  if (grade >= 9) {
    const anchors = compAnchors(prices);
    if (anchors.length === 0) {
      return { value: round2(raw * RAW_ONLY_HIGH_GRADE_MULTIPLE), method: 'raw-multiple', multiplier: null, compPrice: null };
    }
    // Only higher grades are known (e.g. a 9 with just a PSA 10): don't borrow the
    // 10's price. Keep the legacy multiple, capped at the cheapest higher comp.
    if (anchors[0].grade > grade) {
      const cap = Math.min(...anchors.map(a => a.price));
      return { value: round2(Math.max(raw, Math.min(raw * RAW_ONLY_HIGH_GRADE_MULTIPLE, cap))), method: 'raw-multiple', multiplier: null, compPrice: null };
    }
    const nearest = compAtGrade(anchors, grade);
    const multiplier = dcmPremiumMultiplier(grade);
    const premium = Math.max(0, nearest - raw);
    return { value: round2(raw + premium * multiplier), method: 'nearest-comp', multiplier, compPrice: round2(nearest) };
  }

  let value = raw * belowRawFactor(grade);
  // Cap by the reference grader's (PSA) higher-grade comps, or the other graders'
  // when PSA has none. A lone CGC/SGC 10 under raw is noise, not a ceiling.
  const higher = compAnchors(prices).filter(a => a.grade > grade).map(a => a.price);
  if (higher.length > 0) value = Math.min(value, ...higher);
  return { value: round2(value), method: 'below-raw', multiplier: null, compPrice: null };
}

/**
 * Estimate the DCM value of a card at `grade` from PriceCharting-style prices.
 * Returns null only when there is nothing to price from.
 */
export function estimateGradedValue(prices: GradedPriceTable, grade: number): GradedValueEstimate | null {
  const base = baseEstimate(prices, grade);
  if (!base) return null;

  // Monotonic: never above any higher whole grade's estimate.
  let value = base.value;
  for (let h = Math.floor(grade) + 1; h <= 10; h++) {
    const higher = baseEstimate(prices, h);
    if (higher && higher.value < value) value = higher.value;
  }
  return { ...base, value: round2(value), cappedByHigherGrade: value < base.value };
}

/** Number-only form used by the per-category estimators. */
export function estimateGradedValueNumber(prices: GradedPriceTable, grade: number): number | null {
  return estimateGradedValue(prices, grade)?.value ?? null;
}
