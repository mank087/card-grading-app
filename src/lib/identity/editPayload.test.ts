import { describe, expect, it } from 'vitest';
import { dropNoOpIdentityFills } from './editPayload';

const card = (info: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
  id: 'card-1', category: 'Baseball', card_set: 'Topps', rookie_card: null,
  conversational_card_info: { set_name: 'Topps', ...info },
  ...over,
});

describe('dropNoOpIdentityFills', () => {
  it('drops false over a blank flag and Base or blank over a blank parallel', () => {
    expect(dropNoOpIdentityFills({ is_refractor: false, rookie_card: false, parallel_type: 'Base', card_set: 'Topps' }, card()))
      .toEqual({ card_set: 'Topps' });
    expect(dropNoOpIdentityFills({ parallel_type: '' }, card())).toEqual({});
  });

  it('keeps every real value', () => {
    const payload = { is_refractor: true, parallel_type: 'Refractor' };
    expect(dropNoOpIdentityFills(payload, card())).toEqual(payload);
    // Unticking a flag that is stored true is a correction.
    expect(dropNoOpIdentityFills({ is_patch: false }, card({ is_patch: true }))).toEqual({ is_patch: false });
    expect(dropNoOpIdentityFills({ rookie_card: false }, card({}, { rookie_card: true }))).toEqual({ rookie_card: false });
    // Clearing a stored parallel is a change too.
    expect(dropNoOpIdentityFills({ parallel_type: '' }, card({ parallel_type: 'Refractor' }))).toEqual({ parallel_type: '' });
  });

  it('leaves equal text fields alone (they keep column and JSON in step)', () => {
    expect(dropNoOpIdentityFills({ card_set: 'Topps', team: '' }, card())).toEqual({ card_set: 'Topps', team: '' });
  });
});
