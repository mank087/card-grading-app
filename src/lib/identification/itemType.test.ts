import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { actionableItemType, isNonStandardItemType, nonStandardExplanation, NOT_STANDARD_CARD_LABEL } from './itemType';

const rec = (finalType: string, firstType?: string | null) => ({ result: { photos: { item_type: finalType } }, ...(firstType !== undefined ? { contract_item_type: firstType } : {}) });

describe('non-standard item policy', () => {
  it('labels dividers, stickers, jumbos, customs, marked reprints and screen photos', () => {
    for (const t of ['accessory_not_a_card', 'sticker_or_decal', 'oversized_or_jumbo', 'custom_or_fan_made', 'reproduction_or_reprint_marked', 'photo_of_a_screen_or_printout', 'not_a_collectible']) expect(isNonStandardItemType(t)).toBe(true);
  });
  it('never labels a trading card, an unsure read, or a card inside a grading slab', () => {
    for (const t of ['trading_card', 'cannot_tell', 'already_graded_slab', '', null, undefined, 42]) expect(isNonStandardItemType(t)).toBe(false);
  });
  it('acts on a single pass, but needs both passes to agree when two ran', () => {
    expect(actionableItemType(rec('accessory_not_a_card'))).toBe('accessory_not_a_card');
    expect(actionableItemType(rec('trading_card'))).toBeNull();
    expect(actionableItemType(rec('sticker_or_decal', 'trading_card'))).toBeNull();
    expect(actionableItemType(rec('trading_card', 'sticker_or_decal'))).toBeNull();
    expect(actionableItemType(rec('custom_or_fan_made', 'sticker_or_decal'))).toBe('sticker_or_decal');
    expect(actionableItemType(null)).toBeNull();
  });
  it('explains itself calmly, with no em dash and no "AI"', () => {
    const text = `${NOT_STANDARD_CARD_LABEL} ${nonStandardExplanation('accessory_not_a_card')}`;
    expect(text).toContain('deck divider');
    expect(text).not.toContain('—');
    expect(text).not.toMatch(/\bAI\b/);
    expect(nonStandardExplanation('trading_card')).toBeNull();
  });
  it('keeps the mobile copy identical once it exists', () => {
    let mobile: string | null = null;
    try { mobile = readFileSync('dcm-mobile/lib/itemType.ts', 'utf8'); } catch { /* not copied yet */ }
    if (mobile !== null) expect(mobile.replace(/\r\n/g, '\n')).toBe(readFileSync('src/lib/identification/itemType.ts', 'utf8').replace(/\r\n/g, '\n'));
  });
});
