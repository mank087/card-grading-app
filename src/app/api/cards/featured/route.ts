import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  try {
    // Fetch featured cards (public, graded, and marked as featured)
    // Includes all fields needed for label generation
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select(`
        id, serial, card_name, category, front_path, back_path, created_at,
        featured, pokemon_featured, card_set, release_date, manufacturer_name, card_number,
        conversational_decimal_grade, conversational_whole_grade,
        conversational_condition_label, conversational_card_info, conversational_grading,
        dvg_decimal_grade,
        is_foil, foil_type, is_double_faced, mtg_rarity, holofoil,
        serial_numbering, rarity_tier, rarity_description,
        autographed, autograph_type, memorabilia_type,
        rookie_card, first_print_rookie
      `)
      .eq('visibility', 'public')
      .eq('is_featured', true)
      .not('conversational_decimal_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(15)

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
      if (item.signedUrl) {
        urlMap.set(item.path, item.signedUrl)
      }
    })

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      let enrichedCard = {
        ...card,
        front_url: urlMap.get(card.front_path) || null,
        back_url: urlMap.get(card.back_path) || null
      };

      // If conversational_card_info is missing but conversational_grading exists, parse it
      if (!card.conversational_card_info && card.conversational_grading) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading;

          if (parsed.card_info) {
            enrichedCard.conversational_card_info = parsed.card_info;
            if (!card.featured && parsed.card_info.player_or_character) {
              enrichedCard.featured = parsed.card_info.player_or_character;
            }
            if (!card.card_name && parsed.card_info.card_name) {
              enrichedCard.card_name = parsed.card_info.card_name;
            }
            if (!card.card_set && parsed.card_info.set_name) {
              enrichedCard.card_set = parsed.card_info.set_name;
            }
            if (!card.card_number && parsed.card_info.card_number) {
              enrichedCard.card_number = parsed.card_info.card_number;
            }
            if (!card.release_date && parsed.card_info.year) {
              enrichedCard.release_date = parsed.card_info.year;
            }
          }
          if (!card.conversational_condition_label && parsed.final_grade?.condition_label) {
            enrichedCard.conversational_condition_label = parsed.final_grade.condition_label;
          }
        } catch (e) {
          // Parsing failed, continue with original data
        }
      }

      // Remove the large JSON from response
      delete enrichedCard.conversational_grading;

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
