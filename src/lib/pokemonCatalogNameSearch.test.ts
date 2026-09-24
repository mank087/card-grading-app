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
