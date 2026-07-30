import type { SupabaseClient } from '@supabase/supabase-js';
import {
  neighboursForDrop,
  positionAfterMax,
  positionBetween,
  rebalancedPositions,
} from './position';

/**
 * Binder read/write helpers shared by the API routes.
 *
 * See docs/BINDERS_DESIGN_2026-07-30.md. Two rules run through all of it:
 *
 *  1. Deleting a binder NEVER deletes cards. The binder is a view onto the
 *     collection, not a container that owns them.
 *  2. Positions are computed here, server-side, from the client's intent. The
 *     client never sends a number — that is what makes concurrent drags safe.
 */

export type SmartFilter = {
  ownership_status?: 'owned' | 'sold' | 'archived';
  category?: string;
  min_grade?: number;
  max_grade?: number;
  search?: string;
};

export interface BinderRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_card_id: string | null;
  accent_color: string | null;
  position: number;
  smart_filter: SmartFilter | null;
  is_public: boolean;
  slug: string | null;
  system_key: string | null;
  created_at: string;
  updated_at: string;
}

export const SOLD_BINDER_KEY = 'sold';

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'binder';
}

/** True when a binder is a saved filter rather than a hand-curated list. */
export function isSmart(binder: Pick<BinderRow, 'smart_filter'>): boolean {
  return binder.smart_filter !== null && binder.smart_filter !== undefined;
}

/**
 * Apply a smart binder's filter to a cards query.
 *
 * Deliberately a small, closed set of predicates. A general-purpose query
 * language stored in JSONB and interpolated into SQL is how you build an
 * injection hole — every field here maps to a typed PostgREST call.
 */
export function applySmartFilter(query: any, filter: SmartFilter) {
  if (filter.ownership_status) query = query.eq('ownership_status', filter.ownership_status);
  if (filter.category) query = query.eq('category', filter.category);
  if (typeof filter.min_grade === 'number') query = query.gte('conversational_whole_grade', filter.min_grade);
  if (typeof filter.max_grade === 'number') query = query.lte('conversational_whole_grade', filter.max_grade);
  if (filter.search) {
    const safe = filter.search.replace(/[%_,()]/g, ' ').trim();
    if (safe) query = query.or(`card_name.ilike.%${safe}%,serial.ilike.%${safe}%`);
  }
  return query;
}

/** Next free position at the end of a user's binder list. */
export async function nextBinderPosition(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from('binders')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return positionAfterMax(data?.position);
}

/**
 * Create (or return) the auto-maintained "Sold" binder.
 *
 * A SMART binder, not a membership list: mark a card sold and it appears; hit
 * "Still mine" and it leaves. Literal membership would need syncing from the
 * ownership route, the eBay reconciliation and the undo path — three places to
 * fall out of step.
 */
export async function ensureSoldBinder(
  supabase: SupabaseClient,
  userId: string
): Promise<BinderRow | null> {
  const { data: existing } = await supabase
    .from('binders')
    .select('*')
    .eq('user_id', userId)
    .eq('system_key', SOLD_BINDER_KEY)
    .maybeSingle();
  if (existing) return existing as BinderRow;

  const { data, error } = await supabase
    .from('binders')
    .insert({
      user_id: userId,
      name: 'Sold',
      description: 'Cards you\'ve sold. They stay verifiable for the buyer.',
      accent_color: '#059669',
      position: await nextBinderPosition(supabase, userId),
      smart_filter: { ownership_status: 'sold' } satisfies SmartFilter,
      system_key: SOLD_BINDER_KEY,
      slug: 'sold',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    // Unique violation = another request created it first; re-read.
    if ((error as any).code === '23505') {
      const { data: raced } = await supabase
        .from('binders')
        .select('*')
        .eq('user_id', userId)
        .eq('system_key', SOLD_BINDER_KEY)
        .maybeSingle();
      return (raced as BinderRow) ?? null;
    }
    console.error('[binders] could not create Sold binder:', error.message);
    return null;
  }
  return data as BinderRow;
}

/** Remove the Sold binder when the user turns the preference off. */
export async function removeSoldBinder(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from('binders').delete().eq('user_id', userId).eq('system_key', SOLD_BINDER_KEY);
}

/**
 * Add cards to a manual binder, appended in the order supplied.
 * Already-present cards are skipped rather than reordered — re-adding a card
 * you already filed shouldn't yank it out of the position you put it in.
 */
export async function addCardsToBinder(
  supabase: SupabaseClient,
  binderId: string,
  cardIds: string[]
): Promise<number> {
  if (!cardIds.length) return 0;

  const { data: existing } = await supabase
    .from('binder_cards')
    .select('card_id, position')
    .eq('binder_id', binderId)
    .order('position', { ascending: false });

  const present = new Set((existing ?? []).map(r => r.card_id));
  const fresh = cardIds.filter(id => !present.has(id));
  if (!fresh.length) return 0;

  let cursor = positionAfterMax(existing?.[0]?.position);
  const rows = fresh.map(card_id => {
    const row = { binder_id: binderId, card_id, position: cursor };
    cursor = positionAfterMax(cursor);
    return row;
  });

  const { error } = await supabase.from('binder_cards').insert(rows);
  if (error) {
    console.error('[binders] add failed:', error.message);
    return 0;
  }
  return rows.length;
}

/**
 * Move a card within a binder, given the card it should land AFTER
 * (null = move to the front). Writes one row in the common case.
 *
 * Returns the new position, or null if the anchor was stale.
 */
export async function moveCardInBinder(
  supabase: SupabaseClient,
  binderId: string,
  cardId: string,
  afterCardId: string | null
): Promise<number | null> {
  const { data: ordered } = await supabase
    .from('binder_cards')
    .select('card_id, position')
    .eq('binder_id', binderId)
    .order('position', { ascending: true });

  if (!ordered?.length) return null;

  const neighbours = neighboursForDrop(ordered, cardId, afterCardId);
  if (!neighbours) return null;

  let position = positionBetween(neighbours);

  // Gap collapsed — renumber the binder evenly, then retry once against the
  // fresh spacing. Rare: needs ~30 consecutive inserts into the same gap.
  if (position === null) {
    console.warn(`[binders] rebalancing ${binderId} — position gap exhausted`);
    const fresh = rebalancedPositions(ordered.length);
    for (let i = 0; i < ordered.length; i++) {
      await supabase
        .from('binder_cards')
        .update({ position: fresh[i] })
        .eq('binder_id', binderId)
        .eq('card_id', ordered[i].card_id);
      ordered[i].position = fresh[i];
    }
    const retry = neighboursForDrop(ordered, cardId, afterCardId);
    position = retry ? positionBetween(retry) : null;
    if (position === null) return null;
  }

  const { error } = await supabase
    .from('binder_cards')
    .update({ position })
    .eq('binder_id', binderId)
    .eq('card_id', cardId);

  if (error) {
    console.error('[binders] move failed:', error.message);
    return null;
  }
  return position;
}
