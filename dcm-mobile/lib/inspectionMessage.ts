/**
 * What to tell the owner when the server stopped a grade because the
 * inspection could not be completed (code INSPECTION_INCOMPLETE).
 *
 * Shared verbatim by the web (src/lib/grading/inspectionMessageText.ts) and the
 * app (dcm-mobile/lib/inspectionMessage.ts); a test fails if the two drift. The
 * refund line only claims what the server confirmed: a refund is mentioned only
 * when `credit_refunded` is true.
 */

const TITLE = 'We could not finish a reliable grade from these photos.';

// Not every incomplete inspection is the photos' fault, but retaking them is
// the one thing the owner can do right away, and the failed attempt was
// refunded or never charged. An unconfirmed refund still goes to support first.
const RETAKE = 'This can happen when a photo is blurry, taken at an angle, or cuts off part of the card. '
  + 'Retake both photos with the card flat, all four edges in frame, and the phone held steady, then try again.';
const STILL_STUCK = 'If it keeps happening, contact support.';

/**
 * Sept 2026: when the evaluations declined for a stated reason, say that reason
 * instead of the generic retake advice. Keys match the server's inspection_reason.
 */
const REASONS: Record<string, { title: string; advice: string }> = {
  no_card: {
    title: 'We could not find a trading card in one of the photos.',
    advice: 'Make sure the front photo shows the front of the card and the back photo shows the back of the same card, then try again.',
  },
  different_cards: {
    title: 'The front and back photos appear to show two different cards.',
    advice: 'Photograph the front and the back of the same card, then try again.',
  },
  multiple_cards: {
    title: 'The photos show more than one card.',
    advice: 'Photograph one card at a time, then try again.',
  },
  not_a_card: {
    title: 'This item does not appear to be a trading card we can grade.',
    advice: 'Comics, custom or unofficial cards and other collectibles cannot receive a card grade. If you believe this is a genuine trading card, contact support.',
  },
  framing: {
    title: "Part of the card's edge was cut off or too small to inspect up close.",
    advice: 'Retake the photos with all four edges fully in the frame, a little space around the card, and the card filling most of the photo.',
  },
  // Sept 2026: the pre-charge photo check (src/lib/grading/photoPrecheck.ts).
  blurry: {
    title: 'A photo is too blurry to read the card.',
    advice: 'Hold the phone steady, tap the card to focus, use good light, and retake the photo, then try again.',
  },
  screenshot: {
    title: 'This looks like a screenshot or a photo of a screen, not a photo of the card itself.',
    advice: 'Photograph the physical card with your camera, front and back, with all four edges in the frame, then try again.',
  },
  altered_marking: {
    title: 'We found writing or marks added to this card after it was printed.',
    advice: 'Cards with added markings cannot receive a numeric grade. If you believe this is part of the printed card, contact support.',
  },
};

export interface InspectionFailureBody {
  code?: string;
  inspection_incomplete?: boolean;
  inspection_reason?: string | null;
  credit_refunded?: boolean;
  credit_refund_status?: string;
  /** Which photo the problem is in, when the server knows (pre-charge photo check). */
  photo_side?: string | null;
}

/** "The problem is in the back photo." — only for a single named side. */
function sideNote(side: string | null | undefined): string {
  return side === 'front' || side === 'back' ? ` The problem is in the ${side} photo.` : '';
}

function parts(reason: string | null | undefined): { title: string; advice: string } {
  const r = reason ? REASONS[reason] : undefined;
  return r ?? { title: TITLE, advice: `${RETAKE} ${STILL_STUCK}` };
}

/** The full message for a grading response body, or null when it is not an incomplete inspection. */
export function incompleteInspectionMessage(body: InspectionFailureBody | null | undefined): string | null {
  if (!body || body.code !== 'INSPECTION_INCOMPLETE' || body.inspection_incomplete !== true) return null;
  const { title, advice } = parts(body.inspection_reason);
  if (body.credit_refund_status === 'not_charged') {
    return `${title}${sideNote(body.photo_side)} No grading credit was charged for this attempt. ${advice}`;
  }
  return body.credit_refunded === true
    ? `${title} Your grading credit was refunded. ${advice}`
    : `${title} We could not confirm a credit refund, so please contact support before submitting this card again.`;
}

/**
 * The same outcome read back from the card row, for when the app was not
 * holding the grading request open (backgrounded, or the owner came back
 * later). The row does not say whether a refund landed, so this does not claim one.
 * The server writes the reason into the stored message as "[reason]", and the
 * pre-charge photo check adds the photo as "(front photo)" / "(back photo)".
 */
export function incompleteInspectionFromErrorMessage(errorMessage: string | null | undefined): string | null {
  if (!errorMessage || !/inspection incomplete/i.test(errorMessage)) return null;
  const { title, advice } = parts(/\[([a-z_]+)\]/.exec(errorMessage)?.[1]);
  return `${title}${sideNote(/\((front|back) photo\)/.exec(errorMessage)?.[1])} ${advice}`;
}
