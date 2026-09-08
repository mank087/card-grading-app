import { describe, expect, it } from 'vitest';
import { buildDetailsPatch, currentDetails, detailsCorrectionSchema } from './cardDetails';

function fixture() {
  const info = { card_name: 'Mickey Mantle', player_or_character: 'Mickey Mantle', set_name: 'Topps', year: '1957', year_text_seen: '© 1957', year_source: 'back_copyright', card_number: '35', manufacturer: 'Topps', _year_guard: { outcome: 'kept' } };
  const report = { card_info: { ...info }, final_grade: { whole_grade: 6, summary: 'ok' }, raw_sub_scores: {} };
  const card = {
    id: 'card', category: 'Sports', serial: '611488', card_name: 'Mickey Mantle', featured: 'Mickey Mantle', card_set: 'Topps', card_number: '35', release_date: '1957', manufacturer_name: 'Topps',
    conversational_whole_grade: 6, conversational_decimal_grade: 6, conversational_condition_label: 'Excellent-Mint',
    conversational_card_info: info, conversational_grading: JSON.stringify(report),
    ai_grading: { 'Card Information': { ...info }, 'Grading (DCM Master Scale)': { 'DCM Grade (Final Whole Number)': 6 } },
    label_data: { year: '1957', cardNumber: '35', grade: 6 }, original_label_data: { year: '1957', cardNumber: '35', grade: 6 },
  };
  return { card, report };
}

describe('card details correction', () => {
  it('reads the current identity from the live columns', () => {
    expect(currentDetails(fixture().card)).toEqual({ card_name: 'Mickey Mantle', set_name: 'Topps', year: '1957', card_number: '35', manufacturer: 'Topps' });
  });
  it('rewrites every identity surface for the changed fields only', () => {
    const { card } = fixture();
    const result = buildDetailsPatch(card, card.conversational_grading, { year: '1960', card_number: '350', set_name: 'Topps' }, 'review-1');
    expect(result.changes).toEqual([{ field: 'year', from: '1957', to: '1960' }, { field: 'card_number', from: '35', to: '350' }]);
    expect(result.patch).toMatchObject({ release_date: '1960', card_number: '350' });
    expect(result.patch).not.toHaveProperty('card_set');
    expect(result.patch).not.toHaveProperty('card_name');
    const info = result.patch.conversational_card_info as Record<string, unknown>;
    expect(info).toMatchObject({ year: '1960', year_source: 'manual_correction', year_text_seen: null, card_number: '350', card_number_source: 'manual_correction', card_name: 'Mickey Mantle' });
    expect((info._year_guard as Record<string, unknown>).original_year).toBe('1957');
    const report = JSON.parse(String(result.patch.conversational_grading));
    expect(report.card_info).toMatchObject({ year: '1960', card_number: '350' });
    expect(report.final_grade).toEqual({ whole_grade: 6, summary: 'ok' });
    const ai = result.patch.ai_grading as Record<string, Record<string, unknown>>;
    expect(ai['Card Information']).toMatchObject({ year: '1960', card_number: '350' });
    expect(ai['Grading (DCM Master Scale)']).toEqual({ 'DCM Grade (Final Whole Number)': 6 });
    const label = result.patch.label_data as Record<string, unknown>;
    expect(label.year).toBe('1960'); expect(label.cardNumber).toBe('350'); expect(label.grade).toBe(6);
    expect(result.patch.original_label_data).toEqual(result.patch.label_data);
    expect(result.expected).toMatchObject({ release_date: '1957', card_number: '35', conversational_grading: card.conversational_grading });
  });
  it('tracks the player name when it mirrored the card name', () => {
    const { card } = fixture();
    const result = buildDetailsPatch(card, card.conversational_grading, { card_name: 'Roger Maris' }, 'r');
    expect(result.patch).toMatchObject({ card_name: 'Roger Maris', featured: 'Roger Maris' });
    expect((result.patch.conversational_card_info as Record<string, unknown>).player_or_character).toBe('Roger Maris');
    const kept = buildDetailsPatch({ ...card, featured: 'Someone Else' }, card.conversational_grading, { card_name: 'Roger Maris' }, 'r');
    expect(kept.patch).not.toHaveProperty('featured');
  });
  it('refuses stale reports and no-op corrections', () => {
    const { card } = fixture();
    expect(() => buildDetailsPatch(card, '{"changed":true}', { year: '1960' }, 'r')).toThrow('stale_review');
    expect(() => buildDetailsPatch(card, card.conversational_grading, { year: '1957' }, 'r')).toThrow('no_change');
    expect(detailsCorrectionSchema.safeParse({ year: 'nineteen sixty' }).success).toBe(false);
    expect(detailsCorrectionSchema.safeParse({ grade: 10 }).success).toBe(false);
  });
});
