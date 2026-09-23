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

export interface InspectionFailureBody {
  code?: string;
  inspection_incomplete?: boolean;
  credit_refunded?: boolean;
  credit_refund_status?: string;
}

/** The full message for a grading response body, or null when it is not an incomplete inspection. */
export function incompleteInspectionMessage(body: InspectionFailureBody | null | undefined): string | null {
  if (!body || body.code !== 'INSPECTION_INCOMPLETE' || body.inspection_incomplete !== true) return null;
  if (body.credit_refund_status === 'not_charged') {
    return `${TITLE} No grading credit was charged for this attempt. ${RETAKE} ${STILL_STUCK}`;
  }
  return body.credit_refunded === true
    ? `${TITLE} Your grading credit was refunded. ${RETAKE} ${STILL_STUCK}`
    : `${TITLE} We could not confirm a credit refund, so please contact support before submitting this card again.`;
}

/**
 * The same outcome read back from the card row, for when the app was not
 * holding the grading request open (backgrounded, or the owner came back
 * later). The row does not say whether a refund landed, so this does not claim one.
 */
export function incompleteInspectionFromErrorMessage(errorMessage: string | null | undefined): string | null {
  if (!errorMessage || !/inspection incomplete/i.test(errorMessage)) return null;
  return `${TITLE} ${RETAKE} ${STILL_STUCK}`;
}
