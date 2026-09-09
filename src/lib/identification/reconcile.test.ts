import { describe, it, expect } from 'vitest';
import { reconcileIdentity, namesAgree, numbersAgree, normalizeName, normalizeNumber } from './reconcile';
import type { IdentificationResult } from './identifyCard';

function ident(over: Partial<IdentificationResult> = {}): IdentificationResult {
  return {
    printed_name_seen: null,
    player_or_character: null,
    card_name: null,
    set_name: null,
    card_number: null,
    card_number_text_seen: null,
    year_hint: null,
    language: 'en',
    variant: null,
    confidence: 'high',
    model: 'gpt-5.6-luna',
    tokens: { in: 300, out: 90 },
    ms: 1200,
    ...over,
  };
}

describe('name normalization / agreement', () => {
  it('normalizes diacritics, case and punctuation', () => {
    expect(normalizeName('José  Ramírez!')).toBe('jose ramirez');
  });

  it('treats generational suffixes as noise', () => {
    expect(namesAgree('Ken Griffey Jr.', 'Ken Griffey')).toBe(true);
    expect(namesAgree('Cal Ripken Jr', 'Cal Ripken, Jr.')).toBe(true);
  });

  it('accepts containment and initials', () => {
    expect(namesAgree('Mickey Mantle', 'Mantle')).toBe(true);
    expect(namesAgree('M. Mantle', 'Mickey Mantle')).toBe(true);
  });

  it('rejects genuinely different people', () => {
    expect(namesAgree('Cal Ripken Jr.', 'Al Pilarcik')).toBe(false);
    expect(namesAgree('Ken Griffey', 'Ken Caminiti')).toBe(false);
  });
});

describe('number agreement', () => {
  it('ignores separators and case', () => {
    expect(normalizeNumber('RC-25')).toBe('RC25');
    expect(numbersAgree('RC-25', 'rc 25')).toBe(true);
    expect(numbersAgree('#350', '350')).toBe(true);
  });

  it('matches numerators of N OF M', () => {
    expect(numbersAgree('8', '8 OF 12')).toBe(true);
    expect(numbersAgree('8/12', '8 of 12')).toBe(true);
  });

  it('flags "1" vs "101"', () => {
    expect(numbersAgree('1', '101')).toBe(false);
  });
});

