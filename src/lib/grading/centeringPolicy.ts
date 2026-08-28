/**
 * centeringPolicy.ts — when a centering score is allowed to be 10.
 *
 * Customer report (John Russell, Aug 28 2026): vintage cards visibly off-centre
 * were awarded centering 10. Verified against stored measurements — Don Maynard
 * was submitted twice, the model said 48/52 then 50/50, and CV independently
 * measured 26/74 then 25/75. Both submissions scored centering 10.
 *
 * Every rule here can only ever LOWER a score. None can raise one. That is
 * deliberate: the goal is accuracy, and the failure being corrected is
 * exclusively over-generosity.
 *
 * ── Why this is a separate module ──────────────────────────────────────────
 * The rules previously lived inside the reconciliation block in
 * visionGrader.ts, so changing a threshold cost a live grading run to evaluate.
 * These are pure functions over plain data: thresholds become unit tests.
 *
 * ── The rules, and what each one is for ────────────────────────────────────
 * R1  ratio worse than 55/45 cannot be a 10   (kills the ±2% upward drift)
 * R2  no measured ratio at all cannot be a 10 (Dave Duerson: 10/10, no ratio)
 * R3  the three passes must agree             (if they disagree, nothing knows)
 * R4  only a bordered face can claim a 10     (Alex Karras: full-bleed back
 *                                              classified "Standard Bordered")
 * R5  vintage + mediocre photos need unanimity
 * R6  confident CV disagreement vetoes a 10   (the ONLY rule that catches
 *                                              Don Maynard)
 *
 * R1–R5 need no CV whatsoever. R6 is the single place CV is consulted, and it
 * may only cap — see the note on it.
 */

export type FaceLayout =
  | 'standard_bordered'   // a measurable printed border on all four sides
  | 'asymmetric'          // intentionally uneven design
  | 'full_bleed'          // art runs to the cut edge; no border to measure
  | 'obstructed'          // holder, sleeve glare or crop hides a side
  | 'indeterminate';      // could not be classified

/** Layouts where a border-derived ratio means anything. */
const MEASURABLE_LAYOUTS: ReadonlySet<FaceLayout> = new Set<FaceLayout>(['standard_bordered']);

/**
 * Map the rubric's existing `centering.<face>.card_type` vocabulary onto the
 * layout enum. The field already exists in the grading output — the Karras
 * failure was that a near-full-bleed asymmetric back was CLASSIFIED "Standard
 * Bordered", not that nothing recorded the layout. So this reads what is
 * already there rather than adding a parallel field.
 *
 * Anything unrecognised maps to 'indeterminate', which is not measurable — an
 * unknown layout must not inherit the benefit of the doubt.
 */
export function layoutFromCardType(cardType: string | null | undefined): FaceLayout | null {
  const t = String(cardType ?? '').trim().toLowerCase();
  if (!t) return null; // nothing stated — R4 stays out of it, R2 still applies
  if (t.includes('standard') || t.includes('bordered')) return 'standard_bordered';
  if (t.includes('asymmetric')) return 'asymmetric';
  if (t.includes('borderless') || t.includes('full')) return 'full_bleed';
  if (t.includes('die-cut') || t.includes('die cut')) return 'full_bleed';
  // "Foil-Frame" and anything else: a frame is not a printed border with even
  // margins, so it cannot support a Gem centering claim by border measurement.
  return 'indeterminate';
}

/**
 * Ratio deviation (points from 50) at the rubric's own 55/45 line for a 10.
 * 55/45 → dev 5. Anything worse cannot be Gem-eligible.
 */
export const GEM_MAX_DEV = 5;

/**
 * R3: maximum spread between per-pass centering deviations before the
 * measurement is treated as unstable.
 *
 * CALIBRATED, not guessed. Across 140 production cards the pass-to-pass spread
 * runs p50=2, p75=3, p90=4, p95=4, max=11. Among centering-10s specifically:
 * p50=2, p75=3, p90=3. So a spread of 4+ is genuinely unusual — the passes
 * normally agree within 2–3 points.
 *
 * Impact on centering-10s at each candidate cut, measured:
 *   >=2 blocks 66%   >=3 blocks 43%   >=4 blocks 5%   >=5 blocks 4%
 * 4 is the knee: it isolates real disagreement without punishing ordinary
 * ensemble noise. Re-derive if the ensemble size or prompt changes.
 */
export const MAX_PASS_SPREAD = 4;

/**
 * R6: how far CV must diverge from the model before it may veto a 10.
 * 11 points = 61/39 or worse, i.e. two full bands below Gem. On the complaint
 * cards this fires for Don Maynard (dev 25) and both Butkus, and does NOT fire
 * for Lawrence Taylor (dev 3) or the Karras front (dev 9) — which is the
 * intended behaviour, since Taylor is the card the customer said was correct.
 */
