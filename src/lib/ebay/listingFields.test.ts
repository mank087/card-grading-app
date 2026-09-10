import { describe, it, expect } from 'vitest';
import { cleanFieldValue, isMeaningfulValue } from './listingFields';

describe('listing field placeholders', () => {
  it('treats the grading engine\'s "Unconfirmed" rarity tier as empty', () => {
    // rarity_tier = "Unconfirmed" leaked into eBay titles as a rarity word
    // ("... #118 Unconfirmed 2024 Lorcana DCM 10") on Sept 5 2026 listings.
    expect(cleanFieldValue('Unconfirmed')).toBe('');
    expect(isMeaningfulValue('unconfirmed')).toBe(false);
    expect(cleanFieldValue('Legendary')).toBe('Legendary');
  });
});