describe('reconcileIdentity', () => {
  it('Ripken vs printed "al pilarcik": the printed name wins and confidence drops', () => {
    const grading = {
      card_name: 'Cal Ripken Jr.',
      player_or_character: 'Cal Ripken Jr.',
      card_number: '7',
      year: '1959',
      identification_confidence: 'high',
    };
    const out = reconcileIdentity(
      grading,
      ident({
        printed_name_seen: 'AL PILARCIK',
        player_or_character: 'Al Pilarcik',
        card_name: 'Al Pilarcik',
        card_number: '7',
        card_number_text_seen: '7',
        year_hint: '1958',
      }),
      'sports'
    );

    expect(out.conflicts).toEqual(['name']);
    expect(out.confidence).toBe('low');
    expect(out.changed).toBe(true);
    expect(out.cardInfo.card_name).toBe('Al Pilarcik');
    expect(out.cardInfo.player_or_character).toBe('Al Pilarcik');
    expect(out.cardInfo.identification_confidence).toBe('low');
    // the year is never touched, and the unreliable hint stays in the audit blob
    expect(out.cardInfo.year).toBe('1959');
    const check: any = out.cardInfo.identification_check;
    expect(check.independent.year_hint).toBe('1958');
    expect(check.independent.tokens).toBeUndefined();
    expect(check.agreement).toEqual({ name: false, number: true });
    expect(check.applied).toContain('card_name');
  });

  it('does not overwrite a distinct player_or_character', () => {
    const out = reconcileIdentity(
      { card_name: 'Cal Ripken Jr. — Iron Man', player_or_character: 'Some Other Guy', card_number: '7' },
      ident({ printed_name_seen: 'AL PILARCIK', card_name: 'Al Pilarcik', player_or_character: 'Al Pilarcik' })
    );
    expect(out.cardInfo.card_name).toBe('Al Pilarcik');
    expect(out.cardInfo.player_or_character).toBe('Some Other Guy');
  });

  it('leaves the name alone when the independent pass cannot quote the print', () => {
    const out = reconcileIdentity(
      { card_name: 'Cal Ripken Jr.', player_or_character: 'Cal Ripken Jr.' },
      ident({ printed_name_seen: null, card_name: 'Al Pilarcik', player_or_character: 'Al Pilarcik' })
    );
    expect(out.cardInfo.card_name).toBe('Cal Ripken Jr.');
    expect(out.changed).toBe(false);
    expect(out.conflicts).toEqual([]);
  });

  it('Mantle 350 agreeing with Mantle 350: high confidence, nothing changed', () => {
    const grading = {
      card_name: 'Mickey Mantle',
      player_or_character: 'Mickey Mantle',
      card_number: '350',
      set_name: 'Topps',
      year: '1960',
    };
    const out = reconcileIdentity(
      grading,
      ident({
        printed_name_seen: 'MICKEY MANTLE',
        player_or_character: 'Mickey Mantle',
        card_name: 'Mickey Mantle',
        card_number: '350',
        card_number_text_seen: '350',
        set_name: 'Topps',
        year_hint: '1958',
      })
    );

    expect(out.conflicts).toEqual([]);
    expect(out.changed).toBe(false);
    expect(out.confidence).toBe('high');
    expect(out.cardInfo.card_name).toBe('Mickey Mantle');
    expect(out.cardInfo.card_number).toBe('350');
    expect(out.cardInfo.year).toBe('1960');
    expect((out.cardInfo.identification_check as any).agreement).toEqual({ name: true, number: true });
  });

  it('a null independent pass leaves the identity untouched and caps confidence at medium', () => {
    const grading = { card_name: 'Mickey Mantle', card_number: '350', identification_confidence: 'high' };
    const out = reconcileIdentity(grading, null);
    expect(out.changed).toBe(false);
    expect(out.conflicts).toEqual([]);
    expect(out.confidence).toBe('medium');
    expect(out.cardInfo.card_name).toBe('Mickey Mantle');
    expect(out.cardInfo.card_number).toBe('350');
    expect((out.cardInfo.identification_check as any).independent).toBeNull();
  });

  it('a low-confidence independent pass is recorded but never applied', () => {
    const out = reconcileIdentity(
      { card_name: 'Mickey Mantle', card_number: '350' },
      ident({ confidence: 'low', printed_name_seen: 'M?CK?Y', card_name: 'Unknown' })
    );
    expect(out.cardInfo.card_name).toBe('Mickey Mantle');
    expect(out.confidence).toBe('medium');
    expect((out.cardInfo.identification_check as any).independent.confidence).toBe('low');
  });

  it('a number conflict flags the card but never overwrites the grading number', () => {
    const out = reconcileIdentity(
      { card_name: 'Ken Griffey Jr.', card_number: '101', identification_confidence: 'high' },
      ident({
        printed_name_seen: 'KEN GRIFFEY',
        card_name: 'Ken Griffey Jr.',
        player_or_character: 'Ken Griffey Jr.',
        card_number: '1',
        card_number_text_seen: '1 OF 12',
      })
    );
    expect(out.conflicts).toEqual(['number']);
    // The grading read keeps the number (full-resolution + DB matchers downstream);
    // the independent value is recorded for the audit trail and the owner prompt.
    expect(out.cardInfo.card_number).toBe('101');
    expect(out.cardInfo.card_number_independent_read).toBe('1');
    expect(out.cardInfo.card_number_source).toBeUndefined();
    expect(out.confidence).toBe('low');
  });

  it('does not mutate the object it was given', () => {
    const grading: Record<string, unknown> = { card_name: 'Cal Ripken Jr.' };
    reconcileIdentity(grading, ident({ printed_name_seen: 'AL PILARCIK', card_name: 'Al Pilarcik' }));
    expect(grading.card_name).toBe('Cal Ripken Jr.');
    expect(grading.identification_check).toBeUndefined();
  });
});