export const CV_VETO_MIN_DEV = 11;

/**
 * Bar for a SINGLE-axis CV reading. Higher than the two-axis bar, because a
 * lone axis has more opportunity to be a bad read.
 *
 * An earlier draft required both axes before the veto could act at all. That
 * was wrong, and replaying it against the customer's cards proved it: CV
 * measured both axes on ZERO of 15 vintage submissions, so the rule fired
 * never — on precisely the cards that were complained about.
 *
 * The reasoning error was importing a rule that belongs elsewhere. Requiring
 * both axes protects against "the axis I did not measure might be worse",
 * which matters when SETTING a score. It is irrelevant when CAPPING one:
 * centering is scored on the WORST axis, so a single axis measured 25 points
 * off already disqualifies a 10 whatever the other axis does.
 */
export const CV_VETO_MIN_DEV_ONE_AXIS = 20;

/** …and only when the model itself claimed the card was Gem-clean. */
export const CV_VETO_MAX_MODEL_DEV = GEM_MAX_DEV;

/** Cards printed before this are "vintage" for R5. */
export const VINTAGE_BEFORE_YEAR = 2000;

export interface CvEvidence {
  /** Deviation from 50 in ratio points, or null when not measured. */
  dev: number | null;
  /** CV measured BOTH axes. A one-axis reading may flag, never act. */
  bothAxes: boolean;
}

export interface CenteringPolicyInput {
  face: 'front' | 'back';
  /** The score the ensemble proposes for this face. */
  proposedScore: number;
  /** Model's stated ratio for this face, e.g. "55/45". Null when unmeasured. */
  ratio: string | null;
  /** Per-pass centering deviations, from grading_passes.pass_N.centering_dev. */
  passDevs: number[];
  layout: FaceLayout | null;
  /** Per-pass final centering scores, for the R5 unanimity check. */
  passScores: number[];
  /** CV reading for this face. Only consulted for the front — see R6. */
  cv: CvEvidence | null;
  /** A/B/C/D from the grader's image assessment. */
  imageConfidence: string | null;
  /** Print year, for R5. */
  year: number | null;
}

export interface CenteringPolicyResult {
  /** Score after policy. Never higher than proposedScore. */
  score: number;
  /** True when a rule lowered the score. */
  capped: boolean;
  /** True when a human should look at this card. */
  reviewFlag: boolean;
  /** Rule ids that fired, e.g. ['R2','R6']. */
  firedRules: string[];
  /** Human-readable reasons, in the order the rules ran. */
  reasons: string[];
}

