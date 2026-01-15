import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Thumbnail transform parameters for carousel/grid view
// Appended to signed URLs to reduce egress (requires Supabase Pro plan)
function addTransformToUrl(signedUrl: string): string {
  try {
    const url = new URL(signedUrl);
    // Replace /object/sign/ with /render/image/sign/ for transforms
    url.pathname = url.pathname.replace('/object/sign/', '/render/image/sign/');
    // Add transform parameters - optimized for carousel thumbnails
    url.searchParams.set('width', '400');
    url.searchParams.set('quality', '75');
    return url.toString();
  } catch {
    return signedUrl; // Return original if URL parsing fails
  }
}

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
        conversational_condition_label, conversational_card_info, conversational_grading,
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

    // Build a map of path -> transformed signedUrl for quick lookup
    // Apply image transforms to reduce bandwidth (carousel uses smaller images)
    const urlMap = new Map<string, string>()
    signedUrls?.forEach(item => {
      if (item.signedUrl) {
        urlMap.set(item.path, addTransformToUrl(item.signedUrl))
      }
    })

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      let enrichedCard: any = {
        ...card,
        front_url: card.front_path ? urlMap.get(card.front_path) || null : null,
        back_url: card.back_path ? urlMap.get(card.back_path) || null : null
      }

      // If conversational_card_info is missing but conversational_grading exists, parse it
      if (!card.conversational_card_info && card.conversational_grading) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading

          if (parsed.card_info) {
            enrichedCard.conversational_card_info = parsed.card_info
            if (!card.featured && parsed.card_info.player_or_character) {
              enrichedCard.featured = parsed.card_info.player_or_character
            }
            if (!card.card_name && parsed.card_info.card_name) {
              enrichedCard.card_name = parsed.card_info.card_name
            }
            if (!card.card_set && parsed.card_info.set_name) {
              enrichedCard.card_set = parsed.card_info.set_name
            }
            if (!card.card_number && parsed.card_info.card_number) {
              enrichedCard.card_number = parsed.card_info.card_number
            }
            if (!card.release_date && parsed.card_info.year) {
              enrichedCard.release_date = parsed.card_info.year
            }
          }
          if (!card.conversational_condition_label && parsed.final_grade?.condition_label) {
            enrichedCard.conversational_condition_label = parsed.final_grade.condition_label
          }
        } catch (e) {
          // Parsing failed, continue with original data
        }
      }

      // Remove the large JSON from response
      delete enrichedCard.conversational_grading

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
