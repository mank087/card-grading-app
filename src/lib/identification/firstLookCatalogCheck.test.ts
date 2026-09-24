import { describe, expect, it, vi } from 'vitest';

vi.mock('../pokemonApiVerification', () => ({
  findUniqueCatalogMatch: vi.fn(async (name: string, printed: string) => ({ card: name === 'Espeon-GX' && printed === '140/149' ? { id: 'sm1-140' } : null, agreeing: [] })),
}));
vi.mock('../identity/catalogRelink', () => ({
  catalogConfirmsIdentity: vi.fn(async (category: string, who: any) => category === 'MTG' && who.name === 'Lotus Petal'),
}));

import { firstLookCatalogCheck } from './firstLookCatalogCheck';

const read = (name: string, number: string | null, asPrinted = '', set: string | null = null) => ({
  identity: { card_title: { value: name, source: 'printed' }, subject: { value: null }, card_number: { value: number }, set_name: { value: set } },
  printed_text: { card_number_as_printed: asPrinted },
}) as any;

describe('first look catalog check (skips the web search)', () => {
  it('Pokemon: uses the printed fraction, not the bare numerator', async () => {
    const check = firstLookCatalogCheck('pokemon')!;
    expect(await check(read('Espeon-GX', '140', '140/149'))).toBe(true);
    expect(await check(read('Espeon-GX', '140', ''))).toBe(false);
  });
  it('MTG/Lorcana/One Piece go through the catalog link guards', async () => {
    expect(await firstLookCatalogCheck('mtg')!(read('Lotus Petal', '294', '', 'Tempest'))).toBe(true);
    expect(await firstLookCatalogCheck('onepiece')!(read('Roronoa Zoro', 'OP01-025'))).toBe(false);
  });
  it('categories without a live catalog always search', () => {
    for (const t of ['sports', 'other', 'starwars', 'yugioh', undefined]) expect(firstLookCatalogCheck(t)).toBeUndefined();
  });
});
