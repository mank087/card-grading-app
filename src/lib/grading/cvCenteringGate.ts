/**
 * cvCenteringGate.ts — CV_CENTERING_GATE_V1: record, and flag for a human,
 * the cards where the border measurement CONFIDENTLY disagrees with the
 * model's centering estimate.
 *
 * ── What the data said (Sept 29 2026, 1,500 most recent grades) ───────────
 * |model − CV| on the worst common axis, front faces (n=1,038):
 *   p50 4, p75 11, p90 23, p95 30 points; 285 faces ≥10 apart.
 * Swapping CV's ratio into the rubric ladder would change the front face
 * score on 52% of faces (CV lower on 530 of 544). That is not a signal about
 * the cards; it is mostly CV failing:
 *   - hand-checked 24 random front faces ≥12 points apart: CV nearer the
 *     truth on ~7, model nearer on ~13, 4 undecidable. Even where CV had the
 *     DIRECTION right it usually exaggerated the size (Dawson 30/70 vs ~42/58
 *     by eye; Magic Johnson 28/72 vs ~42/58).
 *   - the failure modes, all visible in the stored numbers: dark borders
 *     (Mike Evans, 2014 Topps Chrome: chroma distance amplifies noise in
 *     near-black pixels, so the right border "ended" 14px in), a mislocated
 *     corner quad (McHale: trapezoid quad, snap latched onto the inner frame),
 *     yellow TCG borders against holo art, patterned/asymmetric designs,
 *     full-bleed and slabbed cards, and low-resolution photos.
 * The per-side cluster spread and minimum border width predict it strongly:
 *   min side width <20px → 89% of faces ≥10 apart; ≥60px → 10%.
 *   worst side spread 25-30% → 39% ≥10 apart; ≤10% → 11%.
 *
 * ── Policy chosen: FLAG, never re-score ───────────────────────────────────
 * Even after the quality gate below, the hand-checked sample put CV right on
 * about half of the faces that fire. Using "the more conservative of the two"
 * would lower roughly one correct grade for every wrong one it fixes, and by
 * CV's exaggerated amount. So the gate keeps the model's score and ratios,
 * stores BOTH readings, tells the customer plainly that two reads disagreed,
 * and marks the card for a human centering check.
 *
 * Pure functions over plain data — no env reads except the one flag helper,
 * so every threshold is a unit test.
 */

import type { CenteringMeasurement } from '../zoomInspection';
import { layoutFromCardType, type FaceLayout } from './centeringPolicy';

/** Worst-axis disagreement (ratio points) at which the gate may fire. */
export const CV_GATE_MIN_DIFF = 12;
/**
 * Per-side cluster spread (%) above which a side is not trusted. The
 * measurement itself accepts up to 30; Evans's bad sides sat at 29 and 30.
 */
export const CV_GATE_MAX_SIDE_SPREAD = 20;
/** Measured border narrower than this (px) is usually a frame line, not a border. */
export const CV_GATE_MIN_SIDE_WIDTH_PX = 20;
/**
 * Corner-quad distortion (relative difference of opposite sides) above which
 * the quad is treated as mislocated. McHale's quad scored 0.063; Evans 0.007.
 * NOTE: across all 1,038 faces skew alone did not predict disagreement
 * (25-29% ≥10 apart in every bucket) — it is kept only as the one signal
 * that catches a quad whose corners were placed off the card.
 */
export const CV_GATE_MAX_QUAD_SKEW = 0.06;

export const CV_CENTERING_GATE_VERSION = 'cvgate-1';

export function cvCenteringGateEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CV_CENTERING_GATE_V1 === '1' || env.CV_CENTERING_GATE_V1 === 'true';
}

type Pt = { x: number; y: number };
type Axis = 'left_right' | 'top_bottom';

