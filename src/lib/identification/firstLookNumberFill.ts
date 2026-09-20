/**
 * Fill a BLANK card number from first look's printed read, at grading time.
 *
 * WHY. The card-number problem is mostly missing numbers, not misread ones
 * (measured Sept 20 2026 from card_identity_history):
 *   - 62 of 110 owner edits to the card number (56%) were the owner filling in a
 *     number the grading call had left blank;
 *   - 35 of 186 recent cards nobody had edited (19%) still had no number, and first
 *     look had read a printed one on 25 of them.
 * A card with no number cannot be matched to a price or a catalog entry, and it
 * stays that way unless its owner happens to open the confirm dialog. First look
 * already runs on every grade, so using its read costs nothing.
 *
 * HOW SURE. On 18 cards where grading left the number blank, first look's number
 * was checked independently (a second model read agreeing, or by eye against the
 * photo): 11 of 12 verified reads were right. The one miss read a faint "1" as
 * "39". A separate dedicated re-read was also tried and was worse than first look
 * (docs/EVAL_number_reread_2026-09-20.md), so this uses what is already there.
 *
 * THE RULE, same as the confirm dialog's (src/lib/identity/reviewPrefill.ts):
 * a value first look READ off the card may fill a blank. It never replaces a
 * number the grading call produced, and a recognized or inferred number fills
 * nothing. The fill is marked `card_number_source: 'first_look'` so it can always
 * be told apart from a grading read, audited, and scored against owner edits.
 */

import type { FirstLook } from './firstLook';

const BLANK = /^(unknown|n\/?a|none|null|undefined|not visible|unreadable)?$/i;
const isBlank = (value: unknown): boolean => BLANK.test(String(value ?? '').trim());

/** The keys the category routes read a card number from. Any one of them means "not blank". */
const NUMBER_KEYS = ['card_number', 'card_number_raw', 'collector_number', 'card_id'] as const;

/** "No. 126" and "#126" are the number 126 with a printed label in front of it. */
export function stripNumberLabel(value: string): string {
  return value.trim().replace(/^(?:#|no\.?|number)\s*(?=[A-Za-z]*\d)/i, '').trim();
}

const squash = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * The number first look may contribute, or null. Only a value it transcribed off
 * the card counts; its own contract marks that as `source: 'printed'`.
 */
export function printedNumberFromFirstLook(look: FirstLook | null | undefined): string | null {
  return printedNumberEvidence(look)?.value ?? null;
}

/** The usable number together with the characters first look actually transcribed. */
function printedNumberEvidence(look: FirstLook | null | undefined): { value: string; textSeen: string } | null {
  if (!look) return null;
  // Two different items photographed as front and back: nothing about the back
  // (where most numbers are printed) can be trusted to describe this card.
  if (look.photos?.same_item_both_photos === 'no_different_items') return null;
  if (look.identity?.card_number?.source !== 'printed') return null;

  const raw = String(look.printed_text?.card_number_as_printed ?? '').trim();
  if (isBlank(raw)) return null;
  const value = stripNumberLabel(raw);
  if (isBlank(value) || value.length > 40) return null;
  // The contract keeps the serial stamp apart from the card number. If the two came
  // back identical, the "number" is the stamp ("23/99"), and that is not an identity.
  const stamp = look.printed_text?.serial_stamp;
  if (!isBlank(stamp) && squash(stamp) === squash(value)) return null;
  return { value, textSeen: raw };
}

/** On unless FIRST_LOOK_NUMBER_FILL=0, so it can be switched off in Vercel without a deploy. */
export function numberFillEnabled(): boolean {
  return process.env.FIRST_LOOK_NUMBER_FILL !== '0';
}

export interface NumberFill {
  filled: boolean;
  value?: string;
}

/**
 * Fill the number on a grading call's card_info when — and only when — it has none.
 * Mutates and returns `cardInfo`'s fill outcome; a card that already has a number
 * in any of the keys the routes read is left exactly as it was.
 */
export function fillBlankNumberFromFirstLook(
  cardInfo: Record<string, any> | null | undefined,
  look: FirstLook | null | undefined,
): NumberFill {
  if (!cardInfo || typeof cardInfo !== 'object') return { filled: false };
  if (NUMBER_KEYS.some(key => !isBlank(cardInfo[key]))) return { filled: false };
  const evidence = printedNumberEvidence(look);
  if (!evidence) return { filled: false };
  cardInfo.card_number = evidence.value;
  cardInfo.card_number_raw = evidence.value;
  // The sports, other, Star Wars and Yu-Gi-Oh routes run cardNumberGuard AFTER the
  // grader returns, and it drops any number that arrives without a transcription or
  // with a source it does not know. Without these two fields the fill is silently
  // undone on exactly the categories that need it most (caught Sept 20 2026, before
  // shipping). The guard still applies its whole-token and serial checks to it.
  cardInfo.card_number_text_seen = evidence.textSeen;
  cardInfo.card_number_source = 'first_look';
  return { filled: true, value: evidence.value };
}
