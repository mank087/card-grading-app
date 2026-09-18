/**
 * Displayed-value guard.
 *
 * A price lookup that runs with no set and no year searches by name alone, so
 * it lands on the most famous card that subject ever had. A card typed only as
 * "Babe Ruth" matched "Babe Ruth #53" and the grade formula turned that into
 * $2,739,573 on a public page. A read-only scan on 2026-09-17 found 274 cards
 * at or above $1,000 in that exact shape (no set or no year, product
 * auto-matched, nearly all stamped match confidence "high"), $5.9M of shown
 * value across 199 users.
 *
 * The guard does not try to decide whether a match is right. It decides whether
 * the identity behind a large number is thin enough that the number should not
 * be shown until somebody confirms the card. Small numbers are left alone: a
 * name-only match on a $40 card is not a claim worth hiding, and hiding it
 * would empty most collections.
 *
 * Nothing here reads or writes the database and nothing here changes a stored
 * price. A withheld card still has its estimate in `dcm_price_estimate`; only
 * the display and the totals change.
 *
 * Mobile copies this file verbatim at dcm-mobile/lib/valueGuard.ts.
 * If you change a rule here, update the mobile copy too.
 */

/** Dollars. Above this a thin identity stops being displayable. */
export const VALUE_GUARD_THRESHOLD = 500;

export type ValueTrustReason =
  | 'ok'
  | 'below_threshold'
  | 'owner_confirmed'
  | 'not_standard_card'
  | 'identity_unknown'
  | 'thin_identity';

export interface ValueTrust {
  /** False only when the value must not be shown. */
  trusted: boolean;
  reason: ValueTrustReason;
}

/**
 * The identity fields the guard reads. Every one is optional, and ABSENT is
 * meaningfully different from null: absent means this caller did not select the
 * column, null means the column is empty. The guard never withholds on absent
 * data, so a caller that forgets to select `card_set` silently disables the
 * guard rather than hiding real values.
 */
export interface CardIdentityForGuard {
  category?: string | null;
  /** cards.item_type: null or absent means a standard trading card. */
  item_type?: string | null;
  card_set?: string | null;
  release_date?: string | null;
  /** Owner picked the pricing product by hand (api/pricing/dcm-select). */
  dcm_selected_product_id?: string | null;
  /** Owner confirmed the identity at this revision (Phase 2A). */
  identity_confirmed_revision?: number | null;
  conversational_card_info?: {
    set_name?: string | null;
    year?: string | number | null;
    [key: string]: unknown;
  } | null;
}

/**
 * Categories whose year is routinely absent from `release_date` even for a
 * perfectly identified card, because the set name already pins the printing.
 * For these a blank year alone is not thin; a blank SET still is.
 */
const TCG_CATEGORIES = new Set([
  'pokemon',
  'mtg',
  'magic',
  'magic: the gathering',
  'lorcana',
  'one piece',
  'onepiece',
  'yugioh',
  'yu-gi-oh',
  'yu-gi-oh!',
]);

/** Values that are stored as text but mean "we do not know". */
const BLANK_IDENTITY_TEXT = new Set(['', 'unknown', 'n/a', 'na', 'none', 'null', 'undefined']);

/** True when a set or year field carries no information. */
export function isBlankIdentityText(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return !Number.isFinite(value) || value === 0;
  if (typeof value !== 'string') return false;
  return BLANK_IDENTITY_TEXT.has(value.trim().toLowerCase());
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** A blank year matters for sports, Other and Star Wars, not for the TCGs. */
function yearMattersFor(category?: string | null): boolean {
  if (!category) return true;
  return !TCG_CATEGORIES.has(category.trim().toLowerCase());
}

/**
 * Decide whether a resolved value can be displayed.
 *
 * Withheld only when ALL of these hold:
 *   1. the value is above VALUE_GUARD_THRESHOLD
 *   2. the owner has not confirmed the identity or picked the pricing product
 *   3. the identity is thin: no set, or no year on a category where the year
 *      is what separates an original from a reprint
 */
/**
 * item_type values that never show a market value, at ANY amount, and that an
 * owner confirmation cannot lift: a deck divider or a photo of a screen must not
 * borrow a real card's price. Kept inline because this file is copied verbatim
 * to mobile; a test holds it equal to NON_STANDARD_ITEM_TYPES in
 * src/lib/identification/itemType.ts.
 */
export const NO_VALUE_ITEM_TYPES: readonly string[] = [
  'sticker_or_decal',
  'accessory_not_a_card',
  'oversized_or_jumbo',
  'custom_or_fan_made',
  'reproduction_or_reprint_marked',
  'photo_of_a_screen_or_printout',
  'not_a_collectible',
];

export function assessValueTrust(card: CardIdentityForGuard, value: number): ValueTrust {
  // Owner policy (Sept 17 2026): graded, labelled "Not a standard trading card", no price.
  if (typeof card.item_type === 'string' && NO_VALUE_ITEM_TYPES.includes(card.item_type)) {
    return { trusted: false, reason: 'not_standard_card' };
  }

  if (!(typeof value === 'number' && Number.isFinite(value)) || value <= VALUE_GUARD_THRESHOLD) {
    return { trusted: true, reason: 'below_threshold' };
  }

  // The owner has already vouched for this card, one way or the other.
  if (!isBlankIdentityText(card.dcm_selected_product_id)) {
    return { trusted: true, reason: 'owner_confirmed' };
  }
  const confirmedRevision = card.identity_confirmed_revision;
  if (confirmedRevision !== null && confirmedRevision !== undefined) {
    return { trusted: true, reason: 'owner_confirmed' };
  }

  const info = card.conversational_card_info;
  const hasInfo = !!info && typeof info === 'object';
  const hasSetField = hasOwn(card, 'card_set') || (hasInfo && hasOwn(info, 'set_name'));
  const hasYearField = hasOwn(card, 'release_date') || (hasInfo && hasOwn(info, 'year'));

  // Neither field was selected, so there is nothing to judge. Fix the caller's
  // select rather than guessing; guessing here would hide priced collections.
  if (!hasSetField && !hasYearField) {
    return { trusted: true, reason: 'identity_unknown' };
  }

  const setValue = card.card_set !== undefined && card.card_set !== null
    ? card.card_set
    : (hasInfo ? info!.set_name : undefined);
  const yearValue = card.release_date !== undefined && card.release_date !== null
    ? card.release_date
    : (hasInfo ? info!.year : undefined);

  const setBlank = hasSetField && isBlankIdentityText(setValue);
  const yearBlank = hasYearField && isBlankIdentityText(yearValue);

  if (setBlank || (yearBlank && yearMattersFor(card.category))) {
    return { trusted: false, reason: 'thin_identity' };
  }

  return { trusted: true, reason: 'ok' };
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Cap the confidence stamped on a price match that came from a query with no
 * set and no year. Such a query cannot tell an original from a reprint, so
 * "Best Match" is not an honest label for it however well the name scored.
 *
 * 'none' is left alone: it already means no match at all.
 */
export function capMatchConfidence(
  confidence: MatchConfidence,
  query: { setName?: string | null; year?: string | number | null },
): MatchConfidence {
  if (confidence === 'none' || confidence === 'low') return confidence;
  const thinQuery = isBlankIdentityText(query.setName) && isBlankIdentityText(query.year);
  return thinQuery ? 'low' : confidence;
}
