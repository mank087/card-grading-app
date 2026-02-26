import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

// Initialize storage client for signed URLs
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || 'all'
    const graded = searchParams.get('graded') || 'all' // all, graded, ungraded
    const featured = searchParams.get('featured') || 'all' // all, featured, not_featured
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const offset = (page - 1) * limit

    // Build query with all fields needed for collection-style display
    // Matches My Collection page fields for consistent display
    let query = supabaseAdmin
      .from('cards')
      .select(`
        id,
        user_id,
        serial,
        card_name,
        category,
        conversational_decimal_grade,
        conversational_whole_grade,
        conversational_condition_label,
        conversational_card_info,
        conversational_grading,
        ai_grading,
        featured,
        pokemon_featured,
        card_set,
        release_date,
        manufacturer_name,
        card_number,
        front_path,
        back_path,
        visibility,
        is_featured,
        created_at,
        dvg_decimal_grade,
        dcm_grade_whole,
        grade_numeric,
        ebay_price_median,
        ebay_price_listing_count,
        ebay_price_updated_at,
        is_foil,
        scryfall_price_usd,
        scryfall_price_usd_foil,
        dcm_price_estimate,
        dcm_cached_prices
      `, { count: 'exact' })

    // Apply category filter (consolidate sports subcategories)
    if (category === 'Sports') {
      query = query.in('category', ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'])
    } else if (category !== 'all') {
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

    // Apply search filter (search across multiple fields including user email)
    if (search) {
      // Check if search looks like an email - look up matching user IDs
      let emailUserIds: string[] = []
      if (search.includes('@') || search.includes('.')) {
        const { data: matchedUsers } = await supabaseAdmin
          .from('users')
          .select('id')
          .ilike('email', `%${search}%`)
          .limit(50)
        emailUserIds = matchedUsers?.map(u => u.id) || []
      }

      // Build OR filter with card fields + optional user_id match
      const cardFieldFilters = `card_name.ilike.%${search}%,serial.ilike.%${search}%,featured.ilike.%${search}%,card_set.ilike.%${search}%,manufacturer_name.ilike.%${search}%,card_number.ilike.%${search}%,pokemon_featured.ilike.%${search}%`
      if (emailUserIds.length > 0) {
        query = query.or(`${cardFieldFilters},user_id.in.(${emailUserIds.join(',')})`)
      } else {
        query = query.or(cardFieldFilters)
      }
    }

    // Apply sorting - map frontend column names to database fields
    const sortFieldMap: Record<string, string> = {
      'name': 'card_name',
      'series': 'card_set',
      'year': 'release_date',
      'grade': 'conversational_decimal_grade',
      'date': 'created_at',
      'price': 'dcm_price_estimate',
      'visibility': 'visibility',
      'created_at': 'created_at',
    }
    const dbSortField = sortFieldMap[sortBy] || 'created_at'
    query = query.order(dbSortField, { ascending: sortOrder === 'asc', nullsFirst: false })

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

    // Generate signed URLs for card images (batch operation)
    const storageClient = createClient(supabaseUrl, supabaseServiceKey)
    const frontPaths = cards?.filter(c => c.front_path).map(c => c.front_path) || []

    const signedUrlMap: Record<string, string> = {}
    if (frontPaths.length > 0) {
      // Generate signed URLs in batch (1 hour expiry)
      const { data: signedUrls } = await storageClient.storage
        .from('cards')
        .createSignedUrls(frontPaths, 3600)

      signedUrls?.forEach((item) => {
        if (item.signedUrl && item.path) {
          signedUrlMap[item.path] = item.signedUrl
        }
      })
    }

    // Enrich card data with user email, signed URL, and extract grade from JSON if needed
    const enrichedCards = cards?.map(card => {
      const enrichedCard: any = {
        ...card,
        user_email: userMap[card.user_id] || 'Unknown',
        front_url: card.front_path ? signedUrlMap[card.front_path] || null : null,
      }

      // If conversational_grading exists, parse it and extract grade if missing
      // This matches the My Collection API enrichment logic
      if (card.conversational_grading && !card.conversational_decimal_grade) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading

          // Extract grade from JSON structure
          const grade = parsed.grading_passes?.averaged_rounded?.final ?? parsed.final_grade?.decimal_grade
          if (grade !== undefined && grade !== null) {
            enrichedCard.conversational_decimal_grade = grade
            enrichedCard.conversational_whole_grade = Math.floor(grade)
          }

          // Extract condition label if missing
          if (!card.conversational_condition_label && parsed.final_grade?.condition_label) {
            enrichedCard.conversational_condition_label = parsed.final_grade.condition_label
          }
        } catch (e) {
          // Parsing failed, continue with original data
        }
      }

      return enrichedCard
    })

    // Get category stats using count queries (avoids Supabase default 1000 row limit)
    const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports']
    const allCategories = [...sportCategories, 'Pokemon', 'MTG', 'Lorcana', 'One Piece', 'Other']

    const [totalResult, gradedResult, ...categoryResults] = await Promise.all([
      supabaseAdmin.from('cards').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('cards').select('*', { count: 'exact', head: true }).not('conversational_decimal_grade', 'is', null),
      ...allCategories.map(cat =>
        supabaseAdmin.from('cards').select('*', { count: 'exact', head: true }).eq('category', cat)
      )
    ])

    // Build category counts and consolidate sports
    const consolidatedByCategory: Record<string, number> = {}
    let sportsTotal = 0
    allCategories.forEach((cat, i) => {
      const catCount = categoryResults[i].count || 0
      if (sportCategories.includes(cat)) {
        sportsTotal += catCount
      } else {
        consolidatedByCategory[cat] = catCount
      }
    })
    if (sportsTotal > 0) {
      consolidatedByCategory['Sports'] = sportsTotal
    }

    const stats = {
      total: totalResult.count || 0,
      graded: gradedResult.count || 0,
      byCategory: consolidatedByCategory
    }

    return NextResponse.json({
      cards: enrichedCards,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      },
      stats
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching cards:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
