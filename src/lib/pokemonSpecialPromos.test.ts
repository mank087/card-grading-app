import { describe, expect, it } from 'vitest';
import {
  applySpecialPromo, isCanonicalSpecialPromo, matchSpecialPromo, promoLanguage, specialPromoColumns, specialPromoProduct,
  SPECIAL_PROMOS, SPECIAL_PROMO_SOURCE,
} from './pokemonSpecialPromos';

describe('special promos: Ancient Mew', () => {
  it.each([
    [{ card_name: 'Ancient Mew' }],
    [{ card_name: ' ANCIENT MEW' }],
    [{ card_name: 'Mew', player_or_character: 'Ancient Mew' }],
    [{ card_name: 'AncientMew' }],
    [{ card_name: '古代ミュウ (Ancient Mew)' }],
    [{ featured: 'Ancient Mew' }],
  ])('matches %j', info => {
    expect(matchSpecialPromo(info)?.promo.id).toBe('ancient-mew-2000');
  });

  it.each([
    [{ card_name: 'Mew' }],
    [{ card_name: 'Mew ex', card_number: '232/091' }],
    [{ card_name: 'Mewtwo', card_number: '150' }],
    [{ card_name: 'Ancient Mewtwo' }],
    [{ card_name: '古代 (Ancient)' }],
    [{ card_name: 'Mew', card_front_text: 'Psychic attack text' }],
    // runes in the text but a printed number: a numbered Mew, not this promo
    [{ card_name: 'Mew', card_number: '9', card_front_text: 'runic glyphs' }],
    [null],
  ])('does not match %j', info => {
    expect(matchSpecialPromo(info as any)).toBeNull();
  });

  it('matches a plain "Mew" read only with Unown/glyph text and no printed number', () => {
    const m = matchSpecialPromo({ card_name: 'Mew', player_or_character: 'Mew', card_number: null,
      card_front_text: 'Front text consists of decorative runic-style glyphs' });
    expect(m).toMatchObject({ via: 'evidence', language: 'en' });
  });

  it('prices by language: English 1958438, Japanese 3834602', () => {
    const en = matchSpecialPromo({ card_name: 'Ancient Mew', language: 'English' })!;
    expect(specialPromoProduct(en)).toEqual({ productId: '1958438', productName: 'Ancient Mew' });
    const ja = matchSpecialPromo({ card_name: '古代ミュウ (Ancient Mew)' })!;
    expect(ja.language).toBe('ja');
    expect(specialPromoProduct(ja)).toEqual({ productId: '3834602', productName: 'Ancient Mew' });
    expect(specialPromoProduct(matchSpecialPromo({ card_name: 'Ancient Mew', language: 'japanese' })!)!.productId).toBe('3834602');
  });

  it('a Wizards copyright keeps the English print even when the grader wrote the name in katakana', () => {
    expect(promoLanguage({ card_name: 'Ancient Mew', player_or_character: 'ミュウ (Mew)', manufacturer: 'Nintendo / Wizards of the Coast' })).toBe('en');
    expect(promoLanguage({ card_name: 'Ancient Mew', player_or_character: 'ミュウ (Mew)' })).toBe('ja');
  });

  it('a variant is pinned only when the card text names it; Korean is not pinned', () => {
    const ja = { card_name: '古代ミュウ (Ancient Mew)', year_text_seen: '©1995 Nintedo' };
    expect(specialPromoProduct(matchSpecialPromo(ja)!, ja)!.productId).toBe('4602476');
    // the "Nintedo" error is a Japanese printing: no effect on an English card
    const en = { card_name: 'Ancient Mew', language: 'en', year_text_seen: '©1995 Nintedo' };
    expect(specialPromoProduct(matchSpecialPromo(en)!, en)!.productId).toBe('1958438');
    expect(specialPromoProduct(matchSpecialPromo({ card_name: 'Ancient Mew', language: 'ko' })!)).toBeNull();
  });

  it('applies ONE canonical identity at grading time and clears the number', () => {
    const info: Record<string, any> = { card_name: 'Ancient Mew', player_or_character: 'Mew', set_name: 'Wizards Black Star Promos',
      year: '1999-2000', card_number: '5', card_number_raw: '5', set_total: '53', needs_api_lookup: true };
    expect(applySpecialPromo(info)?.promo.id).toBe('ancient-mew-2000');
    expect(info).toMatchObject({
      card_name: 'Ancient Mew', player_or_character: 'Ancient Mew', set_name: 'Pokemon Movie 2000 Promo', year: '2000',
      card_number: null, card_number_raw: null, set_total: null, card_number_format: 'none', needs_api_lookup: false,
      validated_source: SPECIAL_PROMO_SOURCE, special_promo: 'ancient-mew-2000',
    });
    expect(applySpecialPromo({ card_name: 'Mew', card_number: '8' })).toBeNull();
  });

  it('builds the row columns with the pricing pin', () => {
    const m = matchSpecialPromo({ card_name: 'Ancient Mew' })!;
    expect(specialPromoColumns(m)).toEqual({
      card_name: 'Ancient Mew', featured: 'Ancient Mew', pokemon_featured: 'Ancient Mew', card_set: 'Pokemon Movie 2000 Promo',
      card_number: null, release_date: '2000', dcm_selected_product_id: '1958438', dcm_selected_product_name: 'Ancient Mew',
    });
    const promo = SPECIAL_PROMOS[0];
    expect(isCanonicalSpecialPromo({ card_name: 'Ancient Mew', featured: 'Ancient Mew', card_set: 'Pokemon Movie 2000 Promo', card_number: null, release_date: '2000' }, promo)).toBe(true);
    expect(isCanonicalSpecialPromo({ card_name: 'Ancient Mew', featured: null, card_set: null, card_number: null, release_date: '1999' }, promo)).toBe(false);
  });

  it('every entry is complete', () => {
    for (const p of SPECIAL_PROMOS) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.match.names.length).toBeGreaterThan(0);
      expect(p.canonical.card_set).toBeTruthy();
      expect(p.pricing.en?.productId).toMatch(/^\d+$/);
      expect(p.notes).toBeTruthy();
    }
  });
});

describe('grading route wiring (source order)', () => {
  it('applies the promo after catalog validation, before Trick or Trade, and pins before the regrade identity guard', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/app/api/pokemon/[id]/route.ts', 'utf8');
    const validation = src.indexOf('If DB validation applied corrections, update the raw JSON string too');
    const apply = src.indexOf('applySpecialPromo(cardInfo)');
    const tot = src.indexOf('applyTrickOrTradeStamp(cardInfo)');
    const pin = src.indexOf('dcm_selected_product_id = promoCols.dcm_selected_product_id');
    const guard = src.indexOf('preserveIdentityOnRegrade(supabase, cardId, updateData');
    expect(validation).toBeGreaterThan(0);
    expect(apply).toBeGreaterThan(validation);
    expect(tot).toBeGreaterThan(apply);
    expect(pin).toBeGreaterThan(tot);
    expect(guard).toBeGreaterThan(pin);
    expect(src).toContain('!identityOwnerConfirmed ? applySpecialPromo(cardInfo)');
    expect(src).toContain('!card.dcm_selected_product_id && !identityOwnerConfirmed');
  });
});
