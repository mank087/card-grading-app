import { describe, it, expect } from 'vitest';
import { reconcileIdentity, namesAgree, numbersAgree, normalizeName, normalizeNumber, looksLikeCaption, hasNameConflict } from './reconcile';
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
      // The grading call's own transcription has the printed name in it.
      card_front_text: 'AL PILARCIK  ORIOLES  OUTFIELD',
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
    expect(check.name_decision).toEqual({ action: 'override', reason: 'grader_transcription', grading_name: 'Cal Ripken Jr.', first_look_subject: null });
  });

  it('does not overwrite a distinct player_or_character', () => {
    const out = reconcileIdentity(
      { card_name: 'Cal Ripken Jr. — Iron Man', player_or_character: 'Some Other Guy', card_number: '7' },
      ident({ printed_name_seen: 'AL PILARCIK', card_name: 'Al Pilarcik', player_or_character: 'Al Pilarcik' }),
      'sports',
      { firstLookSubject: 'Al Pilarcik' }
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

describe('name override gate (Oct 2026 production misses)', () => {
  it('Luis Castillo read as "MIKE WILSON": no first look, not in the transcription -> grading name kept, low confidence', () => {
    const out = reconcileIdentity(
      { card_name: 'Luis Castillo', player_or_character: 'Luis Castillo', card_number: '69', identification_confidence: 'high', card_front_text: 'TOPPS CHROME  MARINERS' },
      ident({ printed_name_seen: 'MIKE WILSON', card_name: 'Mike Wilson', player_or_character: 'Mike Wilson', card_number: '69', card_number_text_seen: '69' }),
      'Sports'
    );
    expect(out.cardInfo.card_name).toBe('Luis Castillo');
    expect(out.cardInfo.player_or_character).toBe('Luis Castillo');
    expect(out.cardInfo.identification_name_source).toBeUndefined();
    expect(out.cardInfo.printed_name_seen).toBeUndefined();
    expect(out.conflicts).toEqual(['name']);
    expect(out.confidence).toBe('low');
    expect(out.changed).toBe(false);
    expect((out.cardInfo.identification_check as any).name_decision).toEqual({
      action: 'kept_grading', reason: 'uncorroborated', grading_name: 'Luis Castillo', first_look_subject: null,
    });
  });

  it('David Justice read as "RICK DEMPSEY" while the first look says Justice -> kept', () => {
    const out = reconcileIdentity(
      { card_name: 'David Justice', player_or_character: 'David Justice' },
      ident({ printed_name_seen: 'RICK DEMPSEY', card_name: 'Rick Dempsey Autograph Card', player_or_character: 'Rick Dempsey' }),
      'Sports',
      { firstLookSubject: 'David Justice' }
    );
    expect(out.cardInfo.card_name).toBe('David Justice');
    expect((out.cardInfo.identification_check as any).name_decision.reason).toBe('first_look_disagrees');
    expect(out.confidence).toBe('low');
  });

  it('Spewpa read as "Mimikyu" with the first look saying Spewpa -> kept', () => {
    const out = reconcileIdentity(
      { card_name: 'Spewpa', player_or_character: 'Spewpa', card_number: '089/088' },
      ident({ printed_name_seen: 'Mimikyu', card_name: 'Mimikyu', player_or_character: 'Mimikyu' }),
      'Pokemon',
      { firstLookSubject: 'Spewpa' }
    );
    expect(out.cardInfo.card_name).toBe('Spewpa');
    expect(out.confidence).toBe('low');
  });

  it('a caption is never taken as the name, even when the first look echoes it', () => {
    for (const printed of ['BO BREAKER', 'MAGIC ON JORDAN', '1963 ROOKIE STARS', 'ALL-STAR CHECKLIST', 'Mickey Bio', 'BIRDMAN', "MICHAEL'S MAGIC"]) {
      const out = reconcileIdentity(
        { card_name: 'Bo Jackson', player_or_character: 'Bo Jackson' },
        ident({ printed_name_seen: printed, card_name: printed, player_or_character: printed }),
        'Sports',
        { firstLookSubject: printed }
      );
      expect(out.cardInfo.card_name).toBe('Bo Jackson');
      expect((out.cardInfo.identification_check as any).name_decision.reason).toBe('caption');
    }
  });

  it('the first look agreeing with the independent read lets the override through', () => {
    const out = reconcileIdentity(
      { card_name: 'Cal Ripken Jr.', player_or_character: 'Cal Ripken Jr.' },
      ident({ printed_name_seen: 'AL PILARCIK', card_name: 'Al Pilarcik', player_or_character: 'Al Pilarcik' }),
      'Sports',
      { firstLookSubject: 'Al Pilarcik' }
    );
    expect(out.cardInfo.card_name).toBe('Al Pilarcik');
    expect(out.cardInfo.identification_name_source).toBe('independent_read');
    expect((out.cardInfo.identification_check as any).name_decision.reason).toBe('first_look_agrees');
  });

  it('the transcription rule needs the grading name to be ABSENT from its own text', () => {
    const out = reconcileIdentity(
      { card_name: 'Luis Castillo', player_or_character: 'Luis Castillo', card_back_text: 'Castillo struck out 10 in a win over Mike Wilson and Oakland.' },
      ident({ printed_name_seen: 'MIKE WILSON', card_name: 'Mike Wilson', player_or_character: 'Mike Wilson' }),
      'Sports'
    );
    expect(out.cardInfo.card_name).toBe('Luis Castillo');
  });

  it('the first look backs the read through name order, spelling drift and position tags', () => {
    const cases: Array<[string, string]> = [
      ['Howe, Gordon', 'Gordon Howe'],
      ['JEREMIAH LOVE', 'Jeremiyah Love'],
      ['BILL DENEHY · P / TOM SEAVER · P', 'Bill Denehy / Tom Seaver'],
      ['M. MALONE / D. WILKINS / M. JORDAN', 'Michael Jordan, Dominique Wilkins, Karl Malone'],
    ];
    for (const [printed, fl] of cases) {
      const out = reconcileIdentity(
        { card_name: 'Someone Else', player_or_character: 'Someone Else' },
        ident({ printed_name_seen: printed, card_name: printed, player_or_character: printed }),
        'Sports',
        { firstLookSubject: fl }
      );
      expect((out.cardInfo.identification_check as any).name_decision.reason, printed).toBe('first_look_agrees');
    }
  });

  it('a shared word is not agreement on a TCG card', () => {
    const out = reconcileIdentity(
      { card_name: 'Red-Eyes Black Dragon', player_or_character: 'Red-Eyes Black Dragon' },
      ident({ printed_name_seen: 'Red-Eyes Darkness Metal Dragon', card_name: 'Red-Eyes Darkness Metal Dragon' }),
      'Yu-Gi-Oh',
      { firstLookSubject: 'Red-Eyes B. Dragon' }
    );
    expect(out.cardInfo.card_name).toBe('Red-Eyes Black Dragon');
  });

  it('looksLikeCaption leaves real names alone', () => {
    expect(looksLikeCaption('KEN GRIFFEY, JR.', 'Sports')).toBe(false);
    expect(looksLikeCaption('JORDAN / BLAYLOCK / STOCKTON', 'Sports')).toBe(false);
    expect(looksLikeCaption('THOR', 'Other')).toBe(false);
    expect(looksLikeCaption("Team Rocket's Mewtwo ex", 'Pokemon')).toBe(false);
    expect(looksLikeCaption('Red-Eyes Darkness Metal Dragon', 'Yu-Gi-Oh')).toBe(false);
  });

  it('hasNameConflict only fires on a quoted disagreement', () => {
    expect(hasNameConflict({ card_name: 'Mickey Mantle' }, ident({ printed_name_seen: 'MANTLE' }))).toBe(false);
    expect(hasNameConflict({ card_name: 'Mickey Mantle' }, ident({ printed_name_seen: null, card_name: 'Roger Maris' }))).toBe(false);
    expect(hasNameConflict({ card_name: 'Mickey Mantle' }, ident({ printed_name_seen: 'ROGER MARIS' }))).toBe(true);
  });
});
