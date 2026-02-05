import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication - user must be logged in
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Use the authenticated user's ID - NOT from query params
    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // Query cards for this user - includes all fields needed for label generation and batch reports
    let query = supabase
      .from('cards')
      .select(`
        id, serial, front_path, back_path, card_name, featured, pokemon_featured, category, card_set,
        manufacturer_name, release_date, card_number, grade_numeric, ai_confidence_score,
        dcm_grade_whole, dvg_image_quality, created_at, visibility,
        conversational_decimal_grade, conversational_whole_grade, conversational_image_confidence,
        conversational_card_info, conversational_condition_label, conversational_grading, dvg_decimal_grade,
        conversational_weighted_sub_scores, conversational_sub_scores, conversational_corners_edges_surface,
        conversational_final_grade_summary, conversational_grade_uncertainty, estimated_professional_grades,
        is_foil, foil_type, is_double_faced, mtg_api_verified, mtg_rarity, mtg_set_code,
        card_language, scryfall_price_usd, scryfall_price_usd_foil,
        serial_numbering, rarity_tier, rarity_description, autographed, autograph_type,
        memorabilia_type, rookie_card, first_print_rookie, holofoil,
        ebay_price_lowest, ebay_price_median, ebay_price_average, ebay_price_highest,
        ebay_price_listing_count, ebay_price_updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply search filter if provided
    if (search) {
      query = query.or(`serial.ilike.%${search}%,card_name.ilike.%${search}%`);
    }

    const { data: cards, error } = await query;

    if (error) {
      console.error('[Collection API] Error fetching cards:', error);
      return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [] });
    }

    // 🚀 PERFORMANCE: Batch create signed URLs (fast, single request)
    // Then modify URLs to use image transforms for egress optimization
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path]);

    const { data: signedUrls, error: signError } = await supabase.storage
      .from('cards')
      .createSignedUrls(allPaths, 60 * 60); // 1 hour expiry

    if (signError) {
      console.error('[Collection API] Error creating signed URLs:', signError);
      // Fall back to returning cards without URLs
      return NextResponse.json({
        cards: cards.map(card => ({ ...card, front_url: null, back_url: null }))
      });
    }

    // Build a map of path -> signedUrl for quick lookup
    // Note: Client-side Next.js Image component handles optimization
    const urlMap = new Map<string, string>();
    signedUrls?.forEach(item => {
      if (item.signedUrl) {
        urlMap.set(item.path, item.signedUrl);
      }
    });

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      const enrichedCard = {
        ...card,
        front_url: urlMap.get(card.front_path) || null,
        back_url: urlMap.get(card.back_path) || null
      };

      // If conversational_grading exists, parse it and extract any missing fields
      // This handles cards that have the JSON but not the extracted columns
      if (card.conversational_grading) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading;

          // Extract card_info if missing
          if (!card.conversational_card_info && parsed.card_info) {
            enrichedCard.conversational_card_info = parsed.card_info;
            // Also populate direct fields if they're missing
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

          // Extract grade if missing
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

          // Extract weighted sub-scores if missing
          // Try multiple formats: v4.0+ JSON format, then legacy structured format
          if (!card.conversational_weighted_sub_scores) {
            // v4.0+ JSON format: weighted_scores.centering_weighted, etc.
            if (parsed.weighted_scores) {
              enrichedCard.conversational_weighted_sub_scores = {
                centering: parsed.weighted_scores.centering_weighted ?? null,
                corners: parsed.weighted_scores.corners_weighted ?? null,
                edges: parsed.weighted_scores.edges_weighted ?? null,
                surface: parsed.weighted_scores.surface_weighted ?? null
              };
            }
            // Legacy format: grading_passes or final_grade structure
            else if (parsed.grading_passes?.averaged_rounded?.weighted_sub_scores) {
              enrichedCard.conversational_weighted_sub_scores = parsed.grading_passes.averaged_rounded.weighted_sub_scores;
            }
            else if (parsed.final_grade?.weighted_sub_scores) {
              enrichedCard.conversational_weighted_sub_scores = parsed.final_grade.weighted_sub_scores;
            }
          }

          // Extract sub-scores (front/back/weighted) if missing
          if (!card.conversational_sub_scores) {
            // v4.0+ JSON format: raw_sub_scores + weighted_scores
            if (parsed.raw_sub_scores || parsed.weighted_scores) {
              enrichedCard.conversational_sub_scores = {
                centering: {
                  front: parsed.raw_sub_scores?.centering_front ?? 0,
                  back: parsed.raw_sub_scores?.centering_back ?? 0,
                  weighted: parsed.weighted_scores?.centering_weighted ?? 0
                },
                corners: {
                  front: parsed.raw_sub_scores?.corners_front ?? 0,
                  back: parsed.raw_sub_scores?.corners_back ?? 0,
                  weighted: parsed.weighted_scores?.corners_weighted ?? 0
                },
                edges: {
                  front: parsed.raw_sub_scores?.edges_front ?? 0,
                  back: parsed.raw_sub_scores?.edges_back ?? 0,
                  weighted: parsed.weighted_scores?.edges_weighted ?? 0
                },
                surface: {
                  front: parsed.raw_sub_scores?.surface_front ?? 0,
                  back: parsed.raw_sub_scores?.surface_back ?? 0,
                  weighted: parsed.weighted_scores?.surface_weighted ?? 0
                }
              };
            }
            // Legacy format: grading_passes or final_grade structure
            else if (parsed.grading_passes?.averaged_rounded?.sub_scores) {
              enrichedCard.conversational_sub_scores = parsed.grading_passes.averaged_rounded.sub_scores;
            }
            else if (parsed.final_grade?.sub_scores) {
              enrichedCard.conversational_sub_scores = parsed.final_grade.sub_scores;
            }
          }

          // Extract corners/edges/surface summaries if missing
          if (!card.conversational_corners_edges_surface) {
            // v4.0+ JSON format: centering.front.summary, corners.front.summary, etc.
            if (parsed.centering || parsed.corners || parsed.edges || parsed.surface) {
              enrichedCard.conversational_corners_edges_surface = {
                front_centering: {
                  summary: parsed.centering?.front?.summary || parsed.centering?.front_summary || ''
                },
                back_centering: {
                  summary: parsed.centering?.back?.summary || parsed.centering?.back_summary || ''
                },
                front_corners: {
                  summary: parsed.corners?.front?.summary || parsed.corners?.front_summary || ''
                },
                back_corners: {
                  summary: parsed.corners?.back?.summary || parsed.corners?.back_summary || ''
                },
                front_edges: {
                  summary: parsed.edges?.front?.summary || parsed.edges?.front_summary || ''
                },
                back_edges: {
                  summary: parsed.edges?.back?.summary || parsed.edges?.back_summary || ''
                },
                front_surface: {
                  summary: parsed.surface?.front?.summary || parsed.surface?.front_summary || ''
                },
                back_surface: {
                  summary: parsed.surface?.back?.summary || parsed.surface?.back_summary || ''
                }
              };
            }
            // Legacy format: corners_edges_surface or corners_edges_surface_json
            else if (parsed.corners_edges_surface) {
              enrichedCard.conversational_corners_edges_surface = parsed.corners_edges_surface;
            }
            else if (parsed.corners_edges_surface_json) {
              enrichedCard.conversational_corners_edges_surface = parsed.corners_edges_surface_json;
            }
          }

          // Extract final grade summary if missing
          // v4.0+ uses final_grade.summary, legacy uses final_grade.final_grade_summary
          if (!card.conversational_final_grade_summary) {
            const summary = parsed.final_grade?.summary || parsed.final_grade?.final_grade_summary;
            if (summary) {
              enrichedCard.conversational_final_grade_summary = summary;
            }
          }

          // Extract grade uncertainty if missing
          // v4.0+ uses final_grade.grade_range, legacy uses final_grade.grade_uncertainty
          if (!card.conversational_grade_uncertainty) {
            const uncertainty = parsed.final_grade?.grade_range || parsed.final_grade?.grade_uncertainty;
            if (uncertainty) {
              enrichedCard.conversational_grade_uncertainty = uncertainty;
            }
          }

          // Extract image confidence if missing
          // v4.0+ uses image_quality.confidence_letter, legacy uses final_grade.image_confidence
          if (!card.conversational_image_confidence) {
            const confidence = parsed.image_quality?.confidence_letter || parsed.final_grade?.image_confidence;
            if (confidence) {
              enrichedCard.conversational_image_confidence = confidence;
            }
          }

          // Extract estimated professional grades if missing or empty
          // v4.0+ uses professional_grade_estimates, stored column uses estimated_professional_grades
          const hasValidProfGrades = card.estimated_professional_grades &&
            typeof card.estimated_professional_grades === 'object' &&
            Object.keys(card.estimated_professional_grades).length > 0 &&
            (card.estimated_professional_grades.PSA || card.estimated_professional_grades.psa);

          if (!hasValidProfGrades) {
            const profGrades = parsed.estimated_professional_grades || parsed.professional_grade_estimates;
            if (profGrades && Object.keys(profGrades).length > 0) {
              enrichedCard.estimated_professional_grades = profGrades;
            }
          }
        } catch (e) {
          // Parsing failed, continue with original data
        }
      }

      // Remove the large conversational_grading field from response to reduce payload
      delete enrichedCard.conversational_grading;

      return enrichedCard;
    });

    return NextResponse.json({ cards: cardsWithUrls });
  } catch (error: any) {
    console.error('[Collection API] Unexpected error:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
