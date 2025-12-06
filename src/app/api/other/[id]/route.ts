import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
// PRIMARY: Conversational grading system (matches sports card flow)
import { gradeCardConversational } from "@/lib/visionGrader";
// Professional grade estimation (deterministic backend mapper)
import { estimateProfessionalGrades } from "@/lib/professionalGradeMapper";

// Vercel serverless function configuration
// maxDuration: Maximum execution time in seconds (Pro plan supports up to 300s)
// GPT-5.1 with large prompts + vision can take 60-90 seconds, with retries up to 3 minutes
export const maxDuration = 180;

// Track Other cards currently being processed with timestamps
const processingOtherCards = new Map<string, number>();

// Clean up stuck processing cards (older than 2 minutes - reduced from 5 to prevent long lock-outs)
const cleanupStuckCards = () => {
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);

  for (const [cardId, timestamp] of processingOtherCards.entries()) {
    if (timestamp < twoMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set (was locked for ${Math.round((now - timestamp) / 1000)}s)`);
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

  // Check for query parameters
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';
  const statusOnly = searchParams.get('status_only') === 'true';

  console.log(`[GET /api/other/${cardId}] Starting Other card request (force_regrade: ${forceRegrade}, status_only: ${statusOnly})`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // STATUS-ONLY MODE: Just return the current card state without acquiring lock or starting grading
  // This is used by the background polling system to check if grading is complete
  if (statusOnly) {
    console.log(`[GET /api/other/${cardId}] Status-only check requested`);

    const supabase = supabaseServer();
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, conversational_grading, raw_decimal_grade, dcm_grade_whole, grading_error, category")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Verify it's an Other card
    if (card.category !== 'Other') {
      return NextResponse.json({ error: "Not an Other card" }, { status: 404 });
    }

    // Check if card has complete grading
    const hasCompleteGrading =
      (card.conversational_grading && card.conversational_grading.length > 0) ||
      (card.raw_decimal_grade && card.dcm_grade_whole);

    // Check if currently processing (in the lock map)
    const isProcessing = processingOtherCards.has(cardId);

    return NextResponse.json({
      id: cardId,
      status: hasCompleteGrading ? 'complete' : (isProcessing ? 'processing' : 'pending'),
      has_grading: hasCompleteGrading,
      is_processing: isProcessing,
      grading_error: card.grading_error || null
    });
  }

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
    // Card is complete if:
    // 1. Has ai_grading AND numeric grades (decimal AND whole), OR
    // 2. Has ai_grading AND N/A grade (null) with a complete conversational grading report (for altered cards)
    const hasCompleteGrading =
      (card.ai_grading && card.conversational_decimal_grade && card.conversational_whole_grade) ||
      (card.ai_grading && card.conversational_grading && card.conversational_grading.length > 0);

    // Skip cache if force_regrade is requested
    if (hasCompleteGrading && !forceRegrade) {
      console.log(`[GET /api/other/${cardId}] Other card already fully processed, returning existing result`);

      // Parse conversational_grading if it exists to extract professional grades
      let parsedConversationalData = null;
      if (card.conversational_grading) {
        try {
          console.log('[OTHER CACHE] Parsing cached conversational_grading JSON...');
          const jsonData = JSON.parse(card.conversational_grading);

          parsedConversationalData = {
            decimal_grade: jsonData.final_grade?.decimal_grade ?? null,
            whole_grade: jsonData.final_grade?.whole_grade ?? null,
            grade_range: jsonData.final_grade?.grade_range || '±0.5',
            condition_label: jsonData.final_grade?.condition_label || null,
            final_grade_summary: jsonData.final_grade?.summary || null,
            image_confidence: jsonData.image_quality?.confidence_letter || null,
            sub_scores: {
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
            centering_ratios: {
              front_lr: jsonData.centering?.front?.left_right || 'N/A',
              front_tb: jsonData.centering?.front?.top_bottom || 'N/A',
              back_lr: jsonData.centering?.back?.left_right || 'N/A',
              back_tb: jsonData.centering?.back?.top_bottom || 'N/A'
            },
            corners_edges_surface: {
              front_centering: {
                summary: jsonData.centering?.front_summary || jsonData.centering?.front?.summary || jsonData.centering?.front?.analysis || 'Centering analysis not available.'
              },
              back_centering: {
                summary: jsonData.centering?.back_summary || jsonData.centering?.back?.summary || jsonData.centering?.back?.analysis || 'Centering analysis not available.'
              },
              front_corners: {
                top_left: jsonData.corners?.front?.top_left?.condition || 'N/A',
                top_right: jsonData.corners?.front?.top_right?.condition || 'N/A',
                bottom_left: jsonData.corners?.front?.bottom_left?.condition || 'N/A',
                bottom_right: jsonData.corners?.front?.bottom_right?.condition || 'N/A',
                sub_score: jsonData.raw_sub_scores?.corners_front || 0,
                summary: jsonData.corners?.front_summary || jsonData.corners?.front?.summary || 'Corner analysis not available'
              },
              back_corners: {
                top_left: jsonData.corners?.back?.top_left?.condition || 'N/A',
                top_right: jsonData.corners?.back?.top_right?.condition || 'N/A',
                bottom_left: jsonData.corners?.back?.bottom_left?.condition || 'N/A',
                bottom_right: jsonData.corners?.back?.bottom_right?.condition || 'N/A',
                sub_score: jsonData.raw_sub_scores?.corners_back || 0,
                summary: jsonData.corners?.back_summary || jsonData.corners?.back?.summary || 'Corner analysis not available'
              },
              front_edges: {
                top: jsonData.edges?.front?.top?.condition || 'N/A',
                bottom: jsonData.edges?.front?.bottom?.condition || 'N/A',
                left: jsonData.edges?.front?.left?.condition || 'N/A',
                right: jsonData.edges?.front?.right?.condition || 'N/A',
                sub_score: jsonData.raw_sub_scores?.edges_front || 0,
                summary: jsonData.edges?.front_summary || jsonData.edges?.front?.summary || 'Edge analysis not available'
              },
              back_edges: {
                top: jsonData.edges?.back?.top?.condition || 'N/A',
                bottom: jsonData.edges?.back?.bottom?.condition || 'N/A',
                left: jsonData.edges?.back?.left?.condition || 'N/A',
                right: jsonData.edges?.back?.right?.condition || 'N/A',
                sub_score: jsonData.raw_sub_scores?.edges_back || 0,
                summary: jsonData.edges?.back_summary || jsonData.edges?.back?.summary || 'Edge analysis not available'
              },
              front_surface: {
                defects: jsonData.surface?.front?.defects || [],
                analysis: jsonData.surface?.front?.condition || jsonData.surface?.front?.analysis || 'No analysis available',
                sub_score: jsonData.raw_sub_scores?.surface_front || 0,
                summary: jsonData.surface?.front?.summary || jsonData.surface?.front_summary || 'Surface analysis not available'
              },
              back_surface: {
                defects: jsonData.surface?.back?.defects || [],
                analysis: jsonData.surface?.back?.condition || jsonData.surface?.back?.analysis || 'No analysis available',
                sub_score: jsonData.raw_sub_scores?.surface_back || 0,
                summary: jsonData.surface?.back?.summary || jsonData.surface?.back_summary || 'Surface analysis not available'
              }
            },
            card_info: jsonData.card_info || null,
            transformedDefects: {
              front: jsonData.defect_summary?.front || null,
              back: jsonData.defect_summary?.back || null
            },
            case_detection: jsonData.case_detection || null,
            professional_grade_estimates: jsonData.professional_grade_estimates || null
          };

          // Calculate professional grade estimates if not stored in JSON
          if (!parsedConversationalData.professional_grade_estimates && parsedConversationalData.decimal_grade && parsedConversationalData.decimal_grade !== 'N/A') {
            try {
              console.log('[OTHER CACHE] 🔧 Calculating professional grade estimates...');

              const parseCentering = (ratio: string): [number, number] | undefined => {
                if (!ratio || ratio === 'N/A') return undefined;
                const parts = ratio.split('/').map(p => parseInt(p.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  return [parts[0], parts[1]] as [number, number];
                }
                return undefined;
              };

              const cardInfoData = parsedConversationalData.card_info || {};
              const hasAutographedFlag = cardInfoData.autographed === true;
              const hasAutographRarity = cardInfoData.rarity_or_variant?.toLowerCase()?.includes('autograph');
              const hasAutographInName = cardInfoData.card_name?.toLowerCase()?.includes('autograph');
              const isAuthentic = cardInfoData.authentic !== false;
              const isAuthenticatedAutograph = isAuthentic && (hasAutographedFlag || hasAutographRarity || hasAutographInName);

              const mapperInput = {
                final_grade: parsedConversationalData.decimal_grade,
                centering: {
                  front_lr: parseCentering(parsedConversationalData.centering_ratios?.front_lr),
                  front_tb: parseCentering(parsedConversationalData.centering_ratios?.front_tb),
                  back_lr: parseCentering(parsedConversationalData.centering_ratios?.back_lr),
                  back_tb: parseCentering(parsedConversationalData.centering_ratios?.back_tb)
                },
                corners_score: parsedConversationalData.sub_scores?.corners?.weighted,
                edges_score: parsedConversationalData.sub_scores?.edges?.weighted,
                surface_score: parsedConversationalData.sub_scores?.surface?.weighted,
                has_structural_damage: jsonData.structural_damage?.detected || false,
                has_handwriting: jsonData.handwriting?.detected || false,
                has_alterations: jsonData.alterations?.detected || false,
                crease_detected: jsonData.structural_damage?.has_creases || false,
                bent_corner_detected: jsonData.structural_damage?.has_bent_corners || false,
                is_authenticated_autograph: isAuthenticatedAutograph
              };

              const professionalEstimates = estimateProfessionalGrades(mapperInput);
              parsedConversationalData.professional_grade_estimates = professionalEstimates;

              console.log(`[OTHER CACHE] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}`);
            } catch (mapperError) {
              console.error('[OTHER CACHE] ⚠️ Professional mapper failed:', mapperError);
            }
          }

          console.log('[OTHER CACHE] ✅ Parsed cached JSON successfully');
        } catch (error) {
          console.error('[OTHER CACHE] ⚠️ Failed to parse cached JSON:', error);
        }
      }

      processingOtherCards.delete(cardId);
      return NextResponse.json({
        ...card,
        // Add parsed conversational data if available
        ...(parsedConversationalData && {
          conversational_decimal_grade: parsedConversationalData.decimal_grade,
          conversational_whole_grade: parsedConversationalData.whole_grade,
          conversational_grade_uncertainty: parsedConversationalData.grade_range,
          conversational_final_grade_summary: parsedConversationalData.final_grade_summary,
          conversational_sub_scores: parsedConversationalData.sub_scores,
          conversational_condition_label: parsedConversationalData.condition_label,
          conversational_image_confidence: parsedConversationalData.image_confidence,
          conversational_centering_ratios: parsedConversationalData.centering_ratios,
          conversational_card_info: parsedConversationalData.card_info,
          conversational_corners_edges_surface: parsedConversationalData.corners_edges_surface,
          conversational_case_detection: parsedConversationalData.case_detection,
          conversational_defects_front: parsedConversationalData.transformedDefects.front,
          conversational_defects_back: parsedConversationalData.transformedDefects.back,
          estimated_professional_grades: parsedConversationalData.professional_grade_estimates
        }),
        front_url: frontUrl,
        back_url: backUrl
      });
    }

    // Grade the card with conversational v4.2 (Other-specific)
    console.log(`[GET /api/other/${cardId}] Grading Other card with conversational v4.2...`);
    let conversationalGradingResult = null;

    if (frontUrl && backUrl) {
      try {
        const versionLabel = process.env.USE_V5_ARCHITECTURE === 'true' ? 'v5.0' : 'v4.2';
        console.log(`[OTHER CONVERSATIONAL AI ${versionLabel}] 🎯 Starting grading with Other-specific prompt...`);
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

        // Extract grading scores - handle both v5.0 (scoring.final_grade) and v4.2 (final_grade.decimal_grade)
        const decimalGrade = jsonData.scoring?.final_grade ?? jsonData.final_grade?.decimal_grade ?? null;
        const wholeGrade = jsonData.scoring?.rounded_grade ?? jsonData.final_grade?.whole_grade ?? null;
        const finalGrade = jsonData.final_grade || {};
        gradingData = {
          // Legacy columns (for backwards compatibility)
          raw_decimal_grade: decimalGrade,
          dcm_grade_whole: wholeGrade,

          // 🆕 v4.2/v5.0: Structured conversational grading fields (parsed from JSON)
          conversational_decimal_grade: decimalGrade,
          conversational_whole_grade: wholeGrade,
          conversational_grade_uncertainty: jsonData.image_quality?.grade_uncertainty || finalGrade.grade_range || '±0.5',  // 🔧 FIX: Prioritize ± format over range
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
              summary: jsonData.centering?.front_summary || jsonData.centering?.front?.summary || jsonData.centering?.front?.analysis || 'Centering analysis not available.'
            },
            back_centering: {
              summary: jsonData.centering?.back_summary || jsonData.centering?.back?.summary || jsonData.centering?.back?.analysis || 'Centering analysis not available.'
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
              analysis: jsonData.surface?.front?.condition || jsonData.surface?.front?.analysis || 'No analysis available',
              sub_score: jsonData.raw_sub_scores?.surface_front || 0,
              summary: jsonData.surface?.front?.summary || jsonData.surface?.front_summary || 'Surface analysis not available'
            },
            // Back surface
            back_surface: {
              defects: jsonData.surface?.back?.defects || [],
              analysis: jsonData.surface?.back?.condition || jsonData.surface?.back?.analysis || 'No analysis available',
              sub_score: jsonData.raw_sub_scores?.surface_back || 0,
              summary: jsonData.surface?.back?.summary || jsonData.surface?.back_summary || 'Surface analysis not available'
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
          conversational_slab_detection: jsonData.slab_detection || null,  // 🔧 FIX: Master rubric outputs slab_detection, not professional_slab

          // 🎯 LEGACY COMPATIBILITY: Also populate old slab fields for frontend display
          slab_detected: jsonData.slab_detection?.detected || false,
          slab_company: jsonData.slab_detection?.company || null,
          slab_grade: jsonData.slab_detection?.grade || null,
          slab_grade_description: jsonData.slab_detection?.grade_description || null,
          slab_cert_number: jsonData.slab_detection?.cert_number || null,
          slab_serial: jsonData.slab_detection?.serial_number || null,
          slab_subgrades: jsonData.slab_detection?.subgrades || null,

          // Protective case detection
          conversational_case_detection: jsonData.case_detection || null,

          // 🆕 Defect summaries (matches Pokemon/MTG/Lorcana pattern)
          conversational_defects_front: jsonData.defect_summary?.front || null,
          conversational_defects_back: jsonData.defect_summary?.back || null,

          // 🎯 Professional grade estimates (PSA, BGS, SGC, CGC comparisons)
          estimated_professional_grades: jsonData.professional_grade_estimates || null
        };

        console.log(`[GET /api/other/${cardId}] Extracted grades: decimal=${gradingData.conversational_decimal_grade}, whole=${gradingData.conversational_whole_grade}`);

        // 🎯 Call backend deterministic mapper for professional grade estimates
        if (gradingData.conversational_decimal_grade && gradingData.conversational_decimal_grade !== 'N/A') {
          try {
            console.log(`[GET /api/other/${cardId}] 🔧 Calling professional grade mapper (deterministic)...`);

            const jsonData = JSON.parse(conversationalGradingResult);

            // Parse centering ratios from strings like "55/45" to [55, 45]
            const parseCentering = (ratio: string): [number, number] | undefined => {
              if (!ratio || ratio === 'N/A') return undefined;
              const parts = ratio.split('/').map(p => parseInt(p.trim()));
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return [parts[0], parts[1]] as [number, number];
              }
              return undefined;
            };

            const centeringRatios = {
              front_lr: jsonData.centering?.front?.left_right || 'N/A',
              front_tb: jsonData.centering?.front?.top_bottom || 'N/A',
              back_lr: jsonData.centering?.back?.left_right || 'N/A',
              back_tb: jsonData.centering?.back?.top_bottom || 'N/A'
            };

            // Check if autograph is manufacturer-authenticated (not an alteration)
            // Multiple ways to detect authenticated autographs:
            const autographType = jsonData.autograph?.type || 'none';
            const cardInfoData = jsonData.card_info || {};
            const rarityFeatures = jsonData.rarity_features || {};

            // Check various indicators of authenticated autograph
            const hasAutographType = autographType === 'manufacturer_authenticated' ||
                                     autographType === 'on-card' ||
                                     autographType === 'sticker';
            const hasAutographedFlag = cardInfoData.autographed === true;
            const hasAutographRarity = cardInfoData.rarity_or_variant?.toLowerCase()?.includes('autograph') ||
                                       cardInfoData.rarity_tier?.toLowerCase()?.includes('autograph');
            const hasAutographInName = cardInfoData.card_name?.toLowerCase()?.includes('autograph');
            const hasRarityAutograph = rarityFeatures.autograph?.present === true;
            const isAuthentic = cardInfoData.authentic !== false;

            const isAuthenticatedAutograph = isAuthentic && (
              hasAutographType ||
              hasAutographedFlag ||
              hasAutographRarity ||
              hasAutographInName ||
              hasRarityAutograph
            );

            console.log(`[GET /api/other/${cardId}] 🔍 Autograph detection: type=${autographType}, flag=${hasAutographedFlag}, rarity=${hasAutographRarity}, name=${hasAutographInName}, rarityFeatures=${hasRarityAutograph}, authentic=${isAuthentic} → isAuthenticated=${isAuthenticatedAutograph}`);

            const mapperInput = {
              final_grade: gradingData.conversational_decimal_grade,
              centering: {
                front_lr: parseCentering(centeringRatios.front_lr),
                front_tb: parseCentering(centeringRatios.front_tb),
                back_lr: parseCentering(centeringRatios.back_lr),
                back_tb: parseCentering(centeringRatios.back_tb)
              },
              corners_score: gradingData.conversational_sub_scores?.corners?.weighted,
              edges_score: gradingData.conversational_sub_scores?.edges?.weighted,
              surface_score: gradingData.conversational_sub_scores?.surface?.weighted,
              has_structural_damage: jsonData.structural_damage?.detected || false,
              has_handwriting: jsonData.handwriting?.detected || false,
              has_alterations: jsonData.alterations?.detected || false,
              crease_detected: jsonData.structural_damage?.has_creases || false,
              bent_corner_detected: jsonData.structural_damage?.has_bent_corners || false,
              // If autograph is authenticated, don't treat as alteration
              is_authenticated_autograph: isAuthenticatedAutograph
            };

            const professionalEstimates = estimateProfessionalGrades(mapperInput);
            gradingData.estimated_professional_grades = professionalEstimates;

            // Update card_info with derived autographed flag for frontend display
            if (isAuthenticatedAutograph && gradingData.conversational_card_info) {
              gradingData.conversational_card_info = {
                ...gradingData.conversational_card_info,
                autographed: true
              };
              console.log(`[GET /api/other/${cardId}] ✅ Set card_info.autographed = true (authenticated autograph detected)`);
            }

            console.log(`[GET /api/other/${cardId}] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}, SGC ${professionalEstimates.SGC.estimated_grade}, CGC ${professionalEstimates.CGC.estimated_grade}`);
          } catch (mapperError) {
            console.error(`[GET /api/other/${cardId}] ⚠️ Professional mapper failed:`, mapperError);
            gradingData.estimated_professional_grades = null;
          }
        } else {
          console.log(`[GET /api/other/${cardId}] ⏭️ Skipping professional mapper (grade is N/A or null)`);
          gradingData.estimated_professional_grades = null;
        }
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
