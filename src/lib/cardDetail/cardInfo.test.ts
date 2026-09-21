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
