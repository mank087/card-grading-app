import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending' // pending, resolved, dismissed
    const severity = searchParams.get('severity') || 'all' // all, low, medium, high
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('card_flags')
      .select('*, flagged_by_admin:admin_users!card_flags_flagged_by_fkey(email, full_name)', { count: 'exact' })

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply severity filter
    if (severity !== 'all') {
      query = query.eq('severity', severity)
    }

    // Apply sorting (most recent first)
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: flags, error, count } = await query

    if (error) {
      throw error
    }

    // Get card details for each flag
    const cardIds = flags?.map(f => f.card_id).filter(Boolean) || []
    const { data: cards } = await supabase
      .from('cards')
      .select('id, category, front_image_url, conversational_decimal_grade, user_id')
      .in('id', cardIds)

    const cardMap: Record<string, any> = {}
    cards?.forEach(card => {
      cardMap[card.id] = card
    })

    // Get user emails for cards
    const userIds = cards?.map(c => c.user_id).filter(Boolean) || []
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds)

    const userMap: Record<string, string> = {}
    users?.forEach(user => {
      userMap[user.id] = user.email
    })

    // Enrich flag data
    const enrichedFlags = flags?.map(flag => ({
      ...flag,
      card: cardMap[flag.card_id] || null,
      user_email: cardMap[flag.card_id] ? userMap[cardMap[flag.card_id].user_id] : null
    }))

    return NextResponse.json({
      flags: enrichedFlags,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching flags:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
