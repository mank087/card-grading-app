import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateLabelData, type CardForLabel } from '@/lib/labelDataGenerator'

/**
 * Backfill label_data for existing cards
 * POST /api/admin/backfill-labels
 *
 * Query params:
 * - limit: Number of cards to process per batch (default: 100)
 * - offset: Starting offset (default: 0)
 * - category: Filter by category (optional)
 * - force: Regenerate even if label_data exists (default: false)
 */
export async function POST(request: NextRequest) {
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
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const category = searchParams.get('category')
    const force = searchParams.get('force') === 'true'

    // Build query to fetch cards
    let query = supabaseAdmin
      .from('cards')
      .select(`
        id,
        category,
        serial,
        conversational_decimal_grade,
        conversational_whole_grade,
        conversational_condition_label,
        conversational_card_info,
        dvg_decimal_grade,
        card_name,
        card_set,
        card_number,
        featured,
        pokemon_featured,
        release_date,
        serial_numbering,
        rarity_tier,
        rarity_description,
        autographed,
        autograph_type,
        memorabilia_type,
        rookie_card,
        first_print_rookie,
        holofoil,
        is_foil,
        foil_type,
        is_double_faced,
        mtg_rarity,
        label_data
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Only fetch cards without label_data unless force=true
    if (!force) {
      query = query.is('label_data', null)
    }

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category)
    }

    // Only process graded cards
    query = query.not('conversational_decimal_grade', 'is', null)

    const { data: cards, error: fetchError } = await query

    if (fetchError) {
      throw fetchError
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        message: 'No cards to process',
        processed: 0,
        offset,
        hasMore: false
      }, { status: 200 })
    }

    // Process each card
    const results = {
      processed: 0,
      updated: 0,
      errors: [] as Array<{ cardId: string; error: string }>
    }

    for (const card of cards) {
      try {
        // Generate label data
        const labelData = generateLabelData(card as CardForLabel)

        // Update card with label_data
        const { error: updateError } = await supabaseAdmin
          .from('cards')
          .update({ label_data: labelData })
          .eq('id', card.id)

        if (updateError) {
          results.errors.push({ cardId: card.id, error: updateError.message })
        } else {
          results.updated++
        }
        results.processed++
      } catch (err) {
        results.errors.push({
          cardId: card.id,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        results.processed++
      }
    }

    // Check if there are more cards to process
    const { count } = await supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .not('conversational_decimal_grade', 'is', null)
      .is('label_data', null)

    return NextResponse.json({
      message: `Processed ${results.processed} cards, updated ${results.updated}`,
      processed: results.processed,
      updated: results.updated,
      errors: results.errors,
      offset,
      nextOffset: offset + limit,
      hasMore: (count || 0) > 0,
      remainingCount: count || 0
    }, { status: 200 })

  } catch (error) {
    console.error('Error backfilling labels:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * Get backfill status
 * GET /api/admin/backfill-labels
 */
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

    // Count total graded cards
    const { count: totalGraded } = await supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .not('conversational_decimal_grade', 'is', null)

    // Count cards with label_data
    const { count: withLabelData } = await supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .not('conversational_decimal_grade', 'is', null)
      .not('label_data', 'is', null)

    // Count cards without label_data
    const { count: withoutLabelData } = await supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .not('conversational_decimal_grade', 'is', null)
      .is('label_data', null)

    // Count by category
    const { data: byCategory } = await supabaseAdmin
      .from('cards')
      .select('category')
      .not('conversational_decimal_grade', 'is', null)
      .is('label_data', null)

    const categoryCounts: Record<string, number> = {}
    byCategory?.forEach(card => {
      const cat = card.category || 'Other'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    })

    return NextResponse.json({
      totalGradedCards: totalGraded || 0,
      cardsWithLabelData: withLabelData || 0,
      cardsNeedingBackfill: withoutLabelData || 0,
      percentComplete: totalGraded
        ? Math.round(((withLabelData || 0) / totalGraded) * 100)
        : 0,
      byCategory: categoryCounts
    }, { status: 200 })

  } catch (error) {
    console.error('Error getting backfill status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
