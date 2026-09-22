import { describe, it, expect } from 'vitest';
import {
  buildCardInfo,
  hasAutograph,
  hasPrintRunSerial,
  isRookieOrFirst,
} from './cardInfo';

describe('buildCardInfo', () => {
  it('prefers the verified database columns over the model JSON', () => {
    const info = buildCardInfo({
      card_set: 'Base Set',
      card_number: '4/102',
      conversational_card_info: {
        set_name: '**Jungle**',
        card_number_raw: '15/64',
      },
      dvg_grading: { card_info: { set_name: 'Fossil' } },
    });
    expect(info.set_name).toBe('Base Set');
    expect(info.card_number).toBe('4/102');
  });

  it('strips markdown from the JSON fallbacks', () => {
    const info = buildCardInfo({ conversational_card_info: { set_name: '**Jungle**' } });
    expect(info.set_name).toBe('Jungle');
  });

  it('appends the subset to the set name and keeps the subset separately', () => {
    const info = buildCardInfo({ card_set: 'Base Set', subset: 'Shadowless' });
    expect(info.set_name).toBe('Base Set - Shadowless');
    expect(info.subset).toBe('Shadowless');
  });

  it('takes the year from the first four characters of release_date', () => {
    expect(buildCardInfo({ release_date: '1999-01-09' }).year).toBe('1999');
  });

  it('falls back through conversational then dvg for the year', () => {
    const info = buildCardInfo({
      conversational_card_info: { year: '**2003**' },
      dvg_grading: { card_info: { year: '1999' } },
    });
    expect(info.year).toBe('2003');
  });

  it('reproduces the legacy memorabilia quirk: a null column reads as true', () => {
    // card.memorabilia_type !== 'none' — NULL !== 'none'. Kept, not fixed.
    expect(buildCardInfo({}).memorabilia).toBe(true);
    expect(buildCardInfo({ memorabilia_type: 'none' }).memorabilia).toBe(false);
  });

  it('treats an authentic autograph_type as autographed', () => {
    expect(buildCardInfo({ autograph_type: 'authentic' }).autographed).toBe(true);
    expect(buildCardInfo({ autograph_type: 'unverified' }).autographed).toBe(false);
  });
});

describe('hasPrintRunSerial', () => {
  it('accepts a real print run', () => {
    expect(hasPrintRunSerial('12/99')).toBe(true);
  });

  it('rejects the grader’s ways of saying there is none', () => {
    for (const value of ['N/A', 'Not present', 'None visible', 'none', 'NONE']) {
      expect(hasPrintRunSerial(value)).toBe(false);
    }
  });

  it('rejects absent values', () => {
    expect(hasPrintRunSerial(null)).toBe(false);
    expect(hasPrintRunSerial(undefined)).toBe(false);
    expect(hasPrintRunSerial('')).toBe(false);
  });
});

describe('isRookieOrFirst', () => {
  it('accepts a boolean, the string "true", and the dvg string', () => {
    expect(isRookieOrFirst({ rookie_or_first: true } as never, {})).toBe(true);
    expect(isRookieOrFirst({ rookie_or_first: 'true' } as never, {})).toBe(true);
    expect(
      isRookieOrFirst({ rookie_or_first: null } as never, {
        rarity_features: { rookie_or_first: 'true' },
      })
    ).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isRookieOrFirst({ rookie_or_first: 'false' } as never, {})).toBe(false);
  });
});

describe('hasAutograph', () => {
  it('accepts the three card-info spellings and both dvg locations', () => {
    expect(hasAutograph({ autographed: true } as never, {})).toBe(true);
    expect(hasAutograph({ autographed: 'Yes' } as never, {})).toBe(true);
    expect(hasAutograph({ autographed: false } as never, { autograph: { present: true } })).toBe(true);
    expect(
      hasAutograph({ autographed: false } as never, {
        rarity_features: { autograph: { present: true } },
      })
    ).toBe(true);
  });

  it('is false when nothing says so', () => {
    expect(hasAutograph({ autographed: false } as never, {})).toBe(false);
  });
});

/**
 * Owner review 2026-09-22, item 12: `cards.rarity_tier` is the grader's
 * classification bucket ('Parallel / Insert Variant' on nearly every Pokemon
 * card), not the rarity. See src/lib/rarityBuckets.ts.
 */
describe('rarity_tier vs the classification bucket', () => {
  it('skips the bucket and uses the printed rarity for a Pokemon card', () => {
    const info = buildCardInfo(
      {
        rarity_tier: 'Parallel / Insert Variant',
        conversational_card_info: { rarity_tier: 'Secret Rare' },
      },
      'pokemon',
    );
    expect(info.rarity_tier).toBe('Secret Rare');
  });

  it('shows nothing rather than the bucket when there is no other source', () => {
    const info = buildCardInfo({ rarity_tier: 'Parallel / Insert Variant' }, 'pokemon');
    expect(info.rarity_tier).toBeUndefined();
  });

  it('keeps the bucket for sports, where it is the description', () => {
    const info = buildCardInfo(
      {
        rarity_tier: 'Parallel / Insert Variant',
        conversational_card_info: { rarity_tier: 'Secret Rare' },
      },
      'sports',
    );
    expect(info.rarity_tier).toBe('Parallel / Insert Variant');
  });

  it('falls back to the row’s own category column when none is passed', () => {
    expect(
      buildCardInfo({ category: 'Baseball', rarity_tier: 'Short Print (SP)' }).rarity_tier,
    ).toBe('Short Print (SP)');
    expect(
      buildCardInfo({ category: 'Pokemon', rarity_tier: 'Short Print (SP)' }).rarity_tier,
    ).toBeUndefined();
  });
});
