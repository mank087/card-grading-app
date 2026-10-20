import { describe, expect, it } from 'vitest';
import { decideJapaneseVintage, japaneseNameOf, jpExpansionSymbolOf, type JaCatalogRow } from './pokemonJapaneseVintage';

const row = (set_id: string, hp: number, id = `${set_id}-x`): JaCatalogRow => ({ id, name: 'x', hp, set_id });
const info = (over: Record<string, any> = {}) => ({ card_name: 'ライチュウ (Raichu)', hp: '90', set_name: null, year: '1996', year_source: 'back_copyright', card_number: '026', first_look_jp_symbol: 'none', ...over });

describe('decideJapaneseVintage', () => {
  it('name + HP picks the set even when the symbol was misread (Raichu HP90 = Fossil, read as "none")', () => {
    const i: any = info();
    expect(decideJapaneseVintage(i, [row('PMCG1', 80), row('PMCG3', 90, 'PMCG3-014')])).toMatchObject({ applied: 'catalog', set_name: 'Mystery of the Fossils', year: '1997', card_id: 'PMCG3-014' });
    expect(i).toMatchObject({ year: '1997', year_source: 'set_logo', set_id: 'PMCG3', tcgdex_id: 'PMCG3-014', card_number: '026' });
  });

  it('a Base Set card stays 1996 even when the symbol was misread as Jungle (Tangela HP50)', () => {
    const i: any = info({ card_name: 'モンジャラ (Tangela)', hp: '50', first_look_jp_symbol: 'jungle' });
    decideJapaneseVintage(i, [row('PMCG1', 50)]);
    expect(i).toMatchObject({ set_name: 'Expansion Pack', year: '1996' });
  });

  it('two catalog candidates are settled by the symbol (Pikachu HP50: Jungle or Neo Genesis)', () => {
    const i: any = info({ card_name: 'ピカチュウ (Pikachu)', hp: '50', first_look_jp_symbol: 'jungle' });
    expect(decideJapaneseVintage(i, [row('PMCG1', 40), row('PMCG2', 50), row('neo1', 50)])).toMatchObject({ applied: 'catalog', via: 'name_hp_symbol', set_name: 'Jungle' });
    const j: any = info({ card_name: 'ピカチュウ (Pikachu)', hp: '50', year: null, year_source: 'not_visible', first_look_jp_symbol: 'none' });
    expect(decideJapaneseVintage(j, [row('PMCG2', 50), row('neo1', 50)]).applied).toBe('year_restored');
  });

  it('a palm tree with no catalog match is Southern Islands, 1999 (Vileplume HP70)', () => {
    const i: any = info({ card_name: 'ラフレシア (Vileplume)', hp: '70', first_look_jp_symbol: 'southern_islands', tcgdex_id: 'SV2a-045', set_id: 'SV2a' });
    expect(decideJapaneseVintage(i, [row('PMCG2', 80), row('PMCG4', 60)])).toMatchObject({ applied: 'symbol', set_name: 'Southern Islands', year: '1999' });
    expect(i).toMatchObject({ tcgdex_id: null, set_id: null });
  });

  it('a Jungle or Fossil symbol alone is not trusted: the 1996 from the back is dropped instead', () => {
    const i: any = info({ card_name: 'ラフレシア (Vileplume)', hp: '70', first_look_jp_symbol: 'jungle' });
    expect(decideJapaneseVintage(i, [row('PMCG2', 80)])).toMatchObject({ applied: 'year_cleared' });
    expect(i).toMatchObject({ year: null, set_name: null });
  });

  it('the Rocket R is trusted alone', () => {
    const i: any = info({ card_name: 'わるいブースター (Dark Flareon)', hp: '', first_look_jp_symbol: 'rocket' });
    expect(decideJapaneseVintage(i, [])).toMatchObject({ applied: 'symbol', set_name: 'Rocket Gang', year: '1997' });
  });

  it('gym cards resolve from the catalog (Koga Zubat HP40 = Challenge from the Darkness, 1999)', () => {
    const i: any = info({ card_name: 'キョウのズバット (Koga Zubat)', hp: '40', first_look_jp_symbol: 'other' });
    expect(decideJapaneseVintage(i, [row('PMCG6', 40)])).toMatchObject({ applied: 'catalog', year: '1999' });
  });

  it('no symbol and no match restores the dropped 1996, never naming a set', () => {
    const i: any = info({ year: null, year_source: 'not_visible', hp: '' });
    expect(decideJapaneseVintage(i, []).applied).toBe('year_restored');
    expect(i).toMatchObject({ year: '1996', set_name: null });
  });

  it('a modern card (first look reports no symbol) is left alone', () => {
    const i: any = info({ first_look_jp_symbol: null, jp_expansion_symbol: null, year: '2023', year_source: 'back_copyright' });
    expect(decideJapaneseVintage(i, [row('PMCG3', 90)]).applied).toBeNull();
    expect(i.year).toBe('2023');
  });

  it('a symbol that contradicts the catalog pick vetoes it (name misread without its prefix)', () => {
    const flareon: any = info({ card_name: 'イーブイ (Eevee)', hp: '50', first_look_jp_symbol: 'rocket', year: null, year_source: 'not_visible' });
    expect(decideJapaneseVintage(flareon, [row('PMCG2', 50)])).toMatchObject({ applied: 'symbol', set_name: 'Rocket Gang' });
    const pidgeotto: any = info({ card_name: 'ピジョン (Pidgeotto)', hp: '60', first_look_jp_symbol: 'other', year: null, year_source: 'not_visible' });
    expect(decideJapaneseVintage(pidgeotto, [row('PMCG1', 60)]).applied).toBeNull();
    expect(pidgeotto).toMatchObject({ set_name: null, year: null });
    const fossilReadNone: any = info();
    expect(decideJapaneseVintage(fossilReadNone, [row('PMCG3', 90)]).applied).toBe('catalog');
  });

  it('reads the Japanese name and normalises the symbol', () => {
    expect(japaneseNameOf({ card_name: 'ラフレシア (Vileplume)' })).toBe('ラフレシア');
    expect(japaneseNameOf({ card_name: 'Vileplume', player_or_character: 'わるいカイリュー（Dark Dragonite）' })).toBe('わるいカイリュー');
    expect(japaneseNameOf({ card_name: 'Vileplume' })).toBeNull();
    expect(jpExpansionSymbolOf(' Southern_Islands ')).toBe('southern_islands');
    expect(jpExpansionSymbolOf('palm tree')).toBeNull();
  });
});
