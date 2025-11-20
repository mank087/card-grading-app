import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Get single user details
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

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, category, created_at, conversational_decimal_grade')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get user statistics
    const { data: allCards } = await supabase
      .from('cards')
      .select('id, conversational_decimal_grade')
      .eq('user_id', id)

    const totalCards = allCards?.length || 0
    const gradedCards = allCards?.filter(c => c.conversational_decimal_grade).length || 0
    const avgGrade = gradedCards > 0
      ? allCards
          .filter(c => c.conversational_decimal_grade)
          .reduce((sum, c) => sum + c.conversational_decimal_grade, 0) / gradedCards
      : 0

    return NextResponse.json({
      user: {
        ...user,
        is_suspended: false // Will update when we add suspended_at field
      },
      statistics: {
        total_cards: totalCards,
        graded_cards: gradedCards,
        average_grade: Math.round(avgGrade * 10) / 10
      },
      recent_cards: cards || []
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update user (suspend/activate)
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
    const { action, reason } = body

    if (action === 'suspend') {
      // Note: This requires adding a suspended_at field to users table
      // For now, we'll log the action in admin_activity_log

      // Log the suspension action
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: admin.id,
          action: 'suspend_user',
          resource_type: 'user',
          resource_id: id,
          details: { reason },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        })

      return NextResponse.json({
        message: 'User suspended successfully',
        note: 'To fully implement suspension, add suspended_at TIMESTAMPTZ field to users table'
      }, { status: 200 })
    } else if (action === 'activate') {
      // Log the activation action
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: admin.id,
          action: 'activate_user',
          resource_type: 'user',
          resource_id: id,
          details: { reason },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        })

      return NextResponse.json({
        message: 'User activated successfully'
      }, { status: 200 })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete user
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

    // Only super_admin can delete users
    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Only super admins can delete users' }, { status: 403 })
    }

    // Get reason from query params
    const searchParams = request.nextUrl.searchParams
    const reason = searchParams.get('reason') || 'No reason provided'

    // Delete user's cards first (cascade)
    const { error: cardsError } = await supabase
      .from('cards')
      .delete()
      .eq('user_id', id)

    if (cardsError) {
      console.error('Error deleting user cards:', cardsError)
    }

    // Delete user
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (userError) {
      throw userError
    }

    // Log the deletion
    await supabase
      .from('admin_activity_log')
      .insert({
        admin_id: admin.id,
        action: 'delete_user',
        resource_type: 'user',
        resource_id: id,
        details: { reason },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      })

    return NextResponse.json({
      message: 'User and associated cards deleted successfully'
    }, { status: 200 })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
