import { describe, expect, it } from 'vitest';
import {
  buildReviewPrefill,
  changedFieldPayload,
  cleanPrintedCardNumber,
  firstLookCandidate,
  firstLookResultOf,
  markBaseCandidate,
  NO_CANDIDATE,
  pickBestCandidate,
  reviewEligibility,
  reviewFieldKeys,
  seasonToYear,
  type ReviewCandidate,
  type ReviewField,
} from './reviewPrefill';
import type { FirstLook } from '../identification/firstLook';

/** A complete first look with everything unknown; each test fills in what it needs. */
function look(overrides: {
  identity?: Partial<Record<string, any>>;
  printed?: Partial<Record<string, any>>;
  parallel?: Partial<Record<string, any>>;
  alternatives?: FirstLook['alternatives'];
} = {}): FirstLook {
  const unknown = { value: null, source: 'unknown' as const };
  return {
    photos: { front_shows: 'card_front', back_shows: 'card_back', card_orientation: 'portrait', in_holder: 'none', text_legibility: 'all_readable' },
    layout: { border: 'white', logo_placement: 'none', name_panel: 'bottom', back_layout: 'stats', numbering_style: 'numeral' },
    printed_text: {
      front_title_or_name: null, front_other: null, back_header: null, card_number_as_printed: null,
      copyright_line: null, serial_stamp: null, back_parallel_or_product_text: null,
      ...(overrides.printed || {}),
    } as FirstLook['printed_text'],
    identity: {
      category: 'sports',
      subject: unknown, card_title: unknown, year: unknown, manufacturer: unknown,
      set_name: unknown, insert_or_subset: unknown, card_number: unknown,
      language: 'english', licensed_product: 'licensed',
      ...(overrides.identity || {}),
    } as FirstLook['identity'],
    parallel: {
      finish_observed: 'plain_paper_or_gloss', dominant_color_vs_base: null, pattern_observed: null,
      autograph: 'none', relic_or_patch: false, serial_denominator: null,
      is_base: true, parallel_name: 'Base', decided_by: 'observed_color_or_pattern',
      ...(overrides.parallel || {}),
    } as FirstLook['parallel'],
    design_features: [],
    alternatives: overrides.alternatives || [],
  };
}

const printed = (value: string) => ({ value, source: 'printed' as const });
const recognized = (value: string) => ({ value, source: 'recognized' as const });
const inferred = (value: string) => ({ value, source: 'inferred' as const });

function field(prefill: { fields: ReviewField[] }, key: string): ReviewField {
  const found = prefill.fields.find(f => f.key === key);
  if (!found) throw new Error(`no review field ${key}`);
  return found;
}

describe('review field set', () => {
  it('asks a sports owner about the parallel and everyone else not', () => {
    expect(reviewFieldKeys('Basketball')).toContain('parallel_type');
    expect(reviewFieldKeys('Pokemon')).not.toContain('parallel_type');
    expect(reviewFieldKeys('Pokemon')).toContain('subset_variant');
    expect(reviewFieldKeys(null)).toEqual(reviewFieldKeys('Other'));
  });
});

