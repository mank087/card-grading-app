/**
 * The three anchor cases are real production rows found by the 2026-09-17 scan:
 * a "Babe Ruth" with no set and no year matched to Babe Ruth #53 at $2,739,573,
 * a Mickey Mantle whose set is the useless "Topps Baseball" with no year at
 * $778,764, and a 1977 Wonder Bread Luke Skywalker (a ~$30-200 card) whose set
 * was literally the string "Unknown", matched to Luke Skywalker #1 at $94,854.
 * If any of them stops being withheld, the guard is broken.
 */

import { describe, it, expect } from 'vitest';
import {
  assessValueTrust,
  capMatchConfidence,
  isBlankIdentityText,
  VALUE_GUARD_THRESHOLD,
} from './valueGuard';

/** The Babe Ruth row: name only, nothing else on file. */
const babeRuth = {
  category: 'Baseball',
  card_set: null,
  release_date: null,
  dcm_selected_product_id: null,
  identity_confirmed_revision: null,
};

/** The Mantle row: a set that names no printing, and no year. */
const mantle = {
  category: 'Baseball',
  card_set: 'Topps Baseball',
  release_date: null,
  dcm_selected_product_id: null,
  identity_confirmed_revision: null,
};

/** The Wonder Bread Luke: the set is the word "Unknown". */
const luke = {
  category: 'Star Wars',
  card_set: 'Unknown',
  release_date: null,
  dcm_selected_product_id: null,
  identity_confirmed_revision: null,
};

describe('assessValueTrust', () => {
  it('withholds the three production cards that showed six- and seven-figure values', () => {
    expect(assessValueTrust(babeRuth, 2739573)).toEqual({ trusted: false, reason: 'thin_identity' });
    expect(assessValueTrust(mantle, 778764)).toEqual({ trusted: false, reason: 'thin_identity' });
    expect(assessValueTrust(luke, 94854.17)).toEqual({ trusted: false, reason: 'thin_identity' });
  });

  it('releases the same cards once the owner picked the pricing product', () => {
    for (const card of [babeRuth, mantle, luke]) {
      const picked = { ...card, dcm_selected_product_id: '6910' };
      expect(assessValueTrust(picked, 2739573)).toEqual({ trusted: true, reason: 'owner_confirmed' });
    }
  });

  it('releases the same cards once the owner confirmed the identity', () => {
    for (const card of [babeRuth, mantle, luke]) {
      expect(assessValueTrust({ ...card, identity_confirmed_revision: 3 }, 778764))
        .toEqual({ trusted: true, reason: 'owner_confirmed' });
    }
    // Revision 0 is a real confirmation: a card confirmed before any edit.
    expect(assessValueTrust({ ...babeRuth, identity_confirmed_revision: 0 }, 778764))
      .toEqual({ trusted: true, reason: 'owner_confirmed' });
  });

  it('leaves a thin card alone below the threshold', () => {
    expect(assessValueTrust(babeRuth, 300)).toEqual({ trusted: true, reason: 'below_threshold' });
    expect(assessValueTrust(babeRuth, VALUE_GUARD_THRESHOLD)).toEqual({ trusted: true, reason: 'below_threshold' });
    expect(assessValueTrust(babeRuth, VALUE_GUARD_THRESHOLD + 0.01).trusted).toBe(false);
  });

  it('does not treat a missing year as thin for a TCG card with a set', () => {
    const pokemon = {
      category: 'Pokemon',
      card_set: 'Base Set',
      release_date: null,
      dcm_selected_product_id: null,
      identity_confirmed_revision: null,
    };
    expect(assessValueTrust(pokemon, 12000)).toEqual({ trusted: true, reason: 'ok' });

    // Same card with no set is still thin.
    expect(assessValueTrust({ ...pokemon, card_set: null }, 12000).trusted).toBe(false);
  });

  it('does treat a missing year as thin for sports, Other and Star Wars', () => {
    const base = { card_set: 'Topps', release_date: null, dcm_selected_product_id: null, identity_confirmed_revision: null };
    for (const category of ['Baseball', 'Football', 'Sports', 'Other', 'Star Wars']) {
      expect(assessValueTrust({ ...base, category }, 9000).reason).toBe('thin_identity');
    }
    // With a year on file the same rows are fine.
    expect(assessValueTrust({ ...base, category: 'Baseball', release_date: '1960' }, 9000))
      .toEqual({ trusted: true, reason: 'ok' });
  });

  it('never withholds when the caller selected no identity fields at all', () => {
    expect(assessValueTrust({ dcm_price_estimate: 999999 } as any, 999999))
      .toEqual({ trusted: true, reason: 'identity_unknown' });
    // An explicit null is NOT the same as an absent field.
    expect(assessValueTrust({ card_set: null }, 999999).trusted).toBe(false);
  });

  it('judges on whichever identity field the caller did select', () => {
    // Year only, sports: thin.
    expect(assessValueTrust({ category: 'Baseball', release_date: null }, 9000).trusted).toBe(false);
    // Year only, present: cannot see the set, so nothing to withhold on.
    expect(assessValueTrust({ category: 'Baseball', release_date: '1960' }, 9000))
      .toEqual({ trusted: true, reason: 'ok' });
    // Set only, present: a missing year it cannot see must not withhold.
    expect(assessValueTrust({ category: 'Baseball', card_set: '1960 Topps' }, 9000))
      .toEqual({ trusted: true, reason: 'ok' });
  });

  it('reads the set and year out of conversational_card_info when the columns are not selected', () => {
    expect(assessValueTrust({ category: 'Baseball', conversational_card_info: { set_name: null, year: null } }, 9000).trusted)
      .toBe(false);
    expect(assessValueTrust({ category: 'Baseball', conversational_card_info: { set_name: '1960 Topps', year: '1960' } }, 9000))
      .toEqual({ trusted: true, reason: 'ok' });
    // The column wins when it has a value; the JSON fills in when it is null.
    expect(assessValueTrust(
      { category: 'Baseball', card_set: null, release_date: null, conversational_card_info: { set_name: 'Topps', year: '1960' } },
      9000,
    )).toEqual({ trusted: true, reason: 'ok' });
  });

  it('treats Unknown, N/A and whitespace as blank, case and padding included', () => {
    for (const set of ['Unknown', ' unknown ', 'N/A', 'n/a', 'NONE', '', '   ', 'null']) {
      expect(assessValueTrust({ category: 'Pokemon', card_set: set }, 9000).reason).toBe('thin_identity');
    }
    expect(assessValueTrust({ category: 'Pokemon', card_set: 'Unknown Origins' }, 9000).reason).toBe('ok');
  });

  it('never withholds a value that is not a usable number', () => {
    expect(assessValueTrust(babeRuth, Number.NaN).trusted).toBe(true);
    expect(assessValueTrust(babeRuth, Number.POSITIVE_INFINITY).trusted).toBe(true);
    expect(assessValueTrust(babeRuth, 0).trusted).toBe(true);
  });
});

