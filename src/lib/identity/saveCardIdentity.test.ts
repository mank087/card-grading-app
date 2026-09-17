import { describe, expect, it } from 'vitest';
import {
  buildIdentityPatch,
  IdentityFieldError,
  IDENTITY_CONTROL_KEYS,
  FORBIDDEN_IDENTITY_COLUMNS,
  MATERIAL_IDENTITY_FIELDS,
  PRICING_INVALIDATION_COLUMNS,
  IDENTITY_FIELDS,
  allowedFieldsForCategory,
  normalizeIdentityValue,
  saveCardIdentity,
} from './saveCardIdentity';

const sportsCard = (over: Record<string, any> = {}) => ({
  id: 'card-1',
  user_id: 'owner-1',
  category: 'Baseball',
  card_name: 'Mickey Mantle',
  featured: 'Mickey Mantle',
  card_set: 'Topps',
  card_number: '091/086',
  release_date: '1960',
  conversational_card_info: {
    card_name: 'Mickey Mantle',
    set_name: 'Topps',
    card_number: '091/086',
    card_number_raw: '091/086',
    year: '1960',
  },
  ...over,
});

describe('editable field allowlist', () => {
  it('rejects a field that is not editable instead of silently dropping it', () => {
    expect(() => buildIdentityPatch({ conversational_grading: 'x' }, sportsCard()))
      .toThrow(IdentityFieldError);
    try {
      buildIdentityPatch({ made_up_field: 'x' }, sportsCard());
    } catch (e) {
      expect(e).toBeInstanceOf(IdentityFieldError);
      expect((e as IdentityFieldError).field).toBe('made_up_field');
    }
  });

  it('drops a known field that belongs to another category instead of failing the save', () => {
    const patch = buildIdentityPatch({ mana_cost: '{2}{U}', card_set: 'Topps' }, sportsCard());
    expect(JSON.stringify(patch)).not.toContain('mana_cost');
    expect(() => buildIdentityPatch({ mana_cost: '{2}{U}' }, sportsCard({ category: 'MTG' }))).not.toThrow();
  });

  it('gives every category the common fields the shared editor sends', () => {
    for (const category of ['Pokemon', 'MTG', 'Lorcana', 'Baseball', 'One Piece', 'Other', null]) {
      const allowed = allowedFieldsForCategory(category);
      for (const field of ['card_name', 'featured', 'card_set', 'card_number', 'release_date']) {
        expect(allowed.has(field)).toBe(true);
      }
    }
  });

  it('never maps an editable field onto a forbidden column', () => {
    for (const mapping of Object.values(IDENTITY_FIELDS)) {
      if (mapping.column) expect(FORBIDDEN_IDENTITY_COLUMNS).not.toContain(mapping.column);
    }
  });

  it('cannot put a grade column, image path or credit field into the column patch', () => {
    const card = sportsCard();
    const patch = buildIdentityPatch({
      card_name: 'Roger Maris', card_set: 'Topps', card_number: '091/086', release_date: '1960',
      featured: 'Roger Maris', serial_numbering: '17/99', rarity_tier: 'rare',
    }, card);
    for (const forbidden of FORBIDDEN_IDENTITY_COLUMNS) {
      expect(Object.keys(patch.columnPatch)).not.toContain(forbidden);
    }
    expect(Object.keys(patch.columnPatch)).not.toContain('conversational_decimal_grade');
    expect(Object.keys(patch.columnPatch)).not.toContain('front_path');
  });
});

describe('omitted, cleared and unchanged values', () => {
  it('leaves an omitted field out of the patch entirely', () => {
    const patch = buildIdentityPatch({ card_name: 'Mickey Mantle' }, sportsCard());
    expect(Object.keys(patch.columnPatch)).toEqual(['card_name']);
    expect(patch.cardInfo?.set_name).toBe('Topps');
  });

  it('stores a cleared field as null, not an empty string', () => {
    const patch = buildIdentityPatch({ card_set: '' }, sportsCard());
    expect(patch.columnPatch.card_set).toBeNull();
    expect(patch.cardInfo?.set_name).toBeNull();
    expect(patch.changedFields).toContain('card_set');
  });

  it('writes an unchanged value without counting it as a change', () => {
    const patch = buildIdentityPatch({ card_name: 'Mickey Mantle', card_set: 'Topps' }, sportsCard());
    expect(patch.changedFields).toEqual([]);
    expect(patch.material).toBe(false);
    expect(patch.columnPatch.card_name).toBe('Mickey Mantle');
  });
});

