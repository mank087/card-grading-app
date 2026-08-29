/**
 * Centering display helpers.
 *
 * v9.21 taught the grader to answer "XX/XX" when a face's design gives it
 * nothing to measure (full-bleed art, asymmetric inserts, die-cuts). That is a
 * correct answer, but every card detail page parsed the ratio with parseInt and
 * compared the resulting NaN against the tier thresholds. Every comparison is
 * false against NaN, so the chain fell through to its last branch and printed a
 * red "Off-Center" next to a 9/10 score and prose reading "Good centering".
 *
 * One place now decides what a ratio string means, so a face that could not be
 * measured says so instead of being reported as the worst tier there is.
 */

export type CenteringTier = { text: string; color: string; colorClass: string };

export const CENTERING_TIER_STYLES: Record<string, { color: string; colorClass: string }> = {
  // "Centered" is what R0 assigns to a face whose design has no border to
  // measure — the artwork runs to the cut, so there is no ratio to state and
  // nothing to fall short of. Distinct from "Perfect", which is a measurement.
  'Centered': { color: '#22c55e', colorClass: 'text-green-600' },
  'Perfect': { color: '#22c55e', colorClass: 'text-green-600' },
  'Excellent': { color: '#22c55e', colorClass: 'text-green-600' },
  'Good': { color: '#3b82f6', colorClass: 'text-blue-600' },
  'Fair': { color: '#eab308', colorClass: 'text-yellow-600' },
  'Off-Center': { color: '#ef4444', colorClass: 'text-orange-600' },
};

/** Shown when the design offers no border to measure — not a defect. */
export const NOT_MEASURABLE: CenteringTier = {
  text: 'Not measurable',
  color: '#6b7280',
  colorClass: 'text-gray-500',
};

/**
 * A ratio only counts if both halves are numeric and they add up to roughly a
 * whole card. "XX/XX", "N/A", "die-cut" and "60/60" are all rejected.
 */
export function parseCenteringRatio(ratioStr: unknown): { left: number; right: number } | null {
  if (typeof ratioStr !== 'string') return null;
  const m = ratioStr.trim().match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
  if (!m) return null;
  const left = Number(m[1]);
  const right = Number(m[2]);
  const total = left + right;
  if (total < 95 || total > 105) return null;
  return { left, right };
}

/** What to print in a ratio row. An unmeasurable face gets an em dash, never "XX/XX". */
export function displayCenteringRatio(ratioStr: unknown): string {
  return parseCenteringRatio(ratioStr) ? String(ratioStr).trim() : '—';
}

/** True when neither axis of this face carries a usable measurement. */
export function isCenteringMeasurable(lrText: unknown, tbText: unknown): boolean {
  return !!(parseCenteringRatio(lrText) || parseCenteringRatio(tbText));
}

/**
 * The tier to show for one face.
 * The grader's own quality_tier wins when it gave one — it is the same
 * judgement that produced the score and the prose, so the three agree.
 * Otherwise the tier is derived from whichever axes were measured, and a face
 * with no measurement at all reports NOT_MEASURABLE rather than "Off-Center".
 */
export function centeringQuality(lrText: unknown, tbText: unknown, aiTier?: string | null): CenteringTier {
  if (aiTier && CENTERING_TIER_STYLES[aiTier]) {
    return { text: aiTier, ...CENTERING_TIER_STYLES[aiTier] };
  }
  const lr = parseCenteringRatio(lrText);
  const tb = parseCenteringRatio(tbText);
  if (!lr && !tb) return NOT_MEASURABLE;

  const worst = Math.max(
    lr ? Math.abs(lr.left - 50) : 0,
    tb ? Math.abs(tb.left - 50) : 0
  );
  // Bands match the rubric's ratio table: 55/45 is the Gem threshold.
  if (worst <= 1) return { text: 'Perfect', ...CENTERING_TIER_STYLES['Perfect'] };
  if (worst <= 3) return { text: 'Excellent', ...CENTERING_TIER_STYLES['Excellent'] };
  if (worst <= 5) return { text: 'Good', ...CENTERING_TIER_STYLES['Good'] };
  if (worst <= 10) return { text: 'Fair', ...CENTERING_TIER_STYLES['Fair'] };
  return { text: 'Off-Center', ...CENTERING_TIER_STYLES['Off-Center'] };
}

/** ✓ / ⚠ / ✗ / – to sit beside the tier text. */
export function centeringTierIcon(tierText: string): string {
  if (tierText === NOT_MEASURABLE.text) return '–';
  if (tierText === 'Fair') return '⚠';
  if (tierText === 'Off-Center') return '✗';
  return '✓';
}
