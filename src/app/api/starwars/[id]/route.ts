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
// CARD IDENTIFICATION: Local Supabase database lookup for Star Wars cards
import { lookupStarWarsCard } from "@/lib/starwarsCardMatcher";

// Vercel serverless function configuration
// maxDuration: Maximum execution time in seconds (Pro plan supports up to 300s)
// GPT-5.1 with large prompts + vision can take 60-90 seconds, with retries up to 5 minutes
export const maxDuration = 300;

// Track Star Wars cards currently being processed with timestamps
const processingStarWarsCards = new Map<string, number>();

// Clean up stuck processing cards (older than 2 minutes - reduced from 5 to prevent long lock-outs)
const cleanupStuckCards = () => {
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);

  for (const [cardId, timestamp] of processingStarWarsCards.entries()) {
    if (timestamp < twoMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set (was locked for ${Math.round((now - timestamp) / 1000)}s)`);
      processingStarWarsCards.delete(cardId);
    }
  }
};

// Types
type StarWarsCardGradingRequest = {
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

// Extract Star Wars card grade information
function extractStarWarsGradeInfo(gradingResult: any) {
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

// Extract key fields for database columns (Star Wars-specific) - Legacy Assistant API
function extractStarWarsCardFields(gradingResult: any) {
  const cardInfo = gradingResult["Card Information"] || {};
  const cardDetails = gradingResult["Card Details"] || {};
  const estimatedValue = gradingResult["DCM Estimated Value"] || {};

  return {
    card_name: cardInfo["Card Name"] || null,
    card_set: cardInfo["Card Set"] || null,
    card_number: cardInfo["Card Number"] || cardInfo["Card ID"] || null,
    serial_numbering: cardInfo["Serial Numbering"] || null,
    manufacturer_name: cardInfo["Manufacturer Name"] || 'Topps',
    release_date: cardInfo["Release Date"] || null,
    authentic: cardInfo["Authentic"] || null,
    // Star Wars-specific fields
    sw_card_type: cardDetails["Card Type"] || null,
    sw_faction: cardDetails["Faction"] || null,
    sw_era: cardDetails["Era"] || null,
    sw_rarity: cardDetails["Rarity"] || null,
    rarity_description: cardDetails["Rarity"] || null,
    autographed: cardDetails["Autographed"] || null,
    is_foil: cardDetails["Foil"] || cardDetails["Parallel"] || false,
    estimated_market_value: estimatedValue["Estimated Market Value"] || null,
    estimated_range: estimatedValue["Estimated Range"] || null,
    estimate_confidence: estimatedValue["Estimate Confidence"] || null
  };
}

// Extract Star Wars-specific fields from conversational v4.2 JSON
function extractStarWarsFieldsFromConversational(conversationalJSON: any) {
  try {
    const data = typeof conversationalJSON === 'string' ? JSON.parse(conversationalJSON) : conversationalJSON;
    const cardInfo = data.card_info || {};

    return {
      // Standard fields
      card_name: cardInfo.card_name || null,
      card_set: cardInfo.set_name || null,
      card_number: cardInfo.card_id || cardInfo.card_number || null,
      release_date: cardInfo.set_year || cardInfo.year || null,
      manufacturer_name: cardInfo.manufacturer || 'Topps',
      serial_numbering: cardInfo.serial_number || null,
      authentic: cardInfo.authentic !== undefined ? cardInfo.authentic : null,
      rarity_description: cardInfo.rarity || cardInfo.rarity_or_variant || null,
      autographed: cardInfo.autographed !== undefined ? cardInfo.autographed : null,
      featured: cardInfo.player_or_character || null,

      // Star Wars-specific fields
      sw_card_type: cardInfo.sw_card_type || cardInfo.card_type || null,
      sw_faction: cardInfo.sw_faction || cardInfo.faction || null,
      sw_era: cardInfo.sw_era || cardInfo.era || null,
      sw_rarity: cardInfo.sw_rarity || cardInfo.rarity || null,
      is_foil: cardInfo.is_foil !== undefined ? cardInfo.is_foil : false
    };
  } catch (error) {
    console.error('[Star Wars Field Extraction] Error parsing conversational JSON:', error);
    return {};
  }
}

// Main GET handler for Star Wars cards
export async function GET(request: NextRequest, { params }: StarWarsCardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  // Check for query parameters
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';
  const statusOnly = searchParams.get('status_only') === 'true';

  console.log(`[GET /api/starwars/${cardId}] Starting Star Wars card request (force_regrade: ${forceRegrade}, status_only: ${statusOnly})`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // STATUS-ONLY MODE: Just return the current card state without acquiring lock or starting grading
  // This is used by the background polling system to check if grading is complete
  if (statusOnly) {
    console.log(`[GET /api/starwars/${cardId}] Status-only check requested`);

    const supabase = supabaseServer();
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, conversational_grading, raw_decimal_grade, dcm_grade_whole, category")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.log(`[GET /api/starwars/${cardId}] Status-only 404: error=${cardError?.message || 'none'}, code=${cardError?.code || 'none'}`);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Verify it's a Star Wars card
    if (card.category !== 'Star Wars') {
      return NextResponse.json({ error: "Not a Star Wars card" }, { status: 404 });
    }

    // Check if card has complete grading
    const hasCompleteGrading =
      (card.conversational_grading && card.conversational_grading.length > 0) ||
      (card.raw_decimal_grade && card.dcm_grade_whole);

    // Check if currently processing (in the lock map)
    const isProcessing = processingStarWarsCards.has(cardId);

    console.log(`[GET /api/starwars/${cardId}] Status-only result: complete=${hasCompleteGrading}, processing=${isProcessing}`);

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

  // Check if already processing this Star Wars card
  if (processingStarWarsCards.has(cardId)) {
    console.log(`[GET /api/starwars/${cardId}] Star Wars card already being processed, returning 429`);
    return NextResponse.json(
      { error: "Star Wars card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingStarWarsCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get Star Wars card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .eq("category", "Star Wars") // Ensure it's a Star Wars card
      .single();

    if (cardError || !card) {
      console.error(`[GET /api/starwars/${cardId}] Card lookup error:`, cardError);
      console.log(`[GET /api/starwars/${cardId}] Card data:`, card);
      return NextResponse.json({ error: "Star Wars card not found" }, { status: 404 });
    }

    console.log(`[GET /api/starwars/${cardId}] Star Wars card found`);

    // VISIBILITY CHECK: Verify user has permission to view this card
    const cardVisibility = card.visibility || 'private'; // Default to private if not set

    if (cardVisibility === 'private') {
      // Private card - only owner can view
      // Get user_id from query parameter (client-side directAuth uses localStorage)
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('user_id');

      if (!userId) {
        console.log(`[GET /api/starwars/${cardId}] Private card access denied - not authenticated`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card. Please log in if this is your card.",
          visibility: "private"
        }, { status: 403 });
      }

      if (card.user_id !== userId) {
        console.log(`[GET /api/starwars/${cardId}] Private card access denied - user ${userId} is not owner ${card.user_id}`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card.",
          visibility: "private"
        }, { status: 403 });
      }

      console.log(`[GET /api/starwars/${cardId}] Private card access granted to owner ${userId}`);
    } else {
      // Public card - anyone can view
      console.log(`[GET /api/starwars/${cardId}] Public card - access granted`);
    }

    // ⭐ Fetch card owner's founder status, VIP status, and Card Lovers status (for emblems on card labels)
    let ownerIsFounder = false;
    let ownerShowFounderBadge = false;
    let ownerIsVip = false;
    let ownerShowVipBadge = false;
    let ownerIsCardLover = false;
    let ownerShowCardLoverBadge = false;
    let ownerPreferredLabelEmblem: string = 'auto';
    if (card.user_id) {
      try {
        const ownerCredits = await getUserCredits(card.user_id);
        if (ownerCredits) {
          ownerIsFounder = ownerCredits.is_founder;
          ownerShowFounderBadge = ownerCredits.show_founder_badge;
          ownerIsVip = ownerCredits.is_vip;
          ownerShowVipBadge = ownerCredits.show_vip_badge;
          ownerIsCardLover = ownerCredits.is_card_lover;
          ownerShowCardLoverBadge = ownerCredits.show_card_lover_badge;
          ownerPreferredLabelEmblem = ownerCredits.preferred_label_emblem || 'auto';
        }
      } catch (err) {
        console.error(`[GET /api/starwars/${cardId}] Error fetching owner founder status:`, err);
      }
    }

    // Create signed URLs for Star Wars card images (parallel for speed)
    console.log(`[GET /api/starwars/${cardId}] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const [frontUrl, backUrl] = await Promise.all([
      createSignedUrl(supabase, "cards", card.front_path),
      createSignedUrl(supabase, "cards", card.back_path)
    ]);

    if (!frontUrl || !backUrl) {
      console.error(`[GET /api/starwars/${cardId}] Failed to create signed URLs. Front: ${frontUrl}, Back: ${backUrl}`);
      return NextResponse.json({ error: "Failed to access Star Wars card images" }, { status: 500 });
    }
    console.log(`[GET /api/starwars/${cardId}] Signed URLs created successfully`);

    // Check if Star Wars card already has complete grading data
    const hasCompleteGrading =
      (card.ai_grading && card.raw_decimal_grade && card.dcm_grade_whole) ||
      (card.ai_grading && card.conversational_grading && card.conversational_grading.length > 0);

    // Skip cache if force_regrade is requested
    if (hasCompleteGrading && !forceRegrade) {
      console.log(`[GET /api/starwars/${cardId}] Star Wars card already fully processed, returning existing result`);

      // Parse conversational_grading if it exists
      let parsedConversationalData = null;
      if (card.conversational_grading) {
        try {
          console.log('[STAR WARS CACHE] Parsing cached conversational_grading JSON...');
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
              console.log('[STAR WARS CACHE] Calculating professional grade estimates...');

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

              console.log(`[STAR WARS CACHE] Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}`);
            } catch (mapperError) {
              console.error('[STAR WARS CACHE] Professional mapper failed:', mapperError);
            }
          }

          console.log('[STAR WARS CACHE] Parsed cached JSON successfully');
        } catch (error) {
          console.error('[STAR WARS CACHE] Failed to parse cached JSON:', error);
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
        // ⭐ Card owner's founder/VIP/Card Lovers status (for emblems on public card labels)
        owner_is_founder: ownerIsFounder,
        owner_show_founder_badge: ownerShowFounderBadge,
        owner_is_vip: ownerIsVip,
        owner_show_vip_badge: ownerShowVipBadge,
        owner_is_card_lover: ownerIsCardLover,
        owner_show_card_lover_badge: ownerShowCardLoverBadge,
        owner_preferred_label_emblem: ownerPreferredLabelEmblem
      });
    }

    // If incomplete grading OR force_regrade is requested, process it
    if (!hasCompleteGrading) {
      console.log(`[GET /api/starwars/${cardId}] Star Wars card needs grading analysis`);
    } else if (forceRegrade) {
      console.log(`[GET /api/starwars/${cardId}] Force re-grade requested, bypassing cache`);
    }

    // PRIMARY: Conversational AI grading (v4.2 JSON format)
    console.log(`[GET /api/starwars/${cardId}] Starting Star Wars card conversational AI grading (v4.2)...`);
    let conversationalGradingResult = null;
    let conversationalResultV3_3: any = null;
    let isJSONMode = false;
    let gradingResult = null;

    if (frontUrl && backUrl) {
      try {
        console.log(`[STAR WARS CONVERSATIONAL AI v4.2] Starting PRIMARY grading with Star Wars-specific prompt...`);

        // Check if user provided condition report hints
        const userConditionReport = card.user_condition_processed || null;
        if (userConditionReport) {
          console.log(`[GET /api/starwars/${cardId}] User condition report found: ${userConditionReport.total_defects_reported || 0} defects reported`);
        }

        const conversationalResult = await gradeCardConversational(frontUrl, backUrl, 'starwars', {
          userConditionReport: userConditionReport
        });
        conversationalGradingResult = conversationalResult.markdown_report;

        // Store full result for enhanced data extraction
        conversationalResultV3_3 = conversationalResult;

        // Detect if we're using JSON format (version string contains 'json')
        isJSONMode = conversationalResult.meta?.version?.includes('json') === true;
        console.log(`[STAR WARS CONVERSATIONAL AI] Output format detected: ${isJSONMode ? 'JSON' : 'Markdown'} (${conversationalResult.meta?.version || 'unknown'})`);

        console.log(`[GET /api/starwars/${cardId}] Conversational grading completed: ${conversationalResult.extracted_grade?.decimal_grade || 'N/A'}`);

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
            console.error(`[GET /api/starwars/${cardId}] Failed to create legacy gradingResult:`, e);
          }
        }
      } catch (error: any) {
        console.error(`[GET /api/starwars/${cardId}] Conversational grading failed:`, error.message);
        return NextResponse.json({
          error: "Failed to grade Star Wars card. Please try again or contact support.",
          details: error.message
        }, { status: 500 });
      }
    }

    // Parse conversational JSON to extract structured fields
    let conversationalGradingData = null;
    if (conversationalGradingResult) {
      try {
        console.log(`[GET /api/starwars/${cardId}] Parsing conversational JSON...`);
        const jsonData = JSON.parse(conversationalGradingResult);

        console.log(`[GET /api/starwars/${cardId}] DEBUG Raw AI card_info:`, JSON.stringify(jsonData.card_info, null, 2));

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

        console.log(`[GET /api/starwars/${cardId}] Parsed conversational data:`, {
          grade: conversationalGradingData.decimal_grade,
          sub_scores: conversationalGradingData.sub_scores,
          has_defects: !!(conversationalGradingData.transformedDefects?.front)
        });

        // Call backend deterministic mapper for professional grade estimates
        if (conversationalGradingData.decimal_grade && conversationalGradingData.decimal_grade !== 'N/A') {
          try {
            console.log(`[GET /api/starwars/${cardId}] Calling professional grade mapper (deterministic)...`);

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

            console.log(`[GET /api/starwars/${cardId}] Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}, SGC ${professionalEstimates.SGC.estimated_grade}, CGC ${professionalEstimates.CGC.estimated_grade}`);
          } catch (mapperError) {
            console.error(`[GET /api/starwars/${cardId}] Professional mapper failed:`, mapperError);
            conversationalGradingData.professional_grade_estimates = null;
          }
        } else {
          console.log(`[GET /api/starwars/${cardId}] Skipping professional mapper (grade is N/A or null)`);
          conversationalGradingData.professional_grade_estimates = null;
        }

      } catch (error) {
        console.error(`[GET /api/starwars/${cardId}] Failed to parse conversational JSON:`, error);
      }
    }

    // DATABASE LOOKUP: Cross-reference AI identification with internal Star Wars database
    let matchedDatabaseCard: any = null;
    let databaseMatchConfidence: string | null = null;

    if (conversationalGradingData?.card_info) {
      try {
        const aiCardInfo = conversationalGradingData.card_info;
        console.log(`[GET /api/starwars/${cardId}] Looking up card in internal database...`);
        console.log(`[GET /api/starwars/${cardId}]   AI identified: name="${aiCardInfo.card_name}", card_number="${aiCardInfo.card_id || aiCardInfo.card_number}", set="${aiCardInfo.set_name}"`);

        const matchResult = await lookupStarWarsCard(
          aiCardInfo.card_name,
          aiCardInfo.card_id || aiCardInfo.card_number,
          aiCardInfo.set_name
        );

        if (matchResult.card && matchResult.confidence !== 'low') {
          matchedDatabaseCard = matchResult.card;
          databaseMatchConfidence = matchResult.confidence;

          console.log(`[GET /api/starwars/${cardId}] Database match found (${databaseMatchConfidence} confidence):`);
          console.log(`[GET /api/starwars/${cardId}]   DB: ${matchResult.card.card_name} (${matchResult.card.set_name}) #${matchResult.card.card_number}`);

          // Enhance card_info with verified database data
          const dbCard = matchResult.card;

          conversationalGradingData.card_info = {
            ...conversationalGradingData.card_info,
            // === CORE IDENTIFICATION (verified from database) ===
            card_name: dbCard.card_name,
            card_id: dbCard.id,
            card_number: dbCard.card_number,
            set_name: dbCard.set_name,
            // === STAR WARS-SPECIFIC ATTRIBUTES (from database) ===
            console_name: dbCard.console_name,
            genre: dbCard.genre,
            release_date: dbCard.release_date,
            // === PRICING (from database if available) ===
            market_price: dbCard.loose_price || dbCard.graded_price,
            loose_price: dbCard.loose_price,
            graded_price: dbCard.graded_price,
            // === DATABASE REFERENCE ===
            _database_match: {
              starwars_card_id: dbCard.id,
              match_confidence: databaseMatchConfidence,
              match_score: matchResult.score,
            }
          };

          console.log(`[GET /api/starwars/${cardId}] Card info enhanced with database data`);
        } else {
          console.log(`[GET /api/starwars/${cardId}] No high-confidence database match found`);
        }
      } catch (dbLookupError) {
        console.error(`[GET /api/starwars/${cardId}] Database lookup failed:`, dbLookupError);
      }
    }

    // Extract Star Wars card grade information
    const { rawGrade, wholeGrade, confidence } = extractStarWarsGradeInfo(gradingResult);

    // Extract key fields for database columns (Star Wars-specific)
    const cardFieldsLegacy = extractStarWarsCardFields(gradingResult);

    // Extract Star Wars-specific fields from conversational v4.2 JSON
    const cardFieldsConversational = conversationalGradingData?.card_info
      ? extractStarWarsFieldsFromConversational(conversationalGradingData)
      : {};

    // Merge fields: conversational v4.2 takes priority over legacy
    const cardFields = {
      ...cardFieldsLegacy,
      ...cardFieldsConversational
    };

    // Update database with comprehensive Star Wars card data
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
      // Legacy slab fields for frontend display
      slab_detected: conversationalGradingData?.professional_slab?.detected || (conversationalGradingData as any)?.slab_detection?.detected || false,
      slab_company: conversationalGradingData?.professional_slab?.company || (conversationalGradingData as any)?.slab_detection?.company || null,
      slab_grade: conversationalGradingData?.professional_slab?.grade || (conversationalGradingData as any)?.slab_detection?.grade || null,
      slab_grade_description: conversationalGradingData?.professional_slab?.grade_description || (conversationalGradingData as any)?.slab_detection?.grade_description || null,
      slab_cert_number: conversationalGradingData?.professional_slab?.cert_number || (conversationalGradingData as any)?.slab_detection?.cert_number || null,
      slab_serial: conversationalGradingData?.professional_slab?.serial_number || (conversationalGradingData as any)?.slab_detection?.serial_number || null,
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

      // Individual searchable/sortable columns (Star Wars-specific - merged from both sources)
      ...cardFields,

      // Database-matched card reference
      ...(matchedDatabaseCard && {
        starwars_card_id: matchedDatabaseCard.id,
        starwars_reference_image: matchedDatabaseCard.image_url || null,
        starwars_database_match_confidence: databaseMatchConfidence
      }),

      // Processing metadata
      processing_time: Date.now() - startTime
    };

    // Generate standardized label data for consistent display across all contexts
    const cardForLabel: CardForLabel = {
      id: cardId,
      category: 'Star Wars',
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

    console.log(`[GET /api/starwars/${cardId}] Generated label data:`, {
      primaryName: labelData.primaryName,
      contextLine: labelData.contextLine,
      featuresLine: labelData.featuresLine,
      grade: labelData.gradeFormatted
    });

    console.log(`[GET /api/starwars/${cardId}] Updating database with extracted Star Wars fields:`, {
      card_name: cardFields.card_name,
      card_set: cardFields.card_set,
      sw_card_type: cardFields.sw_card_type,
      sw_faction: cardFields.sw_faction,
      sw_era: cardFields.sw_era,
      grade: wholeGrade
    });

    // Try to update with all fields first
    let { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    // If update fails due to missing columns (migration not applied), retry without Star Wars specific columns
    if (updateError?.code === 'PGRST204') {
      console.warn(`[GET /api/starwars/${cardId}] Some columns not found, retrying without Star Wars specific columns. Run migration: migrations/add_starwars_card_reference_columns.sql`);

      // Remove Star Wars specific columns that may not exist
      const fallbackUpdateData = { ...updateData };
      delete (fallbackUpdateData as any).starwars_card_id;
      delete (fallbackUpdateData as any).starwars_reference_image;
      delete (fallbackUpdateData as any).starwars_database_match_confidence;
      delete (fallbackUpdateData as any).sw_card_type;
      delete (fallbackUpdateData as any).sw_faction;
      delete (fallbackUpdateData as any).sw_era;
      delete (fallbackUpdateData as any).sw_rarity;

      const { error: retryError } = await supabase
        .from("cards")
        .update(fallbackUpdateData)
        .eq("id", cardId);

      updateError = retryError;
    }

    if (updateError) {
      console.error(`[GET /api/starwars/${cardId}] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to save Star Wars card grading results" }, { status: 500 });
    }

    console.log(`[GET /api/starwars/${cardId}] Star Wars card request completed in ${Date.now() - startTime}ms`);

    // Fire-and-forget: Fetch pricing from PriceCharting (uses "Other" pricing which covers Star Wars)
    (async () => {
      try {
        const { searchOtherCardPrices, estimateOtherDcmValue, isOtherPricingEnabled } = await import("@/lib/otherPricing");
        if (!isOtherPricingEnabled()) return;

        const cardInfo = conversationalGradingData?.card_info || {};
        const pricingCardName = cardFields.card_name || cardInfo.card_name;
        if (!pricingCardName) return;

        console.log(`[GET /api/starwars/${cardId}] Fetching pricing for: ${pricingCardName}`);
        const result = await searchOtherCardPrices({
          cardName: pricingCardName,
          setName: cardFields.card_set || cardInfo.set_name,
          cardNumber: cardFields.card_number || cardInfo.card_number,
          year: cardFields.release_date || cardInfo.year,
          manufacturer: cardFields.manufacturer_name || cardInfo.manufacturer || 'Topps',
          variant: cardInfo.rarity_or_variant || cardInfo.variant_type,
        });

        if (result.prices) {
          const dcmGrade = conversationalGradingData?.decimal_grade || rawGrade;
          const estimatedValue = estimateOtherDcmValue(result.prices, dcmGrade);
          const priceUpdate: any = {
            dcm_price_estimate: estimatedValue,
            dcm_price_raw: result.prices.raw,
            dcm_price_updated_at: new Date().toISOString(),
            dcm_price_match_confidence: result.matchConfidence,
            dcm_price_product_id: result.prices.productId,
            dcm_price_product_name: result.prices.productName,
          };
          await supabase.from("cards").update(priceUpdate).eq("id", cardId);
          console.log(`[GET /api/starwars/${cardId}] Pricing saved: $${estimatedValue} (confidence: ${result.matchConfidence})`);
        }
      } catch (priceErr: any) {
        console.warn(`[GET /api/starwars/${cardId}] Pricing failed (non-blocking): ${priceErr.message}`);
      }
    })();

    // Return updated Star Wars card data with all structured fields
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
      // Legacy slab fields for frontend display
      slab_detected: conversationalGradingData?.professional_slab?.detected || (conversationalGradingData as any)?.slab_detection?.detected || false,
      slab_company: conversationalGradingData?.professional_slab?.company || (conversationalGradingData as any)?.slab_detection?.company || null,
      slab_grade: conversationalGradingData?.professional_slab?.grade || (conversationalGradingData as any)?.slab_detection?.grade || null,
      slab_grade_description: conversationalGradingData?.professional_slab?.grade_description || (conversationalGradingData as any)?.slab_detection?.grade_description || null,
      slab_cert_number: conversationalGradingData?.professional_slab?.cert_number || (conversationalGradingData as any)?.slab_detection?.cert_number || null,
      slab_serial: conversationalGradingData?.professional_slab?.serial_number || (conversationalGradingData as any)?.slab_detection?.serial_number || null,
      raw_decimal_grade: rawGrade,
      dcm_grade_whole: wholeGrade,
      ai_confidence_score: confidence,
      final_dcm_score: wholeGrade.toString(),
      ...cardFields,
      front_url: frontUrl,
      back_url: backUrl,
      processing_time: Date.now() - startTime,
      starwars_card_id: matchedDatabaseCard?.id || null,
      starwars_reference_image: matchedDatabaseCard?.image_url || null,
      starwars_database_match_confidence: databaseMatchConfidence,
      // ⭐ Card owner's founder/Card Lovers status (for emblems on public card labels)
      owner_is_founder: ownerIsFounder,
      owner_show_founder_badge: ownerShowFounderBadge,
      owner_is_card_lover: ownerIsCardLover,
      owner_show_card_lover_badge: ownerShowCardLoverBadge,
      owner_preferred_label_emblem: ownerPreferredLabelEmblem
    });

  } catch (error: any) {
    console.error(`[GET /api/starwars/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to process Star Wars card: " + error.message },
      { status: 500 }
    );
  } finally {
    processingStarWarsCards.delete(cardId);
    console.log(`[GET /api/starwars/${cardId}] Removed from processing set`);
  }
}

// PATCH handler for updating Star Wars card data (e.g., clearing cached grading)
export async function PATCH(request: NextRequest, { params }: StarWarsCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[PATCH /api/starwars/${cardId}] Starting Star Wars card update request`);

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

    console.log(`[PATCH /api/starwars/${cardId}] Update data:`, body);

    // Update the Star Wars card
    const { data, error } = await supabase
      .from("cards")
      .update(body)
      .eq("id", cardId)
      .select()
      .single();

    if (error) {
      console.error(`[PATCH /api/starwars/${cardId}] Update failed:`, error);
      return NextResponse.json({ error: "Failed to update Star Wars card" }, { status: 500 });
    }

    console.log(`[PATCH /api/starwars/${cardId}] Star Wars card updated successfully`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[PATCH /api/starwars/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to update Star Wars card: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE handler for removing Star Wars cards
export async function DELETE(request: NextRequest, { params }: StarWarsCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[DELETE /api/starwars/${cardId}] Starting Star Wars card deletion request`);

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Get the Star Wars card and verify ownership
    const { data: card, error: fetchError } = await supabase
      .from("cards")
      .select("front_path, back_path, user_id")
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      console.error(`[DELETE /api/starwars/${cardId}] Star Wars card not found:`, fetchError);
      return NextResponse.json({ error: "Star Wars card not found" }, { status: 404 });
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

    // Delete Star Wars card record
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error(`[DELETE /api/starwars/${cardId}] Deletion failed:`, deleteError);
      return NextResponse.json({ error: "Failed to delete Star Wars card" }, { status: 500 });
    }

    console.log(`[DELETE /api/starwars/${cardId}] Star Wars card deleted successfully`);
    return NextResponse.json({ success: true, message: "Star Wars card deleted successfully" });

  } catch (error: any) {
    console.error(`[DELETE /api/starwars/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to delete Star Wars card: " + error.message },
      { status: 500 }
    );
  }
}
