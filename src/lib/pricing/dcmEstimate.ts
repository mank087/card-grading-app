/**
 * DCM Estimated Value — single shared implementation (WS4)
 *
 * Replaces the three divergent copies that previously lived in
 * priceCharting.estimateDcmValue, dcmPriceTracker.calculateDcmEstimate and
 * the client-side PriceChartingLookup copy.
 *
 * Changes vs the legacy math:
 * - Grade tiers are INTERPOLATED, not rounded (a DCM 8.5 prices between the
 *   Grade 8 and Grade 9 comps instead of jumping to Grade 9 — the legacy
 *   Math.round always rounded half-up into the more expensive tier).
 * - The `raw × 3` fallback is gone: with no graded comps the estimate is the
 *   raw (ungraded) value, labeled as such. A flat 3x was wrong in both
 *   directions (modern commons ~1.2-1.5x, vintage keys can be 10x+).
 * - The DCM-vs-PSA market haircut (established-market discount) is unchanged:
 *   estimate = raw + (comp - raw) × multiplier(grade), multipliers 0.35–0.70.
 * - Low-data flagging: thin sales volume or a defaulted grade marks the
 *   estimate so the UI can qualify it.
 */

import type { NormalizedPrices } from '@/lib/priceCharting';

export interface DcmEstimateOptions {
  /** True when the card had no grade and 8 was assumed */
  gradeWasDefaulted?: boolean;
}

export interface DcmEstimateResult {
  estimate: number;
  /** How the number was produced (drives UI labeling) */
  method: 'interpolated' | 'raw-only' | 'discounted-comp';
  /** Thin comps: sales volume < 3 or grade was defaulted */
  lowData: boolean;
}

/** Grade anchors available in SportsCardsPro data, ascending */
const TIER_GRADES = [7, 8, 9, 9.5, 10] as const;

/** DCM market multiplier: how much of the graded premium over raw DCM commands */
function dcmMultiplier(grade: number): number {
  if (grade >= 9.5) return 0.70;
  if (grade >= 9) return 0.65;
  if (grade >= 8) return 0.55;
  if (grade >= 7) return 0.45;
  return 0.35;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Interpolate the graded-comp price at an arbitrary grade from the available
 * tier anchors. Returns null when no tiers have data.
 */
function interpolateCompAtGrade(psa: Record<string, number>, grade: number): number | null {
  const anchors = TIER_GRADES
    .map(g => ({ grade: g, price: psa[String(g)] }))
    .filter(a => typeof a.price === 'number' && a.price > 0);
  if (anchors.length === 0) return null;

  const clamped = Math.max(anchors[0].grade, Math.min(grade, anchors[anchors.length - 1].grade));

  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];
  for (const a of anchors) {
    if (a.grade <= clamped && a.grade >= lower.grade) lower = a;
    if (a.grade >= clamped && a.grade < upper.grade) upper = a;
  }
  // Exact anchor or single anchor
  if (upper.grade === lower.grade) return lower.price;

  const t = (clamped - lower.grade) / (upper.grade - lower.grade);
  return lower.price + t * (upper.price - lower.price);
}

/**
 * Estimate the DCM value for a card at a given DCM grade.
 * Returns null only when there is no price data at all.
 */
export function estimateDcmValue(
  prices: NormalizedPrices,
  dcmGrade: number,
  options: DcmEstimateOptions = {}
): DcmEstimateResult | null {
  const raw = prices.raw && prices.raw > 0 ? prices.raw : null;
  const salesVolume = prices.salesVolume != null ? parseInt(String(prices.salesVolume), 10) : null;
  const lowData = !!options.gradeWasDefaulted || (salesVolume !== null && !Number.isNaN(salesVolume) && salesVolume < 3);

  const comp = interpolateCompAtGrade(prices.psa, dcmGrade);

  // No graded comps: the honest answer is the ungraded value (WS4.1 —
  // replaces the legacy raw × 3 guess).
  if (comp === null) {
    if (raw === null) return null;
    return { estimate: round2(raw), method: 'raw-only', lowData };
  }

  // Graded comps but no raw: discount the comp (legacy behavior preserved)
  if (raw === null) {
    return { estimate: round2(comp * 0.70), method: 'discounted-comp', lowData };
  }

  // Low grades trade like raw; below the lowest tier the premium fades out
  if (dcmGrade <= 6) {
    return { estimate: round2(raw), method: 'raw-only', lowData };
  }

  const premium = Math.max(0, comp - raw);
  const estimate = raw + premium * dcmMultiplier(dcmGrade);
  return { estimate: round2(estimate), method: 'interpolated', lowData };
}