describe('material change detection', () => {
  it('treats whitespace and casing as the same value', () => {
    expect(normalizeIdentityValue('  Topps ')).toBe(normalizeIdentityValue('topps'));
    const patch = buildIdentityPatch({ card_set: '  Topps ' }, sportsCard());
    expect(patch.changedFields).toEqual([]);
    expect(patch.material).toBe(false);
  });

  it('treats null, undefined and an empty string as the same absent value', () => {
    expect(normalizeIdentityValue('')).toBeNull();
    expect(normalizeIdentityValue(null)).toBeNull();
    expect(normalizeIdentityValue(undefined)).toBeNull();
    const patch = buildIdentityPatch({ serial_numbering: '' }, sportsCard());
    expect(patch.changedFields).toEqual([]);
  });

  it.each([
    ['091/086', '91/86'],
    ['RA-CS', 'RA-CS1'],
    ['OP11-001', 'OP11-01'],
  ])('preserves alphanumeric card numbers verbatim (%s vs %s)', (stored, edited) => {
    const patch = buildIdentityPatch({ card_number: edited }, sportsCard({
      card_number: stored,
      conversational_card_info: { card_number: stored, card_number_raw: stored },
    }));
    expect(patch.columnPatch.card_number).toBe(edited);
    expect(patch.cardInfo?.card_number).toBe(edited);
    expect(patch.materialFields).toContain('card_number');
  });

  it('keeps leading zeros exactly as typed', () => {
    const patch = buildIdentityPatch({ card_number: '007' }, sportsCard());
    expect(patch.columnPatch.card_number).toBe('007');
    expect(patch.cardInfo?.card_number_raw).toBe('007');
  });

  it('does not treat a cosmetic field as material', () => {
    const patch = buildIdentityPatch({ rarity_description: 'Holo Rare' }, sportsCard());
    expect(patch.changedFields).toEqual(['rarity_description']);
    expect(patch.material).toBe(false);
  });

  it.each(['card_name', 'card_set', 'card_number', 'release_date', 'serial_numbering'])(
    'treats a %s change as material', field => {
      expect(MATERIAL_IDENTITY_FIELDS).toContain(field);
      const patch = buildIdentityPatch({ [field]: 'brand new value' }, sportsCard());
      expect(patch.material).toBe(true);
      expect(patch.materialFields).toContain(field);
    });

  it('records a before and after snapshot of only the changed fields', () => {
    const patch = buildIdentityPatch({ card_set: 'Bowman', card_name: 'Mickey Mantle' }, sportsCard());
    expect(patch.before).toEqual({ card_set: 'Topps' });
    expect(patch.after).toEqual({ card_set: 'Bowman' });
  });
});

describe('defect A: the two card-number keys stay in step', () => {
  it('writes card_number and card_number_raw together', () => {
    const patch = buildIdentityPatch({ card_number: '35' }, sportsCard());
    expect(patch.cardInfo?.card_number).toBe('35');
    expect(patch.cardInfo?.card_number_raw).toBe('35');
    expect(patch.columnPatch.card_number).toBe('35');
  });

  it('clears both keys when the number is cleared', () => {
    const patch = buildIdentityPatch({ card_number: '' }, sportsCard());
    expect(patch.cardInfo?.card_number).toBeNull();
    expect(patch.cardInfo?.card_number_raw).toBeNull();
  });
});

describe('control keys', () => {
  it('never reaches the column patch or the card info', () => {
    const card = sportsCard();
    const patch = buildIdentityPatch(
      { card_set: 'Bowman', confirm: true, dismiss: false, expected_identity_revision: 3 }, card);
    for (const key of IDENTITY_CONTROL_KEYS) {
      expect(Object.keys(patch.columnPatch)).not.toContain(key);
      expect(Object.keys(patch.cardInfo || {})).not.toContain(key);
      expect(patch.changedFields).not.toContain(key);
    }
  });

  it('accepts a confirmation with no field changes at all', async () => {
    const calls: any[] = [];
    const supabase = {
      rpc: async (fn: string, args: any) => {
        calls.push([fn, args]);
        return { data: { status: 'saved', identity_revision: 2, confirmed: true, pricing_invalidated: false }, error: null };
      },
    } as any;
    const result = await saveCardIdentity(supabase, {
      cardId: 'card-1', card: sportsCard(), body: {}, actorId: 'owner-1', confirm: true,
    });
    expect(result).toMatchObject({ status: 'saved', confirmed: true, identityRevision: 2 });
    expect(calls[0][1].p_confirm).toBe(true);
    expect(calls[0][1].p_material_change).toBe(false);
  });

  it('still refuses an empty body that is neither an edit nor a confirmation', async () => {
    const supabase = { rpc: async () => { throw new Error('must not be called'); } } as any;
    const result = await saveCardIdentity(supabase, {
      cardId: 'card-1', card: sportsCard(), body: {}, actorId: 'owner-1',
    });
    expect(result).toMatchObject({ status: 'invalid', error: 'No changes to save' });
  });
});

