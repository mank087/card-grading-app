/**
 * Set names for the confirmation dialog's Set field, from DCM's own card
 * databases, so a TCG card's set is always spelled the way the catalog and the
 * price lookups spell it. Public catalog data; cached in memory for an hour.
 */
import { supabaseServer } from '@/lib/supabaseServer';
import type { ReviewField } from './reviewPrefill';

export interface SetOption { name: string; year: string | null; code?: string | null }

interface Source { table: string; name: string; date: string; code?: string; filter?: (q: any) => any }

const SOURCES: Record<string, Source[]> = {
  pokemon: [
    { table: 'pokemon_sets', name: 'name', date: 'release_date', code: 'ptcgo_code' },
    { table: 'pokemon_sets_ja', name: 'name_english', date: 'release_date' },
  ],
  mtg: [{ table: 'mtg_sets', name: 'name', date: 'released_at', code: 'code', filter: q => q.eq('digital', false) }],
  lorcana: [{ table: 'lorcana_sets', name: 'name', date: 'released_at', code: 'code' }],
  onepiece: [{ table: 'onepiece_sets', name: 'name', date: 'release_date' }],
  yugioh: [{ table: 'yugioh_sets', name: 'set_name', date: 'tcg_date', code: 'set_code' }],
  starwars: [{ table: 'starwars_sets', name: 'name', date: 'release_date' }],
};

/** cards.category → a key of SOURCES, or null when DCM has no set list for it. */
export function setCatalogKey(category: string | null | undefined): string | null {
  const c = String(category || '').toLowerCase().replace(/[^a-z]/g, '');
  if (c === 'pokemon') return 'pokemon';
  if (c === 'mtg' || c.startsWith('magic')) return 'mtg';
  if (c === 'lorcana') return 'lorcana';
  if (c === 'onepiece') return 'onepiece';
  if (c === 'yugioh') return 'yugioh';
  if (c === 'starwars') return 'starwars';
  return null;
}

/** "PZA" → "Teenage Mutant Ninja Turtles Source Material". Only an exact code match counts. */
export function setNameForCode(options: SetOption[], text: string | null | undefined): SetOption | null {
  const code = String(text || '').trim().toLowerCase();
  if (!code || code.length > 8 || /\s/.test(code)) return null;
  if (options.some(o => o.name.toLowerCase() === code)) return null; // already a set name
  return options.find(o => String(o.code || '').toLowerCase() === code) || null;
}

const cache = new Map<string, { at: number; options: SetOption[] }>();
const TTL_MS = 60 * 60 * 1000;

export async function loadSetOptions(category: string | null | undefined): Promise<SetOption[]> {
  const key = setCatalogKey(category);
  if (!key) return [];
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.options;

  const seen = new Map<string, SetOption & { sort: string }>();
  for (const source of SOURCES[key]) {
    try {
      const columns = [source.name, source.date, source.code].filter(Boolean).join(', ');
      let query: any = supabaseServer().from(source.table).select(columns).limit(2000);
      if (source.filter) query = source.filter(query);
      const { data, error } = await query;
      if (error || !data) continue;
      for (const row of data as Record<string, any>[]) {
        const name = String(row[source.name] || '').trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        const date = row[source.date] ? String(row[source.date]) : '';
        const year = /^(19|20)\d{2}/.test(date) ? date.slice(0, 4) : null;
        seen.set(name.toLowerCase(), { name, year, code: source.code ? (row[source.code] ?? null) : null, sort: date });
      }
    } catch { /* one missing table must not empty the list */ }
  }
  // Newest first: the set an owner is looking for is usually a recent one.
  const options = [...seen.values()].sort((a, b) => (b.sort || '').localeCompare(a.sort || '') || a.name.localeCompare(b.name)).map(({ sort: _sort, ...rest }) => rest);
  if (options.length) cache.set(key, { at: Date.now(), options });
  return options;
}

/**
 * Turn a printed set CODE in the review's Set field (value or suggestion) into the
 * catalog's set NAME, and fill an empty Year from that set. Owner test, Sept 18
 * 2026: two Magic cards printed "PZA"; the grader stored no set at all, first look
 * read the code, and pricing found nothing because neither is the catalog's name
 * ("Teenage Mutant Ninja Turtles Source Material").
 */
export async function resolveSetCodesInFields(
  fields: ReviewField[],
  category: string | null | undefined,
): Promise<ReviewField[]> {
  if (!setCatalogKey(category)) return fields;
  const options = await loadSetOptions(category);
  if (!options.length) return fields;
  let setYear: string | null = null;
  const out = fields.map(field => {
    if (field.key !== 'card_set') return field;
    const next = { ...field };
    const fromValue = setNameForCode(options, next.value);
    if (fromValue) { next.value = fromValue.name; setYear = fromValue.year; }
    if (next.suggestion) {
      const fromSuggestion = setNameForCode(options, next.suggestion.value);
      if (fromSuggestion) { next.suggestion = { ...next.suggestion, value: fromSuggestion.name }; setYear = setYear || fromSuggestion.year; }
    }
    return next;
  });
  // Magic only: offer the collector number without its rarity letter.
  if (setCatalogKey(category) === 'mtg') {
    for (let i = 0; i < out.length; i++) {
      const field = out[i];
      if (field.key !== 'card_number') continue;
      const clean = mtgCollectorNumber(field.value);
      if (clean && clean !== field.value) out[i] = { ...field, suggestion: { value: clean, origin: 'suggested' as const, source: 'inferred' as const } as ReviewField['suggestion'] };
    }
  }
  if (!setYear) return out;
  return out.map(field => (field.key === 'release_date' && !field.value
    ? { ...field, value: setYear as string, origin: 'suggested' as const, needsCheck: true }
    : field));
}

/**
 * Magic prints the rarity letter in front of the collector number ("M 0006").
 * The grader stored the whole string, and the catalog knows the card as "6".
 * Returns the catalog form, or null when the text is not in that shape.
 */
export function mtgCollectorNumber(text: string | null | undefined): string | null {
  const m = /^\s*[CURMLSTB]\s*0*(\d{1,4}[a-z]?)\s*$/i.exec(String(text || ''));
  return m ? m[1] : null;
}