/** Larger side share, 50-100, of a "55/45" ratio; null for "XX/XX" etc. */
export function worstPct(ratio: string | null | undefined): number | null {
  const m = String(ratio ?? '').match(/^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (a + b < 95 || a + b > 105) return null;
  const p = Math.round((100 * a) / (a + b));
  return Math.max(p, 100 - p);
}

/** The rubric's front ladder (master rubric: 10 = 55/45 or better … 2 = worse than 95/5). */
export function frontScoreFromPct(p: number): number {
  return p <= 55 ? 10 : p <= 60 ? 9 : p <= 65 ? 8 : p <= 70 ? 7 : p <= 80 ? 6 : p <= 85 ? 5 : p <= 90 ? 4 : p <= 95 ? 3 : 2;
}

/**
 * The back's effect on the centering subgrade (rubric "BACK CENTERING
 * PENALTY"): 75/25 or better → none; worse blocks a 10; worse than 90/10 → −1;
 * worse than 95/5 → −2. Returned as a comparable label.
 */
export function backEffectFromPct(p: number): 'none' | 'blocks_10' | 'minus_1' | 'minus_2' {
  return p <= 75 ? 'none' : p <= 90 ? 'blocks_10' : p <= 95 ? 'minus_1' : 'minus_2';
}

/** Largest relative difference between opposite sides of the corner quad. */
export function quadSkew(quad: Pt[] | null | undefined): number | null {
  if (!Array.isArray(quad) || quad.length !== 4) return null;
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const [tl, tr, br, bl] = quad;
  const top = d(tl, tr), bottom = d(bl, br), left = d(tl, bl), right = d(tr, br);
  if (!(top > 0 && bottom > 0 && left > 0 && right > 0)) return null;
  return Math.max(Math.abs(top - bottom) / Math.max(top, bottom), Math.abs(left - right) / Math.max(left, right));
}

export interface AxisReading {
  axis: Axis;
  model_ratio: string;
  cv_ratio: string;
  model_pct: number;
  cv_pct: number;
  diff: number;
  side_spread_pct: [number, number];
  side_width_px: [number, number];
  /** Why CV's reading of this axis is not trusted; empty = trusted. */
  rejected: string[];
}

export interface CenteringDisagreement {
  version: string;
  face: 'front' | 'back';
  axis: Axis;
  model_ratio: string;
  cv_ratio: string;
  diff: number;
  /** Face-level effect under the rubric, model reading vs CV reading. */
  model_effect: number | string;
  cv_effect: number | string;
  would_change_subgrade: boolean;
  quad_skew: number | null;
  side_spread_pct: [number, number];
  side_width_px: [number, number];
  /** Always 'flag_for_review' in v1 — see the header for why. */
  policy: 'flag_for_review';
  review: true;
}

export interface FaceGateInput {
  face: 'front' | 'back';
  model: { left_right?: string | null; top_bottom?: string | null } | null | undefined;
  cv: CenteringMeasurement | null | undefined;
  quad: Pt[] | null | undefined;
  /** The grader's centering.<face>.card_type, e.g. "Standard Bordered". */
  cardType?: string | null;
  /** Photo is of a slab/rigid case — CV reads the holder, not the card. */
  rigidCase?: boolean;
}

export interface FaceGateResult {
  disagreement: CenteringDisagreement | null;
  /** Why nothing fired, for the shadow record. */
  skipped: string | null;
  axes: AxisReading[];
}

const MEASURABLE: ReadonlySet<FaceLayout> = new Set<FaceLayout>(['standard_bordered']);

export function evaluateFaceDisagreement(input: FaceGateInput): FaceGateResult {
  const none = (skipped: string, axes: AxisReading[] = []): FaceGateResult => ({ disagreement: null, skipped, axes });
  if (input.rigidCase) return none('rigid_case');
  if (!input.cv) return none('no_cv_measurement');
  const layout = layoutFromCardType(input.cardType);
  if (layout !== null && !MEASURABLE.has(layout)) return none(`layout_${layout}`);

  const skew = quadSkew(input.quad);
  const cv = input.cv;
  const axes: AxisReading[] = [];
  const sides: Record<Axis, [keyof CenteringMeasurement['widths'], keyof CenteringMeasurement['widths']]> = {
    left_right: ['left', 'right'],
    top_bottom: ['top', 'bottom'],
  };
  for (const axis of ['left_right', 'top_bottom'] as const) {
    const modelRatio = input.model?.[axis] ?? null;
    const cvRatio = axis === 'left_right' ? cv.leftRight : cv.topBottom;
    const mp = worstPct(modelRatio), cp = worstPct(cvRatio);
    if (mp === null || cp === null) continue;
    const [a, b] = sides[axis];
    const spread: [number, number] = [cv.spread?.[a] ?? 100, cv.spread?.[b] ?? 100];
    const width: [number, number] = [cv.widths?.[a] ?? 0, cv.widths?.[b] ?? 0];
    const rejected: string[] = [];
    if (Math.max(...spread) > CV_GATE_MAX_SIDE_SPREAD) rejected.push('side_spread');
    if (Math.min(...width) < CV_GATE_MIN_SIDE_WIDTH_PX) rejected.push('thin_side');
    if (skew === null || skew > CV_GATE_MAX_QUAD_SKEW) rejected.push('quad_skew');
    axes.push({ axis, model_ratio: modelRatio!, cv_ratio: cvRatio!, model_pct: mp, cv_pct: cp, diff: Math.abs(mp - cp), side_spread_pct: spread, side_width_px: width, rejected });
  }
  if (!axes.length) return none('no_comparable_axis');
  const trusted = axes.filter(x => x.rejected.length === 0);
  if (!trusted.length) return none('cv_low_confidence', axes);
  const worst = [...trusted].sort((x, y) => y.diff - x.diff)[0];
  if (worst.diff < CV_GATE_MIN_DIFF) return none('below_threshold', axes);

  // Centering is scored on the WORST axis, so the model's other axis stays in
  // play on both sides of the comparison.
  const modelWorst = Math.max(...axes.map(x => x.model_pct));
  const withCv = Math.max(worst.cv_pct, ...axes.filter(x => x !== worst).map(x => x.model_pct));
  const effect = input.face === 'front' ? frontScoreFromPct : backEffectFromPct;
  const modelEffect = effect(modelWorst), cvEffect = effect(withCv);
  if (modelEffect === cvEffect) return none('no_subgrade_effect', axes);

  return {
    skipped: null,
    axes,
    disagreement: {
      version: CV_CENTERING_GATE_VERSION,
      face: input.face,
      axis: worst.axis,
      model_ratio: worst.model_ratio,
      cv_ratio: worst.cv_ratio,
      diff: worst.diff,
      model_effect: modelEffect,
      cv_effect: cvEffect,
      would_change_subgrade: true,
      quad_skew: skew === null ? null : Math.round(skew * 1000) / 1000,
      side_spread_pct: worst.side_spread_pct,
      side_width_px: worst.side_width_px,
      policy: 'flag_for_review',
      review: true,
    },
  };
}

/**
 * "70/30" → "70 to 30". The face prose later passes through
 * gradeNarrator.reconcileFaceProse, which rewrites any "N/10" into the face
 * score — a CV ratio of "90/10" would come out as "9/10".
 */
function spokenRatio(r: string): string {
  const m = r.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  return m ? `${m[1]} to ${m[2]}` : r;
}

/** Customer-facing sentence for a flagged face. States both readings; claims neither. */
export function disagreementNote(d: CenteringDisagreement): string {
  const axis = d.axis === 'left_right' ? 'left/right' : 'top/bottom';
  return `Two independent reads of the ${d.face} ${axis} borders disagreed (visual estimate about ${spokenRatio(d.model_ratio)}, automated border measurement about ${spokenRatio(d.cv_ratio)}), so this card has been flagged for a manual centering check. The ratios shown are the visual estimate.`;
}

export interface GateHookInput {
  jsonData: any;
  centering: { front: CenteringMeasurement | null; back: CenteringMeasurement | null } | null | undefined;
  quads: { front: Pt[] | null; back: Pt[] | null } | null | undefined;
  rigidCase: boolean;
  env?: Record<string, string | undefined>;
}

/**
 * The single hook visionGrader calls. Flag OFF → returns null and touches
 * nothing (byte-identical). Flag ON → for each face that fires, stores the
 * disagreement on centering.<face>.centering_disagreement, prepends the
 * disagreement note to that face's analysis and <face>_summary, and sets
 * jsonData.centering_disagreement = { review: true, faces: [...] }.
 * Scores and ratio fields are never changed.
 */
export function applyCvCenteringGate(input: GateHookInput): CenteringDisagreement[] | null {
  if (!cvCenteringGateEnabled(input.env)) return null;
  const { jsonData } = input;
  if (!jsonData || typeof jsonData !== 'object' || !input.centering) return [];
  const fired: CenteringDisagreement[] = [];
  for (const face of ['front', 'back'] as const) {
    const sec = jsonData.centering?.[face];
    if (!sec || typeof sec !== 'object') continue;
    const r = evaluateFaceDisagreement({
      face,
      model: sec,
      cv: input.centering[face],
      quad: input.quads?.[face] ?? null,
      cardType: sec.card_type,
      rigidCase: input.rigidCase,
    });
    if (!r.disagreement) continue;
    fired.push(r.disagreement);
    sec.centering_disagreement = r.disagreement;
    const note = disagreementNote(r.disagreement);
    const prepend = (t: unknown) => (typeof t === 'string' && t.trim() ? `${note} ${t}` : note);
    sec.analysis = prepend(sec.analysis);
    // The detail page shows centering.<face>_summary first and falls back to
    // <face>.analysis, so the note goes on whichever prose the customer reads.
    const summaryKey = `${face}_summary`;
    if (typeof jsonData.centering[summaryKey] === 'string') {
      jsonData.centering[summaryKey] = prepend(jsonData.centering[summaryKey]);
    }
  }
  if (fired.length) {
    jsonData.centering_disagreement = { version: CV_CENTERING_GATE_VERSION, review: true, policy: 'flag_for_review', faces: fired };
  }
  return fired;
}