describe('pricing invalidation', () => {
  const rpcSpy = () => {
    const calls: any[] = [];
    const supabase = {
      rpc: async (_fn: string, args: any) => {
        calls.push(args);
        return { data: { status: 'saved', identity_revision: 1, confirmed: false, pricing_invalidated: args.p_material_change }, error: null };
      },
    } as any;
    return { supabase, calls };
  };

  it('sends the invalidation list only for a material change', async () => {
    const { supabase, calls } = rpcSpy();
    await saveCardIdentity(supabase, {
      cardId: 'card-1', card: sportsCard(), body: { card_set: 'Bowman' }, actorId: 'owner-1',
    });
    expect(calls[0].p_invalidate_columns).toEqual(PRICING_INVALIDATION_COLUMNS);

    const cosmetic = rpcSpy();
    await saveCardIdentity(cosmetic.supabase, {
      cardId: 'card-1', card: sportsCard(), body: { rarity_description: 'Holo Rare' }, actorId: 'owner-1',
    });
    expect(cosmetic.calls[0].p_invalidate_columns).toEqual([]);
    expect(cosmetic.calls[0].p_material_change).toBe(false);
  });

  it('never invalidates the price-at-grading history', () => {
    expect(PRICING_INVALIDATION_COLUMNS).not.toContain('dcm_price_at_grading');
    expect(PRICING_INVALIDATION_COLUMNS).not.toContain('dcm_price_at_grading_date');
  });

  it('clears the manual product selection so an old match cannot survive', () => {
    expect(PRICING_INVALIDATION_COLUMNS).toContain('dcm_selected_product_id');
    expect(PRICING_INVALIDATION_COLUMNS).toContain('dcm_price_estimate');
    expect(PRICING_INVALIDATION_COLUMNS).toContain('dcm_cached_prices');
    expect(PRICING_INVALIDATION_COLUMNS).toContain('ebay_price_median');
  });
});

describe('save result mapping', () => {
  const stubRpc = (data: any) => ({ rpc: async () => ({ data, error: null }) }) as any;

  it.each([
    [{ status: 'locked' }, 'locked'],
    [{ status: 'forbidden' }, 'forbidden'],
    [{ status: 'not_found' }, 'not_found'],
  ])('maps %o to %s', async (data, expected) => {
    const result = await saveCardIdentity(stubRpc(data), {
      cardId: 'card-1', card: sportsCard(), body: { card_set: 'Bowman' }, actorId: 'owner-1',
    });
    expect(result.status).toBe(expected);
  });

  it('surfaces the current revision on a stale save', async () => {
    const result = await saveCardIdentity(stubRpc({ status: 'stale', current_revision: 7 }), {
      cardId: 'card-1', card: sportsCard(), body: { card_set: 'Bowman' }, actorId: 'owner-1', expectedRevision: 4,
    });
    expect(result).toEqual({ status: 'stale', currentRevision: 7 });
  });
});

describe('fallback when the migration has not been applied', () => {
  const missingFunction = { code: 'PGRST202', message: 'Could not find the function public.save_card_identity' };

  function fakeDb() {
    const updates: Record<string, any>[] = [];
    const supabase = {
      rpc: async () => ({ data: null, error: missingFunction }),
      from: () => ({
        update: (payload: Record<string, any>) => {
          updates.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      }),
    } as any;
    return { supabase, updates };
  }

  it('still applies the identity edit, the card-number fix and the invalidation', async () => {
    const { supabase, updates } = fakeDb();
    const result = await saveCardIdentity(supabase, {
      cardId: 'card-1', card: sportsCard(), body: { card_number: '35' }, actorId: 'owner-1',
    });
    expect(result).toMatchObject({ status: 'saved', identityRevision: null, pricingInvalidated: true });
    // First write preserves the original AI card info, second is the edit.
    expect(updates[0]).toHaveProperty('original_card_info');
    const identityUpdate = updates[1];
    expect(identityUpdate.card_number).toBe('35');
    expect(identityUpdate.conversational_card_info.card_number).toBe('35');
    expect(identityUpdate.conversational_card_info.card_number_raw).toBe('35');
    for (const column of PRICING_INVALIDATION_COLUMNS) {
      expect(identityUpdate[column]).toBeNull();
    }
  });

  it('reports confirmation as unavailable rather than pretending it saved', async () => {
    const { supabase } = fakeDb();
    const result = await saveCardIdentity(supabase, {
      cardId: 'card-1', card: sportsCard(), body: {}, actorId: 'owner-1', confirm: true,
    });
    expect(result.status).toBe('unavailable');
  });

  it('does not invalidate pricing for a cosmetic edit', async () => {
    const { supabase, updates } = fakeDb();
    await saveCardIdentity(supabase, {
      cardId: 'card-1', card: sportsCard(), body: { rarity_description: 'Holo Rare' }, actorId: 'owner-1',
    });
    const identityUpdate = updates[updates.length - 1];
    expect(identityUpdate).not.toHaveProperty('dcm_price_estimate');
  });
});
