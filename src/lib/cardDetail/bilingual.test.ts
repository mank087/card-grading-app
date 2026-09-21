import { describe, it, expect } from 'vitest';
import { hasJapanese, splitBilingual, splitBilingualLines } from './bilingual';

describe('hasJapanese', () => {
  it('is false for empty and for English', () => {
    expect(hasJapanese(null)).toBe(false);
    expect(hasJapanese('')).toBe(false);
    expect(hasJapanese('Charizard')).toBe(false);
  });

  it('is true for hiragana, katakana and kanji', () => {
    expect(hasJapanese('ひとかげ')).toBe(true);
    expect(hasJapanese('リザードン')).toBe(true);
    expect(hasJapanese('炎')).toBe(true);
  });
});

describe('splitBilingual', () => {
  it('returns null for absent text', () => {
    expect(splitBilingual(null)).toBeNull();
    expect(splitBilingual(undefined)).toBeNull();
    expect(splitBilingual('')).toBeNull();
  });

  it('marks English-only text as not Japanese and keeps the whole string', () => {
    expect(splitBilingual('Base Set')).toEqual({
      japanese: false,
      jp: null,
      en: null,
      full: 'Base Set',
    });
  });

  it('splits on ASCII parentheses', () => {
    expect(splitBilingual('リザードン (Charizard)')).toEqual({
      japanese: true,
      jp: 'リザードン',
      en: 'Charizard',
      full: 'リザードン (Charizard)',
    });
  });

  it('splits on full-width parentheses and on a slash', () => {
    expect(splitBilingual('リザードン（Charizard）')?.en).toBe('Charizard');
    expect(splitBilingual('リザードン/Charizard')?.jp).toBe('リザードン');
  });

  it('keeps a Japanese-only string whole with both halves null', () => {
    expect(splitBilingual('リザードン')).toEqual({
      japanese: true,
      jp: null,
      en: null,
      full: 'リザードン',
    });
  });
});

describe('splitBilingualLines', () => {
  it('returns null for absent text', () => {
    expect(splitBilingualLines(null)).toBeNull();
  });

  it('reports English-only text with empty line lists', () => {
    expect(splitBilingualLines('Attack 30')).toEqual({
      japanese: false,
      jpLines: [],
      enLines: [],
    });
  });

  it('separates the lines and drops blank ones', () => {
    expect(splitBilingualLines('かえんほうしゃ\n\nFlamethrower 90')).toEqual({
      japanese: true,
      jpLines: ['かえんほうしゃ'],
      enLines: ['Flamethrower 90'],
    });
  });
});
