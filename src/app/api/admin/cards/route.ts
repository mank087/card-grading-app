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
    const category = searchParams.get('category') || 'all'
    const graded = searchParams.get('graded') || 'all' // all, graded, ungraded
    const featured = searchParams.get('featured') || 'all' // all, featured, not_featured
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const offset = (page - 1) * limit

    // Build query with all fields needed for collection-style display
    let query = supabaseAdmin
      .from('cards')
      .select(`
        id,
        user_id,
        serial,
        card_name,
        category,
        conversational_decimal_grade,
        conversational_condition_label,
        conversational_card_info,
        ai_grading,
        featured,
        card_set,
        release_date,
        manufacturer_name,
        card_number,
        front_path,
        visibility,
        is_featured,
        created_at
      `, { count: 'exact' })

    // Apply category filter
    if (category !== 'all') {
      query = query.eq('category', category)
    }

    // Apply graded filter
    if (graded === 'graded') {
      query = query.not('conversational_decimal_grade', 'is', null)
    } else if (graded === 'ungraded') {
      query = query.is('conversational_decimal_grade', null)
    }

    // Apply featured filter
    if (featured === 'featured') {
      query = query.eq('is_featured', true)
    } else if (featured === 'not_featured') {
      query = query.or('is_featured.is.null,is_featured.eq.false')
    }

    // Apply search filter (search by card name, serial, or featured player)
    if (search) {
      // Search across multiple text fields - can't use ilike on UUID
      query = query.or(`card_name.ilike.%${search}%,serial.ilike.%${search}%,featured.ilike.%${search}%`)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: cards, error, count } = await query

    if (error) {
      throw error
    }

    // Get user emails for each card
    const userIds = cards?.map(c => c.user_id).filter(Boolean) || []
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', userIds)

    const userMap: Record<string, string> = {}
    users?.forEach(user => {
      userMap[user.id] = user.email
    })

    // Enrich card data
    const enrichedCards = cards?.map(card => ({
      ...card,
      user_email: userMap[card.user_id] || 'Unknown'
    }))

    return NextResponse.json({
      cards: enrichedCards,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching cards:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
