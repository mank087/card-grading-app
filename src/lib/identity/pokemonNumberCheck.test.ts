import { describe, expect, it, vi } from 'vitest';

// The default catalog lookup (no injected `lookup`) reads pokemon_cards.
const rows = vi.hoisted(() => ({ data: [] as Array<{ name: string; number: string; set_name: string; set_printed_total: number }>, filters: [] as string[] }));
vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: () => {
    const f: Record<string, any> = {};
    const chain: any = {
      select: () => chain,
      limit: () => chain,
      eq: (col: string, value: any) => { f[col] = value; return chain; },
      ilike: (col: string, value: string) => { rows.filters.push(`${col} ilike ${value}`); f.ilike = value.replace(/%/g, '').toLowerCase(); return chain; },
      then: (resolve: any) => resolve({ error: null, data: rows.data.filter(r => r.number === f.number
        && (f.set_printed_total === undefined || r.set_printed_total === f.set_printed_total)
        && (!f.ilike || r.name.toLowerCase().includes(f.ilike))) }),
    };
    return { from: () => chain };
  },
}));
import { parsePokemonNumber, settlePokemonNumber } from './pokemonNumberCheck';
import type { ReviewField } from './reviewPrefill';

const base = (over: Partial<ReviewField> = {}): ReviewField => ({ key: 'card_number', label: 'Card number', value: '', storedValue: '', origin: 'empty', needsCheck: false, differsFromStored: false, ...over });
const name: ReviewField = { key: 'featured', label: 'Player or character', value: 'Gengar', storedValue: 'Gengar', origin: 'from_grading', needsCheck: false, differsFromStored: false };
// The owner's card: only Gengar #66 in a 196-card set exists in the catalog.
const catalog = async (n: string, number: string, total: number | null) =>
  n.toLowerCase() === 'gengar' && number === '66' && total === 196 ? { setName: 'Lost Origin' } : null;

describe('parsePokemonNumber', () => {
  it('keeps what matters for the catalog and drops padding', () => {
    expect(parsePokemonNumber('066/196')).toEqual({ number: '66', total: 196 });
    expect(parsePokemonNumber('#6/102')).toEqual({ number: '6', total: 102 });
    expect(parsePokemonNumber('TG05/TG30')).toEqual({ number: 'TG5', total: 30 });
    expect(parsePokemonNumber('SWSH039')).toEqual({ number: 'SWSH39', total: null });
    expect(parsePokemonNumber('')).toBeNull();
  });
});

describe('settlePokemonNumber', () => {
  it('puts the catalog-confirmed read in the box, zeros kept, and keeps the stored value one tap away', async () => {
    const fields = [name, base({ value: '086', storedValue: '086', origin: 'from_grading', suggestion: { value: '066/196', origin: 'suggested', source: 'printed' } })];
    const card = (await settlePokemonNumber(fields, 'Pokemon', catalog)).find(f => f.key === 'card_number')!;
    expect(card).toMatchObject({ value: '066/196', origin: 'read_from_card', differsFromStored: true, catalogNote: 'Matches the Pokémon catalog (Lost Origin)' });
    expect(card.suggestion?.value).toBe('086');
  });
  it('marks a stored number the catalog confirms, and changes nothing else', async () => {
    const fields = [name, base({ value: '066/196', storedValue: '066/196', origin: 'from_grading', suggestion: { value: '086/106', origin: 'suggested', source: 'printed' } })];
    const card = (await settlePokemonNumber(fields, 'Pokemon', catalog)).find(f => f.key === 'card_number')!;
    expect(card).toMatchObject({ value: '066/196', catalogNote: 'Matches the Pokémon catalog (Lost Origin)' });
    expect(card.suggestion?.value).toBe('086/106');
  });
  it('leaves the fields alone when neither or both match, for other games, or when the catalog fails', async () => {
    const neither = [name, base({ value: '1', storedValue: '1', suggestion: { value: '2', origin: 'suggested', source: 'printed' } })];
    expect(await settlePokemonNumber(neither, 'Pokemon', catalog)).toEqual(neither);
    const mtg = [name, base({ value: '086', suggestion: { value: '066/196', origin: 'suggested', source: 'printed' } })];
    expect(await settlePokemonNumber(mtg, 'MTG', catalog)).toEqual(mtg);
    expect(await settlePokemonNumber(mtg, 'Pokemon', async () => { throw new Error('down'); })).toEqual(mtg);
  });
});

describe('settlePokemonNumber against the catalog table', () => {
  const espeon: ReviewField = { ...name, key: 'card_name', value: 'Espeon GX', storedValue: 'Espeon GX' };
  const fields = () => [espeon, base({ value: '150/149', storedValue: '150/149', origin: 'from_grading', suggestion: { value: '140/149', origin: 'suggested', source: 'printed' } })];

  it('matches "Espeon GX" to the catalog entry "Espeon-GX" and pre-fills the re-read number', async () => {
    rows.data = [
      { name: 'Espeon-GX', number: '140', set_name: 'Sun & Moon', set_printed_total: 149 },
      { name: 'Espeon-GX', number: '152', set_name: 'Sun & Moon', set_printed_total: 149 },
    ];
    rows.filters = [];
    const card = (await settlePokemonNumber(fields(), 'Pokemon')).find(f => f.key === 'card_number')!;
    expect(card).toMatchObject({ value: '140/149', origin: 'read_from_card', catalogNote: 'Matches the Pokémon catalog (Sun & Moon)' });
    expect(card.suggestion?.value).toBe('150/149');
    expect(rows.filters).toContain('name ilike %espeon%');
  });

  it('does not settle on a number two catalog cards share', async () => {
    rows.data = [
      { name: 'Espeon-GX', number: '140', set_name: 'Sun & Moon', set_printed_total: 149 },
      { name: 'Espeon GX', number: '140', set_name: 'Some Reprint', set_printed_total: 149 },
    ];
    const card = (await settlePokemonNumber(fields(), 'Pokemon')).find(f => f.key === 'card_number')!;
    expect(card.value).toBe('150/149');
    expect(card.catalogNote).toBeUndefined();
  });
});
