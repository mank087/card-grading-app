import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

    // Fetch latest graded cards across all categories
    const { data: cards, error } = await supabaseAdmin
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
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Latest Grades] Database error:', error)
      throw error
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [] }, { status: 200 })
    }

    // Create signed URLs for images
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path].filter(Boolean))

    const { data: signedUrls, error: signError } = await supabaseAdmin.storage
      .from('cards')
      .createSignedUrls(allPaths, 60 * 60) // 1 hour expiry

    if (signError) {
      console.error('[Latest Grades] Signed URL error:', signError)
      return NextResponse.json({
        cards: cards.map(card => ({ ...card, front_url: null, back_url: null }))
      }, { status: 200 })
    }

    // Build a map of path -> signedUrl for quick lookup
    // Note: Client-side Next.js Image component handles optimization
    const urlMap = new Map<string, string>()
    signedUrls?.forEach(item => {
      if (item.signedUrl) {
        urlMap.set(item.path, item.signedUrl)
      }
    })

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      const enrichedCard: any = {
        ...card,
        front_url: card.front_path ? urlMap.get(card.front_path) || null : null,
        back_url: card.back_path ? urlMap.get(card.back_path) || null : null
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
