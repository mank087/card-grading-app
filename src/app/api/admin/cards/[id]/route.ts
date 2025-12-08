import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabase } from '@/lib/supabaseClient'

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
      .single()

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
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: admin.id,
          action: 'flag_card',
          resource_type: 'card',
          resource_id: id,
          details: { reason, severity },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        })

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
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: admin.id,
          action: 'unflag_card',
          resource_type: 'card',
          resource_id: id,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        })

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

// Delete card
export async function DELETE(
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

    // Get reason from query params
    const searchParams = request.nextUrl.searchParams
    const reason = searchParams.get('reason') || 'No reason provided'

    // Delete card
    const { error: cardError } = await supabase
      .from('cards')
      .delete()
      .eq('id', id)

    if (cardError) {
      throw cardError
    }

    // Log the deletion
    await supabase
      .from('admin_activity_log')
      .insert({
        admin_id: admin.id,
        action: 'delete_card',
        resource_type: 'card',
        resource_id: id,
        details: { reason },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      })

    return NextResponse.json({
      message: 'Card deleted successfully'
    }, { status: 200 })
  } catch (error) {
    console.error('Error deleting card:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
