/**
 * What DCM does when the submitted item is not a standard trading card.
 *
 * Owner policy (Sept 17 2026): GRADE it, LABEL it "Not a standard trading card",
 * and SHOW NO MARKET PRICE. Nothing is refused and no credit is refunded: the
 * point is that a deck divider, a jumbo, a custom card, a marked reprint or a
 * photo of a screen can never borrow a real card's identity or value.
 *
 * Stickers are NOT in the no-value set (Sept 28 2026): licensed sticker issues
 * (1986-89 Fleer basketball stickers, "(c) 1987 FLEER CORP.") are catalogued and
 * priced by SportsCardsPro/PriceCharting like any card, and the Sept 17 policy
 * had hidden up to ~$39k of real value. A sticker is still RECORDED as
 * item_type 'sticker_or_decal'; it is simply neither labelled nor unpriced.
 *
 * An owner who has confirmed the card (identity_confirmed_revision set, or a
 * pricing product picked by hand) lifts the no-value rule: see
 * ownerConfirmedIdentity / hidesMarketValue below and assessValueTrust.
 *
 * Pure and dependency-free: copied verbatim to dcm-mobile/lib/itemType.ts.
 */

export const NOT_STANDARD_CARD_LABEL = 'Not a standard trading card';

/** item_type values (see firstLook.ts) that carry the label and lose the price. */
export const NON_STANDARD_ITEM_TYPES = [
  'accessory_not_a_card',
  'oversized_or_jumbo',
  'custom_or_fan_made',
  'reproduction_or_reprint_marked',
  'photo_of_a_screen_or_printout',
  'not_a_collectible',
] as const;
// Deliberately absent: 'trading_card', 'cannot_tell', and 'already_graded_slab'
// (a slabbed card is still a standard card; the holder is handled by the case gate).
// 'sticker_or_decal' is also absent: licensed stickers are priced (see above).

/** item_type values actionableItemType stores: the no-value set plus stickers. */
export const RECORDED_ITEM_TYPES: readonly string[] = [...NON_STANDARD_ITEM_TYPES, 'sticker_or_decal'];

const PLAIN_WORDS: Record<string, string> = {
  accessory_not_a_card: 'an accessory such as a deck divider, token or code card',
  oversized_or_jumbo: 'an oversized or jumbo item',
  custom_or_fan_made: 'a custom or fan made item',
  reproduction_or_reprint_marked: 'an item marked as a reprint or replica',
  photo_of_a_screen_or_printout: 'a photo of a screen or a printed picture',
  not_a_collectible: 'not a collectible card',
};

const OFFICIAL_PUBLISHERS = /wizards of the coast|pok[eé]mon|nintendo|creatures inc|game ?freak|topps|panini|upper deck|fleer|donruss|bowman|leaf trading|skybox|score|konami|bandai|ravensburger|disney|fantasy flight|lucasfilm|marvel|dc comics|viacom|nba properties|nfl|mlb|nhl/i;

/** True when the transcribed legal line carries a © (or TM) and names a real publisher or licensor. */
export function hasOfficialCopyright(line: unknown): boolean {
  return typeof line === 'string' && /©|\(c\)|™|\bTM\b/i.test(line) && OFFICIAL_PUBLISHERS.test(line);
}

export function isNonStandardItemType(itemType: unknown): boolean {
  return typeof itemType === 'string' && (NON_STANDARD_ITEM_TYPES as readonly string[]).includes(itemType);
}

/**
 * The owner has vouched for this card's identity: confirmed it at some revision,
 * or picked the pricing product by hand. The same test the thin-identity guard in
 * valueGuard.ts applies (inline there because both files are copied verbatim;
 * a test holds them equal).
 */
export function ownerConfirmedIdentity(card: {
  dcm_selected_product_id?: string | null;
  identity_confirmed_revision?: number | null;
} | null | undefined): boolean {
  if (!card) return false;
  const product = card.dcm_selected_product_id;
  if (typeof product === 'string' && !['', 'unknown', 'n/a', 'na', 'none', 'null', 'undefined'].includes(product.trim().toLowerCase())) return true;
  return card.identity_confirmed_revision !== null && card.identity_confirmed_revision !== undefined;
}

/** True when the market value must not be shown: a non-standard item the owner has not confirmed. */
export function hidesMarketValue(card: {
  item_type?: string | null;
  dcm_selected_product_id?: string | null;
  identity_confirmed_revision?: number | null;
} | null | undefined): boolean {
  return isNonStandardItemType(card?.item_type) && !ownerConfirmedIdentity(card);
}

/** "DCM Optic read this as a custom or fan made item." — calm, one sentence, for the card page. */
export function nonStandardExplanation(itemType: unknown, ownerConfirmed = false): string | null {
  if (!isNonStandardItemType(itemType)) return null;
  if (ownerConfirmed) return `DCM Optic read this as ${PLAIN_WORDS[itemType as string]}. It is graded for condition, and its market value is shown because the owner confirmed the item.`;
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
  result?: { photos?: { item_type?: string | null } | null; printed_text?: { copyright_line?: string | null } | null } | null;
  contract_item_type?: string | null;
} | null | undefined): string | null {
  const finalType = record?.result?.photos?.item_type ?? null;
  // Owner test, Sept 18 2026: a genuine 2026 Magic "Source Material" borderless
  // mythic (comic-art treatment, "TM & © 2026 Wizards of the Coast" printed on it)
  // was called custom_or_fan_made, which hid its market pricing. A card that prints
  // an official publisher's copyright is not fan made, whatever the art looks like.
  if ((finalType === 'custom_or_fan_made' || finalType === 'not_a_collectible')
    && hasOfficialCopyright(record?.result?.printed_text?.copyright_line)) return null;
  const firstType = record?.contract_item_type;
  const recorded = (t: unknown) => typeof t === 'string' && RECORDED_ITEM_TYPES.includes(t);
  if (firstType === undefined || firstType === null) return recorded(finalType) ? (finalType as string) : null;
  if (recorded(firstType) && recorded(finalType)) return firstType;
  return null;
}
