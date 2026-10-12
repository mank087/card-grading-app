/**
 * EditCardDetailsModal's prefill and save payload.
 *
 * Production, Oct 2026: card 489119's fourth save changed only the serial
 * numbering but also wrote back featured "Lenny Grant" and set "Garbage Pail
 * Kids" — the grader's original read — because the form prefilled from the
 * card-info blob and sent every field.
 */
import { describe, expect, it } from 'vitest';
import {
  buildEditFormData,
  changedEditPayload,
  isIdentityConflict,
} from './editCardDetailsForm';

const graderRead = {
  card_name: 'Lenny Grant',
  player_or_character: 'Lenny Grant',
  set_name: 'Garbage Pail Kids',
  year: '1986',
  card_number_raw: '12a',
  serial_number: '',
  manufacturer: 'Topps',
};

const corrected = {
  id: 'c1',
  category: 'Other',
  identity_revision: 4,
  card_name: 'Adam Bomb',
  featured: 'Adam Bomb',
  card_set: 'Garbage Pail Kids Series 1',
  release_date: '1985',
  card_number: '8a',
  manufacturer_name: 'Topps',
  conversational_card_info: graderRead,
};

describe('buildEditFormData', () => {
  it('prefills identity fields from the columns, not the card-info blob', () => {
    const form = buildEditFormData(corrected);
    expect(form.card_name).toBe('Adam Bomb');
    expect(form.featured).toBe('Adam Bomb');
    expect(form.card_set).toBe('Garbage Pail Kids Series 1');
    expect(form.release_date).toBe('1985');
    expect(form.card_number_num).toBe('8a');
  });

  it('falls back to the blob only when the column is empty', () => {
    const form = buildEditFormData({ ...corrected, featured: '', card_set: null, release_date: undefined });
    expect(form.featured).toBe('Lenny Grant');
    expect(form.card_set).toBe('Garbage Pail Kids');
    expect(form.release_date).toBe('1986');
  });

  it('uses the blob year when the column holds something the year box cannot save', () => {
    expect(buildEditFormData({ ...corrected, release_date: '1985-01-01' }).release_date).toBe('1986');
  });

  it('keeps a stored serial numbering over the blob', () => {
    const form = buildEditFormData({ ...corrected, serial_numbering: '23/99', conversational_card_info: { ...graderRead, serial_number: '28/99' } });
    expect(form.serial_numbering).toBe('23/99');
  });
});

describe('changedEditPayload', () => {
  it('sends only the changed field plus the revision the form opened at', () => {
    const opened = buildEditFormData(corrected);
    const edited = { ...opened, serial_numbering: '7/25' };
    expect(changedEditPayload(edited, opened, 'Other', 4)).toEqual({
      serial_numbering: '7/25',
      expected_identity_revision: 4,
    });
  });

  it('returns null when nothing changed', () => {
    const opened = buildEditFormData(corrected);
    expect(changedEditPayload({ ...opened }, opened, 'Other', 4)).toBeNull();
  });

  it('ignores whitespace-only differences but keeps case corrections', () => {
    const opened = buildEditFormData(corrected);
    expect(changedEditPayload({ ...opened, card_name: ' Adam Bomb ' }, opened, 'Other', 4)).toBeNull();
    expect(changedEditPayload({ ...opened, card_name: 'adam bomb' }, opened, 'Other', 4))
      .toEqual({ card_name: 'adam bomb', expected_identity_revision: 4 });
  });

  it('sends a cleared field as an empty string', () => {
    const opened = buildEditFormData(corrected);
    expect(changedEditPayload({ ...opened, card_set: '' }, opened, 'Other', null)).toEqual({ card_set: '' });
  });

  it('composes the card number from both boxes and sends it only when either changed', () => {
    const pokemon = { id: 'p1', category: 'Pokemon', card_number: '018/091', identity_revision: 2 };
    const opened = buildEditFormData(pokemon);
    expect(changedEditPayload({ ...opened, holofoil: 'Yes' }, opened, 'Pokemon', 2))
      .toEqual({ holofoil: 'Yes', expected_identity_revision: 2 });
    expect(changedEditPayload({ ...opened, card_number_total: '092' }, opened, 'Pokemon', 2))
      .toEqual({ card_number: '018/092', expected_identity_revision: 2 });
  });

  it('sends a toggled checkbox', () => {
    const opened = buildEditFormData({ id: 's1', category: 'Baseball' });
    expect(changedEditPayload({ ...opened, is_refractor: true }, opened, 'Baseball', undefined))
      .toEqual({ is_refractor: true });
  });

  it('omits the revision when the card has none', () => {
    const opened = buildEditFormData(corrected);
    expect(changedEditPayload({ ...opened, card_name: 'X' }, opened, 'Other', undefined)).toEqual({ card_name: 'X' });
  });

  it('never sends a field this category does not edit', () => {
    const opened = buildEditFormData(corrected);
    expect(changedEditPayload({ ...opened, team: 'x' }, opened, 'Other', 4)).toBeNull();
  });
});

describe('isIdentityConflict', () => {
  it('recognises the details route conflict', () => {
    expect(isIdentityConflict(409, { code: 'identity_revision_conflict' })).toBe(true);
    expect(isIdentityConflict(400, { error: 'bad' })).toBe(false);
  });
});
