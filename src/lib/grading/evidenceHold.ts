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
 * the card is not in a holder, a C letter no longer blocks a 10. It still blocks one
 * when any of those is not true, and D always does. Nothing else about uncertainty
 * changes: disagreement between evaluations and unconfirmed damage still count.
 *
 * Holders are deliberately left as they were. Half of the affected cards were in a
 * sleeve or holder, and whether a sleeved card can earn a 10 is the owner's decision,
 * not a side effect of this change.
 */

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

export function holderPresent(caseType: string | null | undefined): boolean {
  const type = String(caseType ?? '').trim().toLowerCase();
  return !!type && type !== 'none' && type !== 'unknown';
}

export interface LetterUncertainty {
  value: number;
  /** True when a C letter was not allowed to block a 10 because the inspection was complete. */
  coverageOverrodeLetter: boolean;
}

export function letterUncertainty(input: EvidenceInputs): LetterUncertainty {
  const letter = String(input.letter || 'B').toUpperCase();
  const value = LETTER_UNCERTAINTY[letter] ?? 1;
  const supported = input.zoomComplete && input.clippedCorners.length === 0 && !holderPresent(input.caseType);
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
  if (holderPresent(input.caseType)) {
    return {
      cause: 'holder',
      reason: 'it was photographed inside a sleeve or holder, which limits how closely the surface and edges can be inspected',
      advice: 'For Gem Mint consideration, re-submit with the card photographed outside the sleeve or holder.',
    };
  }
  return {
    cause: 'image_quality',
    reason: 'the photos are not clear enough to confirm a 10',
    advice: 'Retake the photos in even light with the card in sharp focus and no glare across the surface.',
  };
}
