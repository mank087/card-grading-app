import { describe, it, expect } from 'vitest';
import { cleanFieldValue, isMeaningfulValue, resolveListingFields } from './listingFields';

describe('listing field placeholders', () => {
  it('treats the grading engine\'s "Unconfirmed" rarity tier as empty', () => {
    // rarity_tier = "Unconfirmed" leaked into eBay titles as a rarity word
    // ("... #118 Unconfirmed 2024 Lorcana DCM 10") on Sept 5 2026 listings.
    expect(cleanFieldValue('Unconfirmed')).toBe('');
    expect(isMeaningfulValue('unconfirmed')).toBe(false);
    expect(cleanFieldValue('Legendary')).toBe('Legendary');
  });
});

/**
 * Owner review 2026-09-22, item 12. `cards.rarity_tier` holds the grader's
 * CLASSIFICATION BUCKET, and visionGrader stamps 'Parallel / Insert Variant'
 * on almost every Pokemon card (the model writes the rarity name into
 * `subset`, and a subset is enough to trigger that bucket). It was reaching
 * eBay titles as if it were the rarity.
 */
describe('rarity vs the grader classification bucket', () => {
  const pokemonCard = {
    category: 'Pokemon',
    card_name: 'Toxtricity',
    rarity_tier: 'Parallel / Insert Variant',
    conversational_card_info: {
      player_or_character: 'Toxtricity',
      set_name: '30th Celebration',
      card_number: '134',
      rarity_tier: 'Secret Rare',
    },
  };

  it('uses the printed rarity, not the bucket, for a Pokemon card', () => {
    const fields = resolveListingFields(pokemonCard, 'pokemon');
    expect(fields.rarity).toBe('Secret Rare');
    expect(fields.rarity).not.toMatch(/Parallel/);
  });

  it('shows no rarity at all rather than the bucket', () => {
    const fields = resolveListingFields(
      { ...pokemonCard, conversational_card_info: { player_or_character: 'Toxtricity' } },
      'pokemon',
    );
    expect(fields.rarity).toBe('');
  });

  it('keeps the bucket for a sports card, where it is the description', () => {
    const fields = resolveListingFields(
      {
        category: 'Baseball',
        card_name: 'Mickey Mantle',
        rarity_tier: 'Parallel / Insert Variant',
        conversational_card_info: { player_or_character: 'Mickey Mantle' },
      },
      'sports',
    );
    expect(fields.rarity).toBe('Parallel / Insert Variant');
  });
});
