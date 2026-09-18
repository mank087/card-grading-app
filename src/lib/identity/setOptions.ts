/**
 * Set names for the confirmation dialog's Set field, from DCM's own card
 * databases, so a TCG card's set is always spelled the way the catalog and the
 * price lookups spell it. Public catalog data; cached in memory for an hour.
 */
import { supabaseServer } from '@/lib/supabaseServer';

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