describe('buildReviewPrefill precedence', () => {
  it('shows stored values as coming from grading when there is no first look', () => {
    const prefill = buildReviewPrefill({ category: 'Pokemon', card_set: 'Base Set', card_name: 'Charizard' }, null);
    expect(field(prefill, 'card_set')).toMatchObject({ value: 'Base Set', origin: 'from_grading', needsCheck: false, differsFromStored: false });
    expect(field(prefill, 'manufacturer_name')).toMatchObject({ value: '', origin: 'empty', needsCheck: false });
    expect(prefill.firstLookPresent).toBe(false);
  });

  it('keeps what is on file when first look read something else, and offers the read as a suggestion', () => {
    // Owner test, Sept 18 2026: a serial stored correctly as 047/249 was transcribed as 041/249.
    const prefill = buildReviewPrefill(
      { category: 'Sports', card_set: 'Topps' },
      look({ identity: { set_name: printed('Wonder Bread') } }),
    );
    expect(field(prefill, 'card_set')).toMatchObject({
      value: 'Topps', storedValue: 'Topps', origin: 'from_grading', differsFromStored: false,
      suggestion: { value: 'Wonder Bread', source: 'printed' },
    });
  });

  it('lets a value read off the card fill a blank as "Read from card"', () => {
    const prefill = buildReviewPrefill({ category: 'Sports', card_set: 'Unknown' }, look({ identity: { set_name: printed('Wonder Bread') } }));
    expect(field(prefill, 'card_set')).toMatchObject({ value: 'Wonder Bread', origin: 'read_from_card', needsCheck: false });
  });

  it('does not call a case-only difference a change', () => {
    const prefill = buildReviewPrefill(
      { category: 'Sports', manufacturer_name: 'topps' },
      look({ identity: { manufacturer: printed('Topps') } }),
    );
    expect(field(prefill, 'manufacturer_name').differsFromStored).toBe(false);
  });

  it('fills a blank from a recognized value and marks it for checking', () => {
    const prefill = buildReviewPrefill(
      { category: 'Sports' },
      look({ identity: { manufacturer: recognized('Topps') } }),
    );
    expect(field(prefill, 'manufacturer_name')).toMatchObject({
      value: 'Topps', origin: 'suggested', needsCheck: true, differsFromStored: true,
    });
  });

  it('treats unknown, n/a and none as blanks worth filling', () => {
    for (const blank of ['unknown', 'N/A', 'none', '   ']) {
      const prefill = buildReviewPrefill(
        { category: 'Sports', card_set: blank },
        look({ identity: { set_name: recognized('Flair') } }),
      );
      expect(field(prefill, 'card_set')).toMatchObject({ value: 'Flair', origin: 'suggested', storedValue: '' });
    }
  });

  it('keeps the stored value and offers the disagreement as a suggestion', () => {
    const prefill = buildReviewPrefill(
      { category: 'Sports', card_set: 'Topps Chrome' },
      look({ identity: { set_name: recognized('Bowman Chrome') } }),
    );
    const set = field(prefill, 'card_set');
    expect(set).toMatchObject({ value: 'Topps Chrome', origin: 'from_grading', needsCheck: false, differsFromStored: false });
    expect(set.suggestion).toMatchObject({ value: 'Bowman Chrome', source: 'recognized' });
  });

  it('offers no suggestion when first look agrees with the card', () => {
    const prefill = buildReviewPrefill(
      { category: 'Sports', card_set: 'Flair' },
      look({ identity: { set_name: recognized(' flair ') } }),
    );
    expect(field(prefill, 'card_set').suggestion).toBeUndefined();
  });

  it('never invents a value for a field first look left unknown', () => {
    const prefill = buildReviewPrefill({ category: 'Sports' }, look());
    for (const key of ['card_set', 'release_date', 'manufacturer_name', 'serial_numbering', 'subset_variant']) {
      expect(field(prefill, key)).toMatchObject({ value: '', origin: 'empty', needsCheck: false });
    }
  });

  it('uses the subject as the card title only when the card has no title of its own', () => {
    const titled = buildReviewPrefill({ category: 'Other' }, look({ identity: { subject: recognized('Darth Vader'), card_title: printed('The villainous Darth Vader') } }));
    expect(field(titled, 'card_name').value).toBe('The villainous Darth Vader');
    expect(field(titled, 'featured').value).toBe('Darth Vader');

    const untitled = buildReviewPrefill({ category: 'Other' }, look({ identity: { subject: recognized('Darth Vader') } }));
    expect(field(untitled, 'card_name')).toMatchObject({ value: 'Darth Vader', needsCheck: true });
  });

  it('reads the insert name out of either JSON key the app writes', () => {
    const prefill = buildReviewPrefill({ category: 'Sports', conversational_card_info: { subset: 'Hardwood Leaders' } }, null);
    expect(field(prefill, 'subset_variant')).toMatchObject({ value: 'Hardwood Leaders', origin: 'from_grading' });
  });

  it('carries at most three alternatives through verbatim', () => {
    const alternatives = [1, 2, 3, 4].map(n => ({ differs_in: 'year', value: `199${n}`, what_would_settle_it: 'copyright line' }));
    const prefill = buildReviewPrefill({ category: 'Sports' }, look({ alternatives }));
    expect(prefill.alternatives).toHaveLength(3);
    expect(prefill.alternatives[0]).toEqual(alternatives[0]);
  });
});

