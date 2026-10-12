/**
 * Pokémon "Trick or Trade" Halloween promos (Oct 2026).
 *
 * The BOOster Bundle cards (2022 Sword & Shield era, 2023, 2024, 2025) are the
 * ORIGINAL card, same number and catalog row (Gengar 066/196 = swsh11-66), with
 * a small orange pumpkin-Pikachu stamp on the front. The catalog has no set for
 * them, so the catalog link stays on the original printing; what changes is the
 * card's set as shown and priced: PriceCharting sells them as their own product
 * ("Gengar [Holo] #66", console "Pokemon Trick or Trade 2023").
 *
 * ONE canonical value everywhere: card_set "Trick or Trade <year>" (the year of
 * the bundle, from pokemonTrickOrTrade.json, captured from PriceCharting's three
 * consoles Oct 12 2026), or plain "Trick or Trade" when the year cannot be told.
 * release_date follows the bundle year. Evidence is the printed pumpkin
 * (card_info.printed_badge "pumpkin", from the grading call or first look) or a
 * set name that already says Trick or Trade; there is no extra vision call.
 */
import trickOrTradeCards from './pokemonTrickOrTrade.json';
import { namesAgree } from './identity/nameAgreement';

export const TRICK_OR_TRADE = 'Trick or Trade';

/** "Trick or Trade", "TRICK OR TRADE", "Pokemon Trick or Trade 2023", "Trick or Trade (2023)", the "Trick of Treat" typo. */
export function isTrickOrTradeSetName(value: unknown): boolean {
  const s = String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return /\btrick (?:or|of) trade\b/.test(s) || /^(?:pokemon )?trick of treat\b/.test(s);
}

function numerator(value: unknown): string {
  const raw = String(value ?? '').trim().replace(/^#\s*/, '').split('/')[0].trim();
  return raw.replace(/^0+(?=\d)/, '');
}

/** Bundle years PriceCharting lists for this name + number (usually one). */
export function trickOrTradeYears(name: unknown, number: unknown): string[] {
  const n = numerator(number);
  if (!n || !String(name ?? '').trim()) return [];
  const years = new Set<string>();
  for (const [key, list] of Object.entries(trickOrTradeCards as Record<string, string[]>)) {
    const [keyName, keyNumber] = key.split('|');
    if (keyNumber === n && namesAgree(String(name), keyName).agrees) list.forEach(y => years.add(y));
  }
  return [...years].sort();
}

/**
 * The bundle year: the one PriceCharting year, or, when the same name and
 * number was in two bundles (Gengar #57: 2022 and 2024), the one within two
 * years of the card's own set year (bundles reuse recent cards).
 */
export function trickOrTradeYear(name: unknown, number: unknown, setYear?: unknown): string | null {
  const years = trickOrTradeYears(name, number);
  if (years.length <= 1) return years[0] ?? null;
  const base = parseInt(String(setYear ?? '').slice(0, 4), 10);
  if (!Number.isFinite(base)) return null;
  const near = years.filter(y => Number(y) - base >= 0 && Number(y) - base <= 2);
  return near.length === 1 ? near[0] : null;
}

export function trickOrTradeSetName(year: string | null): string {
  return year ? `${TRICK_OR_TRADE} ${year}` : TRICK_OR_TRADE;
}

/** A canonical value already ("Trick or Trade" / "Trick or Trade 2023"). */
export function isCanonicalTrickOrTrade(value: unknown): boolean {
  return /^Trick or Trade(?: (?:2022|2023|2024|2025))?$/.test(String(value ?? ''));
}

/** The card shows (or its set name already says) the Trick or Trade pumpkin stamp. */
export function hasTrickOrTradeEvidence(info: Record<string, any> | null | undefined): boolean {
  if (!info) return false;
  return info.printed_badge === 'pumpkin' || info.first_look_printed_badge === 'pumpkin' || isTrickOrTradeSetName(info.set_name);
}

/**
 * The canonical identity for a stamped card: set name and (when known) year.
 * `setYear` is the original printing's year (catalog), used only to pick
 * between two bundle years.
 */
export function trickOrTradeIdentity(
  info: { player_or_character?: string | null; card_name?: string | null; card_number?: string | null; card_number_raw?: string | null; set_name?: string | null },
  setYear?: unknown,
): { set_name: string; year: string | null } {
  const name = info.player_or_character || info.card_name || '';
  const number = info.card_number_raw || info.card_number || '';
  // A year the owner/grader already put in the set name is kept when PriceCharting does not decide.
  const stated = String(info.set_name || '').match(/\b(2022|2023|2024|2025)\b/)?.[1] ?? null;
  const years = trickOrTradeYears(name, number);
  const year = trickOrTradeYear(name, number, setYear)
    ?? (stated && (years.length === 0 || years.includes(stated)) ? stated : null);
  return { set_name: trickOrTradeSetName(year), year };
}

/**
 * Grading-time: when the evidence is there, put the canonical set name, year and
 * badge on card_info (mutates). Returns true when it changed anything.
 */
export function applyTrickOrTradeStamp(info: Record<string, any> | null | undefined, setYear?: unknown): boolean {
  if (!info || !hasTrickOrTradeEvidence(info)) return false;
  const { set_name, year } = trickOrTradeIdentity(info, setYear ?? info.year);
  const before = JSON.stringify([info.set_name, info.year, info.printed_badge]);
  info.set_name = set_name;
  if (year) info.year = year;
  info.printed_badge = 'pumpkin';
  return JSON.stringify([info.set_name, info.year, info.printed_badge]) !== before;
}