describe('isBlankIdentityText', () => {
  it('separates real values from the placeholders', () => {
    expect(isBlankIdentityText(null)).toBe(true);
    expect(isBlankIdentityText(undefined)).toBe(true);
    expect(isBlankIdentityText('  ')).toBe(true);
    expect(isBlankIdentityText('unknown')).toBe(true);
    expect(isBlankIdentityText(0)).toBe(true);
    expect(isBlankIdentityText('1960')).toBe(false);
    expect(isBlankIdentityText(1960)).toBe(false);
  });
});

describe('capMatchConfidence', () => {
  it('caps a name-only query at low', () => {
    expect(capMatchConfidence('high', { setName: null, year: null })).toBe('low');
    expect(capMatchConfidence('medium', { setName: '', year: undefined })).toBe('low');
    expect(capMatchConfidence('high', { setName: 'Unknown', year: 'n/a' })).toBe('low');
  });

  it('leaves a query that knows the set or the year alone', () => {
    expect(capMatchConfidence('high', { setName: 'Base Set', year: null })).toBe('high');
    expect(capMatchConfidence('high', { setName: null, year: '1960' })).toBe('high');
    expect(capMatchConfidence('medium', { setName: '1960 Topps', year: '1960' })).toBe('medium');
  });

  it('does not promote or alter low and none', () => {
    expect(capMatchConfidence('low', { setName: 'Base Set', year: '1999' })).toBe('low');
    expect(capMatchConfidence('none', { setName: null, year: null })).toBe('none');
  });
});

describe('items that are not standard trading cards', () => {
  it('never shows a value, at any amount, and owner confirmation does not lift it', async () => {
    const { assessValueTrust } = await import('./valueGuard');
    const divider = { item_type: 'accessory_not_a_card', card_set: 'Lost Origin', release_date: '2022', category: 'Pokemon' };
    expect(assessValueTrust(divider, 22.77)).toEqual({ trusted: false, reason: 'not_standard_card' });
    expect(assessValueTrust({ ...divider, dcm_selected_product_id: '123', identity_confirmed_revision: 3 }, 22.77).trusted).toBe(false);
  });
  it('leaves standard cards, unknown reads and slabbed cards alone', async () => {
    const { assessValueTrust } = await import('./valueGuard');
    for (const item_type of [null, undefined, 'trading_card', 'cannot_tell', 'already_graded_slab']) {
      expect(assessValueTrust({ item_type, card_set: 'Prizm', release_date: '2023', category: 'Sports' } as any, 40).trusted).toBe(true);
    }
  });
  it('uses exactly the item types the identification policy names', async () => {
    const { NO_VALUE_ITEM_TYPES } = await import('./valueGuard');
    const { NON_STANDARD_ITEM_TYPES } = await import('../identification/itemType');
    expect([...NO_VALUE_ITEM_TYPES].sort()).toEqual([...NON_STANDARD_ITEM_TYPES].sort());
  });
});
