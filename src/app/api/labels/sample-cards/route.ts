import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Hardcoded sample card IDs for non-authenticated Label Studio visitors
const SAMPLE_CARD_IDS = [
  '3e869e32-1848-4ae7-9c81-37aaf1f9f680', // Pokemon
  '81eb08af-17f5-4237-957e-4d4a3ac50e60', // Sports
  '2a7caf2c-fe35-48a9-add5-2b130ad8ba70', // Sports
  '0ae08f95-cae6-4709-b9e6-f69fc51a23a7', // Lorcana
  '83abd9b2-c176-4b42-94a7-0a6891438d52', // Pokemon
]

export async function GET() {
  try {
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select(`
        id, serial, card_name, category, front_path, back_path, created_at,
        featured, pokemon_featured, card_set, release_date, manufacturer_name, card_number,
        conversational_decimal_grade, conversational_whole_grade,
        conversational_condition_label, conversational_card_info, conversational_grading,
        conversational_sub_scores, conversational_weighted_sub_scores,
        conversational_final_grade_summary,
        is_foil, foil_type, holofoil,
        serial_numbering, rarity_tier, rarity_description,
        autographed, autograph_type, memorabilia_type,
        rookie_card, first_print_rookie,
        custom_label_data
      `)
      .in('id', SAMPLE_CARD_IDS)
      .eq('visibility', 'public')

    if (error) {
      console.error('[Sample Cards API] Error:', error)
      return NextResponse.json({ cards: [] })
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [] })
    }

    // Generate signed URLs
    const allPaths = cards.flatMap(c => [c.front_path, c.back_path])
    const { data: signedUrls } = await supabaseAdmin.storage
      .from('cards')
      .createSignedUrls(allPaths, 60 * 60)

    const urlMap = new Map<string, string>()
    signedUrls?.forEach(item => {
      if (item.path && item.signedUrl) {
        urlMap.set(item.path, item.signedUrl)
      }
    })

    // Enrich cards — extract missing fields from conversational_grading JSON blob
    const cardsWithUrls = cards.map(card => {
      const enriched: any = {
        ...card,
        front_url: urlMap.get(card.front_path) || null,
        back_url: urlMap.get(card.back_path) || null,
      }

      if (card.conversational_grading) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading

          // Extract card_info fields if missing
          if (parsed.card_info) {
            if (!card.featured && parsed.card_info.player_or_character) {
              enriched.featured = parsed.card_info.player_or_character
            }
            if (!card.card_name && parsed.card_info.card_name) {
              enriched.card_name = parsed.card_info.card_name
            }
            if (!card.card_set && parsed.card_info.set_name) {
              enriched.card_set = parsed.card_info.set_name
            }
            if (!card.card_number && parsed.card_info.card_number) {
              enriched.card_number = parsed.card_info.card_number
            }
            if (!card.release_date && parsed.card_info.year) {
              enriched.release_date = parsed.card_info.year
            }
            if (!card.conversational_card_info) {
              enriched.conversational_card_info = parsed.card_info
            }
          }

          // Extract grade if missing
          if (!card.conversational_decimal_grade) {
            const grade = parsed.grading_passes?.averaged_rounded?.final
              ?? parsed.final_grade?.decimal_grade
            if (grade != null) {
              enriched.conversational_decimal_grade = grade
              enriched.conversational_whole_grade = Math.round(grade)
            }
          }

          // Extract condition label if missing
          if (!card.conversational_condition_label && parsed.final_grade?.condition_label) {
            enriched.conversational_condition_label = parsed.final_grade.condition_label
          }

          // Extract weighted sub-scores if missing
          if (!card.conversational_weighted_sub_scores) {
            if (parsed.weighted_scores) {
              enriched.conversational_weighted_sub_scores = {
                centering: parsed.weighted_scores.centering_weighted ?? null,
                corners: parsed.weighted_scores.corners_weighted ?? null,
                edges: parsed.weighted_scores.edges_weighted ?? null,
                surface: parsed.weighted_scores.surface_weighted ?? null,
              }
            } else if (parsed.grading_passes?.averaged_rounded?.weighted_sub_scores) {
              enriched.conversational_weighted_sub_scores = parsed.grading_passes.averaged_rounded.weighted_sub_scores
            } else if (parsed.final_grade?.weighted_sub_scores) {
              enriched.conversational_weighted_sub_scores = parsed.final_grade.weighted_sub_scores
            }
          }

          // Extract sub-scores if missing
          if (!card.conversational_sub_scores) {
            if (parsed.raw_sub_scores || parsed.weighted_scores) {
              enriched.conversational_sub_scores = {
                centering: {
                  front: parsed.raw_sub_scores?.centering_front ?? 0,
                  back: parsed.raw_sub_scores?.centering_back ?? 0,
                  weighted: parsed.weighted_scores?.centering_weighted ?? 0,
                },
                corners: {
                  front: parsed.raw_sub_scores?.corners_front ?? 0,
                  back: parsed.raw_sub_scores?.corners_back ?? 0,
                  weighted: parsed.weighted_scores?.corners_weighted ?? 0,
                },
                edges: {
                  front: parsed.raw_sub_scores?.edges_front ?? 0,
                  back: parsed.raw_sub_scores?.edges_back ?? 0,
                  weighted: parsed.weighted_scores?.edges_weighted ?? 0,
                },
                surface: {
                  front: parsed.raw_sub_scores?.surface_front ?? 0,
                  back: parsed.raw_sub_scores?.surface_back ?? 0,
                  weighted: parsed.weighted_scores?.surface_weighted ?? 0,
                },
              }
            } else if (parsed.grading_passes?.averaged_rounded?.sub_scores) {
              enriched.conversational_sub_scores = parsed.grading_passes.averaged_rounded.sub_scores
            }
          }

          // Extract final grade summary if missing
          if (!card.conversational_final_grade_summary) {
            const summary = parsed.final_grade?.summary || parsed.final_grade?.final_grade_summary
            if (summary) enriched.conversational_final_grade_summary = summary
          }
        } catch { /* parsing failed, continue */ }
      }

      // Remove large JSON blob from response
      delete enriched.conversational_grading

      return enriched
    })

    return NextResponse.json({ cards: cardsWithUrls })
  } catch (err: any) {
    console.error('[Sample Cards API] Unexpected error:', err)
    return NextResponse.json({ cards: [] })
  }
}
