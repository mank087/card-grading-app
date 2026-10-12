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

describe('printed anniversary badge (Oct 2026)', () => {
  const classic = (id: string, name: string, number: string, setId: string, setName: string, year: string): PokemonCard => ({
    id, name, number, supertype: 'Pokémon', subtypes: [], rarity: 'Rare', images: { small: '', large: '' },
    printedNumber: pokemonPrintedNumber(id, number, 0),
    set: { id: setId, name: setName, printedTotal: 0, total: 30, series: '', releaseDate: `${year}-09-16`, images: { logo: '', symbol: '' } } });
  fixtures.push(classic('me55c-58', 'Pikachu', '58', 'me55c', '30th Celebration: Classic Collection', '2026'),
    classic('cel25c-4_A', 'Charizard', '4', 'cel25c', 'Celebrations: Classic Collection', '2021'));

  it.each([
    [{ printed_badge: '30', card_number_raw: '58/102' }, ['me55c']],
    [{ printed_badge: '30', card_number_raw: '050/128' }, ['me55']],
    [{ printed_badge: '30', card_number_raw: '158/128' }, ['me55']],
    [{ printed_badge: '30', card_number: 'R/RGB' }, ['me55']],
    [{ printed_badge: '30', card_number: '58' }, ['me55c', 'me55']],
    [{ printed_badge: '25', card_number_raw: '4/102' }, ['cel25c']],
    [{ printed_badge: '25', card_number_raw: '005/025' }, ['cel25']],
    [{ first_look_printed_badge: '30', card_number_raw: '149/147', set_name: 'Aquapolis' }, ['me55c']],
    [{ printed_badge: 'pumpkin', card_number_raw: '066/196' }, null],
    [{ printed_badge: null, card_number_raw: '58/102', set_name: 'Base' }, null],
  ])('scopes %j to %j', (info, expected) => {
    expect(anniversarySetIds(info)).toEqual(expected);
  });

  it('a set name still wins over the badge for the existing 30th evidence', () => {
    expect(anniversarySetIds({ set_name: '30th Celebration: Classic Collection', printed_badge: '30' })).toEqual(['me55c']);
  });

  it('badge "30" on a Base read links the Classic Collection reprint, despite the reprinted 1999 copyright year', async () => {
    const r = await verifyPokemonCard({ card_name: 'Pikachu', card_number_raw: '58/102', set_name: 'Base', year: '1999', printed_badge: '30' });
    expect(r.pokemon_api_id).toBe('me55c-58');
    const fields = getPokemonApiUpdateFields(r);
    expect(fields?.card_set).toBe('30th Celebration: Classic Collection');
    expect(fields?.release_date).toBe('2026');
    expect(fields?.card_number).toBe('58/102');
    expect(queries.broad).not.toHaveBeenCalled();
  });

  it('badge "25" links the Celebrations Classic Collection card by its original fraction', async () => {
    const r = await verifyPokemonCard({ card_name: 'Charizard', card_number_raw: '4/102', year: '1999', printed_badge: '25' });
    expect(r.pokemon_api_id).toBe('cel25c-4_A');
    expect(getPokemonApiUpdateFields(r)?.card_number).toBe('4/102');
  });

  it('first look\'s badge counts when the grading call has none', async () => {
    const r = await verifyPokemonCard({ card_name: 'Pikachu', card_number_raw: '58/102', year: '1999', printed_badge: null, first_look_printed_badge: '30' });
    expect(r.pokemon_api_id).toBe('me55c-58');
  });

  it('a badge never falls back to the older printing when no anniversary card matches', async () => {
    const r = await verifyPokemonCard({ card_name: 'Blastoise', card_number_raw: '2/102', year: '1999', printed_badge: '30' });
    expect(r.verified).toBe(false);
    expect(queries.broad).not.toHaveBeenCalled();
  });

  it('cel25c printed numbers are the original fractions', () => {
    expect(pokemonPrintedNumber('cel25c-15_A3', '15', 25)).toBe('15/132');
    expect(pokemonPrintedNumber('cel25c-66_A', '66', 25)).toBe('66/64');
    expect(pokemonPrintedNumber('cel25-5', '5', 25)).toBe('5/25');
  });
});
