import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
// PRIMARY: Conversational grading system (matches sports card flow)
import { gradeCardConversational } from "@/lib/visionGrader";
// Professional grade estimation (deterministic backend mapper)
import { estimateProfessionalGrades } from "@/lib/professionalGradeMapper";
// Label data generation for consistent display across all contexts
import { generateLabelData, type CardForLabel } from "@/lib/labelDataGenerator";
// Grade/summary mismatch fixer (v6.2)
import { fixSummaryGradeMismatch } from "@/lib/cardGradingSchema_v5";
// Founder status for card owner
import { getUserCredits } from "@/lib/credits";
// CARD IDENTIFICATION: Local Supabase database lookup for One Piece cards
import { lookupOnePieceCard, type OnePieceCard } from "@/lib/onepieceCardMatcher";

// Vercel serverless function configuration
// maxDuration: Maximum execution time in seconds (Pro plan supports up to 300s)
// GPT-5.1 with large prompts + vision can take 60-90 seconds, with retries up to 5 minutes
export const maxDuration = 300;

// Track One Piece cards currently being processed with timestamps
const processingOnePieceCards = new Map<string, number>();

// Clean up stuck processing cards (older than 2 minutes - reduced from 5 to prevent long lock-outs)
const cleanupStuckCards = () => {
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);

  for (const [cardId, timestamp] of processingOnePieceCards.entries()) {
    if (timestamp < twoMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set (was locked for ${Math.round((now - timestamp) / 1000)}s)`);
      processingOnePieceCards.delete(cardId);
    }
  }
};

// Types
type OnePieceCardGradingRequest = {
  params: Promise<{ id: string }>;
};

// Signed URL generation
async function createSignedUrl(supabase: any, bucket: string, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
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

// Extract One Piece card grade information
function extractOnePieceGradeInfo(gradingResult: any) {
  const finalGrade = gradingResult["Final DCM Grade"] || gradingResult["Final Score"] || {};
  const gradingScale = gradingResult["Grading (DCM Master Scale)"] || {};
  const dcmSystem = gradingResult["DCM Score System"] || {};

  const rawGrade = gradingScale["Raw Decimal Grade (Before Rounding)"] || finalGrade["Raw Grade"] || 0;
  const wholeGrade = gradingScale["DCM Grade (Final Whole Number)"] || dcmSystem["Condition Grade (Base)"] || Math.round(Number(rawGrade)) || 0;
  const confidence = dcmSystem["AI Confidence Score"] || finalGrade["Confidence Level"] || "Medium";

  return {
    rawGrade: Number(rawGrade),
    wholeGrade: Number(wholeGrade),
    confidence
  };
}

// Extract key fields for database columns (One Piece-specific) - Legacy Assistant API
function extractOnePieceCardFields(gradingResult: any) {
  const cardInfo = gradingResult["Card Information"] || {};
  const cardDetails = gradingResult["Card Details"] || {};
  const estimatedValue = gradingResult["DCM Estimated Value"] || {};

  return {
    card_name: cardInfo["Card Name"] || null,
    card_set: cardInfo["Card Set"] || null,
    card_number: cardInfo["Card Number"] || cardInfo["Card ID"] || null,
    serial_numbering: cardInfo["Serial Numbering"] || null,
    manufacturer_name: cardInfo["Manufacturer Name"] || 'Bandai',
    release_date: cardInfo["Release Date"] || null,
    authentic: cardInfo["Authentic"] || null,
    // One Piece-specific fields
    op_card_color: cardDetails["Card Color"] || null,
    op_card_type: cardDetails["Card Type"] || null,
    op_card_power: cardDetails["Power"] || null,
    op_card_cost: cardDetails["Cost"] || null,
    op_life: cardDetails["Life"] || null,
    op_counter: cardDetails["Counter"] || null,
    op_attribute: cardDetails["Attribute"] || null,
    op_sub_types: cardDetails["Sub Types"] || cardDetails["Traits"] || null,
    op_variant_type: cardDetails["Variant Type"] || null,
    rarity_description: cardDetails["Rarity"] || null,
    autographed: cardDetails["Autographed"] || null,
    is_foil: cardDetails["Foil"] || cardDetails["Parallel"] || false,
    estimated_market_value: estimatedValue["Estimated Market Value"] || null,
    estimated_range: estimatedValue["Estimated Range"] || null,
    estimate_confidence: estimatedValue["Estimate Confidence"] || null
  };
}

// Extract One Piece-specific fields from conversational v4.2 JSON
function extractOnePieceFieldsFromConversational(conversationalJSON: any) {
  try {
    const data = typeof conversationalJSON === 'string' ? JSON.parse(conversationalJSON) : conversationalJSON;
    const cardInfo = data.card_info || {};

    return {
      // Standard fields
      card_name: cardInfo.card_name || null,
      card_set: cardInfo.set_name || null,
      card_number: cardInfo.card_id || cardInfo.card_number || null,
      release_date: cardInfo.set_year || cardInfo.year || null,
      manufacturer_name: cardInfo.manufacturer || 'Bandai',
      serial_numbering: cardInfo.serial_number || null,
      authentic: cardInfo.authentic !== undefined ? cardInfo.authentic : null,
      rarity_description: cardInfo.rarity || cardInfo.rarity_or_variant || null,
      autographed: cardInfo.autographed !== undefined ? cardInfo.autographed : null,
      featured: cardInfo.player_or_character || null,

      // One Piece-specific fields
      op_card_color: cardInfo.card_color || null,
      op_card_type: cardInfo.op_card_type || cardInfo.card_type || null,
      op_card_power: cardInfo.card_power || null,
      op_card_cost: cardInfo.card_cost || null,
      op_life: cardInfo.life || null,
      op_counter: cardInfo.counter_amount || null,
      op_attribute: cardInfo.attribute || null,
      op_sub_types: cardInfo.sub_types || null,
      op_variant_type: cardInfo.variant_type || null,
      is_foil: cardInfo.is_foil !== undefined ? cardInfo.is_foil : false
    };
  } catch (error) {
    console.error('[One Piece Field Extraction] Error parsing conversational JSON:', error);
    return {};
  }
}

// Main GET handler for One Piece cards
export async function GET(request: NextRequest, { params }: OnePieceCardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  // Check for query parameters
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';
  const statusOnly = searchParams.get('status_only') === 'true';

  console.log(`[GET /api/onepiece/${cardId}] Starting One Piece card request (force_regrade: ${forceRegrade}, status_only: ${statusOnly})`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // STATUS-ONLY MODE: Just return the current card state without acquiring lock or starting grading
  // This is used by the background polling system to check if grading is complete
  if (statusOnly) {
    console.log(`[GET /api/onepiece/${cardId}] Status-only check requested`);

    const supabase = supabaseServer();
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, conversational_grading, raw_decimal_grade, dcm_grade_whole, category")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.log(`[GET /api/onepiece/${cardId}] Status-only 404: error=${cardError?.message || 'none'}, code=${cardError?.code || 'none'}`);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Verify it's a One Piece card
    if (card.category !== 'One Piece') {
      return NextResponse.json({ error: "Not a One Piece card" }, { status: 404 });
    }

    // Check if card has complete grading
    const hasCompleteGrading =
      (card.conversational_grading && card.conversational_grading.length > 0) ||
      (card.raw_decimal_grade && card.dcm_grade_whole);

    // Check if currently processing (in the lock map)
    const isProcessing = processingOnePieceCards.has(cardId);

    console.log(`[GET /api/onepiece/${cardId}] Status-only result: complete=${hasCompleteGrading}, processing=${isProcessing}`);

    return NextResponse.json({
      id: cardId,
      status: hasCompleteGrading ? 'complete' : (isProcessing ? 'processing' : 'pending'),
      has_grading: hasCompleteGrading,
      is_processing: isProcessing
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  }

  // Check if already processing this One Piece card
  if (processingOnePieceCards.has(cardId)) {
    console.log(`[GET /api/onepiece/${cardId}] One Piece card already being processed, returning 429`);
    return NextResponse.json(
      { error: "One Piece card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingOnePieceCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get One Piece card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .eq("category", "One Piece") // Ensure it's a One Piece card
      .single();

    if (cardError || !card) {
      console.error(`[GET /api/onepiece/${cardId}] Card lookup error:`, cardError);
      console.log(`[GET /api/onepiece/${cardId}] Card data:`, card);
      return NextResponse.json({ error: "One Piece card not found" }, { status: 404 });
    }

    console.log(`[GET /api/onepiece/${cardId}] One Piece card found`);

    // VISIBILITY CHECK: Verify user has permission to view this card
    const cardVisibility = card.visibility || 'private'; // Default to private if not set

    if (cardVisibility === 'private') {
      // Private card - only owner can view
      // Get user_id from query parameter (client-side directAuth uses localStorage)
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('user_id');

      if (!userId) {
        console.log(`[GET /api/onepiece/${cardId}] Private card access denied - not authenticated`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card. Please log in if this is your card.",
          visibility: "private"
        }, { status: 403 });
      }

      if (card.user_id !== userId) {
        console.log(`[GET /api/onepiece/${cardId}] Private card access denied - user ${userId} is not owner ${card.user_id}`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card.",
          visibility: "private"
        }, { status: 403 });
      }

      console.log(`[GET /api/onepiece/${cardId}] Private card access granted to owner ${userId}`);
    } else {
      // Public card - anyone can view
      console.log(`[GET /api/onepiece/${cardId}] Public card - access granted`);
    }

    // Fetch card owner's founder status (for founder emblem on card labels)
    let ownerIsFounder = false;
    let ownerShowFounderBadge = false;
    if (card.user_id) {
      try {
        const ownerCredits = await getUserCredits(card.user_id);
        if (ownerCredits) {
          ownerIsFounder = ownerCredits.is_founder;
          ownerShowFounderBadge = ownerCredits.show_founder_badge;
        }
      } catch (err) {
        console.error(`[GET /api/onepiece/${cardId}] Error fetching owner founder status:`, err);
      }
    }

    // Create signed URLs for One Piece card images (parallel for speed)
    console.log(`[GET /api/onepiece/${cardId}] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const [frontUrl, backUrl] = await Promise.all([
      createSignedUrl(supabase, "cards", card.front_path),
      createSignedUrl(supabase, "cards", card.back_path)
    ]);

    if (!frontUrl || !backUrl) {
      console.error(`[GET /api/onepiece/${cardId}] Failed to create signed URLs. Front: ${frontUrl}, Back: ${backUrl}`);
      return NextResponse.json({ error: "Failed to access One Piece card images" }, { status: 500 });
    }
    console.log(`[GET /api/onepiece/${cardId}] Signed URLs created successfully`);

    // Check if One Piece card already has complete grading data
    const hasCompleteGrading =
      (card.ai_grading && card.raw_decimal_grade && card.dcm_grade_whole) ||
      (card.ai_grading && card.conversational_grading && card.conversational_grading.length > 0);

    // Skip cache if force_regrade is requested
    if (hasCompleteGrading && !forceRegrade) {
      console.log(`[GET /api/onepiece/${cardId}] One Piece card already fully processed, returning existing result`);

      // Parse conversational_grading if it exists
      let parsedConversationalData = null;
      if (card.conversational_grading) {
        try {
          console.log('[ONE PIECE CACHE] Parsing cached conversational_grading JSON...');
          const jsonData = JSON.parse(card.conversational_grading);

          // v6.0 THREE-PASS: Check for grading_passes.averaged_rounded in cached data
          const threePassData = jsonData.grading_passes;
          const avgRounded = threePassData?.averaged_rounded;

          // v6.2: Fix any grade mismatches in cached summary text
          const cachedDecimalGrade = avgRounded?.final ?? jsonData.final_grade?.decimal_grade ?? null;
          const cachedRawSummary = jsonData.final_grade?.summary || null;
          const cachedCorrectedSummary = cachedRawSummary && cachedDecimalGrade !== null
            ? fixSummaryGradeMismatch(cachedRawSummary, cachedDecimalGrade)
            : cachedRawSummary;

          parsedConversationalData = {
            decimal_grade: cachedDecimalGrade,
            whole_grade: avgRounded?.final ? Math.floor(avgRounded.final) : (jsonData.final_grade?.whole_grade ?? null),
            grade_range: jsonData.final_grade?.grade_range || '±0.5',
            condition_label: jsonData.final_grade?.condition_label || null,
            final_grade_summary: cachedCorrectedSummary,
            image_confidence: jsonData.image_quality?.confidence_letter || null,
            sub_scores: {
              centering: {
                front: jsonData.raw_sub_scores?.centering_front || 0,
                back: jsonData.raw_sub_scores?.centering_back || 0,
                weighted: avgRounded?.centering ?? jsonData.weighted_scores?.centering_weighted ?? 0
              },
              corners: {
                front: jsonData.raw_sub_scores?.corners_front || 0,
                back: jsonData.raw_sub_scores?.corners_back || 0,
                weighted: avgRounded?.corners ?? jsonData.weighted_scores?.corners_weighted ?? 0
              },
              edges: {
                front: jsonData.raw_sub_scores?.edges_front || 0,
                back: jsonData.raw_sub_scores?.edges_back || 0,
                weighted: avgRounded?.edges ?? jsonData.weighted_scores?.edges_weighted ?? 0
              },
              surface: {
                front: jsonData.raw_sub_scores?.surface_front || 0,
                back: jsonData.raw_sub_scores?.surface_back || 0,
                weighted: avgRounded?.surface ?? jsonData.weighted_scores?.surface_weighted ?? 0
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
              console.log('[ONE PIECE CACHE] Calculating professional grade estimates...');

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
                has_alterations: jsonData.alteration_detection?.altered || jsonData.alterations?.detected || false,
                crease_detected: jsonData.structural_damage?.has_creases || false,
                bent_corner_detected: jsonData.structural_damage?.has_bent_corners || false,
                is_authenticated_autograph: isAuthenticatedAutograph
              };

              const professionalEstimates = estimateProfessionalGrades(mapperInput);
              parsedConversationalData.professional_grade_estimates = professionalEstimates;

              console.log(`[ONE PIECE CACHE] Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}`);
            } catch (mapperError) {
              console.error('[ONE PIECE CACHE] Professional mapper failed:', mapperError);
            }
          }

          console.log('[ONE PIECE CACHE] Parsed cached JSON successfully');
        } catch (error) {
          console.error('[ONE PIECE CACHE] Failed to parse cached JSON:', error);
        }
      }

      return NextResponse.json({
        ...card,
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
        back_url: backUrl,
        processing_time: card.processing_time,
        owner_is_founder: ownerIsFounder,
        owner_show_founder_badge: ownerShowFounderBadge
      });
    }

    // If incomplete grading OR force_regrade is requested, process it
    if (!hasCompleteGrading) {
      console.log(`[GET /api/onepiece/${cardId}] One Piece card needs grading analysis`);
    } else if (forceRegrade) {
      console.log(`[GET /api/onepiece/${cardId}] Force re-grade requested, bypassing cache`);
    }

    // PRIMARY: Conversational AI grading (v4.2 JSON format)
    console.log(`[GET /api/onepiece/${cardId}] Starting One Piece card conversational AI grading (v4.2)...`);
    let conversationalGradingResult = null;
    let conversationalResultV3_3: any = null;
    let isJSONMode = false;
    let gradingResult = null;

    if (frontUrl && backUrl) {
      try {
        console.log(`[ONE PIECE CONVERSATIONAL AI v4.2] Starting PRIMARY grading with One Piece-specific prompt...`);

        // Check if user provided condition report hints
        const userConditionReport = card.user_condition_processed || null;
        if (userConditionReport) {
          console.log(`[GET /api/onepiece/${cardId}] User condition report found: ${userConditionReport.total_defects_reported || 0} defects reported`);
        }

        const conversationalResult = await gradeCardConversational(frontUrl, backUrl, 'onepiece', {
          userConditionReport: userConditionReport
        });
        conversationalGradingResult = conversationalResult.markdown_report;

        // Store full result for enhanced data extraction
        conversationalResultV3_3 = conversationalResult;

        // Detect if we're using JSON format (version string contains 'json')
        isJSONMode = conversationalResult.meta?.version?.includes('json') === true;
        console.log(`[ONE PIECE CONVERSATIONAL AI] Output format detected: ${isJSONMode ? 'JSON' : 'Markdown'} (${conversationalResult.meta?.version || 'unknown'})`);

        console.log(`[GET /api/onepiece/${cardId}] Conversational grading completed: ${conversationalResult.extracted_grade?.decimal_grade || 'N/A'}`);

        // Create legacy gradingResult structure for backward compatibility
        if (conversationalGradingResult) {
          try {
            const jsonData = JSON.parse(conversationalGradingResult);
            gradingResult = {
              "Card Information": jsonData.card_info || {},
              "Grading (DCM Master Scale)": {
                "Raw Decimal Grade (Before Rounding)": jsonData.final_grade?.decimal_grade || 0,
                "DCM Grade (Final Whole Number)": jsonData.final_grade?.whole_grade || 0
              }
            };
          } catch (e) {
            console.error(`[GET /api/onepiece/${cardId}] Failed to create legacy gradingResult:`, e);
          }
        }
      } catch (error: any) {
        console.error(`[GET /api/onepiece/${cardId}] Conversational grading failed:`, error.message);
        return NextResponse.json({
          error: "Failed to grade One Piece card. Please try again or contact support.",
          details: error.message
        }, { status: 500 });
      }
    }

    // Parse conversational JSON to extract structured fields
    let conversationalGradingData = null;
    if (conversationalGradingResult) {
      try {
        console.log(`[GET /api/onepiece/${cardId}] Parsing conversational JSON...`);
        const jsonData = JSON.parse(conversationalGradingResult);

        console.log(`[GET /api/onepiece/${cardId}] DEBUG Raw AI card_info:`, JSON.stringify(jsonData.card_info, null, 2));

        // v6.2: Fix any grade mismatches in the summary text
        const actualDecimalGrade = jsonData.scoring?.final_grade ?? jsonData.final_grade?.decimal_grade ?? null;
        const rawSummary = jsonData.final_grade?.summary || null;
        const correctedSummary = rawSummary && actualDecimalGrade !== null
          ? fixSummaryGradeMismatch(rawSummary, actualDecimalGrade)
          : rawSummary;

        // Map JSON to structured data format
        conversationalGradingData = {
          decimal_grade: actualDecimalGrade,
          whole_grade: jsonData.scoring?.rounded_grade ?? jsonData.final_grade?.whole_grade ?? null,
          grade_range: jsonData.image_quality?.grade_uncertainty || jsonData.scoring?.grade_range || jsonData.final_grade?.grade_range || '±0.5',
          condition_label: jsonData.final_grade?.condition_label || null,
          final_grade_summary: correctedSummary,
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
              analysis: jsonData.surface?.front?.analysis || 'No analysis available',
              sub_score: jsonData.raw_sub_scores?.surface_front || 0,
              summary: jsonData.surface?.front_summary || jsonData.surface?.front?.summary || 'Surface analysis not available'
            },
            back_surface: {
              defects: jsonData.surface?.back?.defects || [],
              analysis: jsonData.surface?.back?.analysis || 'No analysis available',
              sub_score: jsonData.raw_sub_scores?.surface_back || 0,
              summary: jsonData.surface?.back_summary || jsonData.surface?.back?.summary || 'Surface analysis not available'
            }
          },
          transformedDefects: {
            front: jsonData.defect_summary?.front || null,
            back: jsonData.defect_summary?.back || null
          },
          card_info: jsonData.card_info || null,
          case_detection: jsonData.case_detection || null,
          professional_slab: jsonData.slab_detection || null,
          professional_grade_estimates: jsonData.professional_grade_estimates || null,
          meta: jsonData.metadata || null
        };

        console.log(`[GET /api/onepiece/${cardId}] Parsed conversational data:`, {
          grade: conversationalGradingData.decimal_grade,
          sub_scores: conversationalGradingData.sub_scores,
          has_defects: !!(conversationalGradingData.transformedDefects?.front)
        });

        // Call backend deterministic mapper for professional grade estimates
        if (conversationalGradingData.decimal_grade && conversationalGradingData.decimal_grade !== 'N/A') {
          try {
            console.log(`[GET /api/onepiece/${cardId}] Calling professional grade mapper (deterministic)...`);

            const parseCentering = (ratio: string): [number, number] | undefined => {
              if (!ratio || ratio === 'N/A') return undefined;
              const parts = ratio.split('/').map(p => parseInt(p.trim()));
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return [parts[0], parts[1]] as [number, number];
              }
              return undefined;
            };

            const autographType = jsonData.autograph?.type || 'none';
            const cardInfoData = jsonData.card_info || {};
            const rarityFeatures = jsonData.rarity_features || {};

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

            const mapperInput = {
              final_grade: conversationalGradingData.decimal_grade,
              centering: {
                front_lr: parseCentering(conversationalGradingData.centering_ratios?.front_lr),
                front_tb: parseCentering(conversationalGradingData.centering_ratios?.front_tb),
                back_lr: parseCentering(conversationalGradingData.centering_ratios?.back_lr),
                back_tb: parseCentering(conversationalGradingData.centering_ratios?.back_tb)
              },
              corners_score: conversationalGradingData.sub_scores?.corners?.weighted,
              edges_score: conversationalGradingData.sub_scores?.edges?.weighted,
              surface_score: conversationalGradingData.sub_scores?.surface?.weighted,
              has_structural_damage: jsonData.structural_damage?.detected || false,
              has_handwriting: jsonData.handwriting?.detected || false,
              has_alterations: jsonData.alteration_detection?.altered || jsonData.alterations?.detected || false,
              crease_detected: jsonData.structural_damage?.has_creases || false,
              bent_corner_detected: jsonData.structural_damage?.has_bent_corners || false,
              is_authenticated_autograph: isAuthenticatedAutograph
            };

            const professionalEstimates = estimateProfessionalGrades(mapperInput);
            conversationalGradingData.professional_grade_estimates = professionalEstimates;

            if (isAuthenticatedAutograph && conversationalGradingData.card_info) {
              conversationalGradingData.card_info = {
                ...conversationalGradingData.card_info,
                autographed: true
              };
            }

            console.log(`[GET /api/onepiece/${cardId}] Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}, SGC ${professionalEstimates.SGC.estimated_grade}, CGC ${professionalEstimates.CGC.estimated_grade}`);
          } catch (mapperError) {
            console.error(`[GET /api/onepiece/${cardId}] Professional mapper failed:`, mapperError);
            conversationalGradingData.professional_grade_estimates = null;
          }
        } else {
          console.log(`[GET /api/onepiece/${cardId}] Skipping professional mapper (grade is N/A or null)`);
          conversationalGradingData.professional_grade_estimates = null;
        }

      } catch (error) {
        console.error(`[GET /api/onepiece/${cardId}] Failed to parse conversational JSON:`, error);
      }
    }

    // DATABASE LOOKUP: Cross-reference AI identification with internal One Piece database
    let matchedDatabaseCard: OnePieceCard | null = null;
    let databaseMatchConfidence: string | null = null;

    if (conversationalGradingData?.card_info) {
      try {
        const aiCardInfo = conversationalGradingData.card_info;
        console.log(`[GET /api/onepiece/${cardId}] Looking up card in internal database...`);
        console.log(`[GET /api/onepiece/${cardId}]   AI identified: name="${aiCardInfo.card_name}", card_id="${aiCardInfo.card_id || aiCardInfo.card_number}", set="${aiCardInfo.set_name}"`);

        const matchResult = await lookupOnePieceCard({
          cardId: aiCardInfo.card_id || aiCardInfo.card_number,
          name: aiCardInfo.card_name,
          set: aiCardInfo.set_name
        });

        if (matchResult.card && matchResult.confidence.overallConfidence !== 'low') {
          matchedDatabaseCard = matchResult.card;
          databaseMatchConfidence = matchResult.confidence.overallConfidence;

          console.log(`[GET /api/onepiece/${cardId}] Database match found (${databaseMatchConfidence} confidence):`);
          console.log(`[GET /api/onepiece/${cardId}]   DB: ${matchResult.card.card_name} (${matchResult.card.set_name}) #${matchResult.card.id}`);
          console.log(`[GET /api/onepiece/${cardId}]   Rarity: ${matchResult.card.rarity}, Color: ${matchResult.card.card_color}`);

          // Enhance card_info with verified database data
          const dbCard = matchResult.card;

          conversationalGradingData.card_info = {
            ...conversationalGradingData.card_info,
            // === CORE IDENTIFICATION (verified from database) ===
            card_name: dbCard.card_name,
            card_id: dbCard.id,
            card_number: dbCard.card_number,
            set_name: dbCard.set_name,
            set_id: dbCard.set_id,
            // === ONE PIECE-SPECIFIC ATTRIBUTES (from database) ===
            card_color: dbCard.card_color,
            op_card_type: dbCard.card_type,
            card_power: dbCard.card_power,
            card_cost: dbCard.card_cost,
            life: dbCard.life,
            counter_amount: dbCard.counter_amount,
            attribute: dbCard.attribute,
            sub_types: dbCard.sub_types,
            // === RARITY & VARIANT (from database) ===
            rarity: dbCard.rarity,
            rarity_or_variant: dbCard.rarity,
            variant_type: dbCard.variant_type,
            // === PRICING (from database if available) ===
            market_price: dbCard.market_price,
            // === DATABASE REFERENCE ===
            _database_match: {
              onepiece_card_id: dbCard.id,
              match_confidence: databaseMatchConfidence,
              match_score: matchResult.score,
              image_url: dbCard.card_image
            }
          };

          console.log(`[GET /api/onepiece/${cardId}] Card info enhanced with database data`);
        } else {
          console.log(`[GET /api/onepiece/${cardId}] No high-confidence database match found`);
          if (matchResult.confidence.warnings.length > 0) {
            matchResult.confidence.warnings.forEach(w => console.log(`[GET /api/onepiece/${cardId}]   Warning: ${w}`));
          }
        }
      } catch (dbLookupError) {
        console.error(`[GET /api/onepiece/${cardId}] Database lookup failed:`, dbLookupError);
      }
    }

    // Extract One Piece card grade information
    const { rawGrade, wholeGrade, confidence } = extractOnePieceGradeInfo(gradingResult);

    // Extract key fields for database columns (One Piece-specific)
    const cardFieldsLegacy = extractOnePieceCardFields(gradingResult);

    // Extract One Piece-specific fields from conversational v4.2 JSON
    const cardFieldsConversational = conversationalGradingData?.card_info
      ? extractOnePieceFieldsFromConversational(conversationalGradingData)
      : {};

    // Merge fields: conversational v4.2 takes priority over legacy
    const cardFields = {
      ...cardFieldsLegacy,
      ...cardFieldsConversational
    };

    // Update database with comprehensive One Piece card data
    const updateData = {
      // Full AI grading JSON for comprehensive display
      ai_grading: gradingResult,

      // Conversational grading raw JSON
      conversational_grading: conversationalGradingResult,

      // Structured conversational grading fields (parsed from JSON)
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_grade_uncertainty: conversationalGradingData?.grade_range || null,
      conversational_final_grade_summary: conversationalGradingData?.final_grade_summary || null,
      conversational_sub_scores: conversationalGradingData?.sub_scores || null,
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_image_confidence: conversationalGradingData?.image_confidence || null,
      conversational_centering_ratios: conversationalGradingData?.centering_ratios || null,
      conversational_card_info: conversationalGradingData?.card_info || null,
      conversational_corners_edges_surface: conversationalGradingData?.corners_edges_surface || null,
      conversational_case_detection: conversationalGradingData?.case_detection || null,
      conversational_defects_front: conversationalGradingData?.transformedDefects?.front || null,
      conversational_defects_back: conversationalGradingData?.transformedDefects?.back || null,
      conversational_slab_detection: conversationalGradingData?.professional_slab || null,
      conversational_prompt_version: conversationalGradingData?.meta?.prompt_version || 'v4.2',
      conversational_evaluated_at: conversationalGradingData?.meta?.evaluated_at_utc ? new Date(conversationalGradingData.meta.evaluated_at_utc) : new Date(),

      // Professional grade estimates (PSA, BGS, SGC, etc.)
      estimated_professional_grades: conversationalGradingData?.professional_grade_estimates || null,

      // Enhanced conversational grading fields
      ...(conversationalResultV3_3 && {
        rarity_tier: conversationalResultV3_3.rarity_classification?.rarity_tier || null,
        serial_number_fraction: conversationalResultV3_3.rarity_classification?.serial_number_fraction || null,
        autograph_type: conversationalResultV3_3.rarity_classification?.autograph_type || null,
        memorabilia_type: conversationalResultV3_3.rarity_classification?.memorabilia_type || null,
        finish_material: conversationalResultV3_3.rarity_classification?.finish_material || null,
        rookie_flag: conversationalResultV3_3.rarity_classification?.rookie_flag || null,
        subset_insert_name: conversationalResultV3_3.rarity_classification?.subset_insert_name || null,
        special_attributes: conversationalResultV3_3.rarity_classification?.special_attributes?.join(', ') || null,
        rarity_notes: conversationalResultV3_3.rarity_classification?.rarity_notes || null,
        weighted_total_pre_cap: conversationalResultV3_3.grading_metadata?.weighted_total_pre_cap || null,
        capped_grade_reason: conversationalResultV3_3.grading_metadata?.capped_grade_reason || null,
        conservative_rounding_applied: conversationalResultV3_3.grading_metadata?.conservative_rounding_applied || false,
        lighting_conditions_notes: conversationalResultV3_3.grading_metadata?.lighting_conditions_notes || null,
        cross_side_verification_result: conversationalResultV3_3.grading_metadata?.cross_side_verification_result || null,
        defect_coordinates_front: conversationalResultV3_3.defect_coordinates_front || [],
        defect_coordinates_back: conversationalResultV3_3.defect_coordinates_back || [],
      }),

      // Grade information
      raw_decimal_grade: rawGrade,
      dcm_grade_whole: wholeGrade,
      ai_confidence_score: confidence,
      final_dcm_score: wholeGrade.toString(),

      // Individual searchable/sortable columns (One Piece-specific - merged from both sources)
      ...cardFields,

      // Database-matched card reference
      ...(matchedDatabaseCard && {
        onepiece_card_id: matchedDatabaseCard.id,
        onepiece_reference_image: matchedDatabaseCard.card_image,
        onepiece_database_match_confidence: databaseMatchConfidence
      }),

      // Processing metadata
      processing_time: Date.now() - startTime
    };

    // Generate standardized label data for consistent display across all contexts
    const cardForLabel: CardForLabel = {
      id: cardId,
      category: 'One Piece',
      serial: card.serial,
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_card_info: conversationalGradingData?.card_info || null,
      card_name: cardFields.card_name || card.card_name,
      card_set: cardFields.card_set || card.card_set,
      card_number: cardFields.card_number || card.card_number,
      featured: cardFields.featured || card.featured,
      release_date: cardFields.release_date || card.release_date,
    };
    const labelData = generateLabelData(cardForLabel);
    (updateData as any).label_data = labelData;

    console.log(`[GET /api/onepiece/${cardId}] Generated label data:`, {
      primaryName: labelData.primaryName,
      contextLine: labelData.contextLine,
      featuresLine: labelData.featuresLine,
      grade: labelData.gradeFormatted
    });

    console.log(`[GET /api/onepiece/${cardId}] Updating database with extracted One Piece fields:`, {
      card_name: cardFields.card_name,
      card_set: cardFields.card_set,
      op_card_color: cardFields.op_card_color,
      op_card_type: cardFields.op_card_type,
      op_variant_type: cardFields.op_variant_type,
      grade: wholeGrade
    });

    // Try to update with all fields first
    let { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    // If update fails due to missing columns (migration not applied), retry without One Piece specific columns
    if (updateError?.code === 'PGRST204') {
      console.warn(`[GET /api/onepiece/${cardId}] Some columns not found, retrying without One Piece specific columns. Run migration: migrations/add_onepiece_card_reference_columns.sql`);

      // Remove One Piece specific columns that may not exist
      const fallbackUpdateData = { ...updateData };
      delete (fallbackUpdateData as any).onepiece_card_id;
      delete (fallbackUpdateData as any).onepiece_reference_image;
      delete (fallbackUpdateData as any).onepiece_database_match_confidence;
      delete (fallbackUpdateData as any).op_card_type;
      delete (fallbackUpdateData as any).op_card_color;
      delete (fallbackUpdateData as any).op_card_power;
      delete (fallbackUpdateData as any).op_card_cost;
      delete (fallbackUpdateData as any).op_life;
      delete (fallbackUpdateData as any).op_counter;
      delete (fallbackUpdateData as any).op_attribute;
      delete (fallbackUpdateData as any).op_sub_types;
      delete (fallbackUpdateData as any).op_variant_type;

      const { error: retryError } = await supabase
        .from("cards")
        .update(fallbackUpdateData)
        .eq("id", cardId);

      updateError = retryError;
    }

    if (updateError) {
      console.error(`[GET /api/onepiece/${cardId}] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to save One Piece card grading results" }, { status: 500 });
    }

    console.log(`[GET /api/onepiece/${cardId}] One Piece card request completed in ${Date.now() - startTime}ms`);

    // Return updated One Piece card data with all structured fields
    return NextResponse.json({
      ...card,
      ai_grading: gradingResult,
      conversational_grading: conversationalGradingResult,
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_grade_uncertainty: conversationalGradingData?.grade_range || null,
      conversational_final_grade_summary: conversationalGradingData?.final_grade_summary || null,
      conversational_sub_scores: conversationalGradingData?.sub_scores || null,
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_image_confidence: conversationalGradingData?.image_confidence || null,
      conversational_centering_ratios: conversationalGradingData?.centering_ratios || null,
      conversational_card_info: conversationalGradingData?.card_info || null,
      conversational_corners_edges_surface: conversationalGradingData?.corners_edges_surface || null,
      conversational_case_detection: conversationalGradingData?.case_detection || null,
      conversational_defects_front: conversationalGradingData?.transformedDefects?.front || null,
      conversational_defects_back: conversationalGradingData?.transformedDefects?.back || null,
      conversational_slab_detection: conversationalGradingData?.professional_slab || null,
      raw_decimal_grade: rawGrade,
      dcm_grade_whole: wholeGrade,
      ai_confidence_score: confidence,
      final_dcm_score: wholeGrade.toString(),
      ...cardFields,
      front_url: frontUrl,
      back_url: backUrl,
      processing_time: Date.now() - startTime,
      onepiece_card_id: matchedDatabaseCard?.id || null,
      onepiece_reference_image: matchedDatabaseCard?.card_image || null,
      onepiece_database_match_confidence: databaseMatchConfidence,
      owner_is_founder: ownerIsFounder,
      owner_show_founder_badge: ownerShowFounderBadge
    });

  } catch (error: any) {
    console.error(`[GET /api/onepiece/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to process One Piece card: " + error.message },
      { status: 500 }
    );
  } finally {
    processingOnePieceCards.delete(cardId);
    console.log(`[GET /api/onepiece/${cardId}] Removed from processing set`);
  }
}

// PATCH handler for updating One Piece card data (e.g., clearing cached grading)
export async function PATCH(request: NextRequest, { params }: OnePieceCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[PATCH /api/onepiece/${cardId}] Starting One Piece card update request`);

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Verify user owns this card
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("user_id")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (card.user_id !== auth.userId) {
      return NextResponse.json({ error: "You can only update your own cards" }, { status: 403 });
    }

    const body = await request.json();

    console.log(`[PATCH /api/onepiece/${cardId}] Update data:`, body);

    // Update the One Piece card
    const { data, error } = await supabase
      .from("cards")
      .update(body)
      .eq("id", cardId)
      .select()
      .single();

    if (error) {
      console.error(`[PATCH /api/onepiece/${cardId}] Update failed:`, error);
      return NextResponse.json({ error: "Failed to update One Piece card" }, { status: 500 });
    }

    console.log(`[PATCH /api/onepiece/${cardId}] One Piece card updated successfully`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[PATCH /api/onepiece/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to update One Piece card: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE handler for removing One Piece cards
export async function DELETE(request: NextRequest, { params }: OnePieceCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[DELETE /api/onepiece/${cardId}] Starting One Piece card deletion request`);

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Get the One Piece card and verify ownership
    const { data: card, error: fetchError } = await supabase
      .from("cards")
      .select("front_path, back_path, user_id")
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      console.error(`[DELETE /api/onepiece/${cardId}] One Piece card not found:`, fetchError);
      return NextResponse.json({ error: "One Piece card not found" }, { status: 404 });
    }

    // Verify user owns this card
    if (card.user_id !== auth.userId) {
      return NextResponse.json({ error: "You can only delete your own cards" }, { status: 403 });
    }

    // Delete images from storage
    if (card.front_path) {
      await supabase.storage.from("cards").remove([card.front_path]);
    }
    if (card.back_path) {
      await supabase.storage.from("cards").remove([card.back_path]);
    }

    // Delete One Piece card record
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error(`[DELETE /api/onepiece/${cardId}] Deletion failed:`, deleteError);
      return NextResponse.json({ error: "Failed to delete One Piece card" }, { status: 500 });
    }

    console.log(`[DELETE /api/onepiece/${cardId}] One Piece card deleted successfully`);
    return NextResponse.json({ success: true, message: "One Piece card deleted successfully" });

  } catch (error: any) {
    console.error(`[DELETE /api/onepiece/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to delete One Piece card: " + error.message },
      { status: 500 }
    );
  }
}
