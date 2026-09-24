import { describe, expect, it } from 'vitest';
import { normalizeCatalogName } from './pokemonTcgApi';

describe('catalog name normalization (matches the name_search column)', () => {
  it('ignores hyphens, spaces, case and punctuation, keeps accented letters', () => {
    expect(normalizeCatalogName('Espeon GX')).toBe(normalizeCatalogName('Espeon-GX'));
    expect(normalizeCatalogName('ESPEON‑GX')).toBe('espeongx');
    expect(normalizeCatalogName('Pikachu & Zekrom-GX')).toBe('pikachuzekromgx');
    expect(normalizeCatalogName("Team Rocket's Mewtwo ex")).toBe('teamrocketsmewtwoex');
    expect(normalizeCatalogName('Flabébé')).toBe('flabébé');
  });
});

describe('"and" vs "&" in catalog names', () => {
  it('searches both forms when the name has "&" or a standalone "and"', async () => {
    const { catalogNameVariants } = await import('./pokemonTcgApi');
    expect(catalogNameVariants('Pikachu and Zekrom GX')).toEqual(['pikachuzekromgx', 'pikachuandzekromgx']);
    expect(catalogNameVariants('Pikachu & Zekrom-GX')).toEqual(['pikachuzekromgx', 'pikachuandzekromgx']);
    expect(catalogNameVariants('Wait and See Hammer')).toContain('waitandseehammer');
  });
  it('leaves "and" inside a word alone', async () => {
    const { catalogNameVariants } = await import('./pokemonTcgApi');
    expect(catalogNameVariants('Sandslash')).toEqual(['sandslash']);
    expect(catalogNameVariants('Brandon')).toEqual(['brandon']);
    expect(catalogNameVariants('Espeon GX')).toEqual(['espeongx']);
  });
});
