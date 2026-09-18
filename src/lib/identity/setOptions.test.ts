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

describe('printed set codes', () => {
  it('turns an exact code into the catalog set, and leaves names and junk alone', async () => {
    const { setNameForCode } = await import('./setOptions');
    const options = [{ name: 'Teenage Mutant Ninja Turtles Source Material', year: '2026', code: 'pza' }, { name: 'Dissension', year: '2006', code: 'dis' }];
    expect(setNameForCode(options, 'PZA')?.name).toBe('Teenage Mutant Ninja Turtles Source Material');
    expect(setNameForCode(options, ' pza ')?.year).toBe('2026');
    expect(setNameForCode(options, 'Dissension')).toBeNull();
    expect(setNameForCode(options, 'Teenage Mutant Ninja Turtles')).toBeNull();
    expect(setNameForCode(options, '')).toBeNull();
  });
});

describe('Magic collector numbers', () => {
  it('drops the rarity letter and the padding, and leaves other shapes alone', async () => {
    const { mtgCollectorNumber } = await import('./setOptions');
    expect(mtgCollectorNumber('M 0006')).toBe('6');
    expect(mtgCollectorNumber('m 0005')).toBe('5');
    expect(mtgCollectorNumber('R0123')).toBe('123');
    expect(mtgCollectorNumber('116/086')).toBeNull();
    expect(mtgCollectorNumber('6')).toBeNull();
    expect(mtgCollectorNumber('')).toBeNull();
  });
});
