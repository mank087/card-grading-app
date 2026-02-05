import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
// PRIMARY: Conversational grading system (matches other card type flows)
import { gradeCardConversational } from "@/lib/visionGrader";
// Professional grade estimation (deterministic backend mapper)
import { estimateProfessionalGrades } from "@/lib/professionalGradeMapper";
// Label data generation for consistent display across all contexts
import { generateLabelData, type CardForLabel } from "@/lib/labelDataGenerator";
// Grade/summary mismatch fixer (v6.2)
import { fixSummaryGradeMismatch } from "@/lib/cardGradingSchema_v5";
// Founder status for card owner
import { getUserCredits } from "@/lib/credits";

// Vercel serverless function configuration
// maxDuration: Maximum execution time in seconds (Pro plan supports up to 300s)
// GPT-5.1 with large prompts + vision can take 60-90 seconds, with retries up to 5 minutes
export const maxDuration = 300;

// Track sports cards currently being processed with timestamps
const processingSportsCards = new Map<string, number>();

// Clean up stuck processing cards (older than 2 minutes - reduced from 5 to prevent long lock-outs)
const cleanupStuckCards = () => {
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);

  for (const [cardId, timestamp] of processingSportsCards.entries()) {
    if (timestamp < twoMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set (was locked for ${Math.round((now - timestamp) / 1000)}s)`);
      processingSportsCards.delete(cardId);
    }
  }
};

// Types
type SportsCardGradingRequest = {
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

// Removed old Sports-specific functions:
// - getSportsInstructions() - prompts now loaded by gradeCardConversational
// - gradeSportsCardWithAI() - replaced with unified gradeCardConversational
// This matches the Pokemon/MTG/Lorcana/Other card grading flow for consistency and efficiency


// Main GET handler for sports cards
export async function GET(request: NextRequest, { params }: SportsCardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  // Check for query parameters
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';
  const statusOnly = searchParams.get('status_only') === 'true';

  console.log(`[GET /api/sports/${cardId}] Starting sports card request (force_regrade: ${forceRegrade}, status_only: ${statusOnly})`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // STATUS-ONLY MODE: Just return the current card state without acquiring lock or starting grading
  // This is used by the background polling system to check if grading is complete
  if (statusOnly) {
    console.log(`[GET /api/sports/${cardId}] Status-only check requested`);

    const supabase = supabaseServer();
    const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, conversational_grading, raw_decimal_grade, dcm_grade_whole, conversational_decimal_grade, conversational_whole_grade, category")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.log(`[GET /api/sports/${cardId}] Status-only 404: error=${cardError?.message || 'none'}, code=${cardError?.code || 'none'}`);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Verify it's a sports card
    if (!sportCategories.includes(card.category)) {
      return NextResponse.json({ error: "Not a sports card" }, { status: 404 });
    }

    // Check if card has complete grading
    const hasCompleteGrading =
      (card.conversational_decimal_grade && card.conversational_whole_grade) ||
      (card.conversational_grading && card.conversational_grading.length > 0) ||
      (card.raw_decimal_grade && card.dcm_grade_whole);

    // Check if currently processing (in the lock map)
    const isProcessing = processingSportsCards.has(cardId);

    console.log(`[GET /api/sports/${cardId}] Status-only result: complete=${hasCompleteGrading}, processing=${isProcessing}`);

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

  // Check if already processing this sports card
  if (processingSportsCards.has(cardId)) {
    console.log(`[GET /api/sports/${cardId}] Sports card already being processed, returning 429`);
    return NextResponse.json(
      { error: "Sports card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingSportsCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get sports card from database
    // Sports cards can have categories: Football, Baseball, Basketball, Hockey, Soccer, Wrestling, Sports
    const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    // Verify it's a sports card
    if (card && !sportCategories.includes(card.category)) {
      console.error(`[GET /api/sports/${cardId}] Card is not a sports card, category: ${card.category}`);
      return NextResponse.json({ error: "Not a sports card" }, { status: 404 });
    }

    if (cardError || !card) {
      console.error(`[GET /api/sports/${cardId}] Card lookup error:`, cardError);
      console.log(`[GET /api/sports/${cardId}] Card data:`, card);
      return NextResponse.json({ error: "Sports card not found" }, { status: 404 });
    }

    console.log(`[GET /api/sports/${cardId}] Sports card found`);

    // 🔒 VISIBILITY CHECK: Verify user has permission to view this card
    const cardVisibility = card.visibility || 'private'; // Default to private if not set

    if (cardVisibility === 'private') {
      // Private card - only owner can view
      // Get user_id from query parameter (client-side directAuth uses localStorage)
      const userId = searchParams.get('user_id');

      if (!userId) {
        console.log(`[GET /api/sports/${cardId}] 🔒 Private card access denied - not authenticated`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card. Please log in if this is your card.",
          visibility: "private"
        }, { status: 403 });
      }

      if (card.user_id !== userId) {
        console.log(`[GET /api/sports/${cardId}] 🔒 Private card access denied - user ${userId} is not owner ${card.user_id}`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card.",
          visibility: "private"
        }, { status: 403 });
      }

      console.log(`[GET /api/sports/${cardId}] ✅ Private card access granted to owner ${userId}`);
    } else {
      // Public card - anyone can view
      console.log(`[GET /api/sports/${cardId}] 🌐 Public card - access granted`);
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
        console.error(`[GET /api/sports/${cardId}] Error fetching owner founder status:`, err);
      }
    }

    // Create signed URLs for sports card images (parallel for speed)
    console.log(`[GET /api/sports/${cardId}] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const [frontUrl, backUrl] = await Promise.all([
      createSignedUrl(supabase, "cards", card.front_path),
      createSignedUrl(supabase, "cards", card.back_path)
    ]);

    if (!frontUrl || !backUrl) {
      console.error(`[GET /api/sports/${cardId}] Failed to create signed URLs. Front: ${frontUrl}, Back: ${backUrl}`);
      return NextResponse.json({ error: "Failed to access sports card images" }, { status: 500 });
    }
    console.log(`[GET /api/sports/${cardId}] Signed URLs created successfully`);

    // Check if sports card already has complete grading data
    // Card is complete if:
    // 1. Has numeric grades (decimal AND whole), OR
    // 2. Has N/A grade (null) with a complete conversational grading report (for altered cards)
    const hasCompleteGrading =
      (card.conversational_decimal_grade && card.conversational_whole_grade) ||
      (card.conversational_grading && card.conversational_grading.length > 0);

    // Skip cache if force_regrade is requested
    if (hasCompleteGrading && !forceRegrade) {
      console.log(`[GET /api/sports/${cardId}] Sports card already fully processed, returning existing result`);

      // Parse conversational_grading if it exists to extract professional grades
      let parsedConversationalData = null;
      if (card.conversational_grading) {
        try {
          console.log('[SPORTS CACHE] Parsing cached conversational_grading JSON...');
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
              console.log('[SPORTS CACHE] 🔧 Calculating professional grade estimates...');

              const parseCentering = (ratio: string): [number, number] | undefined => {
                if (!ratio || ratio === 'N/A') return undefined;
                const parts = ratio.split('/').map(p => parseInt(p.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  return [parts[0], parts[1]] as [number, number];
                }
                return undefined;
              };

              const cardInfoData = parsedConversationalData.card_info || {};
              const alterationDetectionData = jsonData.alteration_detection || {};
              // Check alteration_detection.autograph.present - PRIMARY detection path
              const hasAlterationAutograph = alterationDetectionData.autograph?.present === true;
              const autographVerified = alterationDetectionData.autograph?.verified;
              const hasAutographedFlag = cardInfoData.autographed === true;
              const hasAutographRarity = cardInfoData.rarity_or_variant?.toLowerCase()?.includes('autograph');
              const hasAutographInName = cardInfoData.card_name?.toLowerCase()?.includes('autograph');
              const isAuthentic = cardInfoData.authentic !== false;
              const isAuthenticatedAutograph = isAuthentic && (
                (hasAlterationAutograph && autographVerified !== false) ||
                hasAutographedFlag ||
                hasAutographRarity ||
                hasAutographInName
              );

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

              // Update card_info with derived autographed flag for frontend display
              if (isAuthenticatedAutograph && parsedConversationalData.card_info) {
                parsedConversationalData.card_info = {
                  ...parsedConversationalData.card_info,
                  autographed: true
                };
                console.log(`[SPORTS CACHE] ✅ Set card_info.autographed = true (authenticated autograph detected)`);
              }

              console.log(`[SPORTS CACHE] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}`);
            } catch (mapperError) {
              console.error('[SPORTS CACHE] ⚠️ Professional mapper failed:', mapperError);
            }
          }

          // Also check autograph detection for cards that don't need professional grade recalculation
          // This ensures autograph flag is set even for cached cards
          if (parsedConversationalData?.card_info && !parsedConversationalData.card_info.autographed) {
            const altDet = jsonData.alteration_detection || {};
            const hasAutoAlt = altDet.autograph?.present === true && altDet.autograph?.verified !== false;
            const hasAutoInRarity = parsedConversationalData.card_info.rarity_or_variant?.toLowerCase()?.includes('autograph');
            const hasAutoInName = parsedConversationalData.card_info.card_name?.toLowerCase()?.includes('autograph');
            const isAuth = parsedConversationalData.card_info.authentic !== false;

            if (isAuth && (hasAutoAlt || hasAutoInRarity || hasAutoInName)) {
              parsedConversationalData.card_info = {
                ...parsedConversationalData.card_info,
                autographed: true
              };
              console.log(`[SPORTS CACHE] ✅ Set card_info.autographed = true (from additional autograph check)`);
            }
          }

          console.log('[SPORTS CACHE] ✅ Parsed cached JSON successfully');
        } catch (error) {
          console.error('[SPORTS CACHE] ⚠️ Failed to parse cached JSON:', error);
        }
      }

      // 🔧 FIX: Merge parsed card_info with stored conversational_card_info
      // This ensures manual edits are preserved (column data takes precedence)
      const mergedCardInfo = parsedConversationalData?.card_info
        ? {
            ...parsedConversationalData.card_info,
            ...(card.conversational_card_info || {})
          }
        : card.conversational_card_info;

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
          conversational_card_info: mergedCardInfo,
          conversational_corners_edges_surface: parsedConversationalData.corners_edges_surface,
          conversational_case_detection: parsedConversationalData.case_detection,
          conversational_defects_front: parsedConversationalData.transformedDefects.front,
          conversational_defects_back: parsedConversationalData.transformedDefects.back,
          estimated_professional_grades: parsedConversationalData.professional_grade_estimates
        }),
        front_url: frontUrl,
        back_url: backUrl,
        processing_time: card.processing_time,  // Use stored value, not recalculated
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
      console.log(`[GET /api/sports/${cardId}] Sports card needs grading analysis`);
    } else if (forceRegrade) {
      console.log(`[GET /api/sports/${cardId}] 🔄 Force re-grade requested, bypassing cache`);
    }

    // 🎯 PRIMARY: Run conversational grading v4.2 (single API call)
    let conversationalGradingResult = null;
    let conversationalResultV3_3: any = null;
    let conversationalGradingData: any = null;
    let isJSONMode = false;
    let gradingResult = null; // Legacy field for backward compatibility

    if (frontUrl && backUrl) {
      try {
        const versionLabel = process.env.USE_V5_ARCHITECTURE === 'true' ? 'v5.0' : 'v4.2';
        console.log(`[SPORTS CONVERSATIONAL AI ${versionLabel}] 🎯 Starting PRIMARY grading with Sports-specific prompt...`);

        // Check if user provided condition report hints
        const userConditionReport = card.user_condition_processed || null;
        if (userConditionReport) {
          console.log(`[GET /api/sports/${cardId}] 📋 User condition report found: ${userConditionReport.total_defects_reported || 0} defects reported`);
        }

        const conversationalResult = await gradeCardConversational(frontUrl, backUrl, 'sports', {
          userConditionReport: userConditionReport
        });
        conversationalGradingResult = conversationalResult.markdown_report;
        conversationalResultV3_3 = conversationalResult; // Store full result

        console.log(`[GET /api/sports/${cardId}] ✅ Conversational grading completed: ${conversationalResult.extracted_grade.decimal_grade}`);
        console.log(`[GET /api/sports/${cardId}] 🏆 Rarity: ${conversationalResult.rarity_classification?.rarity_tier || 'Not detected'}`);
        console.log(`[GET /api/sports/${cardId}] 📍 Defects: Front=${conversationalResult.defect_coordinates_front.length}, Back=${conversationalResult.defect_coordinates_back.length}`);

        // Detect if we're using JSON format (version string contains 'json')
        isJSONMode = conversationalResult.meta?.version?.includes('json') === true;
        console.log(`[GET /api/sports/${cardId}] Output format detected: ${isJSONMode ? 'JSON' : 'Markdown'} (${conversationalResult.meta?.version || 'unknown'})`);

        // Create legacy gradingResult structure for backward compatibility
        // This ensures old frontend code paths still work while we transition fully to conversational
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
            console.error(`[GET /api/sports/${cardId}] Failed to create legacy gradingResult:`, e);
          }
        }

        // Parse JSON format and extract fields for database
        if (isJSONMode && conversationalGradingResult) {
          try {
            const parsedJSONData = JSON.parse(conversationalGradingResult);
            console.log(`[GET /api/sports/${cardId}] ✅ Successfully parsed JSON response`);

            // 🆕 v6.0 THREE-PASS GRADING: Check for grading_passes.averaged_rounded
            const threePassData = parsedJSONData.grading_passes;
            const hasThreePass = threePassData?.averaged_rounded?.final !== undefined;
            const avgRounded = threePassData?.averaged_rounded;

            if (hasThreePass) {
              console.log(`[GET /api/sports/${cardId}] ✅ THREE-PASS GRADING detected`);
              console.log(`[GET /api/sports/${cardId}] Pass 1: ${threePassData.pass_1?.final}, Pass 2: ${threePassData.pass_2?.final}, Pass 3: ${threePassData.pass_3?.final}`);
              console.log(`[GET /api/sports/${cardId}] Averaged: ${threePassData.averaged?.final?.toFixed(2)}, Variance: ${threePassData.variance}, Consistency: ${threePassData.consistency}`);
            } else {
              console.log(`[GET /api/sports/${cardId}] ⚠️ No three-pass data found, using direct scores`);
            }

            // Build conversationalGradingData from JSON
            // 🎯 THREE-PASS: Use averaged_rounded when available, fallback to direct values
            const actualDecimalGrade = avgRounded?.final ?? parsedJSONData.scoring?.final_grade ?? parsedJSONData.final_grade?.decimal_grade ?? null;
            const rawSummary = parsedJSONData.final_grade?.summary || null;
            // 🔧 v6.2: Fix any grade mismatches in the summary text
            const correctedSummary = rawSummary && actualDecimalGrade !== null
              ? fixSummaryGradeMismatch(rawSummary, actualDecimalGrade)
              : rawSummary;

            conversationalGradingData = {
              // Handle three-pass, v5.0, and v4.2 formats (priority order)
              decimal_grade: actualDecimalGrade,
              whole_grade: avgRounded?.final ? Math.floor(avgRounded.final) : (parsedJSONData.scoring?.rounded_grade ?? parsedJSONData.final_grade?.whole_grade ?? null),
              grade_uncertainty: parsedJSONData.image_quality?.grade_uncertainty || parsedJSONData.scoring?.grade_range || parsedJSONData.final_grade?.grade_range || '±0.5',
              condition_label: parsedJSONData.final_grade?.condition_label || null,
              final_grade_summary: correctedSummary,
              image_confidence: parsedJSONData.image_quality?.confidence_letter || null,
              // 🎯 THREE-PASS: Use averaged_rounded sub-scores when available
              sub_scores: {
                centering: {
                  front: parsedJSONData.raw_sub_scores?.centering_front || 0,
                  back: parsedJSONData.raw_sub_scores?.centering_back || 0,
                  weighted: avgRounded?.centering ?? parsedJSONData.weighted_scores?.centering_weighted ?? 0
                },
                corners: {
                  front: parsedJSONData.raw_sub_scores?.corners_front || 0,
                  back: parsedJSONData.raw_sub_scores?.corners_back || 0,
                  weighted: avgRounded?.corners ?? parsedJSONData.weighted_scores?.corners_weighted ?? 0
                },
                edges: {
                  front: parsedJSONData.raw_sub_scores?.edges_front || 0,
                  back: parsedJSONData.raw_sub_scores?.edges_back || 0,
                  weighted: avgRounded?.edges ?? parsedJSONData.weighted_scores?.edges_weighted ?? 0
                },
                surface: {
                  front: parsedJSONData.raw_sub_scores?.surface_front || 0,
                  back: parsedJSONData.raw_sub_scores?.surface_back || 0,
                  weighted: avgRounded?.surface ?? parsedJSONData.weighted_scores?.surface_weighted ?? 0
                }
              },
              centering_ratios: {
                front_lr: parsedJSONData.centering?.front?.left_right || 'N/A',
                front_tb: parsedJSONData.centering?.front?.top_bottom || 'N/A',
                back_lr: parsedJSONData.centering?.back?.left_right || 'N/A',
                back_tb: parsedJSONData.centering?.back?.top_bottom || 'N/A'
              },
              // 🆕 Detailed corners/edges/surface analysis (matches Pokemon structure)
              corners_edges_surface: {
                // Centering summaries (for "Centering Details" section)
                front_centering: {
                  summary: parsedJSONData.centering?.front_summary || parsedJSONData.centering?.front?.summary || parsedJSONData.centering?.front?.analysis || 'Centering analysis not available.'
                },
                back_centering: {
                  summary: parsedJSONData.centering?.back_summary || parsedJSONData.centering?.back?.summary || parsedJSONData.centering?.back?.analysis || 'Centering analysis not available.'
                },
                // Front corners
                front_corners: {
                  top_left: parsedJSONData.corners?.front?.top_left?.condition || 'N/A',
                  top_right: parsedJSONData.corners?.front?.top_right?.condition || 'N/A',
                  bottom_left: parsedJSONData.corners?.front?.bottom_left?.condition || 'N/A',
                  bottom_right: parsedJSONData.corners?.front?.bottom_right?.condition || 'N/A',
                  sub_score: parsedJSONData.raw_sub_scores?.corners_front || 0,
                  summary: parsedJSONData.corners?.front_summary || parsedJSONData.corners?.front?.summary || 'Corner analysis not available'
                },
                // Back corners
                back_corners: {
                  top_left: parsedJSONData.corners?.back?.top_left?.condition || 'N/A',
                  top_right: parsedJSONData.corners?.back?.top_right?.condition || 'N/A',
                  bottom_left: parsedJSONData.corners?.back?.bottom_left?.condition || 'N/A',
                  bottom_right: parsedJSONData.corners?.back?.bottom_right?.condition || 'N/A',
                  sub_score: parsedJSONData.raw_sub_scores?.corners_back || 0,
                  summary: parsedJSONData.corners?.back_summary || parsedJSONData.corners?.back?.summary || 'Corner analysis not available'
                },
                // Front edges
                front_edges: {
                  top: parsedJSONData.edges?.front?.top?.condition || 'N/A',
                  bottom: parsedJSONData.edges?.front?.bottom?.condition || 'N/A',
                  left: parsedJSONData.edges?.front?.left?.condition || 'N/A',
                  right: parsedJSONData.edges?.front?.right?.condition || 'N/A',
                  sub_score: parsedJSONData.raw_sub_scores?.edges_front || 0,
                  summary: parsedJSONData.edges?.front_summary || parsedJSONData.edges?.front?.summary || 'Edge analysis not available'
                },
                // Back edges
                back_edges: {
                  top: parsedJSONData.edges?.back?.top?.condition || 'N/A',
                  bottom: parsedJSONData.edges?.back?.bottom?.condition || 'N/A',
                  left: parsedJSONData.edges?.back?.left?.condition || 'N/A',
                  right: parsedJSONData.edges?.back?.right?.condition || 'N/A',
                  sub_score: parsedJSONData.raw_sub_scores?.edges_back || 0,
                  summary: parsedJSONData.edges?.back_summary || parsedJSONData.edges?.back?.summary || 'Edge analysis not available'
                },
                // Front surface
                front_surface: {
                  defects: parsedJSONData.surface?.front?.defects || [],
                  analysis: parsedJSONData.surface?.front?.condition || parsedJSONData.surface?.front?.analysis || 'No analysis available',
                  sub_score: parsedJSONData.raw_sub_scores?.surface_front || 0,
                  summary: parsedJSONData.surface?.front?.summary || parsedJSONData.surface?.front_summary || 'Surface analysis not available'
                },
                // Back surface
                back_surface: {
                  defects: parsedJSONData.surface?.back?.defects || [],
                  analysis: parsedJSONData.surface?.back?.condition || parsedJSONData.surface?.back?.analysis || 'No analysis available',
                  sub_score: parsedJSONData.raw_sub_scores?.surface_back || 0,
                  summary: parsedJSONData.surface?.back?.summary || parsedJSONData.surface?.back_summary || 'Surface analysis not available'
                }
              },
              card_info: parsedJSONData.card_info || null,
              // 🆕 Transformed defects for database storage
              transformedDefects: {
                front: parsedJSONData.defect_summary?.front || null,
                back: parsedJSONData.defect_summary?.back || null
              },
              case_detection: parsedJSONData.case_detection || null,
              weighted_sub_scores: {
                centering: parsedJSONData.weighted_scores?.centering_weighted || null,
                corners: parsedJSONData.weighted_scores?.corners_weighted || null,
                edges: parsedJSONData.weighted_scores?.edges_weighted || null,
                surface: parsedJSONData.weighted_scores?.surface_weighted || null
              },
              limiting_factor: parsedJSONData.weighted_scores?.limiting_factor || null,
              preliminary_grade: parsedJSONData.weighted_scores?.preliminary_grade || null,
              slab_detection: parsedJSONData.slab_detection?.detected ? {  // 🔧 FIX: Master rubric outputs slab_detection, not professional_slab
                detected: true,
                company: parsedJSONData.slab_detection.company || null,
                grade: parsedJSONData.slab_detection.grade || null,
                grade_description: parsedJSONData.slab_detection.grade_description || null,
                cert_number: parsedJSONData.slab_detection.cert_number || null
              } : null,
              meta: {
                version: 'conversational-v4.0-json',
                prompt_version: parsedJSONData.metadata?.prompt_version || 'Conversational_Grading_v4.2_ENHANCED_STRICTNESS',
                evaluated_at_utc: parsedJSONData.metadata?.timestamp || new Date().toISOString()
              },
              professional_grade_estimates: parsedJSONData.professional_grade_estimates || null
            };

            console.log(`[GET /api/sports/${cardId}] ✅ Extracted conversational data from JSON`);
            console.log(`[GET /api/sports/${cardId}] Grade: ${conversationalGradingData.decimal_grade}, Confidence: ${conversationalGradingData.image_confidence}`);

            // 🎯 Call backend deterministic mapper for professional grade estimates
            if (conversationalGradingData.decimal_grade && conversationalGradingData.decimal_grade !== 'N/A') {
              try {
                console.log(`[GET /api/sports/${cardId}] 🔧 Calling professional grade mapper (deterministic)...`);

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
                const cardInfo = parsedJSONData.card_info || {};
                const rarityFeatures = parsedJSONData.rarity_features || {};
                const alterationDetection = parsedJSONData.alteration_detection || {};

                // Check various indicators of authenticated autograph
                // 1. alteration_detection.autograph.present - PRIMARY detection path from AI
                const hasAlterationAutograph = alterationDetection.autograph?.present === true;
                const autographVerified = alterationDetection.autograph?.verified;
                // 2. card_info.autographed flag
                const hasAutographedFlag = cardInfo.autographed === true;
                // 3. rarity_or_variant contains "autograph"
                const hasAutographRarity = cardInfo.rarity_or_variant?.toLowerCase()?.includes('autograph') ||
                                           cardInfo.rarity_tier?.toLowerCase()?.includes('autograph');
                // 4. card_name contains "autograph"
                const hasAutographInName = cardInfo.card_name?.toLowerCase()?.includes('autograph');
                // 5. rarity_features.autograph.present
                const hasRarityAutograph = rarityFeatures.autograph?.present === true;
                const isAuthentic = cardInfo.authentic !== false; // default to true if not specified

                // Card is authenticated autograph if ANY autograph indicator is true AND card is marked authentic
                // For alteration_detection path, also check if verified is not false
                const isAuthenticatedAutograph = isAuthentic && (
                  (hasAlterationAutograph && autographVerified !== false) ||
                  hasAutographedFlag ||
                  hasAutographRarity ||
                  hasAutographInName ||
                  hasRarityAutograph
                );

                console.log(`[GET /api/sports/${cardId}] 🔍 Autograph detection: alteration=${hasAlterationAutograph}, verified=${autographVerified}, flag=${hasAutographedFlag}, rarity=${hasAutographRarity}, name=${hasAutographInName}, rarityFeatures=${hasRarityAutograph}, authentic=${isAuthentic} → isAuthenticated=${isAuthenticatedAutograph}`);

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
                  has_structural_damage: parsedJSONData.structural_damage?.detected || false,
                  has_handwriting: parsedJSONData.handwriting?.detected || false,
                  has_alterations: parsedJSONData.alterations?.detected || false,
                  crease_detected: parsedJSONData.structural_damage?.has_creases || false,
                  bent_corner_detected: parsedJSONData.structural_damage?.has_bent_corners || false,
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
                  console.log(`[GET /api/sports/${cardId}] ✅ Set card_info.autographed = true (authenticated autograph detected)`);
                }

                console.log(`[GET /api/sports/${cardId}] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}, SGC ${professionalEstimates.SGC.estimated_grade}, CGC ${professionalEstimates.CGC.estimated_grade}`);
              } catch (mapperError) {
                console.error(`[GET /api/sports/${cardId}] ⚠️ Professional mapper failed:`, mapperError);
                conversationalGradingData.professional_grade_estimates = null;
              }
            } else {
              console.log(`[GET /api/sports/${cardId}] ⏭️ Skipping professional mapper (grade is N/A or null)`);
              conversationalGradingData.professional_grade_estimates = null;
            }
          } catch (jsonParseError) {
            console.error(`[GET /api/sports/${cardId}] ⚠️ Failed to parse JSON, continuing without detailed fields:`, jsonParseError);
          }
        }

      } catch (error: any) {
        console.error(`[GET /api/sports/${cardId}] ⚠️ Conversational grading failed:`, error.message);
        // Return error response - we can't grade without conversational grading
        return NextResponse.json(
          { error: "Failed to grade sports card: " + error.message },
          { status: 500 }
        );
      }
    }


    // Update database with comprehensive sports card data
    const updateData = {
      // Legacy AI grading for backward compatibility with frontend
      ai_grading: gradingResult,

      // 🎯 PRIMARY: Conversational grading markdown/JSON (full report)
      conversational_grading: conversationalGradingResult,

      // 🎯 PRIMARY: Conversational AI grading v4.2 (extracted fields)
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_grade_uncertainty: conversationalGradingData?.grade_uncertainty || null,
      conversational_sub_scores: conversationalGradingData?.sub_scores || null,
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_final_grade_summary: conversationalGradingData?.final_grade_summary || null,
      conversational_image_confidence: conversationalGradingData?.image_confidence || null,
      conversational_case_detection: conversationalGradingData?.case_detection || null,
      conversational_slab_detection: conversationalGradingData?.slab_detection || null,
      conversational_weighted_sub_scores: conversationalGradingData?.weighted_sub_scores || null,
      conversational_limiting_factor: conversationalGradingData?.limiting_factor || null,
      conversational_preliminary_grade: conversationalGradingData?.preliminary_grade || null,
      conversational_card_info: conversationalGradingData?.card_info || null,
      conversational_centering_ratios: conversationalGradingData?.centering_ratios || null,
      conversational_corners_edges_surface: conversationalGradingData?.corners_edges_surface || null,  // 🆕 Detailed corner/edge/surface analysis
      conversational_defects_front: conversationalGradingData?.transformedDefects?.front || null,  // 🆕 Front defects
      conversational_defects_back: conversationalGradingData?.transformedDefects?.back || null,  // 🆕 Back defects
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

      // 🎯 Card info from Conversational AI
      card_name: conversationalGradingData?.card_info?.card_name || null,
      featured: conversationalGradingData?.card_info?.player_or_character || null,
      card_set: conversationalGradingData?.card_info?.set_name || null,
      manufacturer_name: conversationalGradingData?.card_info?.manufacturer || null,
      release_date: conversationalGradingData?.card_info?.year || null,
      card_number: conversationalGradingData?.card_info?.card_number || null,
      serial_numbering: conversationalGradingData?.card_info?.serial_number || null,
      authentic: conversationalGradingData?.card_info?.authentic !== false,  // Default to true
      rookie_or_first_print: conversationalGradingData?.card_info?.rookie_or_first || null,
      rarity_description: conversationalGradingData?.card_info?.rarity_or_variant || null,
      autographed: conversationalGradingData?.card_info?.autographed || false,

      // Legacy grade fields (for backward compatibility)
      raw_decimal_grade: conversationalGradingData?.decimal_grade || null,
      dcm_grade_whole: conversationalGradingData?.whole_grade || null,
      ai_confidence_score: conversationalGradingData?.image_confidence || null,
      final_dcm_score: conversationalGradingData?.whole_grade?.toString() || null,

      // Processing metadata
      processing_time: Date.now() - startTime
    };

    // Generate standardized label data for consistent display across all contexts
    // 🔧 v7.2: Enhanced fallbacks - extract card info from final_grade summary if card_info is missing
    const cardInfoFromAI = conversationalGradingData?.card_info;

    // Try to extract player name from summary text if card_info is missing
    // Summary often contains: "This [year] [set] [player name] card..."
    let extractedPlayerName: string | null = null;
    if (!cardInfoFromAI?.player_or_character && conversationalGradingData?.final_grade_summary) {
      const summary = conversationalGradingData.final_grade_summary;
      // Match patterns like "2021 Panini Impeccable Matthew Stafford" or just player names
      const playerMatch = summary.match(/(?:This\s+)?(?:\d{4}\s+)?(?:[\w\s]+\s+)?((?:[A-Z][a-z]+\s+)+[A-Z][a-z]+)(?:\s+(?:card|silver|gold|base|rookie|auto))/i);
      if (playerMatch && playerMatch[1]) {
        extractedPlayerName = playerMatch[1].trim();
        console.log(`[GET /api/sports/${cardId}] Extracted player name from summary: "${extractedPlayerName}"`);
      }
    }

    const cardForLabel: CardForLabel = {
      id: cardId,
      category: card.category || 'Sports',
      serial: card.serial,
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_card_info: cardInfoFromAI || null,
      card_name: cardInfoFromAI?.card_name || card.card_name,
      card_set: cardInfoFromAI?.set_name || card.card_set,
      card_number: cardInfoFromAI?.card_number || card.card_number,
      // 🔧 v7.2: Enhanced fallback chain for player name
      featured: cardInfoFromAI?.player_or_character || extractedPlayerName || card.featured,
      release_date: cardInfoFromAI?.year || card.release_date,
      serial_numbering: cardInfoFromAI?.serial_number || card.serial_numbering,
      autographed: cardInfoFromAI?.autographed || card.autographed,
      rookie_card: cardInfoFromAI?.rookie_or_first === true || card.rookie_card,
    };
    const labelData = generateLabelData(cardForLabel);
    (updateData as any).label_data = labelData;

    console.log(`[GET /api/sports/${cardId}] Generated label data:`, {
      primaryName: labelData.primaryName,
      contextLine: labelData.contextLine,
      featuresLine: labelData.featuresLine,
      grade: labelData.gradeFormatted
    });

    console.log(`[GET /api/sports/${cardId}] Updating database with conversational grading:`, {
      card_name: conversationalGradingData?.card_info?.card_name,
      card_set: conversationalGradingData?.card_info?.set_name,
      featured: conversationalGradingData?.card_info?.player_or_character,
      decimal_grade: conversationalGradingData?.decimal_grade,
      whole_grade: conversationalGradingData?.whole_grade
    });

    const { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    if (updateError) {
      console.error(`[GET /api/sports/${cardId}] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to save sports card grading results" }, { status: 500 });
    }

    console.log(`[GET /api/sports/${cardId}] Sports card request completed in ${Date.now() - startTime}ms`);

    // Return updated sports card data with conversational grading
    return NextResponse.json({
      ...card,
      ...updateData,  // Include all the conversational grading fields
      front_url: frontUrl,
      back_url: backUrl,
      // ⭐ Card owner's founder/VIP/Card Lovers status (for emblems on public card labels)
      owner_is_founder: ownerIsFounder,
      owner_show_founder_badge: ownerShowFounderBadge,
      owner_is_vip: ownerIsVip,
      owner_show_vip_badge: ownerShowVipBadge,
      owner_is_card_lover: ownerIsCardLover,
      owner_show_card_lover_badge: ownerShowCardLoverBadge,
      owner_preferred_label_emblem: ownerPreferredLabelEmblem
    });

  } catch (error: any) {
    console.error(`[GET /api/sports/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to process sports card: " + error.message },
      { status: 500 }
    );
  } finally {
    processingSportsCards.delete(cardId);
    console.log(`[GET /api/sports/${cardId}] Removed from processing set`);
  }
}

// PATCH handler for updating card data (e.g., clearing cached grading)
export async function PATCH(request: NextRequest, { params }: SportsCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[PATCH /api/sports/${cardId}] Starting card update request`);

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

    console.log(`[PATCH /api/sports/${cardId}] Update data:`, body);

    // Update the card
    const { data, error } = await supabase
      .from("cards")
      .update(body)
      .eq("id", cardId)
      .select()
      .single();

    if (error) {
      console.error(`[PATCH /api/sports/${cardId}] Update failed:`, error);
      return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
    }

    console.log(`[PATCH /api/sports/${cardId}] Card updated successfully`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[PATCH /api/sports/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to update card: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE handler for removing cards
export async function DELETE(request: NextRequest, { params }: SportsCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[DELETE /api/sports/${cardId}] Starting card deletion request`);

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Get the card and verify ownership
    const { data: card, error: fetchError } = await supabase
      .from("cards")
      .select("front_path, back_path, user_id")
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      console.error(`[DELETE /api/sports/${cardId}] Card not found:`, fetchError);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
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

    // Delete card record
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error(`[DELETE /api/sports/${cardId}] Deletion failed:`, deleteError);
      return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
    }

    console.log(`[DELETE /api/sports/${cardId}] Card deleted successfully`);
    return NextResponse.json({ success: true, message: "Card deleted successfully" });

  } catch (error: any) {
    console.error(`[DELETE /api/sports/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to delete card: " + error.message },
      { status: 500 }
    );
  }
}