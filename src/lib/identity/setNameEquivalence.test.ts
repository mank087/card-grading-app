import { describe, expect, it } from 'vitest';
import { setNamesEquivalent } from './setNameEquivalence';

describe('setNamesEquivalent — naming-only differences', () => {
  const same: Array<[string, string]> = [
    ['Prizm', 'Panini Prizm Football'],
    ['Topps', '2025 Topps Football'],
    ['Panini Prizm', 'Prizm'],
    ['Topps Chrome', '2024 Topps Chrome Baseball'],
    ['Upper Deck', '1993 Upper Deck Baseball'],
    ['Upper-Deck SP Authentic', 'SP Authentic'],
    ['Hoops', '2023-24 Panini Hoops Basketball'],
    ['Donruss Optic', 'Panini Donruss Optic'],
    ['Base Set', 'Pokemon Base Set'],
    ['Base Set', 'Pokémon Base Set'],
    ['Pokemon', 'Pokémon'],
    ['Sun & Moon', 'Sun and Moon'],
    ['Jungle', 'Jungle Set'],
    ['Star Wars', 'Star Wars Trading Cards'],
    ['Mars Attacks', 'MARS ATTACKS!'],
    ['Topps', 'Topps Base Set'],
    ['Flair', ' flair '],
  ];
  for (const [a, b] of same) {
    it(`"${a}" ~ "${b}"`, () => {
      expect(setNamesEquivalent(a, b)).toBe(true);
      expect(setNamesEquivalent(b, a)).toBe(true);
    });
  }
});

describe('setNamesEquivalent — different products stay distinct', () => {
  const different: Array<[string, string]> = [
    ['Prizm', 'Select'],
    ['Base Set', 'Base Set 2'],
    ['Celebrations', '30th Celebration'],
    ['Star Wars', 'Star Wars Wonder Bread'],
    ['Mars Attacks', 'Mars Attacks Christmas'],
    ['Topps Chrome', 'Bowman Chrome'],
    ['Topps', 'Bowman'],
    ['Topps', 'Topps Chrome'],
    ['Bowman', 'Bowman Chrome'],
    ['Prizm', 'Prizm Draft Picks'],
    ['Base Set', 'Topps'],
    ['Base Set', 'Jungle'],
    ['Wonder Bread', 'Topps'],
    ['2024 Topps', '2025 Topps'],
    ['1993-94 Fleer', '1994-95 Fleer'],
    ['Football', 'Baseball'],
    ['Scarlet & Violet 151', '151 Collection'],
  ];
  for (const [a, b] of different) {
    it(`"${a}" ≠ "${b}"`, () => {
      expect(setNamesEquivalent(a, b)).toBe(false);
      expect(setNamesEquivalent(b, a)).toBe(false);
    });
  }

  it('a blank is never equivalent to anything', () => {
    expect(setNamesEquivalent('', 'Topps')).toBe(false);
    expect(setNamesEquivalent(null, null)).toBe(false);
    expect(setNamesEquivalent('  ', undefined)).toBe(false);
  });
});
