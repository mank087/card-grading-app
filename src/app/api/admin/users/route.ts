import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const status = searchParams.get('status') || 'all' // all, active, suspended

    const offset = (page - 1) * limit

    // Build query
    let query = supabaseAdmin
      .from('users')
      .select('id, email, created_at, updated_at', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    // Apply status filter
    // Note: suspended_at column doesn't exist yet in users table
    // Uncomment when suspension feature is added
    // if (status === 'active') {
    //   query = query.is('suspended_at', null)
    // } else if (status === 'suspended') {
    //   query = query.not('suspended_at', 'is', null)
    // }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: users, error, count } = await query

    if (error) {
      throw error
    }

    // Get card counts for each user
    const userIds = users?.map(u => u.id) || []
    const { data: cardCounts } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .in('user_id', userIds)

    const cardCountMap: Record<string, number> = {}
    cardCounts?.forEach(card => {
      cardCountMap[card.user_id] = (cardCountMap[card.user_id] || 0) + 1
    })

    // Get credits for each user
    const { data: userCredits } = await supabaseAdmin
      .from('user_credits')
      .select('user_id, balance')
      .in('user_id', userIds)

    const creditsMap: Record<string, number> = {}
    userCredits?.forEach(credit => {
      creditsMap[credit.user_id] = credit.balance
    })

    // Enrich user data
    const enrichedUsers = users?.map(user => ({
      ...user,
      card_count: cardCountMap[user.id] || 0,
      credits_balance: creditsMap[user.id] ?? 0,
      is_suspended: false // Will be determined by suspended_at field when we add it
    }))

    return NextResponse.json({
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
