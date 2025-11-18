import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
// PRIMARY: Conversational grading system (matches sports card flow)
import { gradeCardConversational } from "@/lib/visionGrader";

// Track Other cards currently being processed with timestamps
const processingOtherCards = new Map<string, number>();

// Clean up stuck processing cards (older than 5 minutes)
const cleanupStuckCards = () => {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);

  for (const [cardId, timestamp] of processingOtherCards.entries()) {
    if (timestamp < fiveMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set`);
      processingOtherCards.delete(cardId);
    }
  }
};

// Types
type OtherCardGradingRequest = {
  params: Promise<{ id: string }>;
};

// Signed URL generation
async function createSignedUrl(supabase: any, bucket: string, path: string): Promise<string | null> {
  try {
    const { data, error} = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (error) {
      console.error(`Failed to create signed URL for ${path}:`, error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(`Error creating signed URL for ${path}:`, error);
    return null;
  }
}

// Extract Other-specific fields from conversational v4.2 JSON
function extractOtherFieldsFromConversational(conversationalJSON: any) {
  try {
    const data = typeof conversationalJSON === 'string' ? JSON.parse(conversationalJSON) : conversationalJSON;
    const cardInfo = data.card_info || {};

    return {
      // Standard fields (every card type has these)
      card_name: cardInfo.card_name || null,
      card_set: cardInfo.set_name || 'Unknown',
      card_number: cardInfo.card_number || null,

      // Other-specific fields
      manufacturer: cardInfo.manufacturer || null,
      card_date: cardInfo.card_date || null,
      special_features: cardInfo.special_features || null,
      front_text: cardInfo.front_text || null,
      back_text: cardInfo.back_text || null,
    };
  } catch (error) {
    console.error('[Other Field Extraction] Error parsing conversational JSON:', error);
    return {
      card_name: null,
      card_set: 'Unknown',
      card_number: null,
      manufacturer: null,
      card_date: null,
      special_features: null,
      front_text: null,
      back_text: null,
    };
  }
}

// Main GET handler for Other cards
export async function GET(request: NextRequest, { params }: OtherCardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  // Check for force_regrade query parameter
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';

  console.log(`[GET /api/other/${cardId}] Starting Other card grading request (force_regrade: ${forceRegrade})`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // Check if already processing this Other card
  if (processingOtherCards.has(cardId)) {
    console.log(`[GET /api/other/${cardId}] Other card already being processed, returning 429`);
    return NextResponse.json(
      { error: "Other card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingOtherCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get Other card from database
    // Remove strict category filter - just fetch the card and let it through
    // (Other category is a catch-all for non-specific card types)
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.error(`[GET /api/other/${cardId}] Card lookup error:`, cardError);
      processingOtherCards.delete(cardId);
      return NextResponse.json({ error: "Other card not found" }, { status: 404 });
    }

    console.log(`[GET /api/other/${cardId}] Other card found`);

    // Create signed URLs for Other card images (parallel for speed)
    console.log(`[GET /api/other/${cardId}] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const [frontUrl, backUrl] = await Promise.all([
      createSignedUrl(supabase, "cards", card.front_path),
      createSignedUrl(supabase, "cards", card.back_path)
    ]);

    if (!frontUrl || !backUrl) {
      console.error(`[GET /api/other/${cardId}] Failed to create signed URLs. Front: ${frontUrl}, Back: ${backUrl}`);
      processingOtherCards.delete(cardId);
      return NextResponse.json({ error: "Failed to access Other card images" }, { status: 500 });
    }
    console.log(`[GET /api/other/${cardId}] Signed URLs created successfully`);

    // Check if Other card already has complete grading data
    // Accept both numeric grades and N/A grades (conversational_decimal_grade will be null for N/A)
    const hasCompleteGrading = card.ai_grading && card.conversational_grading &&
      (card.conversational_decimal_grade !== undefined || card.conversational_whole_grade !== undefined);

    // Skip cache if force_regrade is requested
    if (hasCompleteGrading && !forceRegrade) {
      console.log(`[GET /api/other/${cardId}] Other card already fully processed, returning existing result`);

      processingOtherCards.delete(cardId);
      return NextResponse.json({
        ...card,
        front_url: frontUrl,
        back_url: backUrl
      });
    }

    // Grade the card with conversational v4.2 (Other-specific)
    console.log(`[GET /api/other/${cardId}] Grading Other card with conversational v4.2...`);
    let conversationalGradingResult = null;

    if (frontUrl && backUrl) {
      try {
        console.log(`[OTHER CONVERSATIONAL AI v4.2] 🎯 Starting grading with Other-specific prompt...`);
        const conversationalResult = await gradeCardConversational(frontUrl, backUrl, 'other');
        conversationalGradingResult = conversationalResult.markdown_report;

        console.log(`[GET /api/other/${cardId}] ✅ Conversational grading completed`);
      } catch (error: any) {
        console.error(`[GET /api/other/${cardId}] ⚠️ Conversational grading failed:`, error.message);
        processingOtherCards.delete(cardId);
        return NextResponse.json({
          error: "Failed to grade Other card. Please try again or contact support.",
          details: error.message
        }, { status: 500 });
      }
    }

    // Extract Other-specific fields and grading data from conversational JSON
    let otherFields = {};
    let gradingData = {};

    if (conversationalGradingResult) {
      try {
        const jsonData = JSON.parse(conversationalGradingResult);

        // Extract card-specific fields
        otherFields = extractOtherFieldsFromConversational(jsonData);

        // Extract grading scores from final_grade object (v4.2 structure)
        const finalGrade = jsonData.final_grade || {};
        gradingData = {
          // Legacy columns (for backwards compatibility)
          raw_decimal_grade: finalGrade.decimal_grade ?? null,
          dcm_grade_whole: finalGrade.whole_grade ?? null,

          // 🆕 v4.2: Structured conversational grading fields (parsed from JSON)
          conversational_decimal_grade: finalGrade.decimal_grade ?? null,
          conversational_whole_grade: finalGrade.whole_grade ?? null,
          conversational_grade_uncertainty: finalGrade.grade_range ?? null,
          conversational_final_grade_summary: finalGrade.summary ?? null,
          conversational_condition_label: finalGrade.condition_label || null,

          // Sub-scores for colored circles display
          conversational_sub_scores: {
            centering: {
              front: jsonData.raw_sub_scores?.centering_front || 0,
              back: jsonData.raw_sub_scores?.centering_back || 0,
              weighted: jsonData.weighted_scores?.centering_weighted || 0
            },
            corners: {
              front: jsonData.raw_sub_scores?.corners_front || 0,
              back: jsonData.raw_sub_scores?.corners_back || 0,
              weighted: jsonData.weighted_scores?.corners_weighted || 0
            },
            edges: {
              front: jsonData.raw_sub_scores?.edges_front || 0,
              back: jsonData.raw_sub_scores?.edges_back || 0,
              weighted: jsonData.weighted_scores?.edges_weighted || 0
            },
            surface: {
              front: jsonData.raw_sub_scores?.surface_front || 0,
              back: jsonData.raw_sub_scores?.surface_back || 0,
              weighted: jsonData.weighted_scores?.surface_weighted || 0
            }
          },

          // Detailed category analysis for frontend display
          conversational_corners_edges_surface: {
            // Centering summaries
            front_centering: {
              summary: jsonData.centering?.front_summary || jsonData.centering?.front?.summary || 'Centering analysis not available.'
            },
            back_centering: {
              summary: jsonData.centering?.back_summary || jsonData.centering?.back?.summary || 'Centering analysis not available.'
            },
            // Front corners
            front_corners: {
              top_left: jsonData.corners?.front?.top_left?.condition || 'N/A',
              top_right: jsonData.corners?.front?.top_right?.condition || 'N/A',
              bottom_left: jsonData.corners?.front?.bottom_left?.condition || 'N/A',
              bottom_right: jsonData.corners?.front?.bottom_right?.condition || 'N/A',
              sub_score: jsonData.raw_sub_scores?.corners_front || 0,
              summary: jsonData.corners?.front_summary || jsonData.corners?.front?.summary || 'Corner analysis not available'
            },
            // Back corners
            back_corners: {
              top_left: jsonData.corners?.back?.top_left?.condition || 'N/A',
              top_right: jsonData.corners?.back?.top_right?.condition || 'N/A',
              bottom_left: jsonData.corners?.back?.bottom_left?.condition || 'N/A',
              bottom_right: jsonData.corners?.back?.bottom_right?.condition || 'N/A',
              sub_score: jsonData.raw_sub_scores?.corners_back || 0,
              summary: jsonData.corners?.back_summary || jsonData.corners?.back?.summary || 'Corner analysis not available'
            },
            // Front edges
            front_edges: {
              top: jsonData.edges?.front?.top?.condition || 'N/A',
              bottom: jsonData.edges?.front?.bottom?.condition || 'N/A',
              left: jsonData.edges?.front?.left?.condition || 'N/A',
              right: jsonData.edges?.front?.right?.condition || 'N/A',
              sub_score: jsonData.raw_sub_scores?.edges_front || 0,
              summary: jsonData.edges?.front_summary || jsonData.edges?.front?.summary || 'Edge analysis not available'
            },
            // Back edges
            back_edges: {
              top: jsonData.edges?.back?.top?.condition || 'N/A',
              bottom: jsonData.edges?.back?.bottom?.condition || 'N/A',
              left: jsonData.edges?.back?.left?.condition || 'N/A',
              right: jsonData.edges?.back?.right?.condition || 'N/A',
              sub_score: jsonData.raw_sub_scores?.edges_back || 0,
              summary: jsonData.edges?.back_summary || jsonData.edges?.back?.summary || 'Edge analysis not available'
            },
            // Front surface
            front_surface: {
              defects: jsonData.surface?.front?.defects || [],
              analysis: jsonData.surface?.front?.analysis || 'No analysis available',
              sub_score: jsonData.raw_sub_scores?.surface_front || 0,
              summary: jsonData.surface?.front_summary || jsonData.surface?.front?.summary || 'Surface analysis not available'
            },
            // Back surface
            back_surface: {
              defects: jsonData.surface?.back?.defects || [],
              analysis: jsonData.surface?.back?.analysis || 'No analysis available',
              sub_score: jsonData.raw_sub_scores?.surface_back || 0,
              summary: jsonData.surface?.back_summary || jsonData.surface?.back?.summary || 'Surface analysis not available'
            }
          },

          // Centering ratios for display
          conversational_centering_ratios: {
            front_lr: jsonData.centering?.front?.left_right || 'N/A',
            front_tb: jsonData.centering?.front?.top_bottom || 'N/A',
            back_lr: jsonData.centering?.back?.left_right || 'N/A',
            back_tb: jsonData.centering?.back?.top_bottom || 'N/A'
          },

          // Image quality confidence
          conversational_image_confidence: jsonData.image_quality?.confidence_letter || 'B',

          // Professional grading slab detection (matches Pokemon/Lorcana/MTG structure)
          conversational_slab_detection: jsonData.professional_slab || null,

          // 🎯 LEGACY COMPATIBILITY: Also populate old slab fields for frontend display
          slab_detected: jsonData.professional_slab?.detected || false,
          slab_company: jsonData.professional_slab?.company || null,
          slab_grade: jsonData.professional_slab?.grade || null,
          slab_grade_description: jsonData.professional_slab?.grade_description || null,
          slab_cert_number: jsonData.professional_slab?.cert_number || null,
          slab_serial: jsonData.professional_slab?.serial_number || null,
          slab_subgrades: jsonData.professional_slab?.subgrades || null,

          // Protective case detection
          conversational_case_detection: jsonData.case_detection || null,

          // 🆕 Defect summaries (matches Pokemon/MTG/Lorcana pattern)
          conversational_defects_front: jsonData.defect_summary?.front || null,
          conversational_defects_back: jsonData.defect_summary?.back || null,

          // 🎯 Professional grade estimates (PSA, BGS, SGC, CGC comparisons)
          estimated_professional_grades: jsonData.professional_grade_estimates || null
        };

        console.log(`[GET /api/other/${cardId}] Extracted grades: decimal=${gradingData.conversational_decimal_grade}, whole=${gradingData.conversational_whole_grade}`);
      } catch (error) {
        console.error(`[GET /api/other/${cardId}] Error parsing conversational result:`, error);
      }
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;
    console.log(`[GET /api/other/${cardId}] ⏱️ Total processing time: ${processingTime}ms`);

    // Update database with grading results
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        ai_grading: conversationalGradingResult,
        conversational_grading: conversationalGradingResult,
        conversational_card_info: conversationalGradingResult ? JSON.parse(conversationalGradingResult).card_info : null,
        processing_time: processingTime,
        ...gradingData,
        ...otherFields
      })
      .eq('id', cardId);

    if (updateError) {
      console.error(`[GET /api/other/${cardId}] ❌ Failed to update card:`, updateError);
    }

    // Fetch updated card
    const { data: updatedCard } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    processingOtherCards.delete(cardId);

    return NextResponse.json({
      ...(updatedCard || card),
      front_url: frontUrl,
      back_url: backUrl
    });

  } catch (error: any) {
    console.error(`[GET /api/other/${cardId}] ❌ Error:`, error);
    processingOtherCards.delete(cardId);
    return NextResponse.json(
      { error: 'Failed to process Other card', details: error.message },
      { status: 500 }
    );
  }
}