describe('year and card number handling', () => {
  it('stores a season as its first year and keeps the season for display', () => {
    expect(seasonToYear('1995-96')).toEqual({ year: '1995', season: '1995-96' });
    expect(seasonToYear('1977')).toEqual({ year: '1977' });
    const prefill = buildReviewPrefill({ category: 'Basketball' }, look({ identity: { year: inferred('1995-96') } }));
    expect(field(prefill, 'release_date')).toMatchObject({ value: '1995', displayValue: '1995-96', needsCheck: true });
  });

  it('drops a year that is not four digits rather than guessing one', () => {
    expect(firstLookCandidate(look({ identity: { year: recognized('mid 90s') } }), 'release_date')).toBeNull();
  });

  it('keeps the printed card number verbatim, including leading zeros and codes', () => {
    for (const raw of ['116/086', '091/086', 'RA-CS', 'OP11-001']) {
      const prefill = buildReviewPrefill({ category: 'Other' }, look({ printed: { card_number_as_printed: raw } }));
      expect(field(prefill, 'card_number')).toMatchObject({ value: raw, origin: 'read_from_card' });
    }
    expect(cleanPrintedCardNumber('#7')).toBe('7');
  });

  it('falls back to the normalized card number when nothing was transcribed', () => {
    const prefill = buildReviewPrefill({ category: 'Other' }, look({ identity: { card_number: recognized('7') } }));
    expect(field(prefill, 'card_number')).toMatchObject({ value: '7', origin: 'suggested', needsCheck: true });
  });

  it('takes serial numbering from the stamp that was actually read', () => {
    const prefill = buildReviewPrefill({ category: 'Sports' }, look({ printed: { serial_stamp: '23/99' } }));
    expect(field(prefill, 'serial_numbering')).toMatchObject({ value: '23/99', origin: 'read_from_card' });
  });

  it('marks a parallel decided from colour as needing a check, and one printed on the card as read', () => {
    const guessed = buildReviewPrefill({ category: 'Sports' }, look({ parallel: { is_base: false, parallel_name: 'Green Refractor', decided_by: 'observed_color_or_pattern' } }));
    expect(field(guessed, 'parallel_type')).toMatchObject({ value: 'Green Refractor', needsCheck: true });

    const read = buildReviewPrefill({ category: 'Sports' }, look({ parallel: { is_base: false, parallel_name: 'Silver Prizm', decided_by: 'printed_on_card' } }));
    expect(field(read, 'parallel_type')).toMatchObject({ value: 'Silver Prizm', needsCheck: false, origin: 'read_from_card' });
  });
});

describe('firstLookResultOf', () => {
  it('unwraps a stored record and rejects anything that is not one', () => {
    const record = { version: 'first-look-v1', result: look({ identity: { set_name: printed('Flair') } }) };
    expect(firstLookResultOf(record)?.identity.set_name.value).toBe('Flair');
    expect(firstLookResultOf(null)).toBeNull();
    expect(firstLookResultOf({ result: { nope: true } })).toBeNull();
    expect(firstLookResultOf('not json')).toBeNull();
  });
});

