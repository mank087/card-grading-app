/**
 * What DCM does when the submitted item is not a standard trading card.
 *
 * Owner policy (Sept 17 2026): GRADE it, LABEL it "Not a standard trading card",
 * and SHOW NO MARKET PRICE. Nothing is refused and no credit is refunded: the
 * point is that a deck divider, a sticker, a jumbo, a custom card, a marked
 * reprint or a photo of a screen can never borrow a real card's identity or value.
 *
 * Pure and dependency-free: copied verbatim to dcm-mobile/lib/itemType.ts.
 */

export const NOT_STANDARD_CARD_LABEL = 'Not a standard trading card';

/** item_type values (see firstLook.ts) that carry the label and lose the price. */
export const NON_STANDARD_ITEM_TYPES = [
  'sticker_or_decal',
  'accessory_not_a_card',
  'oversized_or_jumbo',
  'custom_or_fan_made',
  'reproduction_or_reprint_marked',
  'photo_of_a_screen_or_printout',
  'not_a_collectible',
] as const;
// Deliberately absent: 'trading_card', 'cannot_tell', and 'already_graded_slab'
// (a slabbed card is still a standard card; the holder is handled by the case gate).

const PLAIN_WORDS: Record<string, string> = {
  sticker_or_decal: 'a sticker',
  accessory_not_a_card: 'an accessory such as a deck divider, token or code card',
  oversized_or_jumbo: 'an oversized or jumbo item',
  custom_or_fan_made: 'a custom or fan made item',
  reproduction_or_reprint_marked: 'an item marked as a reprint or replica',
  photo_of_a_screen_or_printout: 'a photo of a screen or a printed picture',
  not_a_collectible: 'not a collectible card',
};

export function isNonStandardItemType(itemType: unknown): boolean {
  return typeof itemType === 'string' && (NON_STANDARD_ITEM_TYPES as readonly string[]).includes(itemType);
}

/** "DCM Optic read this as a sticker." — calm, one sentence, for the card page. */
export function nonStandardExplanation(itemType: unknown): string | null {
  if (!isNonStandardItemType(itemType)) return null;
  return `DCM Optic read this as ${PLAIN_WORDS[itemType as string]}, so it is graded for condition but has no market value here.`;
}

/**
 * Decide the item type to ACT on from a first-look record. A single vision call
 * is not reliable enough on its own (a 1977 sticker was called a sticker on 1 run
 * of 2), and a false alarm takes a real card's price away, so:
 *   - when two passes ran (contract + search), both must call it non-standard,
 *     and the first pass's type is used when they name different kinds;
 *   - when one pass ran, its call stands.
 * Returns null when the item should be treated as a standard card.
 */
export function actionableItemType(record: {
  result?: { photos?: { item_type?: string | null } | null } | null;
  contract_item_type?: string | null;
} | null | undefined): string | null {
  const finalType = record?.result?.photos?.item_type ?? null;
  const firstType = record?.contract_item_type;
  if (firstType === undefined || firstType === null) return isNonStandardItemType(finalType) ? (finalType as string) : null;
  if (isNonStandardItemType(firstType) && isNonStandardItemType(finalType)) return firstType;
  return null;
}
