import { describe, it, expect } from 'vitest';
import { cardIdentityKey } from './cardIdentityKey';

const base = {
  id: 'card-1',
  card_name: 'Mega Gengar EX',
  card_set: 'Phantom Forces',
  card_number: '34/119',
  year: 2014,
  rarity: 'Ultra Rare',
  grade: 9,
  serial: 'DCM-0001',
  dcm_price_estimate: 120,
  updated_at: '2026-09-22T10:00:00Z',
};

describe('cardIdentityKey', () => {
  it('is empty for nothing', () => {
    expect(cardIdentityKey(null)).toBe('');
    expect(cardIdentityKey(undefined)).toBe('');
  });

  it('is stable across two reads of the same row', () => {
    expect(cardIdentityKey({ ...base })).toBe(cardIdentityKey({ ...base }));
  });

  it('changes when the identity is corrected', () => {
    const before = cardIdentityKey(base);
    expect(cardIdentityKey({ ...base, card_name: 'Gengar EX' })).not.toBe(before);
    expect(cardIdentityKey({ ...base, card_number: '35/119' })).not.toBe(before);
    expect(cardIdentityKey({ ...base, card_set: 'XY Base' })).not.toBe(before);
    expect(cardIdentityKey({ ...base, year: 2015 })).not.toBe(before);
    expect(cardIdentityKey({ ...base, rarity: 'Secret Rare' })).not.toBe(before);
    expect(cardIdentityKey({ ...base, grade: 10 })).not.toBe(before);
    expect(cardIdentityKey({ ...base, serial: 'DCM-0002' })).not.toBe(before);
  });

  it('does NOT change when a price refresh touches the row', () => {
    const before = cardIdentityKey(base);
    expect(
      cardIdentityKey({
        ...base,
        dcm_price_estimate: 480,
        updated_at: '2026-09-23T04:00:00Z',
        dcm_price_updated_at: '2026-09-23T04:00:00Z',
      }),
    ).toBe(before);
  });

  it('reads the conversational_card_info fallbacks the draft builder reads', () => {
    const a = cardIdentityKey({ id: 'x', conversational_card_info: { set_name: 'Evolutions' } });
    const b = cardIdentityKey({ id: 'x', conversational_card_info: { set_name: 'Base Set' } });
    expect(a).not.toBe(b);
  });

  it('follows an explicit identity_revision when the row has one', () => {
    const before = cardIdentityKey({ ...base, identity_revision: 1 });
    expect(cardIdentityKey({ ...base, identity_revision: 2 })).not.toBe(before);
  });
});
