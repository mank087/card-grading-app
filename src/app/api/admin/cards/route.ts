import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import { createSignedImageMap, pickDisplayUrls, type SignedImagePair } from '@/lib/signedUrlBatch'
import { NON_SPORT_DB_CATEGORIES, SPORT_DB_CATEGORIES } from '@/lib/admin/cardCategories'

// Initialize storage client for signed URLs
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type CardStats = { total: number; graded: number; byCategory: Record<string, number> }

// The stat tiles are global (they ignore the list's filters) and cost a
// couple dozen exact counts, so they're cached per server instance for 60s
// instead of being recounted on every page/filter/search keystroke.
const STATS_TTL_MS = 60_000
let statsCache: { at: number; stats: CardStats } | null = null

async function getCardStats(): Promise<CardStats> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.stats

  // Count queries, not row fetches (avoids the default 1000-row limit).
  // Soft-deleted cards are excluded, matching the list.
  const allCategories = [...SPORT_DB_CATEGORIES, ...NON_SPORT_DB_CATEGORIES]
  const count = () => supabaseAdmin.from('cards').select('id', { count: 'exact', head: true }).is('deleted_at', null)
  const [totalResult, gradedResult, ...categoryResults] = await Promise.all([
    count(),
    count().not('conversational_decimal_grade', 'is', null),
    ...allCategories.map(cat => count().eq('category', cat)),
  ])

  // Build category counts and consolidate sports
  const byCategory: Record<string, number> = {}
  let sportsTotal = 0
  allCategories.forEach((cat, i) => {
    const catCount = categoryResults[i].count || 0
    if (SPORT_DB_CATEGORIES.includes(cat)) {
      sportsTotal += catCount
    } else {
      byCategory[cat] = catCount
    }
  })
  byCategory['Sports'] = sportsTotal

  const stats = {
    total: totalResult.count || 0,
    graded: gradedResult.count || 0,
    byCategory,
  }
  // Don't cache a failed round (all zeros from errors) for the full TTL.
  if (!totalResult.error) statsCache = { at: Date.now(), stats }
  return stats
}

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
        dcm_cached_prices,
        dcm_selected_product_id,
        identity_confirmed_revision,
        item_type
      `, { count: 'exact' })
      // Soft-deleted cards (owner or admin delete) leave the moderation list,
      // same as every other view; otherwise an admin delete looks like a no-op.
      .is('deleted_at', null)

    // Apply category filter (consolidate sports subcategories)
    if (category === 'Sports') {
      query = query.in('category', SPORT_DB_CATEGORIES)
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
    // Strip PostgREST filter syntax (`,` `(` `)`) and ilike wildcards so the
    // term can't break out of the .or() expression; same as label-lab/cards.
    const term = search.replace(/[,()%]/g, ' ').trim()
    if (term) {
      // Email partial match → user ids (always: "smith" should find
      // smith@example.com's cards too, not only terms containing @ or .)
      const { data: matchedUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', `%${term}%`)
        .limit(50)
      const emailUserIds = matchedUsers?.map(u => u.id) || []

      // Build OR filter with card fields (incl. the identified name/player in
      // conversational_card_info) + optional user_id match
      const cardFieldFilters = [
        'card_name', 'serial', 'featured', 'card_set', 'manufacturer_name', 'card_number', 'pokemon_featured',
        'conversational_card_info->>card_name', 'conversational_card_info->>player_or_character',
      ].map(field => `${field}.ilike.%${term}%`).join(',')
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

    // The admin card table renders a ~48px row thumbnail, so front_url is the
    // ≤480px thumb; front_full_url keeps the original for the row's detail link.
    let signedUrlMap = new Map<string, SignedImagePair>()
    if (frontPaths.length > 0) {
      try {
        signedUrlMap = await createSignedImageMap(storageClient.storage, 'cards', frontPaths)
      } catch (signErr) {
        console.error('[admin/cards] Error creating signed URLs:', signErr)
      }
    }

    // The conversational_grading / ai_grading blobs are only display fallbacks
    // for rows with no stored grade or no conversational_card_info (legacy and
    // in-progress cards), so they're fetched for just those ids, and only the
    // parts the page reads are kept.
    const legacyMap = new Map<string, { conversational_grading: any; ai_grading: any }>()
    const legacyIds = (cards || [])
      .filter(c => c.conversational_decimal_grade === null || c.conversational_decimal_grade === undefined || !c.conversational_card_info)
      .map(c => c.id)
    if (legacyIds.length > 0) {
      const { data: legacyRows } = await supabaseAdmin
        .from('cards')
        .select('id, conversational_grading, ai_grading')
        .in('id', legacyIds)
      for (const row of legacyRows || []) {
        const ai = row.ai_grading as Record<string, any> | null
        legacyMap.set(row.id, {
          conversational_grading: row.conversational_grading,
          ai_grading: ai ? {
            'Card Information': ai['Card Information'],
            card_info: ai.card_info,
            recommended_grade: ai.recommended_grade,
          } : null,
        })
      }
    }

    // Enrich card data with user email, signed URL, and extract grade from JSON if needed
    const enrichedCards = cards?.map(card => {
      const legacy = legacyMap.get(card.id)
      const enrichedCard: any = {
        ...card,
        user_email: userMap[card.user_id] || 'Unknown',
        front_url: pickDisplayUrls(signedUrlMap, card.front_path).display,
        front_full_url: pickDisplayUrls(signedUrlMap, card.front_path).full,
      }

      enrichedCard.ai_grading = legacy?.ai_grading ?? null

      // If conversational_grading exists, parse it and extract grade if missing
      // This matches the My Collection API enrichment logic
      if (legacy?.conversational_grading && !card.conversational_decimal_grade) {
        try {
          const parsed = typeof legacy.conversational_grading === 'string'
            ? JSON.parse(legacy.conversational_grading)
            : legacy.conversational_grading

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

    const stats = await getCardStats()

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
