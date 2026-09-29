import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifyAuth } from '@/lib/serverAuth'
import { isUuid } from '@/lib/uuid'
import { isMissingColumnError } from '@/lib/cards/ownership'
import { softDeleteOwnedCard } from '@/lib/cards/softDeleteCard'

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
 * The logic lives in src/lib/cards/softDeleteCard.ts (shared with the legacy
 * per-category DELETE routes).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Auth, ownership, sold lock and the soft-delete write all live in the
    // shared helper so the legacy per-category DELETE routes can't drift.
    const result = await softDeleteOwnedCard(request, id)
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status })
    }
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
