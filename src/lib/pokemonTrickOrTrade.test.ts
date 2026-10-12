import { describe, expect, it } from 'vitest';
import {
  applyTrickOrTradeStamp, hasTrickOrTradeEvidence, isCanonicalTrickOrTrade, isTrickOrTradeSetName, trickOrTradeIdentity, trickOrTradeYear,
} from './pokemonTrickOrTrade';

describe('Trick or Trade', () => {
  it.each(['Trick or Trade', 'TRICK OR TRADE', 'Trick or Trade (2023)', 'Pokemon Trick or Trade 2023', 'Trick of Treat', 'Trick or Trade 2022'])('recognises %j', v => {
    expect(isTrickOrTradeSetName(v)).toBe(true);
  });
  it.each(['Trick or Treat Cards', 'Trick or Treat Cards PRISMA', 'Lost Origin', '', null])('does not take %j', v => {
    expect(isTrickOrTradeSetName(v)).toBe(false);
  });

  it('finds the bundle year from the PriceCharting list', () => {
    expect(trickOrTradeYear('Gengar', '066/196')).toBe('2023');
    expect(trickOrTradeYear('Pikachu', '62/193')).toBe('2023');
    expect(trickOrTradeYear('Mimikyu', '37/91')).toBe('2024');
    expect(trickOrTradeYear('Mewtwo', '56/172')).toBe('2022');
    expect(trickOrTradeYear('Charizard', '4/102')).toBeNull();
  });
  it("picks between two bundles by the card's own set year", () => {
    expect(trickOrTradeYear('Gengar', '057/198', '2021')).toBe('2022');
    expect(trickOrTradeYear('Gengar', '057/064', '2024')).toBe('2024');
    expect(trickOrTradeYear('Gengar', '57')).toBeNull();
  });

  it('builds ONE canonical set name', () => {
    expect(trickOrTradeIdentity({ player_or_character: 'Gengar', card_number: '066/196', set_name: 'Trick or Trade (2023)' })).toEqual({ set_name: 'Trick or Trade 2023', year: '2023' });
    // PriceCharting decides over a wrong stated year
    expect(trickOrTradeIdentity({ player_or_character: 'Mimikyu', card_number: '37/91', set_name: 'Trick or Trade 2023' })).toEqual({ set_name: 'Trick or Trade 2024', year: '2024' });
    // unknown card: a stated year is kept, otherwise no year
    expect(trickOrTradeIdentity({ player_or_character: 'Mega Venusaur', card_number: '003', set_name: 'Trick or Trade 2025' })).toEqual({ set_name: 'Trick or Trade 2025', year: '2025' });
    expect(trickOrTradeIdentity({ player_or_character: 'Mega Venusaur', card_number: '003', set_name: 'Trick or Trade' })).toEqual({ set_name: 'Trick or Trade', year: null });
    expect(isCanonicalTrickOrTrade('Trick or Trade 2023')).toBe(true);
    expect(isCanonicalTrickOrTrade('Pokemon Trick or Trade 2023')).toBe(false);
  });

  it('applies the stamp at grading time from the pumpkin badge, keeping the number', () => {
    const info: Record<string, any> = { player_or_character: 'Gengar', card_number: '66', card_number_raw: '066/196', set_name: 'Lost Origin', year: '2022', printed_badge: 'pumpkin' };
    expect(applyTrickOrTradeStamp(info)).toBe(true);
    expect(info).toMatchObject({ set_name: 'Trick or Trade 2023', year: '2023', card_number_raw: '066/196', printed_badge: 'pumpkin' });
    expect(applyTrickOrTradeStamp(info)).toBe(false); // idempotent
  });
  it("first look's pumpkin counts; no evidence leaves the card untouched", () => {
    expect(hasTrickOrTradeEvidence({ first_look_printed_badge: 'pumpkin' })).toBe(true);
    const plain: Record<string, any> = { player_or_character: 'Gengar', card_number_raw: '066/196', set_name: 'Lost Origin' };
    expect(applyTrickOrTradeStamp(plain)).toBe(false);
    expect(plain.set_name).toBe('Lost Origin');
  });
});
