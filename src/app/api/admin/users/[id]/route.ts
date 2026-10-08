import { NextRequest, NextResponse } from 'next/server'
import { clientIp, logAdminActivity, verifyAdminSession } from '@/lib/admin/adminAuth'
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
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's recent cards (displayed columns only; soft-deleted excluded).
    // ai_grading is a large blob, so it is not selected here — legacy rows
    // with no conversational_card_info get just its card-info part below.
    const { data: cards } = await supabaseAdmin
      .from('cards')
      .select('id, serial, card_name, category, created_at, conversational_decimal_grade, conversational_whole_grade, conversational_condition_label, conversational_card_info, featured, pokemon_featured, card_set, release_date, manufacturer_name, card_number')
      .eq('user_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const recentCards: Array<Record<string, any>> = (cards || []).map(c => ({ ...c, ai_grading: null }))
    const legacyIds = recentCards.filter(c => !c.conversational_card_info).map(c => c.id)
    if (legacyIds.length > 0) {
      const { data: legacyRows } = await supabaseAdmin
        .from('cards')
        .select('id, ai_grading')
        .in('id', legacyIds)
      for (const row of legacyRows || []) {
        const target = recentCards.find(c => c.id === row.id)
        const ai = row.ai_grading as Record<string, any> | null
        if (target && ai) {
          target.ai_grading = { 'Card Information': ai['Card Information'], card_info: ai.card_info }
        }
      }
    }

    // Get user statistics: exact head counts (no 1,000-row cap) and an average
    // paged over the narrow grade column in batches of 1,000.
    const [totalResult, gradedResult, authResult] = await Promise.all([
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .is('deleted_at', null),
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .is('deleted_at', null)
        .not('conversational_decimal_grade', 'is', null),
      supabaseAdmin.auth.admin.getUserById(id).catch(() => null),
    ])

    const totalCards = totalResult.count || 0
    const gradedCards = gradedResult.count || 0
    let gradeSum = 0
    let gradeRows = 0
    const PAGE = 1000
    for (let from = 0; from < gradedCards; from += PAGE) {
      const { data: gradePage, error: gradeError } = await supabaseAdmin
        .from('cards')
        .select('conversational_decimal_grade')
        .eq('user_id', id)
        .is('deleted_at', null)
        .not('conversational_decimal_grade', 'is', null)
        .order('id')
        .range(from, from + PAGE - 1)
      if (gradeError || !gradePage || gradePage.length === 0) break
      for (const row of gradePage) {
        const g = Number(row.conversational_decimal_grade)
        if (g) { gradeSum += g; gradeRows++ }
      }
      if (gradePage.length < PAGE) break
    }
    const avgGrade = gradeRows > 0 ? gradeSum / gradeRows : 0

    return NextResponse.json({
      user: {
        ...user,
        last_active: authResult?.data?.user?.last_sign_in_at ?? null,
        is_suspended: false // Will update when we add suspended_at field
      },
      statistics: {
        total_cards: totalCards,
        graded_cards: gradedCards,
        average_grade: Math.round(avgGrade * 10) / 10
      },
      recent_cards: recentCards
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
      await logAdminActivity(admin.id, admin.email, 'suspend_user', 'user', id, { reason }, clientIp(request))

      return NextResponse.json({
        message: 'User suspended successfully',
        note: 'To fully implement suspension, add suspended_at TIMESTAMPTZ field to users table'
      }, { status: 200 })
    } else if (action === 'activate') {
      // Log the activation action
      await logAdminActivity(admin.id, admin.email, 'activate_user', 'user', id, { reason }, clientIp(request))

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

    // Reason comes in the JSON body (kept out of URLs/access logs); the query
    // param is still read for older clients.
    const body = await request.json().catch(() => null)
    const bodyReason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const reason = bodyReason || request.nextUrl.searchParams.get('reason') || 'No reason provided'

    // Delete user's cards first
    const { error: cardsError } = await supabaseAdmin
      .from('cards')
      .delete()
      .eq('user_id', id)

    if (cardsError) {
      console.error('Error deleting user cards:', cardsError)
    }

    // Delete user credits
    const { error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .delete()
      .eq('user_id', id)

    if (creditsError) {
      console.error('Error deleting user credits:', creditsError)
    }

    // Delete credit transactions
    const { error: transactionsError } = await supabaseAdmin
      .from('credit_transactions')
      .delete()
      .eq('user_id', id)

    if (transactionsError) {
      console.error('Error deleting credit transactions:', transactionsError)
    }

    // Delete from profiles table
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    if (profilesError) {
      console.error('Error deleting user profile:', profilesError)
    }

    // Delete from public.users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)

    if (userError) {
      console.error('Error deleting from users table:', userError)
    }

    // Delete from auth.users (this is the critical one for allowing re-registration)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      console.error('Error deleting from auth.users:', authError)
      throw new Error(`Failed to delete user from auth: ${authError.message}`)
    }

    // Log the deletion
    await logAdminActivity(admin.id, admin.email, 'delete_user', 'user', id, { reason }, clientIp(request))

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
