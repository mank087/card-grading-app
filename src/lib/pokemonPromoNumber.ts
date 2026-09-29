/**
 * Pokemon Black Star promo numbering (Sept 29 2026).
 *
 * The catalog gives every promo set a "printedTotal" (svp 215, swshp 307, smp
 * 248, xyp 211 ...), but promo cards are never printed "of N": SVP 173 is
 * "173", SWSH262 is "SWSH262". Code that built number + "/" + printedTotal
 * therefore invented fractions ("173/215", "SWSH262/307") and ~450 promo cards
 * stored one in card_number. Every writer goes through pokemonNumberForSet now.
 *
 * No imports on purpose: the label generator and the catalog code both use it.
 */

/** Catalog set ids of promo sets: svp, swshp, smp, xyp, bwp, hsp, dpp, np, basep, mep, bp. */
export function isPokemonPromoSetId(setId: string | null | undefined): boolean {
  return typeof setId === 'string' && /^[a-z0-9]*p$/i.test(setId.trim());
}

/** "Scarlet & Violet Black Star Promos", "SWSH Black Star Promo" ... (the catalog's promo set names). */
export function isPokemonPromoSetName(name: string | null | undefined): boolean {
  return typeof name === 'string' && /\bblack\s*star\s*promos?\b/i.test(name);
}

/** The set id a catalog card id belongs to: "svp-173" -> "svp", "me55c-106p" -> "me55c". */
export function pokemonSetIdOfCardId(cardId: string | null | undefined): string | null {
  if (typeof cardId !== 'string') return null;
  const cut = cardId.lastIndexOf('-');
  return cut > 0 ? cardId.slice(0, cut) : null;
}

/**
 * How a catalog number is printed: "4/102" for a numbered set, the bare number
 * for a promo set or when the total is unknown. Secret rares keep their real
 * fraction ("201/165"): only promo sets lose the total.
 */
export function pokemonNumberForSet(
  number: string | number | null | undefined,
  setId: string | null | undefined,
  printedTotal: string | number | null | undefined,
): string {
  const n = String(number ?? '').trim();
  if (!n || isPokemonPromoSetId(setId)) return n;
  const total = String(printedTotal ?? '').trim();
  return total && total !== '0' ? `${n}/${total}` : n;
}

/**
 * Strip an invented "/N" from a promo card's stored number. Only strips when the
 * denominator is the promo set's catalog printedTotal, so a real printed
 * fraction on a stamped set card ("053/091") is left for a human. With no known
 * total, only a prefixed promo number ("SM190/248", "SWSH262/307") is stripped.
 * Returns the value unchanged when there is nothing to strip.
 */
export function stripPromoTotal<T extends string | null | undefined>(
  value: T,
  printedTotal?: string | number | null,
): T | string {
  if (typeof value !== 'string') return value;
  const m = value.trim().match(/^([A-Za-z]{0,6})(\d+[A-Za-z]?)\s*\/\s*(\d+)$/);
  if (!m) return value;
  const known = printedTotal != null && String(printedTotal).trim() !== '' && String(printedTotal).trim() !== '0';
  if (known) {
    if (parseInt(m[3], 10) !== parseInt(String(printedTotal), 10)) return value;
  } else if (!m[1]) {
    return value;
  }
  return m[1] + m[2];
}