describe('changedFieldPayload', () => {
  const fields: ReviewField[] = [
    { key: 'card_set', label: 'Set', value: 'Flair', storedValue: '', origin: 'suggested', needsCheck: true, differsFromStored: true },
    { key: 'card_name', label: 'Card title', value: 'Jordan', storedValue: 'Jordan', origin: 'from_grading', needsCheck: false, differsFromStored: false },
    { key: 'release_date', label: 'Year', value: '1995', storedValue: '1995', origin: 'from_grading', needsCheck: false, differsFromStored: false },
  ];

  it('sends only what differs from the stored value', () => {
    expect(changedFieldPayload(fields, {})).toEqual({ card_set: 'Flair' });
  });

  it('sends an owner edit and a cleared field', () => {
    expect(changedFieldPayload(fields, { card_set: 'Flair', card_name: 'Michael Jordan', release_date: '' }))
      .toEqual({ card_set: 'Flair', card_name: 'Michael Jordan', release_date: '' });
  });

  it('sends nothing when the owner reverts every prefill', () => {
    expect(changedFieldPayload(fields, { card_set: '' })).toEqual({});
  });
});

describe('reviewEligibility', () => {
  const graded = {
    user_id: 'owner', conversational_whole_grade: 9, grade_status: 'complete',
    graded_at: '2026-09-16T10:00:00Z', identity_revision: 0,
  };
  const since = { confirmSince: '2026-09-15' };

  it('pops up for a freshly graded card once a rollout date is set', () => {
    expect(reviewEligibility(graded, 'owner', since)).toEqual({ mode: 'popup', reason: 'eligible' });
  });

  it('pops up on the first visit for every unconfirmed card when no rollout date is set', () => {
    expect(reviewEligibility(graded, 'owner', {})).toEqual({ mode: 'popup', reason: 'eligible' });
    expect(reviewEligibility({ ...graded, graded_at: '2026-01-01T00:00:00Z' }, 'owner', { confirmSince: '' })).toMatchObject({ mode: 'popup' });
    // First time only: once it has been closed or deferred, the banner takes over.
    expect(reviewEligibility({ ...graded, identity_review_dismissed_at: '2026-09-17T00:00:00Z' }, 'owner', {})).toMatchObject({ mode: 'banner' });
  });

  it('gives older collections the banner instead of a popup', () => {
    expect(reviewEligibility({ ...graded, graded_at: '2026-08-01T00:00:00Z' }, 'owner', since))
      .toEqual({ mode: 'banner', reason: 'graded_before_rollout' });
  });

  it('falls back to the created date when the grade has no timestamp', () => {
    expect(reviewEligibility({ ...graded, graded_at: null, created_at: '2026-09-16T10:00:00Z' }, 'owner', since))
      .toMatchObject({ mode: 'popup' });
    expect(reviewEligibility({ ...graded, graded_at: null, created_at: null }, 'owner', since))
      .toEqual({ mode: 'banner', reason: 'no_grade_date' });
  });

  it('shows a dismissed card the banner and never the popup again', () => {
    expect(reviewEligibility({ ...graded, identity_review_dismissed_at: '2026-09-16T11:00:00Z' }, 'owner', since))
      .toEqual({ mode: 'banner', reason: 'dismissed' });
  });

  it('stops asking once the owner confirmed the current revision', () => {
    expect(reviewEligibility({ ...graded, identity_revision: 2, identity_confirmed_revision: 2 }, 'owner', since))
      .toEqual({ mode: 'none', reason: 'already_confirmed' });
  });

  it('asks again after the identity moved past the confirmed revision', () => {
    expect(reviewEligibility({ ...graded, identity_revision: 3, identity_confirmed_revision: 2 }, 'owner', since))
      .toEqual({ mode: 'popup', reason: 'eligible' });
  });

  it('treats a dismissal as not a confirmation even at the current revision', () => {
    const dismissed = { ...graded, identity_review_dismissed_at: '2026-09-16T11:00:00Z', identity_confirmed_revision: null };
    expect(reviewEligibility(dismissed, 'owner', since).mode).toBe('banner');
  });

  it('shows nothing to a viewer who is not the owner', () => {
    expect(reviewEligibility(graded, 'someone-else', since)).toEqual({ mode: 'none', reason: 'not_owner' });
    expect(reviewEligibility(graded, null, since)).toEqual({ mode: 'none', reason: 'not_owner' });
  });

  it('shows nothing for a sold, deleted, failed, processing or ungraded card', () => {
    expect(reviewEligibility({ ...graded, ownership_status: 'sold' }, 'owner', since)).toEqual({ mode: 'none', reason: 'sold_locked' });
    expect(reviewEligibility({ ...graded, deleted_at: '2026-09-16' }, 'owner', since)).toEqual({ mode: 'none', reason: 'deleted' });
    expect(reviewEligibility({ ...graded, grade_status: 'failed' }, 'owner', since)).toEqual({ mode: 'none', reason: 'grade_failed' });
    expect(reviewEligibility({ ...graded, grade_status: 'processing:2026-09-16' }, 'owner', since)).toEqual({ mode: 'none', reason: 'grade_processing' });
    expect(reviewEligibility({ ...graded, conversational_whole_grade: 0 }, 'owner', since)).toEqual({ mode: 'none', reason: 'not_graded' });
  });

  it('still reviews a legacy card whose grade_status was never written', () => {
    expect(reviewEligibility({ ...graded, grade_status: null }, 'owner', since)).toMatchObject({ mode: 'popup' });
  });
});

