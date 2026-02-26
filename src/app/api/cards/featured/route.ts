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
        conversational_condition_label, conversational_card_info, conversational_grading,
        conversational_sub_scores, conversational_weighted_sub_scores,
        conversational_image_confidence, conversational_limiting_factor,
        dvg_decimal_grade,
        is_foil, foil_type, is_double_faced, mtg_rarity, holofoil,
        serial_numbering, rarity_tier, rarity_description,
        autographed, autograph_type, memorabilia_type,
        rookie_card, first_print_rookie,
        dcm_price_estimate, dcm_cached_prices, scryfall_price_usd
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

      // If conversational_grading JSON exists, parse it to fill missing fields
      if (card.conversational_grading) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading;

          // Extract grade from JSON if the decimal column is null
          if (!card.conversational_decimal_grade) {
            const grade = parsed.grading_passes?.averaged_rounded?.final ?? parsed.final_grade?.decimal_grade;
            if (grade !== undefined && grade !== null) {
              enrichedCard.conversational_decimal_grade = grade;
              enrichedCard.conversational_whole_grade = Math.floor(grade);
            }
          }

          // Extract condition label if missing
          if (!card.conversational_condition_label && parsed.final_grade?.condition_label) {
            enrichedCard.conversational_condition_label = parsed.final_grade.condition_label;
          }

          // Extract card info if missing
          if (!card.conversational_card_info && parsed.card_info) {
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

          // Extract weighted sub-scores if missing (try multiple JSON formats)
          if (!card.conversational_weighted_sub_scores) {
            if (parsed.weighted_scores) {
              enrichedCard.conversational_weighted_sub_scores = {
                centering: parsed.weighted_scores.centering_weighted ?? null,
                corners: parsed.weighted_scores.corners_weighted ?? null,
                edges: parsed.weighted_scores.edges_weighted ?? null,
                surface: parsed.weighted_scores.surface_weighted ?? null,
              };
            } else if (parsed.grading_passes?.averaged_rounded?.weighted_sub_scores) {
              enrichedCard.conversational_weighted_sub_scores = parsed.grading_passes.averaged_rounded.weighted_sub_scores;
            } else if (parsed.final_grade?.weighted_sub_scores) {
              enrichedCard.conversational_weighted_sub_scores = parsed.final_grade.weighted_sub_scores;
            }
          }

          // Extract sub-scores (front/back/weighted) if missing (try multiple JSON formats)
          if (!card.conversational_sub_scores) {
            if (parsed.raw_sub_scores || parsed.weighted_scores) {
              enrichedCard.conversational_sub_scores = {
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
              };
            } else if (parsed.grading_passes?.averaged_rounded?.sub_scores) {
              enrichedCard.conversational_sub_scores = parsed.grading_passes.averaged_rounded.sub_scores;
            } else if (parsed.final_grade?.sub_scores) {
              enrichedCard.conversational_sub_scores = parsed.final_grade.sub_scores;
            }
          }

          // Extract image confidence if missing
          if (!card.conversational_image_confidence) {
            const confidence = parsed.image_confidence
              ?? parsed.grading_passes?.averaged_rounded?.image_confidence
              ?? parsed.final_grade?.image_confidence;
            if (confidence) {
              enrichedCard.conversational_image_confidence = confidence;
            }
          }

          // Extract limiting factor if missing
          if (!card.conversational_limiting_factor) {
            const factor = parsed.limiting_factor
              ?? parsed.grading_passes?.averaged_rounded?.limiting_factor
              ?? parsed.final_grade?.limiting_factor;
            if (factor) {
              enrichedCard.conversational_limiting_factor = factor;
            }
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
