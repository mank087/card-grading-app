import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillBlankNumberFromFirstLook, numberFillEnabled, printedNumberFromFirstLook, stripNumberLabel } from './firstLookNumberFill';
import type { FirstLook } from './firstLook';
import { applyCardNumberGuard } from '../cardNumberGuard';

/** Just the parts of a first look the fill reads. */
function look(over: { printed?: string | null; source?: string; stamp?: string | null; sameItem?: string } = {}): FirstLook {
  return {
    photos: { same_item_both_photos: over.sameItem ?? 'yes' },
    printed_text: { card_number_as_printed: over.printed === undefined ? '328' : over.printed, serial_stamp: over.stamp ?? null },
    identity: { card_number: { value: over.printed ?? '328', source: over.source ?? 'printed' } },
  } as unknown as FirstLook;
}

describe('which first-look number may be used', () => {
  it('uses a number read off the card', () => {
    expect(printedNumberFromFirstLook(look({ printed: '099/084' }))).toBe('099/084');
    expect(printedNumberFromFirstLook(look({ printed: 'ODC-TBR' }))).toBe('ODC-TBR');
  });

  it('never uses a number first look recognized or inferred rather than read', () => {
    for (const source of ['recognized', 'inferred', 'unknown']) {
      expect(printedNumberFromFirstLook(look({ source }))).toBeNull();
    }
  });

  it('refuses when front and back are different items', () => {
    expect(printedNumberFromFirstLook(look({ sameItem: 'no_different_items' }))).toBeNull();
  });

  it('refuses a serial stamp posing as the card number', () => {
    expect(printedNumberFromFirstLook(look({ printed: '23/99', stamp: '23 / 99' }))).toBeNull();
    // A real number beside an unrelated stamp is fine.
    expect(printedNumberFromFirstLook(look({ printed: '126', stamp: '304/499' }))).toBe('126');
  });

  it('treats blanks and placeholders as nothing', () => {
    for (const printed of [null, '', '  ', 'unknown', 'N/A', 'none']) {
      expect(printedNumberFromFirstLook(look({ printed }))).toBeNull();
    }
    expect(printedNumberFromFirstLook(null)).toBeNull();
  });

  it('drops a printed label but keeps real prefixes', () => {
    expect(stripNumberLabel('No. 126')).toBe('126');
    expect(stripNumberLabel('#7')).toBe('7');
    for (const code of ['OP05-119', 'LOB-EN005', 'NO-EN001', 'HR 14', 'ML-1', '066/196']) expect(stripNumberLabel(code)).toBe(code);
  });
});

describe('filling a blank number at grading time', () => {
  it('fills every key the routes read, and says where it came from', () => {
    const info: Record<string, any> = { card_name: 'Bobby Orr', card_number: null };
    expect(fillBlankNumberFromFirstLook(info, look({ printed: '336' }))).toEqual({ filled: true, value: '336' });
    expect(info).toMatchObject({ card_number: '336', card_number_raw: '336', card_number_source: 'first_look', card_name: 'Bobby Orr' });
  });

  it('never replaces a number the grading call produced, under any key', () => {
    for (const key of ['card_number', 'card_number_raw', 'collector_number', 'card_id']) {
      const info: Record<string, any> = { [key]: '44' };
      expect(fillBlankNumberFromFirstLook(info, look({ printed: '75' })).filled).toBe(false);
      expect(info).toEqual({ [key]: '44' });
    }
  });

  it('counts the grader\'s placeholders as blank', () => {
    for (const placeholder of ['unknown', 'N/A', 'Not visible', '']) {
      const info: Record<string, any> = { card_number: placeholder };
      expect(fillBlankNumberFromFirstLook(info, look({ printed: '160' })).filled).toBe(true);
      expect(info.card_number).toBe('160');
    }
  });

  it('leaves the card alone when first look has nothing usable', () => {
    const info: Record<string, any> = { card_number: null };
    expect(fillBlankNumberFromFirstLook(info, look({ source: 'recognized' })).filled).toBe(false);
    expect(fillBlankNumberFromFirstLook(info, null).filled).toBe(false);
    expect(fillBlankNumberFromFirstLook(null, look()).filled).toBe(false);
    expect(info).toEqual({ card_number: null });
  });
});

describe('surviving the card number guard the routes run afterwards', () => {
  // The sports, other, Star Wars and Yu-Gi-Oh routes call applyCardNumberGuard on the
  // grader's card_info. The first version of the fill set a source the guard did not
  // know and no transcription, so the guard silently dropped every filled number.
  it.each(['Sports', 'Other', 'Star Wars', 'Yu-Gi-Oh'])('keeps a filled number on a %s card', category => {
    const info: Record<string, any> = { card_name: 'Bobby Orr', card_number: null };
    fillBlankNumberFromFirstLook(info, look({ printed: 'No. 336' }));
    expect(info).toMatchObject({ card_number: '336', card_number_text_seen: 'No. 336', card_number_source: 'first_look' });
    const guard = applyCardNumberGuard(info, 'test', { category });
    expect(guard.outcome).toBe('kept');
    expect(info.card_number).toBe('336');
  });

  it('still lets the guard refuse print-run numbering on a sports card', () => {
    const info: Record<string, any> = { card_number: null };
    fillBlankNumberFromFirstLook(info, look({ printed: '047/249' }));
    expect(applyCardNumberGuard(info, 'test', { category: 'Sports' }).outcome).toBe('dropped_serial');
    expect(info.card_number).toBeNull();
  });

  it('keeps a TCG fraction, where the same shape is the printed set number', () => {
    const info: Record<string, any> = { card_number: null };
    fillBlankNumberFromFirstLook(info, look({ printed: '099/084' }));
    expect(applyCardNumberGuard(info, 'test', { category: 'Pokemon' }).outcome).toBe('kept');
  });
});

describe('the switch', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('is on by default and can be turned off without a deploy', () => {
    vi.stubEnv('FIRST_LOOK_NUMBER_FILL', '');
    expect(numberFillEnabled()).toBe(true);
    vi.stubEnv('FIRST_LOOK_NUMBER_FILL', '0');
    expect(numberFillEnabled()).toBe(false);
  });
});