describe('catalog candidate pre-selection', () => {
  const family: ReviewCandidate[] = markBaseCandidate([
    { id: '1', name: '2023 Panini Prizm #12 Victor Wembanyama', setName: 'Panini Prizm Basketball', hasPrice: true },
    { id: '2', name: '2023 Panini Prizm Silver #12 Victor Wembanyama', setName: 'Panini Prizm Basketball', hasPrice: true },
    { id: '3', name: '2023 Panini Prizm Green Ice #12 Victor Wembanyama', setName: 'Panini Prizm Basketball', hasPrice: false },
    { id: '4', name: '2023 Panini Prizm Gold /10 #12 Victor Wembanyama', setName: 'Panini Prizm Basketball', hasPrice: true },
  ]);

  it('picks the candidate whose name overlaps the parallel', () => {
    expect(pickBestCandidate(family, { parallel: 'Green Ice' })).toBe('3');
    expect(pickBestCandidate(family, { parallel: 'Silver Prizm' })).toBe('2');
  });

  it('uses the serial denominator as strong evidence', () => {
    expect(pickBestCandidate(family, { parallel: '', serial: '7/10' })).toBe('4');
  });

  it('pre-selects the plainest product when there is nothing to match on', () => {
    expect(pickBestCandidate(family, {})).toBe('1');
  });

  it('marks no base when two products are equally plain', () => {
    const ambiguous = markBaseCandidate([
      { id: 'a', name: 'Prizm Silver Wembanyama', setName: 's', hasPrice: true },
      { id: 'b', name: 'Prizm Gold Wembanyama', setName: 's', hasPrice: true },
    ]);
    expect(ambiguous.every(c => !c.isBase)).toBe(true);
    expect(pickBestCandidate(ambiguous, {})).toBe(NO_CANDIDATE);
  });

  it('gives up rather than guess when the parallel matches nothing', () => {
    expect(pickBestCandidate(family, { parallel: 'Wonder Bread Refractor' })).toBe(NO_CANDIDATE);
    expect(pickBestCandidate([], { parallel: 'Silver' })).toBe(NO_CANDIDATE);
  });

  it('prefers a priced product on a tie', () => {
    const tie: ReviewCandidate[] = [
      { id: 'x', name: 'Prizm Gold', setName: 's', hasPrice: false },
      { id: 'y', name: 'Prizm Gold', setName: 's', hasPrice: true },
    ];
    expect(pickBestCandidate(tie, { parallel: 'Gold' })).toBe('y');
  });
});
