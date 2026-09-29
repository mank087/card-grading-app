/**
 * The one owner-delete for a graded card. Every DELETE route that removes a
 * card from a user's collection goes through here — /api/cards/[id] and the
 * legacy per-category routes (/api/pokemon/[id], /api/mtg/[id], ...).
 *
 * The per-category routes used to hard-delete the row and purge both images
 * with no sold lock. That was unrecoverable, it broke /verify/<serial> for
 * buyers holding the slab, and ebay_listings.card_id cascaded so the sale
 * record went with it. See src/lib/cards/ownership.ts.
 *
 * What this does:
 *  1. verifies the caller from the JWT (never a client-supplied user id),
 *  2. checks the card exists and belongs to them,
 *  3. refuses sold cards (423, code card_sold_locked),
 *  4. soft-deletes: stamps deleted_at and forces visibility private in one
 *     write. Images are NOT purged — POST /api/cards/[id] restores.
 */
import type { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifyAuth } from '@/lib/serverAuth'
import { isUuid } from '@/lib/uuid'
import { isRecordLocked } from '@/lib/cards/ownership'

export type SoftDeleteResult =
  | { ok: true; cardId: string; serial: string | null }
  | { ok: false; status: number; body: { error: string; code?: string } }

export const SOLD_LOCKED_DELETE_ERROR =
  "This card is marked as sold and can't be deleted — the buyer verifies " +
  "it by scanning the label on the slab. Move it back to your collection " +
  "with \"Still mine\" first if you really need to remove it."

export async function softDeleteOwnedCard(
  request: NextRequest,
  cardId: string
): Promise<SoftDeleteResult> {
  if (!isUuid(cardId)) {
    return { ok: false, status: 404, body: { error: 'Card not found' } }
  }

  // Verify authentication - get user ID from token, not query params
  const auth = await verifyAuth(request)
  if (!auth.authenticated || !auth.userId) {
    return { ok: false, status: 401, body: { error: auth.error || 'Authentication required' } }
  }
  const userId = auth.userId

  const supabase = supabaseServer()

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id, user_id, serial, ownership_status')
    .eq('id', cardId)
    .single()

  if (cardError || !card) {
    return { ok: false, status: 404, body: { error: 'Card not found' } }
  }

  if (card.user_id !== userId) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Unauthorized - You can only delete your own cards' },
    }
  }

  // A sold card belongs to the record now, not just to the seller — the
  // buyer verifies it by scanning the label.
  if (isRecordLocked(card)) {
    return {
      ok: false,
      status: 423,
      body: { error: SOLD_LOCKED_DELETE_ERROR, code: 'card_sold_locked' },
    }
  }

  // Soft delete. visibility is forced private in the same write: sixty-odd
  // read paths already gate public access on visibility, so a deleted card
  // stops being publicly reachable everywhere at once. The owner still sees it
  // (owner reads bypass the gate), which is what restore needs.
  //
  // No hard-delete fallback on error: any trigger raising 42703 during this
  // UPDATE would otherwise turn a restorable delete into an unrecoverable one.
  // Open grade reviews are closed by the DB trigger
  // close_grade_reviews_on_card_change in this same write.
  const { error: deleteError } = await supabase
    .from('cards')
    .update({ deleted_at: new Date().toISOString(), visibility: 'private' })
    .eq('id', cardId)
    .eq('user_id', userId)

  if (deleteError) {
    console.error('Error deleting card from database:', deleteError)
    return { ok: false, status: 500, body: { error: 'Failed to delete card' } }
  }

  console.log(`[Delete Card] ${card.serial} soft-deleted (restorable)`)
  return { ok: true, cardId, serial: card.serial ?? null }
}
