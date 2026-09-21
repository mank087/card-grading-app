import { describe, it, expect } from 'vitest';
import { resolveCardDetailVersion, CARD_DETAIL_CATEGORIES } from './cardDetailV2';

const env = (CARD_DETAIL_V2?: string) => ({ CARD_DETAIL_V2 });

describe('resolveCardDetailVersion', () => {
  describe('default is the legacy page', () => {
    it('serves v1 when the flag is unset', () => {
      expect(resolveCardDetailVersion({ category: 'pokemon', env: {} })).toBe(1);
    });

    it('serves v1 for every category when unset', () => {
      for (const category of CARD_DETAIL_CATEGORIES) {
        expect(resolveCardDetailVersion({ category, env: {} })).toBe(1);
      }
    });

    it('treats an unrecognised value as off', () => {
      expect(resolveCardDetailVersion({ category: 'pokemon', env: env('  ') })).toBe(1);
    });
  });

  describe('kill switch', () => {
    it.each(['off', 'OFF', 'false', '0'])('serves v1 when set to %s', value => {
      expect(resolveCardDetailVersion({ category: 'pokemon', env: env(value) })).toBe(1);
    });

    // The whole point of the rollback path: a URL must not be able to defeat it.
    it('ignores ?v=2 when the mode is off', () => {
      expect(resolveCardDetailVersion({ category: 'pokemon', override: '2', env: env('off') })).toBe(1);
    });
  });

  describe('global on', () => {
    it.each(['on', 'ON', 'true', 'all'])('serves v2 when set to %s', value => {
      expect(resolveCardDetailVersion({ category: 'pokemon', env: env(value) })).toBe(2);
    });

    it('serves v2 for every category', () => {
      for (const category of CARD_DETAIL_CATEGORIES) {
        expect(resolveCardDetailVersion({ category, env: env('on') })).toBe(2);
      }
    });
  });

  describe('per-category rollout', () => {
    it('serves v2 only to a listed category', () => {
      expect(resolveCardDetailVersion({ category: 'pokemon', env: env('pokemon') })).toBe(2);
      expect(resolveCardDetailVersion({ category: 'sports', env: env('pokemon') })).toBe(1);
    });

    it('accepts a comma list with loose spacing and casing', () => {
      const e = env(' Pokemon , SPORTS ');
      expect(resolveCardDetailVersion({ category: 'pokemon', env: e })).toBe(2);
      expect(resolveCardDetailVersion({ category: 'sports', env: e })).toBe(2);
      expect(resolveCardDetailVersion({ category: 'mtg', env: e })).toBe(1);
    });
  });

  describe('query override', () => {
    it('forces v2 on an unlisted category while the flag is live', () => {
      expect(resolveCardDetailVersion({ category: 'mtg', override: '2', env: env('pokemon') })).toBe(2);
    });

    it('forces v1 back on a listed category so reviewers can compare', () => {
      expect(resolveCardDetailVersion({ category: 'pokemon', override: '1', env: env('pokemon') })).toBe(1);
    });

    it('takes the first value when Next hands over an array', () => {
      expect(resolveCardDetailVersion({ category: 'mtg', override: ['2'], env: env('on') })).toBe(2);
    });

    it.each(['', '3', 'two', 'true', undefined, null])('ignores the junk override %s', value => {
      expect(resolveCardDetailVersion({ category: 'mtg', override: value, env: env('pokemon') })).toBe(1);
    });
  });
});
