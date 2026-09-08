import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSignedImageMap, pickDisplayUrls, type SignedImagePair } from '@/lib/signedUrlBatch'
import { stripSensitiveCardFields } from '@/lib/cards/publicCardShape'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Paginated by default — a public collection page used to sign and ship
    // every card's full-resolution front AND back on first paint. ?all=1 keeps
    // the old unbounded shape for any caller we did not find.
    const unbounded = searchParams.get('all') === '1'
    const limit = unbounded
      ? null
      : Math.min(Math.max(parseInt(searchParams.get('limit') || '60', 10) || 60, 1), 200)
    const offset = unbounded
      ? 0
      : Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

    // Look up user by username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name')
      .eq('username', username.toLowerCase())
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (unbounded) {
      console.warn(`[public-collection] unbounded fetch (username=${profile.username})`)
    }

    // Collection-wide stats (average grade, distribution, category breakdown)
    // must stay exact under pagination, so they are computed from a separate
    // two-column scan. Two numbers per row — a rounding error next to the image
    // bytes this endpoint used to ship.
    const { data: statRows } = await supabaseAdmin
      .from('cards')
      .select('conversational_decimal_grade, category')
      .eq('user_id', profile.id)
      .eq('visibility', 'public')
      .or('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')

    // Fetch public cards for this user (same fields as featured API)
    let listQuery = supabaseAdmin
      .from('cards')
      .select(`
        id, serial, card_name, category, front_path, back_path, created_at,
        featured, pokemon_featured, card_set, release_date, manufacturer_name, card_number,
        conversational_decimal_grade, conversational_whole_grade,
        conversational_condition_label, conversational_card_info,
        conversational_sub_scores, conversational_weighted_sub_scores,
        conversational_image_confidence, conversational_limiting_factor,
        dvg_decimal_grade,
        is_foil, foil_type, is_double_faced, mtg_rarity, holofoil,
        serial_numbering, rarity_tier, rarity_description,
        autographed, autograph_type, memorabilia_type,
        rookie_card, first_print_rookie
      `)
      .eq('user_id', profile.id)
      .eq('visibility', 'public')
      .or('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')
      .order('created_at', { ascending: false })

    if (limit !== null) {
      listQuery = listQuery.range(offset, offset + limit - 1)
    }

    const { data: cards, error } = await listQuery

    if (error) {
      console.error('[Public Collection] Error fetching cards:', error)
      throw error
    }

    // Stats are computed over the WHOLE public collection, not the current page,
    // so paginating the list does not quietly change the numbers on the page.
    const grades = (statRows ?? [])
      .map((c: any) => c.conversational_decimal_grade)
      .filter((g: any) => g != null && !isNaN(g)) as number[]

    const totalCards = (statRows ?? []).length
    const hasMore = limit === null ? false : offset + (cards?.length ?? 0) < totalCards

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        profile: { username: profile.username, displayName: profile.display_name },
        cards: [],
        stats: { totalCards, avgGrade: 0, gradeDistribution: {} },
        total: totalCards,
        limit,
        offset,
        hasMore: false,
      })
    }

    // Batch create signed URLs — chunked (Supabase rejects >1000 paths per request;
    // public collections >500 cards used to render with no images).
    // front_url/back_url are thumbnails where one exists; *_full_url keeps the
    // original for the lightbox and any download.
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path])
    let urlMap = new Map<string, SignedImagePair>()
    try {
      urlMap = await createSignedImageMap(supabaseAdmin.storage, 'cards', allPaths)
    } catch (signError) {
      console.error('[Public Collection API] Error creating signed URLs:', signError)
    }

    // Enrich cards (same logic as featured API)
    const cardsWithUrls = cards.map(card => {
      const front = pickDisplayUrls(urlMap, card.front_path)
      const back = pickDisplayUrls(urlMap, card.back_path)
      const enrichedCard: any = {
        ...stripSensitiveCardFields(card),
        front_url: front.display,
        back_url: back.display,
        front_full_url: front.full,
        back_full_url: back.full,
      }

      return enrichedCard
    })

    const avgGrade = grades.length > 0
      ? Math.round((grades.reduce((a: number, b: number) => a + b, 0) / grades.length) * 10) / 10
      : 0

    const gradeDistribution: Record<string, number> = {}
    grades.forEach(g => {
      const whole = Math.round(g)
      gradeDistribution[whole] = (gradeDistribution[whole] || 0) + 1
    })

    // Count category breakdown
    const categoryBreakdown: Record<string, number> = {}
    ;(statRows ?? []).forEach((c: any) => {
      const cat = c.category || 'Other'
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
    })

    return NextResponse.json({
      profile: { username: profile.username, displayName: profile.display_name },
      cards: cardsWithUrls,
      total: totalCards,
      limit,
      offset,
      hasMore,
      stats: {
        totalCards,
        avgGrade,
        gradeDistribution,
        categoryBreakdown,
        highestGrade: grades.length > 0 ? Math.max(...grades) : 0,
        gem10Count: grades.filter(g => g === 10).length,
      },
    })
  } catch (error) {
    console.error('[Public Collection] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection', cards: [] },
      { status: 500 }
    )
  }
}
