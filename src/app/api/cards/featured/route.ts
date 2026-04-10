import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 50)

    // Fetch featured cards (public, admin-curated, graded)
    // Accept cards with grade in either the decimal column OR the grading JSON blob
    // (older cards may only have the grade inside conversational_grading JSON)
    // Includes all fields needed for label generation + grading details + pricing
    const { data: cards, error } = await supabaseAdmin
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
        rookie_card, first_print_rookie,
        dcm_price_estimate, scryfall_price_usd
      `)
      .eq('visibility', 'public')
      .eq('is_featured', true)
      .or('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching featured cards:', error)
      throw error
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [] }, { status: 200 })
    }

    // 🚀 PERFORMANCE: Batch create signed URLs (fast, single request)
    // Then modify URLs to use image transforms for egress optimization
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path])

    const { data: signedUrls, error: signError } = await supabaseAdmin.storage
      .from('cards')
      .createSignedUrls(allPaths, 60 * 60) // 1 hour expiry

    if (signError) {
      console.error('Error creating signed URLs:', signError)
      return NextResponse.json({
        cards: cards.map(card => ({ ...card, front_url: null, back_url: null }))
      }, { status: 200 })
    }

    // Build a map of path -> signedUrl for quick lookup
    // Note: Client-side Next.js Image component handles optimization
    const urlMap = new Map<string, string>()
    signedUrls?.forEach(item => {
      if (item.signedUrl && item.path) {
        urlMap.set(item.path, item.signedUrl)
      }
    })

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      const enrichedCard = {
        ...card,
        front_url: urlMap.get(card.front_path) || null,
        back_url: urlMap.get(card.back_path) || null
      };

      return enrichedCard;
    })

    return NextResponse.json({ cards: cardsWithUrls }, { status: 200 })
  } catch (error) {
    console.error('Error in featured cards API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch featured cards', cards: [] },
      { status: 500 }
    )
  }
}
