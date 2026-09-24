/**
 * Why the grading evaluations declined to score a card (Sept 2026).
 *
 * The rubric tells an evaluation to return no numeric grade when there is no
 * card in a photo, or when it is highly confident writing was added to the card.
 * Since the Sept 17 fail-closed change every such answer became "Inspection
 * incomplete ... please retake your photos", whatever the reason. Of the 11
 * production failures of that kind (Sept 19-23), six were a selfie or a second
 * card as the "back", several cards in one photo, a comic book, or an unofficial
 * custom card. Another was a printed full-art outline read as marker.
 *
 * This reads what the declining evaluations reported so the caller can act on
 * the actual reason: verify a claimed marking, or tell the owner precisely what
 * to fix. The reason only chooses the next step and the message; it never
 * produces a grade.
 */

export type DeclineReason =
  | 'no_card'
  | 'different_cards'
  | 'multiple_cards'
  | 'not_a_card'
  | 'suspected_alteration'
  | 'unknown';

/** The reason an incomplete ensemble reports; 'altered_marking' once a marking is verified. */
export type EnsembleFailureReason = DeclineReason | 'altered_marking';

export interface DeclinedEnsemble {
  reason: DeclineReason;
  /** How many of the evaluations declined. */
  declined: number;
  /** Marking claims to verify, as "surface <face> marking: <description>". */
  markingClaims: string[];
  note: string;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

// Matched against the declining evaluations' own notes. Production notes these
// must read: "Two distinct trading cards are shown: Zeraora V and Hisuian Zoroark
// VSTAR", "Multiple Pokemon cards are visible simultaneously", "the front cover
// of an Archie comic magazine, not a physical trading card".
const DIFFERENT = /\b(two|2) (distinct|different|separate) (trading )?cards\b|\bdifferent card(s)? (on|in|for) the (front|back)\b|\b(front|back) (photo|image) (shows|is) (a )?(different|another) card\b|\bdo(es)? not (appear to )?(show|be) the same card\b|\bnot the same card\b/;
const MULTIPLE = /\b(multiple|several|many|more than one)\s+(\w+\s+){0,2}cards\b/;
const NOT_A_CARD = /\bnot an? (standard |genuine |official |licensed )?(trading )?card\b|\bcomic( book)?\b|\bmagazine\b|\bcustom (made |art )?card\b|\bfan[- ]made\b|\bunofficial\b|\bcounterfeit\b|\bproxy\b|\bnot a genuine\b/;

/**
 * Describe the declining evaluations, or null when none declined.
 * `declinedAt` flags which candidates returned no usable scores.
 */
export function describeDeclinedEnsemble(candidates: any[], declinedAt: boolean[]): DeclinedEnsemble | null {
  const declined = candidates.filter((_, i) => declinedAt[i]);
  if (declined.length === 0) return null;

  let noCard: string | null = null;
  const markingClaims: string[] = [];
  const blobs: string[] = [];
  // What the ITEM is gets judged from the front photo and the summaries only: a
  // back photo that is "not a card" (a selfie) says nothing about the item.
  const itemBlobs: string[] = [];
  for (const j of declined) {
    const cp = j?.card_presence_validation || {};
    if (cp.front_card_detected === false || cp.back_card_detected === false) {
      const side = cp.front_card_detected === false && cp.back_card_detected === false ? 'either photo'
        : cp.front_card_detected === false ? 'the front photo' : 'the back photo';
      noCard ??= `no card detected in ${side}${text(cp.front_validation_notes) || text(cp.back_validation_notes) ? ` (${[cp.front_validation_notes, cp.back_validation_notes].map(text).filter(Boolean).join('; ').slice(0, 200)})` : ''}`;
    }
    const ad = j?.alteration_detection || {};
    if (ad.marking_detected === true) {
      const face = /back/i.test(text(ad.marking_location)) ? 'back' : 'front';
      markingClaims.push(`surface ${face} marking: ${text(ad.marking_description).slice(0, 240)}`);
    }
    blobs.push([j?.final_grade?.summary, j?.final_grade?.model_summary, j?.grading_status,
      cp.front_validation_notes, cp.back_validation_notes].map(text).join(' ').toLowerCase());
    itemBlobs.push([j?.final_grade?.summary, j?.final_grade?.model_summary, j?.grading_status,
      cp.front_validation_notes].map(text).join(' ').toLowerCase());
  }
  const all = blobs.join(' ');
  const item = itemBlobs.join(' ');

  // A specific explanation in the notes beats the generic "no card detected"
  // flag: the evaluations mark a comic cover or a photo of several cards as
  // "no card" too, and the owner needs to know which it was.
  let reason: DeclineReason = 'unknown';
  let note = 'the evaluations returned no scores without a recorded reason';
  if (DIFFERENT.test(all)) { reason = 'different_cards'; note = 'the front and back photos show different cards'; }
  else if (MULTIPLE.test(all)) { reason = 'multiple_cards'; note = 'more than one card in a photo'; }
  else if (NOT_A_CARD.test(item)) { reason = 'not_a_card'; note = 'the item is not a gradable trading card'; }
  else if (noCard) { reason = 'no_card'; note = noCard; }
  else if (markingClaims.length) { reason = 'suspected_alteration'; note = 'an evaluation reported writing or marks added to the card'; }
  if (reason !== 'unknown' && reason !== 'no_card' && noCard) note += `; ${noCard}`;

  return { reason, declined: declined.length, markingClaims: [...new Set(markingClaims)], note };
}
