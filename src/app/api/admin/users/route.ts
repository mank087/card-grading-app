import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/uuid'

const SORTABLE_COLUMNS = new Set(['created_at', 'updated_at', 'email'])

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
    // Capped: per-user card counts and auth lookups fan out per row.
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100)
    const search = searchParams.get('search') || ''
    // Whitelist: sortBy goes straight into .order(), so an arbitrary column
    // name would 500 the page (or sort by a column the list doesn't show).
    const requestedSort = searchParams.get('sortBy') || 'created_at'
    const sortBy = SORTABLE_COLUMNS.has(requestedSort) ? requestedSort : 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const offset = (page - 1) * limit

    // Build query
    let query = supabaseAdmin
      .from('users')
      .select('id, email, created_at, updated_at', { count: 'exact' })

    // Apply search filter (a full user id matches exactly — grade reviews and
    // other admin pages link here with ?search=<id>)
    if (search) {
      query = isUuid(search.trim())
        ? query.eq('id', search.trim())
        : query.ilike('email', `%${search}%`)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: users, error, count } = await query

    if (error) {
      throw error
    }

    // Card counts (exact head count per user — fetching rows and counting in
    // JS capped at PostgREST's 1,000-row default) and last sign-in from auth
    // (users.updated_at is effectively signup time, not activity). Soft-deleted
    // cards are excluded. Both are bounded by the page size.
    const userIds = users?.map(u => u.id) || []
    const cardCountMap: Record<string, number> = {}
    const lastActiveMap: Record<string, string | null> = {}
    await Promise.all(userIds.map(async (userId) => {
      const [cardsResult, authResult] = await Promise.all([
        supabaseAdmin
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabaseAdmin.auth.admin.getUserById(userId).catch(() => null),
      ])
      cardCountMap[userId] = cardsResult.count || 0
      lastActiveMap[userId] = authResult?.data?.user?.last_sign_in_at ?? null
    }))

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
      last_active: lastActiveMap[user.id] ?? null,
      credits_balance: creditsMap[user.id] ?? 0,
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
