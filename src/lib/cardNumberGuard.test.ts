/**
 * The guard exists to drop confidently-wrong card numbers before they reach a
 * slab label. These cases are drawn from the real failure that motivated it
 * (card cc855000-…, a "Scoring Kings" insert printed "8 OF 12" stored as 101)
 * plus the formats that must keep working.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkCardNumberEvidence, applyCardNumberGuard } from './cardNumberGuard';

const info = (over: Record<string, any> = {}) => ({
  card_number: '8',
  card_number_text_seen: '8 OF 12',
  card_number_source: 'insert_numbering',
  ...over,
});

describe('cardNumberGuard', () => {
  let warn: any;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); delete process.env.CARD_NUMBER_EVIDENCE_REQUIRED; });

  describe('the real failure', () => {
    it('drops 101 when the card reads "8 OF 12"', () => {
      const r = checkCardNumberEvidence(info({ card_number: '101' }));
      expect(r.outcome).toBe('dropped_mismatch');
      expect(r.cardNumber).toBeNull();
    });

    it.each(['11', '180', '13', '10', 'NNO', 'SK11'])(
      'drops %s — every other number this card produced across 18 runs',
      (bogus) => {
        expect(checkCardNumberEvidence(info({ card_number: bogus })).cardNumber).toBeNull();
      }
    );

    it('keeps 8, the number actually printed', () => {
      const r = checkCardNumberEvidence(info());
      expect(r.outcome).toBe('kept');
      expect(r.cardNumber).toBe('8');
    });
  });

  describe('formats that must keep working', () => {
    it.each([
      ['150', '150', 'back_number'],
      ['RC-25', '#RC-25', 'front_number'],
      ['AU-TB', 'AU-TB', 'back_number'],
      ['8', '8 OF 12', 'insert_numbering'],
    ])('keeps %s read from %s', (num, seen, source) => {
      const r = checkCardNumberEvidence(info({
        card_number: num, card_number_text_seen: seen, card_number_source: source,
      }));
      expect(r.outcome).toBe('kept');
      expect(r.cardNumber).toBe(num);
    });

    it('ignores separators and case when matching', () => {
      // "RC-25" quoted as "rc 25" is the same reading, not a mismatch.
      expect(checkCardNumberEvidence(info({
        card_number: 'RC-25', card_number_text_seen: 'rc 25', card_number_source: 'front_number',
      })).outcome).toBe('kept');
    });
  });

  describe('serial numbering is not a card number', () => {
    it('drops 45/299 — a print run, which belongs in serial_number', () => {
      const r = checkCardNumberEvidence(info({
        card_number: '45/299', card_number_text_seen: '45/299', card_number_source: 'front_number',
      }));
      expect(r.outcome).toBe('dropped_serial');
    });

    it('keeps "8 OF 12" — a small denominator is a set size, not a print run', () => {
      expect(checkCardNumberEvidence(info({
        card_number: '8 OF 12', card_number_text_seen: '8 OF 12', card_number_source: 'insert_numbering',
      })).outcome).toBe('kept');
    });
  });

  describe('evidence rules', () => {
    it('drops a number the model supplied after saying nothing was visible', () => {
      expect(checkCardNumberEvidence(info({
        card_number: '101', card_number_text_seen: null, card_number_source: 'not_visible',
      })).outcome).toBe('dropped_not_visible');
    });

    it('drops a source with nothing transcribed', () => {
      expect(checkCardNumberEvidence(info({ card_number_text_seen: null })).outcome)
        .toBe('dropped_no_evidence');
    });

    it('drops an unrecognised source', () => {
      expect(checkCardNumberEvidence(info({ card_number_source: 'my_memory_of_the_set' })).outcome)
        .toBe('dropped_no_evidence');
    });

    it('null stays null', () => {
      const r = checkCardNumberEvidence(info({ card_number: null }));
      expect(r.outcome).toBe('already_null');
      expect(r.cardNumber).toBeNull();
    });
  });

  describe('staged rollout', () => {
    const noEvidence = { card_number: '101', card_number_text_seen: null, card_number_source: null };

    it('keeps an unverified number by default, so an older prompt does not blank the site', () => {
      const r = checkCardNumberEvidence(noEvidence);
      expect(r.outcome).toBe('kept_unverified');
      expect(r.cardNumber).toBe('101');
    });

    it('drops it once CARD_NUMBER_EVIDENCE_REQUIRED=1', () => {
      process.env.CARD_NUMBER_EVIDENCE_REQUIRED = '1';
      const r = checkCardNumberEvidence(noEvidence);
      expect(r.outcome).toBe('dropped_no_evidence');
      expect(r.cardNumber).toBeNull();
    });
  });

  describe('applyCardNumberGuard', () => {
    it('nulls the field in place and records the decision', () => {
      const ci: any = info({ card_number: '101' });
      applyCardNumberGuard(ci, 'sports/test');
      expect(ci.card_number).toBeNull();
      expect(ci._card_number_guard.outcome).toBe('dropped_mismatch');
      expect(ci._card_number_guard.original_card_number).toBe('101');
    });

    it('leaves a verified number untouched', () => {
      const ci: any = info();
      applyCardNumberGuard(ci, 'sports/test');
      expect(ci.card_number).toBe('8');
      expect(ci._card_number_guard.outcome).toBe('kept');
    });

    it('never throws on junk input', () => {
      expect(() => applyCardNumberGuard(null as any)).not.toThrow();
      expect(applyCardNumberGuard(undefined as any).outcome).toBe('already_null');
    });
  });
});

describe('source/text shape agreement', () => {
  it('drops insert_numbering whose quote has no "N OF M" marking', () => {
    // The observed fabrication shape: coherent-looking but internally mismatched.
    const r = checkCardNumberEvidence({
      card_number: '10', card_number_text_seen: '10', card_number_source: 'insert_numbering',
    });
    expect(r.outcome).toBe('dropped_mismatch');
    expect(r.cardNumber).toBeNull();
  });

  it('accepts "8/12" as insert numbering, not just "8 OF 12"', () => {
    expect(checkCardNumberEvidence({
      card_number: '8', card_number_text_seen: '8/12', card_number_source: 'insert_numbering',
    }).outcome).toBe('kept');
  });

  it('KNOWN LIMITATION: a self-consistent fabrication survives', () => {
    // Documented, not desired. card_number "10" quoted as "10" from back_number
    // is coherent, so nothing here can refute it. Closing this needs an
    // independent read, not a stricter internal rule.
    const r = checkCardNumberEvidence({
      card_number: '10', card_number_text_seen: '10', card_number_source: 'back_number',
    });
    expect(r.outcome).toBe('kept');
  });
});
