import { describe, expect, it } from 'vitest';
import { buildDetailsPatch, customLabelDetailsPatch } from '@/lib/gradeReview/cardDetails';
import { buildIdentityPatch } from './saveCardIdentity';
import { applyCardNumberToInfo, applySetNameToInfo, foilFollowOn, normalizePokemonNumberForSet } from './identityFieldSync';
import { generateLabelData, sameCardNumber, type CardForLabel } from '@/lib/labelDataGenerator';
import { isPokemonPromoSetId, pokemonNumberForSet, stripPromoTotal } from '@/lib/pokemonPromoNumber';
import { pokemonPrintedNumber } from '@/lib/pokemonAnniversary';
import { catalogCandidateNumber } from './catalogCandidates';

/** Mana Vault (card b00f3ad5): the grader read "129/040"; the printed number is U29. */
function manaVault() {
  const info = { card_name: 'Mana Vault', set_name: 'Unknown Event', card_number: '129/040', card_number_raw: '129/040', card_number_text_seen: '129/040', collector_number: '129', set_total: '040', expansion_code: 'XXX' };
  const report = { card_info: { ...info }, final_grade: { whole_grade: 9 } };
  return {
    id: 'b00f3ad5', category: 'MTG', serial: '311587', card_name: 'Mana Vault', featured: 'Mana Vault', card_set: 'Unknown Event',
    card_number: '129/040', release_date: '2024', conversational_whole_grade: 9, conversational_decimal_grade: 9,
    conversational_card_info: info, conversational_grading: JSON.stringify(report), mtg_set_code: 'XXX',
    label_data: { cardNumber: '129/040' }, original_label_data: { cardNumber: '129/040' },
  };
}

/** Eevee SVP 173, linked to the promo set whose catalog printedTotal is 215. */
function eevee(cardNumber = '173/215') {
  const info = { card_name: 'Eevee', set_name: 'Scarlet & Violet Black Star Promos', card_number: '173', card_number_raw: '173/215', card_number_text_seen: '173', set_total: '215' };
  const report = { card_info: { ...info }, final_grade: { whole_grade: 10 } };
  return {
    id: 'eevee', category: 'Pokemon', serial: '1', card_name: 'Eevee', featured: 'Eevee', card_set: 'Scarlet & Violet Black Star Promos',
    card_number: cardNumber, release_date: '2025', conversational_whole_grade: 10, conversational_decimal_grade: 10,
    conversational_card_info: info, conversational_grading: JSON.stringify(report),
    pokemon_api_data: { id: 'svp-173', number: '173', set: { id: 'svp', name: 'Scarlet & Violet Black Star Promos', printedTotal: 215 } },
    label_data: { cardNumber: '173/215' }, original_label_data: null,
  };
}

describe('identity corrections reset every neighbouring field', () => {
  it('admin correction (Mana Vault): every number key, set_total and the label take U29', () => {
    const card = manaVault();
    const { patch } = buildDetailsPatch(card, card.conversational_grading, { card_number: 'U29' }, 'r1');
    expect(patch.card_number).toBe('U29');
    expect(patch.conversational_card_info).toMatchObject({ card_number: 'U29', card_number_raw: 'U29', card_number_text_seen: 'U29', collector_number: 'U29', set_total: null });
    expect(JSON.parse(String(patch.conversational_grading)).card_info.card_number).toBe('U29');
    expect((patch.label_data as any).cardNumber).toBe('U29');
    expect((patch.label_data as any).contextLine).toContain('#U29');
    expect((patch.label_data as any).contextLine).not.toContain('129');
    expect(patch.original_label_data).toEqual(patch.label_data);
  });

  it('label (Mana Vault legacy row): a corrected column beats a stale JSON read', () => {
    const card = { ...manaVault(), card_number: 'U29' };
    const label = generateLabelData(card as unknown as CardForLabel);
    expect(label.cardNumber).toBe('U29');
    // Same number in a fuller form still prefers the JSON ("94/102" over "94").
    const same = { ...card, card_number: '94', conversational_card_info: { card_number_raw: '094/102' } };
    expect(generateLabelData(same as unknown as CardForLabel).cardNumber).toBe('094/102');
  });

  it('label: One Piece / Yu-Gi-Oh columns (catalog id, passcode) do not override the printed number', () => {
    const ygo = { id: 'y', category: 'Yu-Gi-Oh', card_number: '87910978', conversational_card_info: { card_number: 'TLM-EN038' } };
    expect(generateLabelData(ygo as unknown as CardForLabel).cardNumber).toBe('TLM-EN038');
  });

  it('owner edit (Mana Vault): set change drops the stale MTG set code; number keys all move', () => {
    const card = manaVault();
    const p = buildIdentityPatch({ card_number: 'U29', card_set: 'Judge Gift Cards 2024', mtg_set_code: 'XXX' }, card);
    expect(p.columnPatch.card_number).toBe('U29');
    expect(p.columnPatch.mtg_set_code).toBeNull();
    expect(p.cardInfo).toMatchObject({ card_number: 'U29', card_number_raw: 'U29', card_number_text_seen: 'U29', collector_number: 'U29', set_total: null, set_name: 'Judge Gift Cards 2024', expansion_code: null });
  });

  it('admin correction (Eevee SVP 173): stored bare, no set_total, label "#173"', () => {
    const card = eevee();
    const { patch, changes } = buildDetailsPatch(card, card.conversational_grading, { card_number: '173' }, 'r2');
    expect(changes).toEqual([{ field: 'card_number', from: '173/215', to: '173' }]);
    expect(patch.conversational_card_info).toMatchObject({ card_number: '173', card_number_raw: '173', set_total: null });
    expect((patch.label_data as any).formattedCardNumber).toBe('#173');
    expect('original_label_data' in patch).toBe(false);
  });

  it('owner edit (Eevee): a promo number typed "of N" is stored bare', () => {
    const p = buildIdentityPatch({ card_number: '173/215' }, eevee('173'));
    expect(p.columnPatch.card_number).toBe('173');
    expect(p.changedFields).toEqual([]);
    expect(p.cardInfo).toMatchObject({ card_number: '173', card_number_raw: '173', set_total: null });
  });

  it('label (Eevee legacy row): a stored "173/215" on a promo set prints "#173"', () => {
    expect(generateLabelData(eevee() as unknown as CardForLabel).formattedCardNumber).toBe('#173');
    const unlinked = { ...eevee('SM190/248'), card_set: 'SM Black Star Promos', pokemon_api_data: null };
    expect(generateLabelData(unlinked as unknown as CardForLabel).formattedCardNumber).toBe('SM190');
  });

  it('custom label follows the admin correction', () => {
    const next = customLabelDetailsPatch({ cardNumber: '129/040', setName: 'X', primaryName: 'Custom' }, [{ field: 'card_number', from: '129/040', to: 'U29' }, { field: 'card_name', from: 'Mana Vault', to: 'Mana Vault' }], 'Mana Vault');
    expect(next).toEqual({ cardNumber: 'U29', setName: 'X', primaryName: 'Custom' });
    expect(customLabelDetailsPatch(null, [], null)).toBeNull();
  });
});

