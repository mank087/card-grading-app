/**
 * DISSENT RELEASE (DISSENT_RELEASE_V1, default OFF) - centering evidence for the
 * v9.14/v9.15 majority Gem gate, measured against the tolerance of the face it
 * was read on.
 *
 * Background. When two of the three evaluations score a card 10 and the third
 * marks the centering down, the majority gate keeps the 10 unless the centering
 * measurement backs the dissent. v9.15 asks two questions of the ratios:
 *
 *   measured arm     the card's own ratios are at or past 55/45 (dev >= 5)
 *   disagreement arm the dissenting pass read borders >= 4 points worse than
 *                    the closest 10-voter
 *
 * Both took the WORST deviation across BOTH faces. The rubric does not hold the
 * back to 55/45: a centering 10 allows the back to 75/25 (master rubric, "GRADE-10
 * EXCEPTION: a centering 10 additionally requires the back at 75/25 or better").
 * So a back read at 56/44 - inside the back's own tolerance - was being counted
 * as evidence that the card is not a 10, and the card was held at 9.
 *
 * Measured (Sept 12 - Oct 12 2026, 323 dissent-held 9s): 8 cards were held ONLY
 * because of a back reading inside 75/25; every one had a front read at or
 * inside 55/45 by all three passes. By eye, 8 of 8 had acceptable centering
 * (front and back) and no visible corner/edge flaw at the photo's resolution
 * (one borderline back-corner fleck). By-eye review, Oct 12 2026.
 *
 * What the flag changes, and nothing else:
 *   - a FRONT reading is evidence at the 55/45 line, exactly as before
 *     (by-eye the exact-55/45 cards were split 2 right / 2 wrong / 2 unclear,
 *     so that arm is deliberately left alone);
 *   - a BACK reading is evidence only past 75/25 (dev > 25);
 *   - the disagreement arm compares FRONT readings with FRONT readings; a
 *     dissenter's back is evidence only past 75/25.
 *
 * What it deliberately does NOT do (the by-eye review said hold):
 *   - release a dissent that cited a corner/edge/surface defect
 *     (5 of 7 decidable sampled cards had a real flaw or off-centering);
 *   - release a dissent of 2+ points (uncertainty gate; 3 of 6 decidable were
 *     correctly held, typically vintage cards the 10-voters under-measured);
 *   - release any front-centering dissent (6 right / 6 wrong / 7 unclear).
 *
 * Pure: no I/O. The caller decides whether the flag is on.
 */
export function dissentReleaseEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.DISSENT_RELEASE_V1 ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

/** The rubric's Gem line for a front: 55/45 -> 5 points from 50. */
export const FRONT_GEM_MAX_DEV = 5;
/** The rubric's Gem line for a back: 75/25 -> 25 points from 50. Worse than this blocks a 10. */
export const BACK_GEM_MAX_DEV = 25;
/** v9.15 disagreement arm: the dissent measured this many points worse than a 10-voter. */
export const CENTERING_DISAGREEMENT_POINTS = 4;

/** Ratio keys as the pass records store them ("front_lr", "back_tb", ...). */
export type CenteringRatios = Record<string, string | undefined> | null | undefined;

export interface CenteringVote {
  /** Per-pass ratios ({ front_lr: "52/48", ... }). */
  ratios?: CenteringRatios;
  /** Per-pass worst deviation across both faces, as v9.15 stores it (legacy arm input). */
  dev?: number | null;
}

export interface CenteringEvidenceInput {
  /** The card's reported ratios (jsonData.centering), keyed like the pass records. */
  cardRatios: CenteringRatios;
  dissenter: CenteringVote;
  /** The two passes that scored the card 10. */
  majority: CenteringVote[];
}

export type CenteringEvidenceArm =
  | 'measured'            // legacy: card worst-of-both-faces >= 55/45
  | 'disagreement'        // legacy: dissenter worst - closest 10-voter worst >= 4
  | 'measured_front'
  | 'measured_back'
  | 'disagreement_front'
  | 'dissent_back_past_tolerance';

export interface CenteringEvidence {
  evidence: boolean;
  arm: CenteringEvidenceArm | null;
}

/**
 * Deviation in points from 50 for "44/56" style text. Identical parse to the
 * engine's centeringOf(): placeholders ("XX/XX") and splits that do not sum to
 * ~100 are not measurements.
 */
export function ratioDev(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a + b < 90 || a + b > 110) return null;
  return Math.abs(a - b) / 2;
}

