/**
 * Capture-gate vocabulary — ONE definition, consumed by server, web and native.
 *
 * These strings are written to upload_telemetry.rule_code and (later) returned
 * by the preflight endpoint, so analytics group on them and both clients render
 * messages from them. Three hand-maintained copies would drift, and drift here
 * is invisible: a renamed code does not error, it just silently splits one
 * rule's counts across two buckets and makes a false-positive rate look better
 * than it is.
 *
 * dcm-mobile cannot import from this package, so it mirrors this file. The
 * contract test in captureReasonCodes.test.ts fails if the two fall out of
 * sync — that test is the thing keeping this honest, not discipline.
 *
 * ADDING A CODE: add it here, add the message, mirror it in
 * dcm-mobile/lib/captureReasonCodes.ts. Never reuse a retired code for a
 * different meaning — historical rows keep the old one.
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
] as const;

export type CaptureReasonCode = (typeof CAPTURE_REASON_CODES)[number];

/**
 * Customer-facing text. Instructions, not diagnoses — these are read by
 * someone holding a phone who needs to know what to do differently, so
 * "Move closer" beats "fill percentage below threshold".
 */
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
};

/** Codes that may ever block a submission. Everything else is advisory. */
export const HARD_REJECT_CODES: readonly CaptureReasonCode[] = [
  'no_card_detected',
  'image_unreadable',
  'duplicate_sides',
  'card_too_far',
  'card_truncated',
  'card_resolution_low',
  'severe_blur',
];

/**
 * Codes that mean "we could not measure", NOT "we found a defect".
 *
 * Kept explicit because conflating the two is an easy and costly mistake: an
 * unusable card outline is absence of evidence, and treating it as support for
 * a distance rejection would make the gate most confident exactly where it
 * understood least. These always fail open.
 */
export const FAIL_OPEN_CODES: readonly CaptureReasonCode[] = [
  'gate_unavailable',
  'gate_timeout',
  'geometry_unusable',
];

export function isHardReject(code: CaptureReasonCode): boolean {
  return HARD_REJECT_CODES.includes(code);
}

export function captureReasonMessage(code: CaptureReasonCode): string {
  return CAPTURE_REASON_MESSAGES[code] ?? 'This photo could not be checked.';
}
