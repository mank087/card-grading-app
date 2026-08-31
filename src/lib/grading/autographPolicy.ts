/**
 * Autograph policy (v9.23)
 *
 * An autograph is NEVER a surface defect and NEVER an N/A grade.
 *
 * - Manufacturer-authenticated autograph (hologram, printed certification/COA text,
 *   "AU" numbering, sticker-auto window) → a feature; graded exactly as before.
 * - Autograph with no official on-card claim of authenticity → the card still receives
 *   its FULL numeric grade (surface scored as if the ink were absent) and carries the
 *   designation "Altered - Unverified Autograph" as a notation on the grade record and
 *   the label. NOT an N/A, NOT a grade 1.
 *
 * This module is the single place that reads the model's autograph verdict out of the
 * grading JSON. The JSON shape has drifted over prompt versions (top-level `autograph`,
 * `alteration_detection.autograph`, `card_info.autographed`), and the verified/unverified
 * signal has been spelled `authenticated`, `verified` and encoded into `type`. All of
 * those are tolerated here so legacy rows and canary models resolve the same way.
 */

export const UNVERIFIED_AUTOGRAPH_DESIGNATION = 'Altered - Unverified Autograph';

/** Matches RarityClassification.autograph_type in conversationalGradingV3_3.ts */
export type AutographTypeValue = 'on-card' | 'sticker' | 'unverified' | 'none';

export interface AutographVerdict {
  /** A hand-applied (non-facsimile) autograph is on the card. */
  present: boolean;
  /** Manufacturer authentication was positively observed. */
  verified: boolean;
  /** Present, but authentication was positively ruled out → carries the designation. */
  unverified: boolean;
  /** Value for cards.autograph_type / RarityClassification.autograph_type. */
  autographType: AutographTypeValue;
  /** "Altered - Unverified Autograph", or null when no designation applies. */
  designation: string | null;
}

const NONE: AutographVerdict = {
  present: false,
  verified: false,
  unverified: false,
  autographType: 'none',
  designation: null,
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.toLowerCase() : '';
}

/**
 * Resolve the autograph verdict from a grading JSON blob.
 *
 * Deliberately conservative: an autograph whose authentication status the model did not
 * state resolves to present-but-unknown — it keeps the pre-v9.23 'on-card' type and gets
 * NO designation. "Altered - Unverified Autograph" is only applied when the model actually
 * ruled authentication out, so legacy rows never gain a customer-visible "Altered" notation.
 */
export function resolveAutographVerdict(jsonData: any): AutographVerdict {
  if (!jsonData || typeof jsonData !== 'object') return NONE;

  const auto = jsonData.autograph || jsonData.alteration_detection?.autograph || null;
  const cardInfo = jsonData.card_info || {};

  // A facsimile (printed) signature is not a hand-applied autograph at all.
  if (cardInfo.facsimile_autograph === true) return NONE;

  const typeText = str(auto?.type);
  const present =
    auto?.present === true ||
    cardInfo.autographed === true ||
    (typeText !== '' && typeText !== 'none');

  if (!present) return NONE;

  const certMarkers = Array.isArray(auto?.cert_markers) ? auto.cert_markers : [];
  const verified =
    auto?.authenticated === true ||
    auto?.verified === true ||
    typeText.includes('manufacturer') ||
    typeText.includes('authenticat') ||
    certMarkers.length > 0;

  const unverified =
    !verified &&
    (auto?.authenticated === false ||
      auto?.verified === false ||
      typeText.includes('unverified') ||
      str(auto?.designation).includes('unverified autograph'));

  const autographType: AutographTypeValue = unverified
    ? 'unverified'
    : typeText === 'sticker'
      ? 'sticker'
      : 'on-card';

  return {
    present: true,
    verified,
    unverified,
    autographType,
    designation: unverified ? UNVERIFIED_AUTOGRAPH_DESIGNATION : null,
  };
}

/**
 * Does this card carry the unverified-autograph designation, judged from the persisted
 * card row rather than the raw grading JSON? Used by the label generator.
 */
export function hasUnverifiedAutographDesignation(card: {
  autograph_type?: string | null;
  conversational_condition_label?: string | null;
  conversational_final_grade_summary?: string | null;
}): boolean {
  if (card.autograph_type === 'unverified') return true;
  const haystack = `${card.conversational_condition_label || ''} ${card.conversational_final_grade_summary || ''}`.toLowerCase();
  return haystack.includes('unverified autograph');
}