/** Worst deviation on one face (both axes), or null when that face was not measured. */
export function faceDev(ratios: CenteringRatios, face: 'front' | 'back'): number | null {
  if (!ratios) return null;
  const devs = [ratios[`${face}_lr`], ratios[`${face}_tb`]].map(ratioDev).filter((d): d is number => d != null);
  return devs.length ? Math.max(...devs) : null;
}

function worstDev(ratios: CenteringRatios): number | null {
  const f = faceDev(ratios, 'front');
  const b = faceDev(ratios, 'back');
  if (f == null && b == null) return null;
  return Math.max(f ?? -Infinity, b ?? -Infinity);
}

/**
 * Does the centering measurement corroborate a centering dissent?
 *
 * faceAware=false reproduces v9.15 exactly (both faces at the front's 55/45 line,
 * the disagreement arm on the stored per-pass worst deviation). faceAware=true is
 * DISSENT_RELEASE_V1: evidence only when v9.15 saw evidence AND it survives the
 * face-aware check, so the flag can release cards but never hold a new one.
 */
export function centeringDissentEvidence(input: CenteringEvidenceInput, faceAware: boolean): CenteringEvidence {
  const none: CenteringEvidence = { evidence: false, arm: null };
  const legacy = legacyEvidence(input);
  // The flag can only RELEASE: it narrows what v9.15 counted as evidence and
  // never adds evidence v9.15 did not see.
  if (!faceAware || !legacy.evidence) return legacy;

  // Arm 1: the card as measured is at or past each face's own Gem line.
  const cardFront = faceDev(input.cardRatios, 'front');
  if (cardFront != null && cardFront >= FRONT_GEM_MAX_DEV) return { evidence: true, arm: 'measured_front' };
  const cardBack = faceDev(input.cardRatios, 'back');
  if (cardBack != null && cardBack > BACK_GEM_MAX_DEV) return { evidence: true, arm: 'measured_back' };

  // Arm 2: the dissent read the FRONT materially worse than a 10-voter did.
  const disFront = faceDev(input.dissenter.ratios, 'front');
  const majFronts = input.majority.map(v => faceDev(v.ratios, 'front')).filter((n): n is number => n != null);
  if (disFront != null && majFronts.length > 0 && disFront - Math.min(...majFronts) >= CENTERING_DISAGREEMENT_POINTS) {
    return { evidence: true, arm: 'disagreement_front' };
  }
  // A dissenting back reading only counts once it fails the back's own tolerance.
  const disBack = faceDev(input.dissenter.ratios, 'back');
  if (disBack != null && disBack > BACK_GEM_MAX_DEV) return { evidence: true, arm: 'dissent_back_past_tolerance' };

  return none;
}

/** v9.15 as shipped: worst of both faces at the front's 55/45 line; stored per-pass worst deviations. */
function legacyEvidence(input: CenteringEvidenceInput): CenteringEvidence {
  const cardDev = worstDev(input.cardRatios);
  if (typeof cardDev === 'number' && cardDev >= FRONT_GEM_MAX_DEV) return { evidence: true, arm: 'measured' };
  const dissenterDev = input.dissenter.dev;
  const majorityDevs = input.majority.map(v => v.dev).filter((n): n is number => typeof n === 'number');
  if (typeof dissenterDev === 'number' && majorityDevs.length > 0
    && dissenterDev - Math.min(...majorityDevs) >= CENTERING_DISAGREEMENT_POINTS) {
    return { evidence: true, arm: 'disagreement' };
  }
  return { evidence: false, arm: null };
}

/**
 * The customer note for a majority 10 that DISSENT_RELEASE_V1 released (the legacy
 * gate would have held it). States only what was checked: the dissent's worse
 * reading was on the back and inside the back's tolerance, the front is inside
 * 55/45, and zoom found nothing.
 */
export function backToleranceReleaseNote(dissentScore: number, dissenterBackRatio: string | null): string {
  const reading = dissenterBackRatio ? ` (${dissenterBackRatio})` : '';
  return `Two of the three independent evaluations scored this card a perfect 10; the third scored the centering at ${dissentScore} on a back-border reading${reading} that is inside the 75/25 tolerance a back is allowed for a perfect centering score. The front borders measure inside 55/45 and the magnified inspection found nothing to support a deduction, so the majority result stands.`;
}

/** The dissenter's worst back ratio text ("56/44"), for the note. */
export function worstBackRatio(ratios: CenteringRatios): string | null {
  if (!ratios) return null;
  let best: { dev: number; raw: string } | null = null;
  for (const key of ['back_lr', 'back_tb']) {
    const raw = ratios[key];
    const dev = ratioDev(raw);
    if (dev != null && typeof raw === 'string' && (!best || dev > best.dev)) best = { dev, raw: raw.trim() };
  }
  return best?.raw ?? null;
}