/** Deviation from 50 for a "55/45" style ratio; null when unparseable. */
export function ratioDeviation(ratio: string | null | undefined): number | null {
  const m = String(ratio ?? '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a + b === 0) return null;
  // Normalise to percentages so "60/40" and "120/80" behave identically.
  const pct = (a / (a + b)) * 100;
  // Rounded because the boundary comparisons are exact: 55/45 evaluates to
  // 5.000000000000007 in floating point, which would push a card that is
  // precisely at the Gem line onto the wrong side of `dev > GEM_MAX_DEV`.
  return Math.round(Math.abs(pct - 50) * 1e6) / 1e6;
}

/** Image confidence at or below B (i.e. not pristine capture conditions). */
function confidenceBOrWorse(c: string | null | undefined): boolean {
  const l = String(c ?? '').trim().toUpperCase().charAt(0);
  return l === 'B' || l === 'C' || l === 'D';
}

/**
 * Apply the centering policy to one face.
 *
 * Rules run in order and each may cap the score at 9; they do not short-circuit,
 * so every applicable reason is reported rather than just the first. Nothing
 * here can raise a score above proposedScore.
 */
export function applyCenteringPolicy(input: CenteringPolicyInput): CenteringPolicyResult {
  const firedRules: string[] = [];
  const reasons: string[] = [];
  let score = input.proposedScore;
  let reviewFlag = false;

  // Only a 10 is in question. Everything below is already conservative, and
  // capping a 7 to a 9 would be a no-op anyway.
  if (score < 10) {
    return { score, capped: false, reviewFlag: false, firedRules, reasons };
  }

  const cap = (rule: string, why: string, review = false) => {
    firedRules.push(rule);
    reasons.push(why);
    score = Math.min(score, 9);
    if (review) reviewFlag = true;
  };

  const dev = ratioDeviation(input.ratio);

  // ── R1: the stated ratio must actually clear 55/45 ────────────────────────
  // The rubric contained two conflicting boundary rules; the one that won gave
  // the higher score to anything within ±2% of a band edge, making the real Gem
  // threshold about 57/43. Enforced here so the prompt cannot drift back.
  if (dev !== null && dev > GEM_MAX_DEV) {
    cap('R1', `stated ratio ${input.ratio} is worse than 55/45`);
  }

  // ── R2: a 10 requires a measurement ───────────────────────────────────────
  // Dave Duerson was awarded centering 10 on both faces with no stored ratio
  // and no CV reading. Nothing measured that card.
  if (dev === null) {
    cap('R2', 'no measured centering ratio for this face');
  }

  // ── R3: the passes must agree on what they saw ────────────────────────────
  // Three independent estimates of the same borders. A wide spread means the
  // model does not know where the border is, whatever score it settled on.
  if (input.passDevs.length >= 2) {
    const spread = Math.max(...input.passDevs) - Math.min(...input.passDevs);
    if (spread >= MAX_PASS_SPREAD) {
      cap('R3', `passes disagree by ${spread} ratio points on centering`);
    }
  }

  // ── R4: only a bordered face can claim a border-derived 10 ────────────────
  // Alex Karras's near-full-bleed asymmetric back was classified "Standard
  // Bordered" and given a confident 48/52 that could not mean anything.
  if (input.layout !== null && !MEASURABLE_LAYOUTS.has(input.layout)) {
    cap('R4', `${input.layout} face has no measurable border`);
  }

  // ── R5: vintage cards shot in ordinary conditions need unanimity ──────────
  // The existing gem gate only intervenes at confidence C/D. B passes straight
  // through, which is how a vintage card took a 10 off a 10/10/9 majority.
  const isVintage = typeof input.year === 'number' && input.year < VINTAGE_BEFORE_YEAR;
  if (isVintage && confidenceBOrWorse(input.imageConfidence) && input.passScores.length >= 2) {
    const unanimous = input.passScores.every(s => s >= 10);
    if (!unanimous) {
      cap('R5', `vintage card at image confidence ${input.imageConfidence} without unanimous passes`);
    }
  }

  // ── R6: the only rule that consults CV, and it may only cap ───────────────
  //
  // GATED ON LAYOUT, not on which face it is. Asymmetric and full-bleed faces
  // are where CV is most confidently wrong — Karras's back measured 28/72 on a
  // design with no symmetric border to measure. But that is a LAYOUT problem,
  // and R4 already refuses those faces a 10. Excluding backs wholesale was the
  // wrong instrument: a genuinely bordered back is as measurable as a front.
  //
  // Two bars, because a lone axis is weaker evidence than two — see
  // CV_VETO_MIN_DEV_ONE_AXIS for why requiring both was a mistake.
  //
  // The asymmetry is the justification for acting at all: a false veto costs
  // one Gem a human can restore on review; a missed catch ships a wrong grade
  // to a paying customer.
  const layoutMeasurable = input.layout === null || MEASURABLE_LAYOUTS.has(input.layout);
  if (input.cv && layoutMeasurable) {
    const cvDev = input.cv.dev;
    const modelClaimsClean = dev !== null && dev <= CV_VETO_MAX_MODEL_DEV;
    const bar = input.cv.bothAxes ? CV_VETO_MIN_DEV : CV_VETO_MIN_DEV_ONE_AXIS;
    if (cvDev !== null && modelClaimsClean && cvDev >= bar) {
      cap('R6', `independent measurement disagrees (CV ${cvDev.toFixed(0)} pts off-centre vs stated ${input.ratio}${input.cv.bothAxes ? '' : ', one axis'})`, true);
    } else if (cvDev !== null && modelClaimsClean && cvDev >= CV_VETO_MIN_DEV) {
      // Real disagreement, below the acting bar for this evidence quality.
      firedRules.push('R6-flag');
      reasons.push(`CV disagrees by ${cvDev.toFixed(0)} pts but below the bar for a one-axis reading — flagged, not applied`);
      reviewFlag = true;
    }
  }

  return { score, capped: score < input.proposedScore, reviewFlag, firedRules, reasons };
}

/**
 * Customer-facing sentence for a capped centering score. Returns null when
 * nothing was capped. Written as an explanation, not a diagnosis — this text
 * can reach the grade report.
 */
export function centeringCapNote(result: CenteringPolicyResult): string | null {
  if (!result.capped) return null;
  if (result.firedRules.includes('R6')) {
    return 'An independent measurement of the borders disagreed with the visual assessment, so centering is held below Gem Mint pending review.';
  }
  if (result.firedRules.includes('R4')) {
    return 'This card’s design has no even printed border to measure, so centering cannot be confirmed at Gem Mint level.';
  }
  if (result.firedRules.includes('R2')) {
    return 'Centering could not be measured from these photos, so it is not scored at Gem Mint level.';
  }
  if (result.firedRules.includes('R3')) {
    return 'Repeated measurements of the borders did not agree closely enough to confirm Gem Mint centering.';
  }
  if (result.firedRules.includes('R1')) {
    return 'The measured borders are outside the Gem Mint centering tolerance.';
  }
  return 'Centering is held below Gem Mint because it could not be confirmed from these photos.';
}
