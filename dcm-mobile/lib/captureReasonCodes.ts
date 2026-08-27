/**
 * MIRROR of src/lib/grading/captureReasonCodes.ts.
 *
 * dcm-mobile is a separate package and cannot import from the web app, so this
 * file is a deliberate copy. It is NOT free to diverge: the web project's
 * captureReasonCodes.test.ts reads this file and fails if the code list or the
 * messages differ.
 *
 * If you change one, change both. If the test fails, that is the test doing
 * its job — a silently renamed code splits one rule's analytics across two
 * buckets and makes a false-positive rate look better than it is.
 */

export const CAPTURE_REASON_CODES = [
  // Hard failures — the image cannot support a grade at all.
  'no_card_detected',
  'image_unreadable',
  'duplicate_sides',
  'card_too_far',
  'card_truncated',
  'card_resolution_low',
  'severe_blur',

  // Soft signals — grading proceeds, accuracy may suffer.
  'mild_blur',
  'glare',
  'dark',
  'perspective',
  'probable_duplicate',

  // Non-verdicts. The gate could not decide; these must never reject.
  'gate_unavailable',
  'gate_timeout',
  'geometry_unusable',
] as const

export type CaptureReasonCode = (typeof CAPTURE_REASON_CODES)[number]

export const CAPTURE_REASON_MESSAGES: Record<CaptureReasonCode, string> = {
  no_card_detected: 'We could not find a card in this photo. Place one card flat in the frame and try again.',
  image_unreadable: 'This image could not be opened. Try taking the photo again.',
  duplicate_sides: 'The front and back look like the same photo. Please capture the other side of the card.',
  card_too_far: 'The card is too far away. Move closer until it reaches all four corners of the guide.',
  card_truncated: 'Part of the card is cut off. Move back slightly so all four corners are visible.',
  card_resolution_low: 'The card is too small in this photo to inspect corners and edges. Move closer and retake.',
  severe_blur: 'This photo is too blurry to grade. Tap the card to focus, hold steady, and retake.',

  mild_blur: 'This photo is slightly soft, which may affect grading accuracy.',
  glare: 'There is glare on the card. Changing the angle or moving away from direct light will help.',
  dark: 'This photo is dark, which may affect grading accuracy. More light will help.',
  perspective: 'The camera is at an angle to the card. Holding the phone parallel gives a more accurate grade.',
  probable_duplicate: 'The front and back look very similar. Check you captured both sides.',

  gate_unavailable: 'Photo check was unavailable — grading continued normally.',
  gate_timeout: 'Photo check timed out — grading continued normally.',
  geometry_unusable: 'We could not measure the card outline in this photo — grading continued normally.',
}

export function captureReasonMessage(code: CaptureReasonCode): string {
  return CAPTURE_REASON_MESSAGES[code] ?? 'This photo could not be checked.'
}
