import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  try {
    // Fetch featured cards (public, graded, and marked as featured)
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select(`
        id,
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
        back_path,
        created_at,
        is_foil,
        foil_type,
        mtg_api_verified,
        mtg_rarity,
        mtg_set_code,
        card_language,
        scryfall_price_usd,
        scryfall_price_usd_foil
      `)
      .eq('visibility', 'public')
      .eq('is_featured', true)
      .not('conversational_decimal_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Error fetching featured cards:', error)
      throw error
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [] }, { status: 200 })
    }

    // 🚀 PERFORMANCE: Batch create signed URLs instead of one-by-one
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
    const urlMap = new Map<string, string>()
    signedUrls?.forEach(item => {
      if (item.signedUrl) {
        urlMap.set(item.path, item.signedUrl)
      }
    })

    // Map URLs back to cards
    const cardsWithUrls = cards.map(card => ({
      ...card,
      front_url: urlMap.get(card.front_path) || null,
      back_url: urlMap.get(card.back_path) || null
    }))

    return NextResponse.json({ cards: cardsWithUrls }, { status: 200 })
  } catch (error) {
    console.error('Error in featured cards API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch featured cards', cards: [] },
      { status: 500 }
    )
  }
}
