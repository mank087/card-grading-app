/**
 * The confirmation flow's client helpers, shared with the mobile app.
 *
 * The drift check compares FILE TEXT: importing from dcm-mobile would make Vite
 * load its Expo tsconfig, which CI does not install.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import type { FieldSource } from '../identification/firstLook';
import {
  changedFieldPayload,
  identityConfirmationPending,
  mergeReviewFields,
  mergeReviewValues,
  NO_CANDIDATE,
  parallelFromListingName,
  reviewOwnerEdited,
  versionPickNeedsSaving,
  type ReviewField,
  type ReviewFieldSource,
} from './reviewClient';
import * as prefill from './reviewPrefill';

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const field = (key: string, value: string, storedValue = value): ReviewField => ({
  key,
  label: key,
  value,
  storedValue,
  origin: value ? 'from_grading' : 'empty',
  needsCheck: false,
  differsFromStored: value !== storedValue,
});

describe('reviewClient shared with the mobile app', () => {
  it('is identical in both copies', () => {
    expect(read('dcm-mobile/lib/reviewClient.ts')).toBe(read('src/lib/identity/reviewClient.ts'));
  });

  it('is still reachable through reviewPrefill, so no existing import broke', () => {
    expect(prefill.NO_CANDIDATE).toBe(NO_CANDIDATE);
    expect(prefill.changedFieldPayload).toBe(changedFieldPayload);
  });

  it('keeps its source union the same as first look\'s', () => {
    const a: ReviewFieldSource = 'printed' as FieldSource;
    const b: FieldSource = 'inferred' as ReviewFieldSource;
    expect([a, b]).toEqual(['printed', 'inferred']);
  });
});

describe('changedFieldPayload', () => {
  it('sends only what differs from the stored value, trimmed and case-folded', () => {
    const fields = [field('card_set', 'Lost Origin'), field('card_number', '066/196', '086'), field('release_date', '')];
    expect(changedFieldPayload(fields, { card_set: ' lost origin ', card_number: '066/196', release_date: '' }))
      .toEqual({ card_number: '066/196' });
  });

  it('treats punctuation as a real change', () => {
    expect(changedFieldPayload([field('card_number', '116086')], { card_number: '116/086' })).toEqual({ card_number: '116/086' });
  });
});

describe('parallelFromListingName', () => {
  it('reads the bracket, and a plain listing is the base card', () => {
    expect(parallelFromListingName('Joe Mixon [Autograph Jersey Mirror Red] #214')).toBe('Autograph Jersey Mirror Red');
    expect(parallelFromListingName('Joe Mixon #214')).toBe('Base');
    expect(parallelFromListingName('')).toBe('Base');
  });
});

describe('merging a later answer', () => {
  it('never overwrites a box the owner typed in', () => {
    const incoming = [field('card_set', 'Evolving Skies'), field('release_date', '2021')];
    const merged = mergeReviewValues({ card_set: 'My typed set', release_date: '' }, incoming, { card_set: true });
    expect(merged).toEqual({ card_set: 'My typed set', release_date: '2021' });
  });

  it('adopts the incoming field list and its metadata', () => {
    const previous = [field('card_set', 'A')];
    const incoming = [{ ...field('card_set', 'B'), needsCheck: true }, field('release_date', '2021')];
    const merged = mergeReviewFields(previous, incoming);
    expect(merged.map(f => [f.key, f.value, f.needsCheck])).toEqual([['card_set', 'B', true], ['release_date', '2021', false]]);
  });
});

describe('buttons and the version pick', () => {
  it('reads "Update details" only after the owner moved something', () => {
    const fields = [field('card_set', 'A')];
    expect(reviewOwnerEdited(fields, { card_set: 'A' }, NO_CANDIDATE, NO_CANDIDATE)).toBe(false);
    expect(reviewOwnerEdited(fields, { card_set: 'B' }, NO_CANDIDATE, NO_CANDIDATE)).toBe(true);
    expect(reviewOwnerEdited(fields, { card_set: 'A' }, '12', NO_CANDIDATE)).toBe(true);
  });

  it('skips an unchanged pick unless the save cleared it', () => {
    expect(versionPickNeedsSaving({ isSports: true, candidateId: '12', currentProductId: '12' })).toBe(false);
    expect(versionPickNeedsSaving({ isSports: true, candidateId: '12', currentProductId: '12', pricingInvalidated: true })).toBe(true);
    expect(versionPickNeedsSaving({ isSports: true, candidateId: '13', currentProductId: '12' })).toBe(true);
    expect(versionPickNeedsSaving({ isSports: true, candidateId: NO_CANDIDATE })).toBe(false);
    expect(versionPickNeedsSaving({ isSports: false, candidateId: '13' })).toBe(false);
  });
});

describe('identityConfirmationPending', () => {
  it('matches the collection rule', () => {
    expect(identityConfirmationPending({ conversational_whole_grade: 9, identity_confirmed_revision: null, identity_revision: 0 })).toBe(true);
    expect(identityConfirmationPending({ conversational_whole_grade: 9, identity_confirmed_revision: 1, identity_revision: 2 })).toBe(true);
    expect(identityConfirmationPending({ conversational_whole_grade: 9, identity_confirmed_revision: 2, identity_revision: 2 })).toBe(false);
    expect(identityConfirmationPending({ conversational_whole_grade: null, identity_confirmed_revision: null })).toBe(false);
    expect(identityConfirmationPending({ ownership_status: 'sold', conversational_whole_grade: 9 })).toBe(false);
  });
});
