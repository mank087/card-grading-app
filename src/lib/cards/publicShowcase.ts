import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { HOME_SHOWCASE_IDS, LEARNING_CARD_IDS } from '@/lib/cards/marketingShowcase'
import { createSignedImageMap, pickDisplayUrls } from '@/lib/signedUrlBatch'

export async function loadFeaturedCards(limit: number, category: string | null, learningPage: string | null) {
    // Fetch featured cards (public, admin-curated, graded)
    // Accept cards with grade in either the decimal column OR the grading JSON blob
    // (older cards may only have the grade inside conversational_grading JSON)
    // Includes all fields needed for label generation + grading details + pricing
    let query = supabaseAdmin
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
        dcm_price_estimate, scryfall_price_usd,
        card_colors, label_data
      `)
      .eq('visibility', 'public')
      .or('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')

    // The local marketing redesign includes an explicitly reviewed public
    // Gengar. Normal featured galleries retain their existing selection.
    const learningIds = learningPage && Object.prototype.hasOwnProperty.call(LEARNING_CARD_IDS, learningPage) ? LEARNING_CARD_IDS[learningPage as keyof typeof LEARNING_CARD_IDS] : null
    query = learningIds ? query.in('id', [...learningIds]) : learningPage === '1'
      ? query.in('id', [...HOME_SHOWCASE_IDS])
      : query.eq('is_featured', true)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: cards, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching featured cards:', error)
      throw error
    }

    if (!cards || cards.length === 0) {
      return { cards: [] }
    }

    // Batch-sign thumbnails and originals. Small marketing displays use the
    // thumbnail; explicitly cropped photos can retain the original when needed.
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path])

    const urlMap = await createSignedImageMap(supabaseAdmin.storage, 'cards', allPaths)

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      const front = pickDisplayUrls(urlMap, card.front_path)
      const back = pickDisplayUrls(urlMap, card.back_path)
      const enrichedCard = {
        ...card,
        front_url: front.display,
        back_url: back.display,
        front_full_url: front.full,
        back_full_url: back.full,
      };

      return enrichedCard;
    })

    return { cards: cardsWithUrls }
}

// Short-lived cache only for reviewed public marketing selections. Normal galleries
// keep their existing live query; failures are thrown and never cached as empty data.
export const cachedShowcase = unstable_cache(loadFeaturedCards, ['reviewed-showcase-v1'], { revalidate: 60 })

