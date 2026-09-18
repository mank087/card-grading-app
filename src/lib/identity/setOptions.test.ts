import { describe, expect, it } from 'vitest';
import { setCatalogKey } from './setOptions';

describe('which internal set catalog a category uses', () => {
  it('maps the stored category spellings', () => {
    expect(setCatalogKey('Pokemon')).toBe('pokemon');
    expect(setCatalogKey('MTG')).toBe('mtg');
    expect(setCatalogKey('Magic: The Gathering')).toBe('mtg');
    expect(setCatalogKey('One Piece')).toBe('onepiece');
    expect(setCatalogKey('Yu-Gi-Oh')).toBe('yugioh');
    expect(setCatalogKey('Yu-Gi-Oh!')).toBe('yugioh');
    expect(setCatalogKey('Star Wars')).toBe('starwars');
    expect(setCatalogKey('Lorcana')).toBe('lorcana');
  });
  it('has no set list for sports or Other, so those stay free text', () => {
    for (const c of ['Sports', 'Baseball', 'Other', '', null, undefined]) expect(setCatalogKey(c)).toBeNull();
  });
});
