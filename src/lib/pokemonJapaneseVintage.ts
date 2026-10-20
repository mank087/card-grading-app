/**
 * Japanese vintage Pokémon: set and year for old-back cards (Oct 2026, v9.47).
 *
 * WHY. Every Japanese card printed with the old "POCKET MONSTERS CARD GAME"
 * back (1996-2001) carries the same "©1996 Nintendo" line on the back, whatever
 * set it came from. The grader read that line as the year: of 75 Japanese
 * vintage-era grades since July, ~55 were dated 1996, including Jungle, Fossil
 * and Rocket cards (1997), gym cards (1998-99), Southern Islands (1999) and Neo
 * (2000-01). The fronts carry no copyright and no set number ("No. 045" is the
 * Pokédex number).
 *
 * EVIDENCE, strongest first (measured on scripts/identity-anchor-set.json):
 *  1. The Japanese catalog (pokemon_cards_ja, vintage sets PMCG1-6 + neo1-4):
 *     the printed Japanese name plus HP is unique for 15 of 18 anchor cards
 *     (Raichu is HP80 in the Expansion Pack, HP90 in Fossil; Zapdos the reverse).
 *  2. The expansion symbol the first look reports (firstLook.ts), only as a
 *     tiebreaker between catalog candidates - at phone resolution it confused
 *     the Jungle flower, the Fossil mark and the palm tree in 7 of 40 runs -
 *     and on its own only for the two marks it never misread: the Rocket "R"
 *     and the Southern Islands palm tree (a set the catalog does not have).
 *  3. Anything else: a year that came only from the ©1996 back is dropped for
 *     a card with another symbol, kept for a card with none (the Expansion Pack
 *     has no symbol). A blank year is better than a wrong one.
 *
 * Applies only when the first look reported a symbol value, i.e. it saw the old
 * back; modern Japanese cards come back null and are left alone.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type JpExpansionSymbol = 'none' | 'jungle' | 'fossil' | 'rocket' | 'southern_islands' | 'other';
export const JP_EXPANSION_SYMBOLS: readonly JpExpansionSymbol[] = ['none', 'jungle', 'fossil', 'rocket', 'southern_islands', 'other'];

/** Vintage Japanese sets in pokemon_sets_ja, with the names DCM saves. */
export const JP_VINTAGE_SETS: Record<string, { set_name: string; year: string }> = {
  PMCG1: { set_name: 'Expansion Pack', year: '1996' },
  PMCG2: { set_name: 'Jungle', year: '1997' },
  PMCG3: { set_name: 'Mystery of the Fossils', year: '1997' },
  PMCG4: { set_name: 'Rocket Gang', year: '1997' },
  PMCG5: { set_name: "Leaders' Stadium", year: '1998' },
  PMCG6: { set_name: 'Challenge from the Darkness', year: '1999' },
  neo1: { set_name: 'Gold, Silver, to a New World...', year: '2000' },
  neo2: { set_name: 'Crossing the Ruins...', year: '2000' },
  neo3: { set_name: 'Awakening Legends', year: '2000' },
  neo4: { set_name: 'Darkness, and to Light...', year: '2001' },
};
export const JP_VINTAGE_SET_IDS = Object.keys(JP_VINTAGE_SETS);

/** Which catalog set each symbol stands for (Southern Islands is not in the catalog). */
const SYMBOL_SET: Partial<Record<JpExpansionSymbol, string>> = { none: 'PMCG1', jungle: 'PMCG2', fossil: 'PMCG3', rocket: 'PMCG4' };
/** Symbols trusted on their own, with no catalog match. */
const SYMBOL_ONLY: Partial<Record<JpExpansionSymbol, { set_name: string; year: string }>> = {
  rocket: JP_VINTAGE_SETS.PMCG4,
  southern_islands: { set_name: 'Southern Islands', year: '1999' },
};

export interface JaCatalogRow { id: string; name: string; hp: number | null; set_id: string; image_url?: string | null }

export function jpExpansionSymbolOf(v: unknown): JpExpansionSymbol | null {
  const s = String(v ?? '').trim().toLowerCase();
  return (JP_EXPANSION_SYMBOLS as readonly string[]).includes(s) ? (s as JpExpansionSymbol) : null;
}

