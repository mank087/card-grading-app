/**
 * Catalog matching must not accept a weak match (Sept 24 2026, production card
 * a9eca6ef): an Espeon-GX printed 140/149 was graded as "150/149", and the old
 * cross-set ±3 fuzzy strategy linked it to sm1-152, a different Rainbow Rare.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PokemonCard } from './pokemonTcgApi';
import { pokemonPrintedNumber } from './pokemonAnniversary';

const queries = vi.hoisted(() => ({ bySet: vi.fn(), byTotal: vi.fn(), broad: vi.fn(), fuzzy: vi.fn(), nameInSet: vi.fn() }));
vi.mock('./pokemonTcgApi', async importOriginal => {
  const actual = await importOriginal<typeof import('./pokemonTcgApi')>();
  return { ...actual, searchLocalByNameNumberSetId: queries.bySet, searchLocalByNameNumberTotal: queries.byTotal,
    searchLocalDatabase: queries.broad, searchLocalFuzzyNumber: queries.fuzzy };
});
// The in-set misread rescue reads pokemon_cards directly.
vi.mock('./supabaseServer', () => ({
  supabaseServer: () => {
    const filters: Record<string, string> = {};
    const chain: any = {
      select: () => chain,
      eq: (col: string, v: string) => { filters[col] = v; return chain; },
      ilike: (col: string, v: string) => { filters[`ilike:${col}`] = v; return chain; },
      limit: async () => ({ data: queries.nameInSet(filters), error: null }),
    };
    return { from: () => chain };
  },
}));

import { findUniqueCatalogMatch, getPokemonApiUpdateFields, verifyPokemonCard, verifyPokemonCardByPrintedNumber } from './pokemonApiVerification';

function card(id: string, name: string, number: string, set: { id: string; name: string; total: number; date: string }): PokemonCard {
  return { id, name, number, supertype: 'Pokémon', subtypes: [], rarity: 'Rare Holo GX', images: { small: `https://images.pokemontcg.io/${set.id}/${number}.png`, large: '' },
    printedNumber: pokemonPrintedNumber(id, number, set.total),
    set: { id: set.id, name: set.name, printedTotal: set.total, total: set.total, series: 'Sun & Moon', releaseDate: set.date, images: { logo: '', symbol: '' } } };
}
const SM1 = { id: 'sm1', name: 'Sun & Moon', total: 149, date: '2017/02/03' };
const BW7 = { id: 'bw7', name: 'Boundaries Crossed', total: 149, date: '2012/11/07' };
const BASE1 = { id: 'base1', name: 'Base', total: 102, date: '1999/01/09' };
const BASE4 = { id: 'base4', name: 'Base Set 2', total: 130, date: '2000/02/24' };
const catalog = [
  card('sm1-61', 'Espeon', '61', SM1),
  card('sm1-140', 'Espeon-GX', '140', SM1),
  card('sm1-150', 'Lunala-GX', '150', SM1),
  card('sm1-152', 'Espeon-GX', '152', SM1),
  card('bw7-140', 'Pokémon Catalogue', '140', BW7),
  card('base1-4', 'Charizard', '4', BASE1),
  card('base4-4', 'Charizard', '4', BASE4),
];
const has = (name: string, pattern: string) => name.toLowerCase().includes(pattern.replace(/%/g, '').toLowerCase());

beforeEach(() => {
  vi.clearAllMocks();
  queries.bySet.mockImplementation(async (name: string, number: string, setId: string) =>
    catalog.filter(c => has(c.name, name) && c.number === number && c.set.id === setId));
  queries.byTotal.mockImplementation(async (name: string, number: string, total?: number) =>
    catalog.filter(c => has(c.name, name) && c.number === number && (!total || c.set.printedTotal === total)));
  queries.broad.mockResolvedValue([]);
  queries.fuzzy.mockImplementation(() => { throw new Error('the ±3 cross-set fuzzy search must not run'); });
  queries.nameInSet.mockImplementation((f: Record<string, string>) =>
    catalog.filter(c => c.set.id === f.set_id && has(c.name, f['ilike:name'] || ''))
      .map(c => ({ id: c.id, name: c.name, number: c.number, rarity: c.rarity, image_small: c.images.small, image_large: '',
        set_id: c.set.id, set_name: c.set.name, set_printed_total: c.set.printedTotal, set_release_date: c.set.releaseDate })));
});

describe('ambiguous numbers are not matched', () => {
  it('Espeon GX read as 150/149 in Sun & Moon: no match, candidates #140 and #152, never sm1-152', async () => {
    const r = await verifyPokemonCard({ card_name: 'Espeon GX', card_number: '150/149', set_name: 'Sun & Moon', year: '2017' });
    expect(r.success).toBe(false);
    expect(r.pokemon_api_id).toBeNull();
    expect(r.candidates?.map(c => c.id)).toEqual(['sm1-140', 'sm1-152']);
    expect(r.candidates?.[0]).toMatchObject({ name: 'Espeon-GX', number: '140', set_name: 'Sun & Moon', set_id: 'sm1', printed_total: 149,
      image_small: 'https://images.pokemontcg.io/sm1/140.png' });
    expect(queries.fuzzy).not.toHaveBeenCalled();
  });

  it('the same read with no set named never lands on a card by numeric distance', async () => {
    const r = await verifyPokemonCard({ card_name: 'Espeon GX', card_number: '150/149' });
    expect(r.success).toBe(false);
    expect(r.pokemon_api_id).not.toBe('sm1-152');
    expect(queries.fuzzy).not.toHaveBeenCalled();
  });

  it('name + number across sets: two survivors is no match (with candidates), one is a match', async () => {
    const two = await verifyPokemonCard({ card_name: 'Charizard', card_number: '4' });
    expect(two.success).toBe(false);
    expect(two.candidates?.map(c => c.id).sort()).toEqual(['base1-4', 'base4-4']);

    const one = await verifyPokemonCard({ card_name: 'Charizard', card_number: '4', year: '1999' });
    expect(one.success).toBe(true);
    expect(one.pokemon_api_id).toBe('base1-4');
    expect(one.candidates).toBeUndefined();
  });

  it('name + number across sets never falls back to a card with the wrong denominator', async () => {
    const r = await verifyPokemonCard({ card_name: 'Charizard', card_number: '4', set_total: '999' });
    expect(r.success).toBe(false);
    expect(r.pokemon_api_id).toBeNull();
  });
});

describe("first look's printed number (the second read)", () => {
  it('names exactly one catalog card when the name agrees ("Espeon GX" = "Espeon-GX")', async () => {
    const { card: hit } = await findUniqueCatalogMatch('Espeon GX', '140/149');
    expect(hit?.id).toBe('sm1-140');
  });

  it('corrects the grading number to the catalog card it names, at high confidence', async () => {
    const r = await verifyPokemonCardByPrintedNumber({ card_name: 'Espeon GX', card_number: '150/149', set_name: 'Sun & Moon', year: '2017' }, '140/149');
    expect(r.success).toBe(true);
    expect(r.pokemon_api_id).toBe('sm1-140');
    expect(r.confidence).toBe('high');
    expect(r.corrections).toContainEqual({ field: 'card_number', original: '150/149', corrected: '140/149' });
    expect(getPokemonApiUpdateFields(r)?.card_number).toBe('140/149');
  });

  it('refuses a printed number whose denominator disagrees with the grading read', async () => {
    const r = await verifyPokemonCardByPrintedNumber({ card_name: 'Espeon GX', card_number: '150/149' }, '140/150');
    expect(r.success).toBe(false);
  });

  it('refuses a printed number whose catalog card has a different name', async () => {
    const r = await verifyPokemonCardByPrintedNumber({ card_name: 'Umbreon GX', card_number: '150/149' }, '140/149');
    expect(r.success).toBe(false);
    expect(r.pokemon_api_id).toBeNull();
  });
});
