import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifyAuth } from '@/lib/serverAuth'
import { isUuid } from '@/lib/uuid'
import { isMissingColumnError, isRecordLocked } from '@/lib/cards/ownership'

/**
 * DELETE /api/cards/[id] — soft delete.
 *
 * This used to remove the row and purge both images from storage in the same
 * request. That was unrecoverable and it also destroyed things that weren't
 * the owner's alone to destroy: the printed slab's QR points at
 * /verify/<serial>, and ebay_listings.card_id cascades, so the sale record
 * went with it.
 *
 * Now it stamps deleted_at. The card leaves every view, the images stay put,
 * and POST (restore) brings it back. A retention sweep can hard-delete and
 * purge images later, once the decision has had time to be regretted.
 *
 * Sold cards can't be deleted at all — see the lock in Phase 2.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Verify authentication - get user ID from token, not query params
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const userId = auth.userId

    const supabase = supabaseServer()

    // Get card to verify ownership
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, user_id, serial, front_path, back_path, ownership_status')
      .eq('id', id)
      .single()

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Verify user owns the card
    if (card.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized - You can only delete your own cards' }, { status: 403 })
    }

    // A sold card belongs to the record now, not just to the seller — the
    // buyer verifies it by scanning the label.
    if (isRecordLocked(card)) {
      return NextResponse.json(
        {
          error:
            "This card is marked as sold and can't be deleted — the buyer verifies " +
            "it by scanning the label on the slab. Move it back to your collection " +
            "with \"Still mine\" first if you really need to remove it.",
          code: 'card_sold_locked',
        },
        { status: 423 }
      )
    }

    // Soft delete. Images are deliberately NOT purged — that's what made the
    // old behaviour unrecoverable. A retention sweep handles them later.
    //
    // visibility is forced private in the same write. Sixty-odd read paths
    // touch the cards table; rather than teach every one of them about
    // deleted_at, this reuses the public-visibility gate they ALREADY have, so
    // a deleted card stops being publicly reachable everywhere at once —
    // including the eight card-detail routes and /verify. The owner still sees
    // it (owner reads bypass the gate), which is what restore needs.
    const { error: deleteError } = await supabase
      .from('cards')
      .update({ deleted_at: new Date().toISOString(), visibility: 'private' })
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      // Migration window: fall back to the old hard delete so the button
      // doesn't simply stop working before the columns land.
      if (isMissingColumnError(deleteError)) {
        console.warn('[Delete Card] deleted_at column missing — falling back to hard delete.')
        try {
          if (card.front_path) await supabase.storage.from('cards').remove([card.front_path])
          if (card.back_path) await supabase.storage.from('cards').remove([card.back_path])
        } catch (storageError) {
          console.warn('Failed to delete card images from storage:', storageError)
        }
        const { error: hardErr } = await supabase.from('cards').delete().eq('id', id)
        if (hardErr) {
          console.error('Error deleting card from database:', hardErr)
          return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
        }
        return NextResponse.json({ message: 'Card deleted successfully', restorable: false }, { status: 200 })
      }
      console.error('Error deleting card from database:', deleteError)
      return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
    }

    console.log(`[Delete Card] ${card.serial} soft-deleted (restorable)`)
    return NextResponse.json({
      message: 'Card deleted successfully',
      restorable: true,
    }, { status: 200 })
  } catch (error) {
    console.error('Error deleting card:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cards/[id] — restore a soft-deleted card.
 *
 * Powers the "Undo" on the delete toast and the Deleted view. Only the owner
 * can restore, and only while the row still exists (a retention sweep that has
 * already hard-deleted it is genuinely gone).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const supabase = supabaseServer()
    const { data: restored, error } = await supabase
      .from('cards')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select('id, serial, ownership_status')
      .maybeSingle()

    if (error) {
      if (isMissingColumnError(error)) {
        return NextResponse.json(
          { error: 'Restore is not available yet.' },
          { status: 503 }
        )
      }
      console.error('Error restoring card:', error)
      return NextResponse.json({ error: 'Failed to restore card' }, { status: 500 })
    }
    if (!restored) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Note: visibility stays private after a restore. The delete forced it
    // private and we don't record what it was before, so the safe direction is
    // to leave it hidden and let the owner re-share deliberately.
    console.log(`[Restore Card] ${restored.serial} restored (visibility left private)`)
    return NextResponse.json({
      message: 'Card restored',
      card: restored,
      note: 'The card is private — make it public again if you want to share it.',
    })
  } catch (error) {
    console.error('Error restoring card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
