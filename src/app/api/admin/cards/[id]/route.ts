import { NextRequest, NextResponse } from 'next/server'
import { clientIp, logAdminActivity, verifyAdminSession } from '@/lib/admin/adminAuth'
// Service-role client. This used the ANON client server-side, which under RLS
// ("Users can delete own cards": auth.uid() = user_id) matched 0 rows on
// DELETE and still answered "deleted successfully"; card_flags writes were
// equally at the mercy of anon policies.
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/uuid'

// Get single card details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get card - admin detail view needs most fields for full inspection
    // Keep SELECT * here since admins need access to all card data for moderation
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single()

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('id, email, created_at')
      .eq('id', card.user_id)
      .single()

    // Check if card is flagged
    const { data: flag } = await supabase
      .from('card_flags')
      .select('*')
      .eq('card_id', id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      card: {
        ...card,
        user: user || null,
        is_flagged: !!flag,
        flag_details: flag || null
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching card:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Flag/unflag card
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, reason, severity } = body

    if (action === 'flag') {
      // Create a flag
      const { error: flagError } = await supabase
        .from('card_flags')
        .insert({
          card_id: id,
          flagged_by: admin.id,
          reason: reason || 'No reason provided',
          severity: severity || 'medium',
          status: 'pending'
        })

      if (flagError) {
        throw flagError
      }

      // Log the action
      await logAdminActivity(admin.id, admin.email, 'flag_card', 'card', id, { reason, severity }, clientIp(request))

      return NextResponse.json({
        message: 'Card flagged successfully'
      }, { status: 200 })
    } else if (action === 'unflag') {
      // Remove flags
      const { error: unflagError } = await supabase
        .from('card_flags')
        .update({ status: 'resolved', resolved_by: admin.id, resolved_at: new Date().toISOString() })
        .eq('card_id', id)
        .eq('status', 'pending')

      if (unflagError) {
        throw unflagError
      }

      // Log the action
      await logAdminActivity(admin.id, admin.email, 'unflag_card', 'card', id, {}, clientIp(request))

      return NextResponse.json({
        message: 'Card unflagged successfully'
      }, { status: 200 })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating card:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/cards/[id] (JSON body { reason }) — admin SOFT delete.
 *
 * Same write as the owner path (DELETE /api/cards/[id]): deleted_at + forced
 * private visibility, images kept, restorable. The DB trigger
 * close_grade_reviews_on_card_change closes any open grade review in the same
 * write. Unlike the owner path, sold cards are not refused: moderation can
 * need to pull one; the audit row records the ownership state.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Reason comes in the JSON body; the query param is read for older clients.
    const body = await request.json().catch(() => null)
    const bodyReason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const reason = bodyReason || request.nextUrl.searchParams.get('reason') || 'No reason provided'

    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('id, user_id, serial, visibility, ownership_status, deleted_at')
      .eq('id', id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    if (card.deleted_at) {
      return NextResponse.json({ message: 'Card was already deleted', already_deleted: true, restorable: true }, { status: 200 })
    }

    const { data: updated, error: deleteError } = await supabase
      .from('cards')
      .update({ deleted_at: new Date().toISOString(), visibility: 'private' })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
    if (deleteError) throw deleteError
    if (!updated?.length) {
      // Lost a race with another delete; nothing changed here.
      return NextResponse.json({ message: 'Card was already deleted', already_deleted: true, restorable: true }, { status: 200 })
    }

    await logAdminActivity(admin.id, admin.email, 'delete_card', 'card', id, {
      reason,
      soft_delete: true,
      serial: card.serial,
      owner_id: card.user_id,
      previous_visibility: card.visibility,
      ownership_status: card.ownership_status,
    }, clientIp(request))

    return NextResponse.json({ message: 'Card deleted successfully', restorable: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting card:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