describe('promo numbering', () => {
  it('knows the promo set ids', () => {
    for (const id of ['svp', 'swshp', 'smp', 'xyp', 'bwp', 'hsp', 'dpp', 'np', 'basep', 'mep']) expect(isPokemonPromoSetId(id)).toBe(true);
    for (const id of ['sv1', 'me55', 'me55c', 'gym2', 'det1', 'sv3pt5', null]) expect(isPokemonPromoSetId(id)).toBe(false);
  });
  it('writes bare promo numbers and keeps real fractions, secret rares included', () => {
    expect(pokemonNumberForSet('173', 'svp', 215)).toBe('173');
    expect(pokemonNumberForSet('4', 'base1', 102)).toBe('4/102');
    expect(pokemonNumberForSet('201', 'sv3', 165)).toBe('201/165');
    expect(pokemonPrintedNumber('svp-173', '173', 215)).toBe('173');
    expect(pokemonPrintedNumber('swshp-SWSH262', 'SWSH262', 307)).toBe('SWSH262');
    expect(pokemonPrintedNumber('sv3pt5-201', '201', 165)).toBe('201/165');
    expect(catalogCandidateNumber({ number: '173', printed_total: 215, set_id: 'svp' })).toBe('173');
    expect(catalogCandidateNumber({ number: '140', printed_total: 149 })).toBe('140/149');
  });
  it('strips only an invented total', () => {
    expect(stripPromoTotal('75/215', 215)).toBe('75');
    expect(stripPromoTotal('053/091', 215)).toBe('053/091');
    expect(stripPromoTotal('SWSH263/307')).toBe('SWSH263');
    expect(stripPromoTotal('053/091')).toBe('053/091');
    expect(normalizePokemonNumberForSet('201/165', { category: 'Pokemon', card_set: 'Surging Sparks' })).toBe('201/165');
  });
});

describe('helpers', () => {
  it('number keys and set codes', () => {
    expect(applyCardNumberToInfo({ set_total: '102', number_corrected_from: '5' }, '4', 'x')).toEqual({ card_number: '4', card_number_raw: '4', card_number_text_seen: '4', set_total: null, card_number_source: 'x' });
    const info: Record<string, unknown> = { set_name: 'Alpha', expansion_code: 'LEA' };
    expect(applySetNameToInfo(info, 'Beta')).toBe(true);
    expect(info.expansion_code).toBeNull();
    expect(sameCardNumber('#094/102', '94')).toBe(true);
    expect(sameCardNumber('129/040', 'U29')).toBe(false);
  });
  it('foil flag and type stay together', () => {
    expect(foilFollowOn({ is_foil: false, foil_type: 'etched' })).toEqual({ foil_type: null });
    expect(foilFollowOn({ foil_type: 'etched' })).toEqual({ is_foil: true });
    expect(foilFollowOn({ is_foil: true, foil_type: 'etched' })).toEqual({});
  });
});
