import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anniversarySetIds, pokemonPrintedNumber } from './pokemonAnniversary';
import type { PokemonCard } from './pokemonTcgApi';

const queries = vi.hoisted(() => ({ bySet: vi.fn(), broad: vi.fn() }));
vi.mock('./pokemonTcgApi', async importOriginal => {
  const actual = await importOriginal<typeof import('./pokemonTcgApi')>();
  return { ...actual, searchLocalByNameNumberSetId: queries.bySet,
    searchLocalByNameNumberTotal: queries.broad, searchLocalDatabase: queries.broad,
    searchLocalFuzzyNumber: queries.broad };
});
import { detectCardNumberFormat, normalizeCardNumber } from './pokemonTcgApi';
import { getPokemonApiUpdateFields, verifyPokemonCard } from './pokemonApiVerification';

function fixture(id: string, name: string, number: string, setId = 'me55c'): PokemonCard {
  return { id, name, number, supertype: 'Pokémon', subtypes: [], rarity: 'Rare', images: { small: '', large: '' },
    printedNumber: pokemonPrintedNumber(id, number, setId === 'me55' ? 128 : 0),
    set: { id: setId, name: setId === 'me55' ? '30th Celebration' : '30th Celebration: Classic Collection', printedTotal: setId === 'me55' ? 128 : 0, total: setId === 'me55' ? 161 : 30, series: 'Mega Evolution', releaseDate: '2026-09-16', images: { logo: '', symbol: '' } } };
}
const fixtures = [fixture('me55c-101', 'N', '101'), fixture('me55c-106', 'Shining Celebi', '106'),
  fixture('me55c-106p', 'Palkia LV.X', '106'), fixture('me55c-106m', 'M Gardevoir-EX', '106'),
  fixture('me55c-4', 'Charizard', '4'), fixture('me55-158', 'Mew ex', '158', 'me55'),
  ...['R', 'G', 'B'].map(n => fixture(`me55-${n}`, 'Mew', n, 'me55'))];

beforeEach(() => {
  vi.clearAllMocks();
  queries.bySet.mockImplementation(async (_name, number, set) => fixtures.filter(c => c.number === number && c.set.id === set));
  queries.broad.mockImplementation(() => { throw new Error('Unexpected unscoped lookup'); });
});

describe('anniversary identification', () => {
  it.each([
    ['N', '101/101', 'me55c-101'],
    ['Shining Celebi', '106/105', 'me55c-106'],
    ['Palkia LV.X', '106/106', 'me55c-106p'],
    ['M Gardevoir-EX', '106/160', 'me55c-106m'],
    ['Charizard', '004/102', 'me55c-4'],
  ])('resolves %s in the reprint set with its own printed fraction', async (name, raw, id) => {
    const r = await verifyPokemonCard({ card_name: name, card_number_raw: raw, set_name: '30th Anniversary Classic Collection', year: '2026' });
    expect(r.pokemon_api_id).toBe(id); expect(r.confidence).toBe('high');
    expect(getPokemonApiUpdateFields(r)?.card_number).toBe(fixtures.find(c => c.id === id)?.printedNumber);
    expect(getPokemonApiUpdateFields(r)?.release_date).toBe('2026');
    expect(queries.broad).not.toHaveBeenCalled();
  });
  it.each(['R', 'G', 'B'])('supports %s/RGB and preserves its printed label', async n => {
    const raw = `${n.toLowerCase()} / rgb`;
    expect(normalizeCardNumber(raw, detectCardNumberFormat(raw))).toEqual([n]);
    const r = await verifyPokemonCard({ card_name: 'Mew', card_number_raw: raw, set_name: '30th Anniversary', year: '2026' });
    expect(r.pokemon_api_id).toBe(`me55-${n}`);
    expect(getPokemonApiUpdateFields(r)?.card_number).toBe(`${n}/RGB`);
  });
  it('resolves the shared 30C code using name/number/fraction, not a single set map', async () => {
    const classic = await verifyPokemonCard({ card_name: 'N', card_number: '101/101', set_code: '30C', year: '2026' });
    const main = await verifyPokemonCard({ card_name: 'Mew ex', card_number: '158/128', set_code: '30C', year: '2026' });
    expect(classic.pokemon_api_id).toBe('me55c-101'); expect(main.pokemon_api_id).toBe('me55-158');
  });
  it.each([
    { card_name: 'N', card_number: '101/999' },
    { card_name: 'Mewtwo', card_number: '158/128' },
    { card_number: '106' },
    { card_name: 'N', card_number: '999/101' },
  ])('rejects contradictions/missing/ambiguous candidates without legacy fallback: %j', async input => {
    const r = await verifyPokemonCard({ ...input, set_code: '30C', year: '2026' });
    expect(r.verified).toBe(false); expect(r.pokemon_api_id).toBeNull();
    expect(queries.broad).not.toHaveBeenCalled();
  });
  it('does not interpret vintage or 25th Anniversary names as 30th', () => {
    expect(anniversarySetIds({ set_name: 'Base Set', card_number: '4/102' })).toBeNull();
    expect(anniversarySetIds({ set_name: 'Celebrations: Classic Collection' })).toBeNull();
  });
  it('keeps year validation for contradictory vintage evidence', async () => {
    const r = await verifyPokemonCard({ card_name: 'Charizard', card_number: '4/102', set_code: '30C', year: '1999' });
    expect(r.verified).toBe(false); expect(r.error).toMatch(/Year mismatch/);
  });
});
