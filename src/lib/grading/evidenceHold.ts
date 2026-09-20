/**
 * Whether the photo evidence supports a Gem Mint grade, and how to say why not.
 *
 * THE PROBLEM (measured on 3,227 production grades, Sept 6–20 2026). The model's
 * image-confidence letter mapped straight to uncertainty (A/B/C/D = ±0/1/2/3), and
 * ±2 blocks a 10. One card in four was C or D and NOT ONE of those 837 cards
 * received a 10; 76% of C cards landed on exactly 9 against 33% of B cards. In a
 * sample of 120 of them, 37% had all three evaluations at 10 — the letter was the
 * only reason for the 9. About 7% of everything graded.
 *
 * The letter is one evaluation's subjective impression ("soft", "glare", "uneven
 * lighting"). Since Sept 17 the grader has something better: the fail-closed
 * magnified inspection, which refuses to publish a grade at all unless every region
 * of both faces was actually inspected by a quorum of samples. The vaguer signal was
 * overruling the more specific one.
 *
 * THE RULE. When the magnified inspection completed, no corner is out of frame and
 * the card is not in a rigid holder, a C letter no longer blocks a 10. It still blocks one
 * when any of those is not true, and D always does. Nothing else about uncertainty
 * changes: disagreement between evaluations and unconfirmed damage still count.
 *
 * HOLDERS. Owner's decision, Sept 20 2026: "a card can still 10 if in a penny sleeve."
 * A soft sleeve lies flat against the card and the magnified inspection sees through
 * it. Top loaders, semi-rigids and slabs still hold the grade: they stand off the card,
 * add their own glare and scratches, and have their own gate in the grader as well.
 *
 * STATUS: THE OVERRIDE IS OFF (GRADING_EVIDENCE_V2 is not '1'), AND SHOULD STAY OFF.
 * It was replayed and then checked by eye on the 34 cards it would have moved from 9 to
 * 10 (Sept 20 2026). About 5 of the 28 examined were photographed well enough to support
 * a 10. Most were not: dim rooms, soft focus, motion blur, hand-held shots, a back face
 * out of focus. The C letter was mostly RIGHT. The premise above is the part that failed:
 * the magnified inspection reported complete coverage on photos far too blurred to show
 * a corner ding, so "every region was inspected" is not evidence that a flaw would have
 * been seen. One photographer accounted for about 14 of the 34.
 *
 * What would make this safe is a MEASURED, per-region image-quality check (sharpness and
 * exposure on the card itself, robust to sensor grain and holo texture) rather than the
 * inspection's own say-so. A simple Laplacian on corner crops was tried and did not
 * separate good from poor cleanly. Until that exists, the letter keeps its veto.
 * The true-cause hold reasons below are unaffected and always on.
 */

/** Off unless GRADING_EVIDENCE_V2=1. See STATUS above before turning it on. */
export function evidenceV2Enabled(): boolean {
  return process.env.GRADING_EVIDENCE_V2 === '1';
}

export interface EvidenceInputs {
  /** Image confidence letter AFTER any out-of-frame adjustment. */
  letter: string | null | undefined;
  /** The magnified inspection ran and inspected every region it expected to. */
  zoomComplete: boolean;
  /** Corners the geometry found out of frame. */
  clippedCorners: string[];
  /** case_detection.case_type, e.g. 'none', 'penny_sleeve', 'top_loader'. */
  caseType: string | null | undefined;
}

const LETTER_UNCERTAINTY: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/** Holder types that keep a card from a 10. A penny sleeve is not one of them. */
const SOFT_SLEEVES = new Set(['penny_sleeve']);

export function holderPresent(caseType: string | null | undefined): boolean {
  const type = String(caseType ?? '').trim().toLowerCase();
  return !!type && type !== 'none' && type !== 'unknown';
}

/** True for a top loader, semi-rigid, slab, or any holder type this file does not know. */
export function holderBlocksTen(caseType: string | null | undefined): boolean {
  return holderPresent(caseType) && !SOFT_SLEEVES.has(String(caseType).trim().toLowerCase());
}

export interface LetterUncertainty {
  value: number;
  /** True when a C letter was not allowed to block a 10 because the inspection was complete. */
  coverageOverrodeLetter: boolean;
}

export function letterUncertainty(input: EvidenceInputs, enabled: boolean = evidenceV2Enabled()): LetterUncertainty {
  const letter = String(input.letter || 'B').toUpperCase();
  const value = LETTER_UNCERTAINTY[letter] ?? 1;
  if (!enabled) return { value, coverageOverrodeLetter: false };
  const supported = input.zoomComplete && input.clippedCorners.length === 0 && !holderBlocksTen(input.caseType);
  if (letter === 'C' && supported) return { value: 1, coverageOverrodeLetter: true };
  return { value, coverageOverrodeLetter: false };
}

export type HoldCause =
  | 'clipped_corner'
  | 'holder'
  | 'possible_damage_unconfirmed'
  | 'evaluations_disagree'
  | 'image_quality';

export interface HoldExplanation {
  cause: HoldCause;
  /** Completes "The card presents at Gem Mint level, but ___ - the grade is held at 9." */
  reason: string;
  /** What the owner can do about it, or null when nothing would help. */
  advice: string | null;
}

/**
 * Why an uncertainty hold fired, most specific cause first. Every one of these used
 * to read "the photos are not clear enough to confirm a 10", including when the
 * photos were fine and the evaluations simply disagreed.
 */
export function explainUncertaintyHold(input: EvidenceInputs & {
  structuralUncertainty: number;
  passSpread: number;
  imageNotes?: string | null;
}): HoldExplanation {
  if (input.clippedCorners.length > 0) {
    const where = input.clippedCorners.join(', ');
    return {
      cause: 'clipped_corner',
      reason: `part of the card is outside the photo (${where}), so that area could not be inspected`,
      advice: 'Retake that photo with the whole card inside the frame and a little space around every corner.',
    };
  }
  if (input.structuralUncertainty >= 2) {
    return {
      cause: 'possible_damage_unconfirmed',
      reason: 'one evaluation saw a possible crease or bend that the others did not confirm',
      advice: 'A photo taken at an angle under a single light shows whether a line is a crease or a reflection.',
    };
  }
  if (input.passSpread >= 2) {
    return {
      cause: 'evaluations_disagree',
      reason: 'the three independent evaluations did not agree closely enough to confirm a 10',
      advice: null,
    };
  }
  if (holderBlocksTen(input.caseType)) {
    return {
      cause: 'holder',
      reason: 'it was photographed inside a holder, which limits how closely the surface and edges can be inspected',
      advice: 'For Gem Mint consideration, re-submit with the card photographed outside the holder. A penny sleeve is fine.',
    };
  }
  return {
    cause: 'image_quality',
    reason: 'the photos are not clear enough to confirm a 10',
    advice: 'Retake the photos in even light with the card in sharp focus and no glare across the surface.',
  };
}
