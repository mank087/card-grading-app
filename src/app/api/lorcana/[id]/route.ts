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
// CARD IDENTIFICATION: Local Supabase database lookup for Lorcana cards
import { lookupLorcanaCard, extractSetCodeFromCardNumber, type LorcanaCard } from "@/lib/lorcanaCardMatcher";

// Vercel serverless function configuration
// maxDuration: Maximum execution time in seconds (Pro plan supports up to 300s)
// GPT-5.1 with large prompts + vision can take 60-90 seconds, with retries up to 5 minutes
export const maxDuration = 300;

// Track Lorcana cards currently being processed with timestamps
const processingLorcanaCards = new Map<string, number>();

// Clean up stuck processing cards (older than 2 minutes - reduced from 5 to prevent long lock-outs)
const cleanupStuckCards = () => {
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);

  for (const [cardId, timestamp] of processingLorcanaCards.entries()) {
    if (timestamp < twoMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set (was locked for ${Math.round((now - timestamp) / 1000)}s)`);
      processingLorcanaCards.delete(cardId);
    }
  }
};

// Types
type LorcanaCardGradingRequest = {
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

// Extract Lorcana card grade information
function extractLorcanaGradeInfo(gradingResult: any) {
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

// Extract key fields for database columns (Lorcana-specific) - Legacy Assistant API
function extractLorcanaCardFields(gradingResult: any) {
  const cardInfo = gradingResult["Card Information"] || {};
  const cardDetails = gradingResult["Card Details"] || {};
  const estimatedValue = gradingResult["DCM Estimated Value"] || {};

  return {
    card_name: cardInfo["Card Name"] || null,
    card_set: cardInfo["Card Set"] || null,
    card_number: cardInfo["Card Number"] || null,
    serial_numbering: cardInfo["Serial Numbering"] || null,
    manufacturer_name: cardInfo["Manufacturer Name"] || 'Ravensburger',
    release_date: cardInfo["Release Date"] || null,
    authentic: cardInfo["Authentic"] || null,
    // Lorcana-specific fields
    ink_color: cardDetails["Ink Color"] || null,
    lorcana_card_type: cardDetails["Card Type"] || null,
    character_version: cardDetails["Character Version"] || null,
    inkwell: cardDetails["Inkwell"] || false,
    ink_cost: cardDetails["Ink Cost"] || null,
    strength: cardDetails["Strength"] || null,
    willpower: cardDetails["Willpower"] || null,
    lore_value: cardDetails["Lore Value"] || null,
    rarity_description: cardDetails["Rarity"] || null,
    autographed: cardDetails["Autographed"] || null,
    is_foil: cardDetails["Foil"] || false,
    is_enchanted: cardDetails["Enchanted"] || false,
    estimated_market_value: estimatedValue["Estimated Market Value"] || null,
    estimated_range: estimatedValue["Estimated Range"] || null,
    estimate_confidence: estimatedValue["Estimate Confidence"] || null
  };
}

// Extract Lorcana-specific fields from conversational v4.2 JSON
function extractLorcanaFieldsFromConversational(conversationalJSON: any) {
  try {
    const data = typeof conversationalJSON === 'string' ? JSON.parse(conversationalJSON) : conversationalJSON;
    const cardInfo = data.card_info || {};

    return {
      // Standard fields
      card_name: cardInfo.card_name || null,
      card_set: cardInfo.set_name || null,
      card_number: cardInfo.card_number || cardInfo.collector_number || null,
      release_date: cardInfo.set_year || cardInfo.year || null,
      manufacturer_name: cardInfo.manufacturer || 'Ravensburger',
      serial_numbering: cardInfo.serial_number || null,
      authentic: cardInfo.authentic !== undefined ? cardInfo.authentic : null,
      rarity_description: cardInfo.rarity_or_variant || null,
      autographed: cardInfo.autographed !== undefined ? cardInfo.autographed : null,
      featured: cardInfo.player_or_character || null,

      // Lorcana-specific fields (ALL 18+ fields from database)
      ink_color: cardInfo.ink_color || null,
      lorcana_card_type: cardInfo.lorcana_card_type || null,
      character_version: cardInfo.character_version || null,
      inkwell: cardInfo.inkwell !== undefined ? cardInfo.inkwell : false,
      ink_cost: cardInfo.ink_cost || null,
      strength: cardInfo.strength || null,
      willpower: cardInfo.willpower || null,
      lore_value: cardInfo.lore_value || null,
      move_cost: cardInfo.move_cost || null,
      quest_value: cardInfo.quest_value || null,
      classifications: cardInfo.classifications || null,
      abilities: cardInfo.abilities || null,
      flavor_text: cardInfo.flavor_text || null,
      is_enchanted: cardInfo.is_enchanted !== undefined ? cardInfo.is_enchanted : false,
      is_foil: cardInfo.is_foil !== undefined ? cardInfo.is_foil : false,
      expansion_code: cardInfo.expansion_code || null,
      artist_name: cardInfo.artist_name || null,
      language: cardInfo.language || 'English',
      franchise: cardInfo.franchise || 'Disney'
    };
  } catch (error) {
    console.error('[Lorcana Field Extraction] Error parsing conversational JSON:', error);
    return {};
  }
}

// Main GET handler for Lorcana cards
export async function GET(request: NextRequest, { params }: LorcanaCardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  // Check for query parameters
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';
  const statusOnly = searchParams.get('status_only') === 'true';

  console.log(`[GET /api/lorcana/${cardId}] Starting Lorcana card request (force_regrade: ${forceRegrade}, status_only: ${statusOnly})`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // STATUS-ONLY MODE: Just return the current card state without acquiring lock or starting grading
  // This is used by the background polling system to check if grading is complete
  if (statusOnly) {
    console.log(`[GET /api/lorcana/${cardId}] Status-only check requested`);

    const supabase = supabaseServer();
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, conversational_grading, raw_decimal_grade, dcm_grade_whole, category")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.log(`[GET /api/lorcana/${cardId}] Status-only 404: error=${cardError?.message || 'none'}, code=${cardError?.code || 'none'}`);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Verify it's a Lorcana card
    if (card.category !== 'Lorcana') {
      return NextResponse.json({ error: "Not a Lorcana card" }, { status: 404 });
    }

    // Check if card has complete grading
    const hasCompleteGrading =
      (card.conversational_grading && card.conversational_grading.length > 0) ||
      (card.raw_decimal_grade && card.dcm_grade_whole);

    // Check if currently processing (in the lock map)
    const isProcessing = processingLorcanaCards.has(cardId);

    console.log(`[GET /api/lorcana/${cardId}] Status-only result: complete=${hasCompleteGrading}, processing=${isProcessing}`);

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

  // Check if already processing this Lorcana card
  if (processingLorcanaCards.has(cardId)) {
    console.log(`[GET /api/lorcana/${cardId}] Lorcana card already being processed, returning 429`);
    return NextResponse.json(
      { error: "Lorcana card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingLorcanaCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get Lorcana card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .eq("category", "Lorcana") // Ensure it's a Lorcana card
      .single();

    if (cardError || !card) {
      console.error(`[GET /api/lorcana/${cardId}] Card lookup error:`, cardError);
      console.log(`[GET /api/lorcana/${cardId}] Card data:`, card);
      return NextResponse.json({ error: "Lorcana card not found" }, { status: 404 });
    }

    console.log(`[GET /api/lorcana/${cardId}] Lorcana card found`);

    // 🔒 VISIBILITY CHECK: Verify user has permission to view this card
    const cardVisibility = card.visibility || 'private'; // Default to private if not set

    if (cardVisibility === 'private') {
      // Private card - only owner can view
      // Get user_id from query parameter (client-side directAuth uses localStorage)
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('user_id');

      if (!userId) {
        console.log(`[GET /api/lorcana/${cardId}] 🔒 Private card access denied - not authenticated`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card. Please log in if this is your card.",
          visibility: "private"
        }, { status: 403 });
      }

      if (card.user_id !== userId) {
        console.log(`[GET /api/lorcana/${cardId}] 🔒 Private card access denied - user ${userId} is not owner ${card.user_id}`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card.",
          visibility: "private"
        }, { status: 403 });
      }

      console.log(`[GET /api/lorcana/${cardId}] ✅ Private card access granted to owner ${userId}`);
    } else {
      // Public card - anyone can view
      console.log(`[GET /api/lorcana/${cardId}] 🌐 Public card - access granted`);
    }

    // ⭐ Fetch card owner's founder status and Card Lovers status (for emblems on card labels)
    let ownerIsFounder = false;
    let ownerShowFounderBadge = false;
    let ownerIsCardLover = false;
    let ownerShowCardLoverBadge = false;
    let ownerPreferredLabelEmblem: string = 'both';
    if (card.user_id) {
      try {
        const ownerCredits = await getUserCredits(card.user_id);
        if (ownerCredits) {
          ownerIsFounder = ownerCredits.is_founder;
          ownerShowFounderBadge = ownerCredits.show_founder_badge;
          ownerIsCardLover = ownerCredits.is_card_lover;
          ownerShowCardLoverBadge = ownerCredits.show_card_lover_badge;
          ownerPreferredLabelEmblem = ownerCredits.preferred_label_emblem || 'both';
        }
      } catch (err) {
        console.error(`[GET /api/lorcana/${cardId}] Error fetching owner status:`, err);
      }
    }

    // Create signed URLs for Lorcana card images (parallel for speed)
    console.log(`[GET /api/lorcana/${cardId}] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const [frontUrl, backUrl] = await Promise.all([
      createSignedUrl(supabase, "cards", card.front_path),
      createSignedUrl(supabase, "cards", card.back_path)
    ]);

    if (!frontUrl || !backUrl) {
      console.error(`[GET /api/lorcana/${cardId}] Failed to create signed URLs. Front: ${frontUrl}, Back: ${backUrl}`);
      return NextResponse.json({ error: "Failed to access Lorcana card images" }, { status: 500 });
    }
    console.log(`[GET /api/lorcana/${cardId}] Signed URLs created successfully`);

    // Check if Lorcana card already has complete grading data
    // Card is complete if:
    // 1. Has ai_grading AND numeric grades (decimal AND whole), OR
    // 2. Has ai_grading AND N/A grade (null) with a complete conversational grading report (for altered cards)
    const hasCompleteGrading =
      (card.ai_grading && card.raw_decimal_grade && card.dcm_grade_whole) ||
      (card.ai_grading && card.conversational_grading && card.conversational_grading.length > 0);

    // Skip cache if force_regrade is requested
    if (hasCompleteGrading && !forceRegrade) {
      console.log(`[GET /api/lorcana/${cardId}] Lorcana card already fully processed, returning existing result`);

      // Parse conversational_grading if it exists and hasn't been parsed yet
      let parsedConversationalData = null;
      // ALWAYS parse conversational_grading to extract corners/edges/surface data
      if (card.conversational_grading) {
        try {
          console.log('[LORCANA CACHE] Parsing cached conversational_grading JSON...');
          const jsonData = JSON.parse(card.conversational_grading);

          // 🆕 v6.0 THREE-PASS: Check for grading_passes.averaged_rounded in cached data
          const threePassData = jsonData.grading_passes;
          const avgRounded = threePassData?.averaged_rounded;

          // 🔧 v6.2: Fix any grade mismatches in cached summary text
          const cachedDecimalGrade = avgRounded?.final ?? jsonData.final_grade?.decimal_grade ?? null;
          const cachedRawSummary = jsonData.final_grade?.summary || null;
          const cachedCorrectedSummary = cachedRawSummary && cachedDecimalGrade !== null
            ? fixSummaryGradeMismatch(cachedRawSummary, cachedDecimalGrade)
            : cachedRawSummary;

          parsedConversationalData = {
            // 🎯 THREE-PASS: Use averaged_rounded when available
            decimal_grade: cachedDecimalGrade,
            whole_grade: avgRounded?.final ? Math.floor(avgRounded.final) : (jsonData.final_grade?.whole_grade ?? null),
            grade_range: jsonData.final_grade?.grade_range || '±0.5',
            condition_label: jsonData.final_grade?.condition_label || null,
            final_grade_summary: cachedCorrectedSummary,
            image_confidence: jsonData.image_quality?.confidence_letter || null,
            // 🎯 THREE-PASS: Use averaged_rounded sub-scores when available
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
              // Centering summaries (for "Centering Details" section)
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
              console.log('[LORCANA CACHE] 🔧 Calculating professional grade estimates...');

              // Parse centering ratios from strings like "55/45" to [55, 45]
              const parseCentering = (ratio: string): [number, number] | undefined => {
                if (!ratio || ratio === 'N/A') return undefined;
                const parts = ratio.split('/').map(p => parseInt(p.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  return [parts[0], parts[1]] as [number, number];
                }
                return undefined;
              };

              // Check if autograph is manufacturer-authenticated
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

              console.log(`[LORCANA CACHE] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}`);
            } catch (mapperError) {
              console.error('[LORCANA CACHE] ⚠️ Professional mapper failed:', mapperError);
            }
          }

          console.log('[LORCANA CACHE] ✅ Parsed cached JSON successfully');
        } catch (error) {
          console.error('[LORCANA CACHE] ⚠️ Failed to parse cached JSON:', error);
        }
      }

      return NextResponse.json({
        ...card,
        // Add parsed conversational data if available
        ...(parsedConversationalData && {
          conversational_decimal_grade: parsedConversationalData.decimal_grade,
          conversational_whole_grade: parsedConversationalData.whole_grade,
          conversational_grade_uncertainty: parsedConversationalData.grade_range,
          conversational_final_grade_summary: parsedConversationalData.final_grade_summary,  // 🆕 Overall summary
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
        processing_time: card.processing_time,  // ✅ CRITICAL: Use stored value, NOT recalculated
        owner_is_founder: ownerIsFounder,
        owner_show_founder_badge: ownerShowFounderBadge,
        owner_is_card_lover: ownerIsCardLover,
        owner_show_card_lover_badge: ownerShowCardLoverBadge,
        owner_preferred_label_emblem: ownerPreferredLabelEmblem
      });
    }

    // If incomplete grading OR force_regrade is requested, process it
    if (!hasCompleteGrading) {
      console.log(`[GET /api/lorcana/${cardId}] Lorcana card needs grading analysis`);
    } else if (forceRegrade) {
      console.log(`[GET /api/lorcana/${cardId}] 🔄 Force re-grade requested, bypassing cache`);
    }

    // 🎯 PRIMARY: Conversational AI grading (v4.2 JSON format)
    console.log(`[GET /api/lorcana/${cardId}] Starting Lorcana card conversational AI grading (v4.2)...`);
    let conversationalGradingResult = null;
    let conversationalResultV3_3: any = null; // Store full result for enhanced data
    let isJSONMode = false; // Track if we're using JSON format
    let gradingResult = null; // Legacy field for backward compatibility

    if (frontUrl && backUrl) {
      try {
        console.log(`[LORCANA CONVERSATIONAL AI v4.2] 🎯 Starting PRIMARY grading with Lorcana-specific prompt...`);

        // Check if user provided condition report hints
        const userConditionReport = card.user_condition_processed || null;
        if (userConditionReport) {
          console.log(`[GET /api/lorcana/${cardId}] 📋 User condition report found: ${userConditionReport.total_defects_reported || 0} defects reported`);
        }

        const conversationalResult = await gradeCardConversational(frontUrl, backUrl, 'lorcana', {
          userConditionReport: userConditionReport
        });
        conversationalGradingResult = conversationalResult.markdown_report;

        // Store full result for enhanced data extraction
        conversationalResultV3_3 = conversationalResult;

        // Detect if we're using JSON format (version string contains 'json')
        isJSONMode = conversationalResult.meta?.version?.includes('json') === true;
        console.log(`[LORCANA CONVERSATIONAL AI] Output format detected: ${isJSONMode ? 'JSON' : 'Markdown'} (${conversationalResult.meta?.version || 'unknown'})`);

        console.log(`[GET /api/lorcana/${cardId}] ✅ Conversational grading completed: ${conversationalResult.extracted_grade?.decimal_grade || 'N/A'}`);

        // Create legacy gradingResult structure for backward compatibility
        // This ensures old code paths still work while we transition fully to conversational
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
            console.error(`[GET /api/lorcana/${cardId}] Failed to create legacy gradingResult:`, e);
          }
        }
      } catch (error: any) {
        console.error(`[GET /api/lorcana/${cardId}] ⚠️ Conversational grading failed:`, error.message);
        return NextResponse.json({
          error: "Failed to grade Lorcana card. Please try again or contact support.",
          details: error.message
        }, { status: 500 });
      }
    }

    // 🆕 Parse conversational JSON to extract structured fields
    let conversationalGradingData = null;
    if (conversationalGradingResult) {
      try {
        console.log(`[GET /api/lorcana/${cardId}] Parsing conversational JSON...`);
        const jsonData = JSON.parse(conversationalGradingResult);

        // 🐛 DEBUG: Log the raw card_info from AI response
        console.log(`[GET /api/lorcana/${cardId}] 🐛 DEBUG Raw AI card_info:`, JSON.stringify(jsonData.card_info, null, 2));

        // 🔧 v6.2: Fix any grade mismatches in the summary text
        const actualDecimalGrade = jsonData.scoring?.final_grade ?? jsonData.final_grade?.decimal_grade ?? null;
        const rawSummary = jsonData.final_grade?.summary || null;
        const correctedSummary = rawSummary && actualDecimalGrade !== null
          ? fixSummaryGradeMismatch(rawSummary, actualDecimalGrade)
          : rawSummary;

        // Map JSON to structured data format
        conversationalGradingData = {
          // Handle both v5.0 (scoring.final_grade) and v4.2 (final_grade.decimal_grade) formats
          decimal_grade: actualDecimalGrade,
          whole_grade: jsonData.scoring?.rounded_grade ?? jsonData.final_grade?.whole_grade ?? null,
          grade_range: jsonData.image_quality?.grade_uncertainty || jsonData.scoring?.grade_range || jsonData.final_grade?.grade_range || '±0.5',  // 🔧 FIX: Prioritize ± format over range
          condition_label: jsonData.final_grade?.condition_label || null,
          final_grade_summary: correctedSummary,  // 🆕 v6.2: Fixed summary with correct grade
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
          // Detailed corners/edges/surface analysis (matches sports card structure)
          corners_edges_surface: {
            // Centering summaries (for "Centering Details" section)
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
          transformedDefects: {
            front: jsonData.defect_summary?.front || null,
            back: jsonData.defect_summary?.back || null
          },
          card_info: jsonData.card_info || null,
          case_detection: jsonData.case_detection || null,
          professional_slab: jsonData.slab_detection || null,  // 🔧 FIX: Master rubric outputs slab_detection, not professional_slab
          professional_grade_estimates: jsonData.professional_grade_estimates || null,
          meta: jsonData.metadata || null
        };

        console.log(`[GET /api/lorcana/${cardId}] ✅ Parsed conversational data:`, {
          grade: conversationalGradingData.decimal_grade,
          sub_scores: conversationalGradingData.sub_scores,
          has_defects: !!(conversationalGradingData.transformedDefects?.front)
        });

        // 🐛 DEBUG: Log full card_info to see what AI extracted
        console.log(`[GET /api/lorcana/${cardId}] 🐛 DEBUG card_info:`, JSON.stringify(conversationalGradingData.card_info, null, 2));

        // 🎯 Call backend deterministic mapper for professional grade estimates
        if (conversationalGradingData.decimal_grade && conversationalGradingData.decimal_grade !== 'N/A') {
          try {
            console.log(`[GET /api/lorcana/${cardId}] 🔧 Calling professional grade mapper (deterministic)...`);

            // Parse centering ratios from strings like "55/45" to [55, 45]
            const parseCentering = (ratio: string): [number, number] | undefined => {
              if (!ratio || ratio === 'N/A') return undefined;
              const parts = ratio.split('/').map(p => parseInt(p.trim()));
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return [parts[0], parts[1]] as [number, number];
              }
              return undefined;
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

            console.log(`[GET /api/lorcana/${cardId}] 🔍 Autograph detection: type=${autographType}, flag=${hasAutographedFlag}, rarity=${hasAutographRarity}, name=${hasAutographInName}, rarityFeatures=${hasRarityAutograph}, authentic=${isAuthentic} → isAuthenticated=${isAuthenticatedAutograph}`);

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
              // If autograph is authenticated, don't treat as alteration
              is_authenticated_autograph: isAuthenticatedAutograph
            };

            const professionalEstimates = estimateProfessionalGrades(mapperInput);
            conversationalGradingData.professional_grade_estimates = professionalEstimates;

            // Update card_info with derived autographed flag for frontend display
            if (isAuthenticatedAutograph && conversationalGradingData.card_info) {
              conversationalGradingData.card_info = {
                ...conversationalGradingData.card_info,
                autographed: true
              };
              console.log(`[GET /api/lorcana/${cardId}] ✅ Set card_info.autographed = true (authenticated autograph detected)`);
            }

            console.log(`[GET /api/lorcana/${cardId}] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}, SGC ${professionalEstimates.SGC.estimated_grade}, CGC ${professionalEstimates.CGC.estimated_grade}`);
          } catch (mapperError) {
            console.error(`[GET /api/lorcana/${cardId}] ⚠️ Professional mapper failed:`, mapperError);
            conversationalGradingData.professional_grade_estimates = null;
          }
        } else {
          console.log(`[GET /api/lorcana/${cardId}] ⏭️ Skipping professional mapper (grade is N/A or null)`);
          conversationalGradingData.professional_grade_estimates = null;
        }

      } catch (error) {
        console.error(`[GET /api/lorcana/${cardId}] ⚠️ Failed to parse conversational JSON:`, error);
      }
    }

    // 🎯 DATABASE LOOKUP: Cross-reference AI identification with internal Lorcana database
    let matchedDatabaseCard: LorcanaCard | null = null;
    let databaseMatchConfidence: string | null = null;

    if (conversationalGradingData?.card_info) {
      try {
        const aiCardInfo = conversationalGradingData.card_info;
        console.log(`[GET /api/lorcana/${cardId}] 🔍 Looking up card in internal database...`);
        console.log(`[GET /api/lorcana/${cardId}]   AI identified: name="${aiCardInfo.card_name}", set="${aiCardInfo.set_name}", number="${aiCardInfo.card_number}"`);

        // Extract set code from AI response (may be in expansion_code or derived from set_name)
        let setCode = aiCardInfo.expansion_code || null;

        // Try to derive set code from set name if not provided
        // Lorcana sets are numbered: "The First Chapter" = "1", "Rise of the Floodborn" = "2", etc.
        if (!setCode && aiCardInfo.set_name) {
          const setNameLower = aiCardInfo.set_name.toLowerCase();
          // Main sets (1-11+)
          if (setNameLower.includes('first chapter')) setCode = '1';
          else if (setNameLower.includes('rise of the floodborn') || setNameLower.includes('floodborn')) setCode = '2';
          else if (setNameLower.includes('into the inklands') || setNameLower.includes('inklands')) setCode = '3';
          else if (setNameLower.includes('ursula\'s return') || setNameLower.includes('ursulas return')) setCode = '4';
          else if (setNameLower.includes('shimmering skies')) setCode = '5';
          else if (setNameLower.includes('azurite sea') || setNameLower.includes('azurite')) setCode = '6';
          else if (setNameLower.includes('archazia\'s island') || setNameLower.includes('archazia')) setCode = '7';
          else if (setNameLower.includes('reign of jafar') || setNameLower.includes('jafar')) setCode = '8';
          else if (setNameLower.includes('fabled')) setCode = '9';
          else if (setNameLower.includes('whispers in the well') || setNameLower.includes('whispers')) setCode = '10';
          else if (setNameLower.includes('winterspell')) setCode = '11';
          // Promo and special sets
          else if (setNameLower.includes('promo set 1') || setNameLower === 'p1') setCode = 'P1';
          else if (setNameLower.includes('promo set 2') || setNameLower === 'p2') setCode = 'P2';
          else if (setNameLower.includes('challenge promo')) setCode = 'cp';
          else if (setNameLower.includes('d23')) setCode = 'D23';

          if (setCode) {
            console.log(`[GET /api/lorcana/${cardId}]   Derived set code: "${setCode}" from set name: "${aiCardInfo.set_name}"`);
          }
        }

        // If still no set code, try to extract from card number format "214/204 • EN • 8"
        // The last number after bullets is often the set code
        if (!setCode && aiCardInfo.card_number) {
          const extractedSetCode = extractSetCodeFromCardNumber(aiCardInfo.card_number);
          if (extractedSetCode) {
            setCode = extractedSetCode;
            console.log(`[GET /api/lorcana/${cardId}]   Extracted set code: "${setCode}" from card number: "${aiCardInfo.card_number}"`);
          }
        }

        const matchResult = await lookupLorcanaCard({
          setCode: setCode,
          collectorNumber: aiCardInfo.card_number,
          name: aiCardInfo.card_name,
          set: aiCardInfo.set_name
        });

        if (matchResult.card && matchResult.confidence.overallConfidence !== 'low') {
          matchedDatabaseCard = matchResult.card;
          databaseMatchConfidence = matchResult.confidence.overallConfidence;

          console.log(`[GET /api/lorcana/${cardId}] ✅ Database match found (${databaseMatchConfidence} confidence):`);
          console.log(`[GET /api/lorcana/${cardId}]   DB: ${matchResult.card.full_name} (${matchResult.card.set_name}) #${matchResult.card.collector_number}`);
          console.log(`[GET /api/lorcana/${cardId}]   Rarity: ${matchResult.card.rarity}, Ink: ${matchResult.card.ink}`);

          // Enhance card_info with verified database data
          // IMPORTANT: Database values take priority over AI-identified values for accuracy
          // AI should only be trusted for: card name (OCR), card number (OCR), and grading
          // All other details come from our verified internal database
          const dbCard = matchResult.card;
          const releaseYear = dbCard.released_at ? new Date(dbCard.released_at).getFullYear().toString() : null;

          conversationalGradingData.card_info = {
            ...conversationalGradingData.card_info,
            // === CORE IDENTIFICATION (verified from database) ===
            card_name: dbCard.full_name,
            character_name: dbCard.name,
            character_version: dbCard.version,
            set_name: dbCard.set_name,
            card_number: dbCard.collector_number,
            expansion_code: dbCard.set_code,
            // === RELEASE INFO (from database, not AI) ===
            year: releaseYear,
            set_year: releaseYear,
            release_date: dbCard.released_at,
            // === LORCANA-SPECIFIC ATTRIBUTES (from database) ===
            ink_color: dbCard.ink,
            lorcana_card_type: dbCard.card_type ? dbCard.card_type.join(', ') : null,
            inkwell: dbCard.inkwell,
            ink_cost: dbCard.cost,
            strength: dbCard.strength,
            willpower: dbCard.willpower,
            lore_value: dbCard.lore,
            move_cost: dbCard.move_cost,
            // === CARD TEXT & ABILITIES (from database) ===
            card_front_text: dbCard.card_text,
            flavor_text: dbCard.flavor_text,
            classifications: dbCard.classifications || null,
            abilities: dbCard.keywords || null,
            // === RARITY & ARTIST (from database) ===
            rarity_or_variant: dbCard.rarity,
            rarity_tier: dbCard.rarity,
            illustrators: dbCard.illustrators || null,
            artist_name: dbCard.illustrators ? dbCard.illustrators.join(', ') : null,
            // === PRICING (from database if available) ===
            price_usd: dbCard.price_usd,
            price_usd_foil: dbCard.price_usd_foil,
            // === DATABASE REFERENCE ===
            _database_match: {
              lorcana_card_id: dbCard.id,
              match_confidence: databaseMatchConfidence,
              match_score: matchResult.score,
              image_url: dbCard.image_normal || dbCard.image_large
            }
          };

          console.log(`[GET /api/lorcana/${cardId}] ✅ Card info enhanced with database data`);
        } else {
          console.log(`[GET /api/lorcana/${cardId}] ⚠️ No high-confidence database match found`);
          if (matchResult.confidence.warnings.length > 0) {
            matchResult.confidence.warnings.forEach(w => console.log(`[GET /api/lorcana/${cardId}]   Warning: ${w}`));
          }
        }
      } catch (dbLookupError) {
        console.error(`[GET /api/lorcana/${cardId}] ⚠️ Database lookup failed:`, dbLookupError);
      }
    }

    // Extract Lorcana card grade information
    const { rawGrade, wholeGrade, confidence } = extractLorcanaGradeInfo(gradingResult);

    // Extract key fields for database columns (Lorcana-specific)
    const cardFieldsLegacy = extractLorcanaCardFields(gradingResult);

    // Extract Lorcana-specific fields from conversational v4.2 JSON
    const cardFieldsConversational = conversationalGradingData?.card_info
      ? extractLorcanaFieldsFromConversational(conversationalGradingData)
      : {};

    // Merge fields: conversational v4.2 takes priority over legacy
    const cardFields = {
      ...cardFieldsLegacy,
      ...cardFieldsConversational
    };


    // Update database with comprehensive Lorcana card data
    const updateData = {
      // Full AI grading JSON for comprehensive display
      ai_grading: gradingResult,

      // 🧪 Experimental: Conversational grading raw JSON
      conversational_grading: conversationalGradingResult,

      // 🆕 v4.2: Structured conversational grading fields (parsed from JSON)
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_grade_uncertainty: conversationalGradingData?.grade_range || null,
      conversational_final_grade_summary: conversationalGradingData?.final_grade_summary || null,  // 🆕 Overall summary
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

      // 🆕 Professional grade estimates (PSA, BGS, SGC, etc.)
      estimated_professional_grades: conversationalGradingData?.professional_grade_estimates || null,

      // 🆕 v3.3: Enhanced conversational grading fields
      ...(conversationalResultV3_3 && {
        // Rarity classification
        rarity_tier: conversationalResultV3_3.rarity_classification?.rarity_tier || null,
        serial_number_fraction: conversationalResultV3_3.rarity_classification?.serial_number_fraction || null,
        autograph_type: conversationalResultV3_3.rarity_classification?.autograph_type || null,
        memorabilia_type: conversationalResultV3_3.rarity_classification?.memorabilia_type || null,
        finish_material: conversationalResultV3_3.rarity_classification?.finish_material || null,
        rookie_flag: conversationalResultV3_3.rarity_classification?.rookie_flag || null,
        subset_insert_name: conversationalResultV3_3.rarity_classification?.subset_insert_name || null,
        special_attributes: conversationalResultV3_3.rarity_classification?.special_attributes?.join(', ') || null,
        rarity_notes: conversationalResultV3_3.rarity_classification?.rarity_notes || null,

        // Enhanced grading metadata
        weighted_total_pre_cap: conversationalResultV3_3.grading_metadata?.weighted_total_pre_cap || null,
        capped_grade_reason: conversationalResultV3_3.grading_metadata?.capped_grade_reason || null,
        conservative_rounding_applied: conversationalResultV3_3.grading_metadata?.conservative_rounding_applied || false,
        lighting_conditions_notes: conversationalResultV3_3.grading_metadata?.lighting_conditions_notes || null,
        cross_side_verification_result: conversationalResultV3_3.grading_metadata?.cross_side_verification_result || null,

        // Defect coordinates (JSONB)
        defect_coordinates_front: conversationalResultV3_3.defect_coordinates_front || [],
        defect_coordinates_back: conversationalResultV3_3.defect_coordinates_back || [],
      }),

      // Grade information
      raw_decimal_grade: rawGrade,
      dcm_grade_whole: wholeGrade,
      ai_confidence_score: confidence,
      final_dcm_score: wholeGrade.toString(),

      // Individual searchable/sortable columns (Lorcana-specific - merged from both sources)
      ...cardFields,

      // 🎯 Database-matched card reference (for verified card identification)
      // Note: lorcana_card_id column requires TEXT type (Lorcast IDs are "crd_xxx" format, not UUID)
      // Run migrations/fix_lorcana_card_id_type.sql if you want to store the ID in a dedicated column
      ...(matchedDatabaseCard && {
        // lorcana_card_id: matchedDatabaseCard.id,  // Commented out until column type is fixed
        lorcana_reference_image: matchedDatabaseCard.image_normal || matchedDatabaseCard.image_large,
        database_match_confidence: databaseMatchConfidence
      }),

      // Processing metadata
      processing_time: Date.now() - startTime
    };

    // Generate standardized label data for consistent display across all contexts
    const cardForLabel: CardForLabel = {
      id: cardId,
      category: 'Lorcana',
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

    console.log(`[GET /api/lorcana/${cardId}] Generated label data:`, {
      primaryName: labelData.primaryName,
      contextLine: labelData.contextLine,
      featuresLine: labelData.featuresLine,
      grade: labelData.gradeFormatted
    });

    console.log(`[GET /api/lorcana/${cardId}] Updating database with extracted Lorcana fields:`, {
      card_name: cardFields.card_name,
      card_set: cardFields.card_set,
      ink_color: cardFields.ink_color,
      lorcana_card_type: cardFields.lorcana_card_type,
      grade: wholeGrade
    });

    const { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    if (updateError) {
      console.error(`[GET /api/lorcana/${cardId}] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to save Lorcana card grading results" }, { status: 500 });
    }

    console.log(`[GET /api/lorcana/${cardId}] Lorcana card request completed in ${Date.now() - startTime}ms`);

    // Return updated Lorcana card data with all structured fields
    return NextResponse.json({
      ...card,
      ai_grading: gradingResult,
      conversational_grading: conversationalGradingResult,
      // Structured conversational fields
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_grade_uncertainty: conversationalGradingData?.grade_range || null,
      conversational_final_grade_summary: conversationalGradingData?.final_grade_summary || null,  // 🆕 Overall summary
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
      // Legacy fields
      raw_decimal_grade: rawGrade,
      dcm_grade_whole: wholeGrade,
      ai_confidence_score: confidence,
      final_dcm_score: wholeGrade.toString(),
      ...cardFields,
      front_url: frontUrl,
      back_url: backUrl,
      processing_time: Date.now() - startTime,
      // 🎯 Database-matched card reference
      lorcana_card_id: matchedDatabaseCard?.id || null,
      lorcana_reference_image: matchedDatabaseCard?.image_normal || matchedDatabaseCard?.image_large || null,
      database_match_confidence: databaseMatchConfidence,
      // ⭐ Card owner's founder/Card Lovers status (for emblems on public card labels)
      owner_is_founder: ownerIsFounder,
      owner_show_founder_badge: ownerShowFounderBadge,
      owner_is_card_lover: ownerIsCardLover,
      owner_show_card_lover_badge: ownerShowCardLoverBadge,
      owner_preferred_label_emblem: ownerPreferredLabelEmblem
    });

  } catch (error: any) {
    console.error(`[GET /api/lorcana/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to process Lorcana card: " + error.message },
      { status: 500 }
    );
  } finally {
    processingLorcanaCards.delete(cardId);
    console.log(`[GET /api/lorcana/${cardId}] Removed from processing set`);
  }
}

// PATCH handler for updating Lorcana card data (e.g., clearing cached grading)
export async function PATCH(request: NextRequest, { params }: LorcanaCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[PATCH /api/lorcana/${cardId}] Starting Lorcana card update request`);

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

    console.log(`[PATCH /api/lorcana/${cardId}] Update data:`, body);

    // Update the Lorcana card
    const { data, error } = await supabase
      .from("cards")
      .update(body)
      .eq("id", cardId)
      .select()
      .single();

    if (error) {
      console.error(`[PATCH /api/lorcana/${cardId}] Update failed:`, error);
      return NextResponse.json({ error: "Failed to update Lorcana card" }, { status: 500 });
    }

    console.log(`[PATCH /api/lorcana/${cardId}] Lorcana card updated successfully`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[PATCH /api/lorcana/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to update Lorcana card: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE handler for removing Lorcana cards
export async function DELETE(request: NextRequest, { params }: LorcanaCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[DELETE /api/lorcana/${cardId}] Starting Lorcana card deletion request`);

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Get the Lorcana card and verify ownership
    const { data: card, error: fetchError } = await supabase
      .from("cards")
      .select("front_path, back_path, user_id")
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      console.error(`[DELETE /api/lorcana/${cardId}] Lorcana card not found:`, fetchError);
      return NextResponse.json({ error: "Lorcana card not found" }, { status: 404 });
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

    // Delete Lorcana card record
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error(`[DELETE /api/lorcana/${cardId}] Deletion failed:`, deleteError);
      return NextResponse.json({ error: "Failed to delete Lorcana card" }, { status: 500 });
    }

    console.log(`[DELETE /api/lorcana/${cardId}] Lorcana card deleted successfully`);
    return NextResponse.json({ success: true, message: "Lorcana card deleted successfully" });

  } catch (error: any) {
    console.error(`[DELETE /api/lorcana/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to delete Lorcana card: " + error.message },
      { status: 500 }
    );
  }
}
