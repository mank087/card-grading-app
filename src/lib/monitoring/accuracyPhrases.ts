/**
 * The customer-facing wording that scripts/accuracy-monitor.ts keys on.
 *
 * The monitor is read-only and runs against stored text, so it can only count a
 * hold or a cap by recognising the sentence the engine wrote. Every phrase here is
 * COPIED from an engine module (named beside it); the engine builds these sentences
 * inline and does not export them as constants. accuracyPhrases.test.ts runs the
 * real engine functions where they are pure and checks that this file still
 * recognises what they produce, so a reworded engine sentence fails a test instead
 * of silently zeroing a row of the report.
 *
 * Wording that lives inline in visionGrader.ts (the rigid-holder, unanimity and
 * uninspected-region holds) cannot be produced without running a grade, so those
 * phrases are coupled by hand: if you reword them in visionGrader.ts, update here.
 */

/**
 * gradeNarrator.ts buildFinalSummary(): the opener when structural damage is
 * confirmed (final grade capped at STRUCT_CAP = 4). Always the first sentence of
 * conversational_final_grade_summary, so the 700-char trim never removes it.
 */
export const STRUCTURAL_CAP_PHRASE = 'This card has structural damage';

/**
 * structuralV2.ts structuralV2Note('uncertain', cap): the customer note when a
 * structural v2 close inspection could not confirm or rule out a line, and the
 * grade is held at structuralUnsureCap() (default 6) instead of the cap of 4.
 * NOTE: this note is stored on structural_damage.unconfirmed_note inside the
 * conversational_grading report, NOT in conversational_final_grade_summary, so the
 * monitor matches it with a server-side LIKE filter (no rows of that column leave
 * the database).
 */
export const STRUCTURAL_UNSURE_PHRASE = 'could not confirm or rule out from the photos';

/**
 * visionGrader.ts (all 10 -> 9 hold notes): "The card presents at Gem Mint level,
 * but <reason> - the grade is held at 9." Present in the final summary via
 * gradeNarrator's gradeCapNote.
 */
export const GEM_MINT_HOLD_PHRASE = 'presents at Gem Mint level';

export type HoldBucket =
  | 'photos_not_clear'
  | 'holder'
  | 'evaluations_disagree'
  | 'evaluation_dissent'
  | 'possible_crease'
  | 'clipped_corner'
  | 'regions_uninspected'
  | 'other';

/**
 * Hold-reason buckets, checked IN ORDER (first match wins). Order matters:
 * "the three independent evaluations did not agree closely enough" also contains
 * "independent evaluations", so the spread bucket must be tested before dissent.
 */
export const HOLD_REASON_PATTERNS: ReadonlyArray<{ bucket: HoldBucket; phrases: readonly string[]; source: string }> = [
  {
    bucket: 'evaluations_disagree',
    // evidenceHold.ts explainUncertaintyHold() cause 'evaluations_disagree'
    phrases: ['did not agree closely enough to confirm a 10'],
    source: 'grading/evidenceHold.ts',
  },
  {
    bucket: 'possible_crease',
    // evidenceHold.ts cause 'possible_damage_unconfirmed'
    phrases: ['saw a possible crease or bend that the others did not confirm'],
    source: 'grading/evidenceHold.ts',
  },
  {
    bucket: 'clipped_corner',
    // evidenceHold.ts cause 'clipped_corner'
    phrases: ['part of the card is outside the photo'],
    source: 'grading/evidenceHold.ts',
  },
  {
    bucket: 'regions_uninspected',
    // visionGrader.ts inspection gate (inline)
    phrases: ['could not be inspected up close'],
    source: 'visionGrader.ts (inline)',
  },
  {
    bucket: 'holder',
    // evidenceHold.ts cause 'holder' ("photographed inside a holder") and
    // visionGrader.ts rigid-case gate ("photographed inside a rigid holder", inline)
    phrases: ['photographed inside a holder', 'photographed inside a rigid holder'],
    source: 'grading/evidenceHold.ts + visionGrader.ts (inline)',
  },
  {
    bucket: 'photos_not_clear',
    // evidenceHold.ts cause 'image_quality'; holdNarration.ts finishHoldReason() for chrome/refractor finishes
    phrases: ['the photos are not clear enough to confirm a 10', "can't be confirmed from photos"],
    source: 'grading/evidenceHold.ts + grading/holdNarration.ts',
  },
  {
    bucket: 'evaluation_dissent',
    // holdNarration.ts describeDissent() ("one of the three independent evaluations",
    // "two of the three ...", "... so the evaluations did not confirm a 10") and the
    // visionGrader.ts unanimity fallbacks ("not every independent evaluation confirmed")
    phrases: ['independent evaluation', 'the evaluations did not confirm a 10'],
    source: 'grading/holdNarration.ts + visionGrader.ts (inline)',
  },
];

/** True when a final summary carries a Gem Mint 10 -> 9 hold note. */
export function isGemMintHold(summary: string | null | undefined): boolean {
  return typeof summary === 'string' && summary.includes(GEM_MINT_HOLD_PHRASE);
}

/**
 * Bucket a Gem Mint hold by its reason clause (the text after "presents at Gem
 * Mint level, but"). Returns null when the summary carries no hold.
 */
export function holdBucket(summary: string | null | undefined): HoldBucket | null {
  if (!isGemMintHold(summary)) return null;
  const s = summary as string;
  const reason = s.slice(s.indexOf(GEM_MINT_HOLD_PHRASE));
  for (const p of HOLD_REASON_PATTERNS) {
    if (p.phrases.some(ph => reason.includes(ph))) return p.bucket;
  }
  return 'other';
}

/** True when a final summary opens with the confirmed-structural-damage sentence. */
export function isStructuralCap(summary: string | null | undefined): boolean {
  return typeof summary === 'string' && summary.includes(STRUCTURAL_CAP_PHRASE);
}

/**
 * gradeNarrator.ts (v9.17): a 9 held by the magnified (zoom) pass is narrated as
 * "The <category> held the grade at 9 - ...". Not a Gem Mint hold; reported
 * separately so zoom-held 9s are visible.
 */
export const ZOOM_HELD_NINE_PHRASE = 'held the grade at 9 -';