/** "ラフレシア (Vileplume)" → "ラフレシア". */
export function japaneseNameOf(info: Record<string, any>): string | null {
  for (const v of [info.card_name, info.player_or_character]) {
    const s = String(v ?? '').split(/\s*[（(]/)[0].trim();
    if (/[぀-ヿ一-龯]/.test(s)) return s;
  }
  return null;
}

/**
 * True when the reported symbol rules the catalog set out. Only the marks that
 * were never misread decide (Rocket R, palm tree), plus "other": a mark that is
 * none of the first four sets' cannot sit on an Expansion Pack, Jungle, Fossil
 * or Rocket card. "none" / "jungle" / "fossil" were confused with each other.
 */
export function symbolContradicts(symbol: JpExpansionSymbol, setId: string): boolean {
  if (symbol === 'rocket') return setId !== 'PMCG4';
  if (symbol === 'southern_islands') return true;
  if (symbol === 'other') return ['PMCG1', 'PMCG2', 'PMCG3', 'PMCG4'].includes(setId);
  return false;
}

export type JpVintageOutcome =
  | { applied: 'catalog'; set_name: string; year: string; card_id: string; via: 'name_hp' | 'name_hp_symbol' }
  | { applied: 'symbol'; set_name: string; year: string; symbol: JpExpansionSymbol }
  | { applied: 'year_cleared' | 'year_restored'; symbol: JpExpansionSymbol }
  | { applied: null; reason: string };

function yearFromOldBackOnly(info: Record<string, any>): boolean {
  return String(info.year ?? '') === '1996' && ['', 'back_copyright'].includes(String(info.year_source ?? ''));
}

function setIdentity(info: Record<string, any>, set_name: string, year: string, evidence: string) {
  info.set_name = set_name;
  info.year = year;
  info.year_source = 'set_logo';
  info.year_evidence = evidence;
}

/**
 * Pure decision. `rows` = vintage catalog cards with this Japanese name.
 * Mutates `info` (a Pokémon card_info).
 */
export function decideJapaneseVintage(info: Record<string, any> | null | undefined, rows: JaCatalogRow[]): JpVintageOutcome {
  if (!info) return { applied: null, reason: 'no card_info' };
  const symbol = jpExpansionSymbolOf(info.first_look_jp_symbol) ?? jpExpansionSymbolOf(info.jp_expansion_symbol);
  if (!symbol) return { applied: null, reason: 'not an old-back Japanese card' };

  const hp = Number.parseInt(String(info.hp ?? ''), 10);
  const byHp = Number.isFinite(hp) ? rows.filter(r => Number(r.hp) === hp) : [];
  let pick: JaCatalogRow | null = byHp.length === 1 ? byHp[0] : null;
  let via: 'name_hp' | 'name_hp_symbol' = 'name_hp';
  if (!pick && byHp.length > 1 && SYMBOL_SET[symbol]) {
    const bySymbol = byHp.filter(r => r.set_id === SYMBOL_SET[symbol]);
    if (bySymbol.length === 1) { pick = bySymbol[0]; via = 'name_hp_symbol'; }
  }
  // The symbol vetoes a catalog pick it contradicts: a misread name ("Eevee"
  // for Dark Flareon, plain "Pidgeotto" for Koga's) lands on another set.
  if (pick && symbolContradicts(symbol, pick.set_id)) pick = null;
  if (pick && JP_VINTAGE_SETS[pick.set_id]) {
    const set = JP_VINTAGE_SETS[pick.set_id];
    setIdentity(info, set.set_name, set.year, `ja_catalog:${pick.id} (${via}${via === 'name_hp_symbol' ? ':' + symbol : ''})`);
    info.set_id = pick.set_id;
    info.tcgdex_id = pick.id;
    if (pick.image_url) info.tcgdex_image_url = pick.image_url;
    return { applied: 'catalog', set_name: set.set_name, year: set.year, card_id: pick.id, via };
  }

  const only = SYMBOL_ONLY[symbol];
  if (only) {
    setIdentity(info, only.set_name, only.year, `jp_expansion_symbol:${symbol}`);
    // A catalog link from the number lookup ("No. 045" read as a modern local id) does not describe this card.
    info.set_id = null; info.tcgdex_id = null; info.tcgdex_image_url = null;
    return { applied: 'symbol', set_name: only.set_name, year: only.year, symbol };
  }

  if (symbol === 'none') {
    if (info.year) return { applied: null, reason: 'no symbol, year kept' };
    info.year = '1996';
    info.year_source = 'back_copyright';
    info.year_evidence = 'jp_expansion_symbol:none (old back ©1996; Expansion Pack has no symbol)';
    return { applied: 'year_restored', symbol };
  }
  // A symbol we cannot trust alone (jungle/fossil) or another mark: never keep the back's 1996.
  if (yearFromOldBackOnly(info)) {
    info.year = null;
    info.year_source = 'not_visible';
    info.year_evidence = `jp_expansion_symbol:${symbol} (old back reads ©1996 on every set; release year not established)`;
    return { applied: 'year_cleared', symbol };
  }
  return { applied: null, reason: `symbol ${symbol}, no catalog match` };
}

/** Looks up the vintage catalog rows for the card's Japanese name, then decides. */
export async function applyJapaneseVintage(db: Pick<SupabaseClient, 'from'>, info: Record<string, any> | null | undefined): Promise<JpVintageOutcome> {
  if (!info) return { applied: null, reason: 'no card_info' };
  if (!jpExpansionSymbolOf(info.first_look_jp_symbol) && !jpExpansionSymbolOf(info.jp_expansion_symbol)) return { applied: null, reason: 'not an old-back Japanese card' };
  const name = japaneseNameOf(info);
  let rows: JaCatalogRow[] = [];
  if (name) {
    const { data, error } = await db.from('pokemon_cards_ja').select('id,name,hp,set_id,image_url').eq('name', name).in('set_id', JP_VINTAGE_SET_IDS);
    if (!error && data) rows = data as JaCatalogRow[];
  }
  return decideJapaneseVintage(info, rows);
}
