/**
 * One place that knows which neighbouring fields describe the same fact
 * (Sept 29 2026). A correction used to write one key and leave its neighbours
 * holding the old read, and the label then printed the neighbour:
 *
 *   - Mana Vault (MTG): card_number column corrected to U29, but
 *     conversational_card_info.card_number still "129/040" -> label "#129/040".
 *   - Eevee SVP 173: number corrected to 173, label appended the promo set's
 *     catalog total (and a stale set_total would come back through the editor).
 *
 * Every identity writer (the owner save in saveCardIdentity, the admin details
 * correction in gradeReview/cardDetails) runs its card-info blob through these
 * helpers, so a correction resets every related key consistently. Pure: no I/O.
 */
import { isPokemonPromoSetId, isPokemonPromoSetName, stripPromoTotal } from '@/lib/pokemonPromoNumber';

type Info = Record<string, unknown>;

const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
const squash = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Apply a corrected printed card number to a card-info blob: card_number,
 * card_number_raw, card_number_text_seen and collector_number all take it, and
 * set_total follows the new denominator (or is cleared when the new number has
 * none, so the old denominator cannot be re-attached by the editor).
 */
export function applyCardNumberToInfo(info: Info, value: string | null, source: string): Info {
  info.card_number = value;
  info.card_number_raw = value;
  info.card_number_text_seen = value;
  if ('collector_number' in info) info.collector_number = value;
  const denominator = typeof value === 'string' ? value.match(/\/\s*(\d+)\s*$/)?.[1] ?? null : null;
  if (denominator) info.set_total = denominator;
  else if ('set_total' in info) info.set_total = null;
  info.card_number_source = source;
  // Rescue breadcrumbs describe the number that was just replaced.
  delete info.number_corrected_from;
  delete info._number_from_first_look;
  return info;
}

/**
 * Apply a corrected set name. When it names a different set, the set codes and
 * catalog set id read with the OLD set are cleared: relinking from a stale MTG
 * expansion code points the card at the old printing.
 */
export function applySetNameToInfo(info: Info, value: string | null): boolean {
  const changed = squash(info.set_name) !== squash(value);
  info.set_name = value;
  if (changed) {
    for (const key of ['set_code', 'expansion_code', 'set_id']) if (key in info) info[key] = null;
  }
  return changed;
}

/** Apply a corrected year; set_year (the label's fallback) follows it. */
export function applyYearToInfo(info: Info, value: string | null, source: string): Info {
  info.year = value;
  if ('set_year' in info) info.set_year = value;
  info.year_source = source;
  info.year_text_seen = null;
  return info;
}

/**
 * The card-number value a Pokemon correction should store. A promo set is never
 * numbered "of N", so a trailing "/<promo printedTotal>" is stripped (SVP
 * "173/215" -> "173"). Real fractions on numbered sets, secret rares included
 * ("201/165"), are untouched.
 */
export function normalizePokemonNumberForSet(
  value: string | null,
  card: Record<string, any>,
  newSetName?: string | null,
): string | null {
  if (typeof value !== 'string' || card?.category !== 'Pokemon') return value;
  const linked = card.pokemon_api_data && typeof card.pokemon_api_data === 'object' ? card.pokemon_api_data.set : null;
  const setChanged = newSetName !== undefined && squash(newSetName) !== squash(card.card_set);
  if (setChanged) return isPokemonPromoSetName(newSetName) ? stripPromoTotal(value) : value;
  if (linked && isPokemonPromoSetId(linked.id)) return stripPromoTotal(value, linked.printedTotal);
  if (isPokemonPromoSetName(card.card_set)) return stripPromoTotal(value);
  return value;
}

/**
 * The foil flag and the foil type describe one fact. "Not foil" clears the foil
 * type (the MTG editor sends the old type alongside an unticked flag); a foil
 * type sent without the flag sets it. Returns the follow-on writes, if any.
 */
export function foilFollowOn(supplied: { is_foil?: unknown; foil_type?: unknown }): { is_foil?: boolean; foil_type?: null } {
  const hasFlag = 'is_foil' in supplied;
  const hasType = 'foil_type' in supplied;
  if (hasFlag && (supplied.is_foil === false || supplied.is_foil === 'false')) return blank(supplied.foil_type) && hasType ? {} : { foil_type: null };
  if (hasType && !hasFlag && !blank(supplied.foil_type)) return { is_foil: true };
  return {};
}
