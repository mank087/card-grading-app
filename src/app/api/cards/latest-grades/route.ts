import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSignedImageMap, pickDisplayUrls, type SignedImagePair } from '@/lib/signedUrlBatch'

/**
 * GET /api/cards/latest-grades
 *
 * Fetches the latest graded cards across ALL categories (Pokemon, Sports, MTG, Lorcana, Other)
 * Returns public cards with signed image URLs, ordered by most recently graded
 */
export async function GET(request: Request) {
  try {
    // Parse query params for limit (default 20, max 30)
    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '20')
    const limit = Math.min(Math.max(limitParam, 1), 30)
    // Optional comma-separated category filter for category landing pages.
    // Sports is spread across many category values (Baseball, Football,
    // Basketball, … plus a generic 'Sports'), hence a list rather than one
    // value. Omitted = all categories, the pre-existing behavior.
    const categories = (searchParams.get('categories') || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean)
      .slice(0, 20)

    // Fetch latest graded cards across all categories
    let query = supabaseAdmin
      .from('cards')
      .select(`
        id, serial, card_name, category, front_path, back_path, created_at,
        featured, pokemon_featured, card_set, release_date, manufacturer_name, card_number,
        conversational_decimal_grade, conversational_whole_grade,
        conversational_condition_label, conversational_card_info,
        dvg_decimal_grade,
        is_foil, foil_type, is_double_faced, mtg_rarity, holofoil,
        serial_numbering, rarity_tier, rarity_description,
        autographed, autograph_type, memorabilia_type,
        rookie_card, first_print_rookie
      `)
      .eq('visibility', 'public')
      .not('conversational_decimal_grade', 'is', null)

    if (categories.length > 0) {
      query = query.in('category', categories)
    }

    const { data: cards, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Latest Grades] Database error:', error)
      throw error
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [] }, { status: 200 })
    }

    // Create signed URLs for images. front_url/back_url are the ≤480px
    // thumbnails (this is a scrolling showcase strip, not a detail view); the
    // originals stay available as *_full_url. Cards graded before the thumbnail
    // backfill simply fall back to the original.
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path].filter(Boolean))

    let urlMap: Map<string, SignedImagePair>
    try {
      urlMap = await createSignedImageMap(supabaseAdmin.storage, 'cards', allPaths)
    } catch (signError) {
      console.error('[Latest Grades] Signed URL error:', signError)
      return NextResponse.json({
        cards: cards.map(card => ({
          ...card,
          front_url: null,
          back_url: null,
          front_full_url: null,
          back_full_url: null,
        }))
      }, { status: 200 })
    }

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      const front = pickDisplayUrls(urlMap, card.front_path)
      const back = pickDisplayUrls(urlMap, card.back_path)
      const enrichedCard: any = {
        ...card,
        front_url: front.display,
        back_url: back.display,
        front_full_url: front.full,
        back_full_url: back.full,
      }

      return enrichedCard
    })

    return NextResponse.json({ cards: cardsWithUrls }, { status: 200 })
  } catch (error) {
    console.error('[Latest Grades] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch latest grades', cards: [] },
      { status: 500 }
    )
  }
}
