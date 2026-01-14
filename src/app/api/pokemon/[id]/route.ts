import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
// PRIMARY: Conversational grading system (matches sports card flow)
import { gradeCardConversational } from "@/lib/visionGrader";
// Professional grade estimation (deterministic backend mapper)
import { estimateProfessionalGrades } from "@/lib/professionalGradeMapper";
// SET IDENTIFICATION: Local Supabase database lookup (external Pokemon TCG API is disabled)
import { lookupSetByCardNumber } from "@/lib/pokemonTcgApi";
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

// Track Pokemon cards currently being processed with timestamps
const processingPokemonCards = new Map<string, number>();

// Clean up stuck processing cards (older than 2 minutes - reduced from 5 to prevent long lock-outs)
const cleanupStuckCards = () => {
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);

  for (const [cardId, timestamp] of processingPokemonCards.entries()) {
    if (timestamp < twoMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set (was locked for ${Math.round((now - timestamp) / 1000)}s)`);
      processingPokemonCards.delete(cardId);
    }
  }
};

/**
 * 🔒 DENOMINATOR-TO-SET LOOKUP TABLE
 * Maps card denominators to their correct sets. Used to override AI hallucination.
 */
const DENOMINATOR_TO_SET: Record<number, { set_name: string; year: string; era: string }> = {
  // WOTC Era (1999-2003)
  102: { set_name: 'Base Set', year: '1999', era: 'WOTC' },
  64: { set_name: 'Jungle', year: '1999', era: 'WOTC' },
  62: { set_name: 'Fossil', year: '1999', era: 'WOTC' },
  82: { set_name: 'Team Rocket', year: '2000', era: 'WOTC' },
  132: { set_name: 'Gym Heroes', year: '2000', era: 'WOTC' },
  111: { set_name: 'Neo Genesis', year: '2000', era: 'WOTC' },
  75: { set_name: 'Neo Discovery', year: '2001', era: 'WOTC' },
  66: { set_name: 'Neo Revelation', year: '2001', era: 'WOTC' },
  113: { set_name: 'Neo Destiny', year: '2002', era: 'WOTC' },
  165: { set_name: 'Legendary Collection', year: '2002', era: 'WOTC' },
  147: { set_name: 'Expedition Base Set', year: '2002', era: 'WOTC' },
  182: { set_name: 'Aquapolis', year: '2003', era: 'WOTC' },
  186: { set_name: 'Skyridge', year: '2003', era: 'WOTC' },
};

/**
 * 🔒 OCR OVERRIDE: ALWAYS use OCR breakdown as source of truth for card number
 *
 * The AI correctly OCRs the card number in card_number_ocr_breakdown but then
 * often outputs wrong values in card_number_raw due to hallucination.
 *
 * Solution: ALWAYS parse and use the OCR breakdown, ignoring AI's stated values.
 */
function validateAndFixCardNumberFromOcr(cardInfo: any): any {
  if (!cardInfo) return cardInfo;

  const ocrBreakdown = cardInfo.card_number_ocr_breakdown;
  const statedRaw = cardInfo.card_number_raw;
  const statedTotal = cardInfo.set_total;
  const statedSetName = cardInfo.set_name;
  const statedYear = cardInfo.year;

  // If no OCR breakdown, can't override
  if (!ocrBreakdown || typeof ocrBreakdown !== 'string') {
    console.log('[OCR Override] No OCR breakdown found, using AI stated values');
    return cardInfo;
  }

  // Parse the OCR breakdown to reconstruct the actual number
  // Format: "Position 1: 4, Position 2: /, Position 3: 1, Position 4: 0, Position 5: 2"
  const positionPattern = /Position \d+:\s*([^,]+)/gi;
  const matches = [...ocrBreakdown.matchAll(positionPattern)];

  if (matches.length === 0) {
    console.log('[OCR Override] Could not parse OCR breakdown format');
    return cardInfo;
  }

  // Reconstruct the number from positions
  const reconstructed = matches.map(m => m[1].trim()).join('');
  console.log(`[OCR Override] Reconstructed from breakdown: "${reconstructed}"`);
  console.log(`[OCR Override] AI stated card_number_raw: "${statedRaw}"`);

  // ALWAYS use reconstructed value - this is the source of truth
  const hasMismatch = reconstructed !== statedRaw;
  if (hasMismatch) {
    console.log(`[OCR Override] ⚠️ MISMATCH! OCR="${reconstructed}" vs AI="${statedRaw}" - Using OCR value`);
  } else {
    console.log(`[OCR Override] ✅ Values match`);
  }

  // Extract numerator and denominator from reconstructed
  const fractionMatch = reconstructed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const [, numerator, denominator] = fractionMatch;
    const denominatorNum = parseInt(denominator);

    // 🔒 CRITICAL: Look up correct set based on denominator from OCR
    const setLookup = DENOMINATOR_TO_SET[denominatorNum];

    if (setLookup) {
      console.log(`[OCR Override] 🎯 Denominator ${denominatorNum} → ${setLookup.set_name} (${setLookup.year})`);
    }

    // ALWAYS create corrected card_info using OCR values
    const corrected = {
      ...cardInfo,
      // ALWAYS use OCR-derived values
      card_number_raw: reconstructed,
      card_number: numerator,
      set_total: denominator,
      // Override set_name and year from denominator lookup
      ...(setLookup && {
        set_name: setLookup.set_name,
        year: setLookup.year,
        card_era: setLookup.era,
      }),
      _ocr_override: {
        ocr_breakdown: ocrBreakdown,
        ocr_reconstructed: reconstructed,
        ai_stated_raw: statedRaw,
        ai_stated_total: statedTotal,
        ai_stated_set_name: statedSetName,
        ai_stated_year: statedYear,
        had_mismatch: hasMismatch,
        denominator_lookup_used: !!setLookup,
        final_set_name: setLookup?.set_name || statedSetName,
        final_year: setLookup?.year || statedYear,
      }
    };

    console.log(`[OCR Override] ✅ Final values: card_number="${numerator}", set_total="${denominator}", set_name="${corrected.set_name}", year="${corrected.year}"`);
    return corrected;
  }

  // Non-fraction format - just use reconstructed for card_number_raw
  console.log(`[OCR Override] Non-fraction format, using reconstructed: "${reconstructed}"`);
  return {
    ...cardInfo,
    card_number_raw: reconstructed,
    _ocr_override: {
      ocr_breakdown: ocrBreakdown,
      ocr_reconstructed: reconstructed,
      ai_stated_raw: statedRaw,
      had_mismatch: hasMismatch,
    }
  };
}

// Types
type PokemonCardGradingRequest = {
  params: Promise<{ id: string }>;
};

// Signed URL generation
async function createSignedUrl(supabase: any, bucket: string, path: string | null | undefined): Promise<string | null> {
  // Guard against null/undefined paths
  if (!path) {
    console.error(`[createSignedUrl] Cannot create signed URL: path is ${path}`);
    return null;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (error) {
      console.error(`[createSignedUrl] Failed for ${path}:`, error.message || error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(`[createSignedUrl] Error for ${path}:`, error);
    return null;
  }
}

// Removed old Pokemon-specific functions:
// - getPokemonInstructions() - prompts now loaded by gradeCardConversational
// - gradePokemonCardWithAI() - replaced with unified gradeCardConversational
// This matches the sports card grading flow for consistency and efficiency

// Extract Pokemon card grade information
function extractPokemonGradeInfo(gradingResult: any) {
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

// Extract key fields for database columns (Pokemon-specific) - Legacy Assistant API
function extractPokemonCardFields(gradingResult: any) {
  const cardInfo = gradingResult["Card Information"] || {};
  const cardDetails = gradingResult["Card Details"] || {};
  const estimatedValue = gradingResult["DCM Estimated Value"] || {};

  return {
    card_name: cardInfo["Card Name"] || null,
    card_set: cardInfo["Card Set"] || null,
    card_number: cardInfo["Card Number"] || null,
    serial_numbering: cardInfo["Serial Numbering"] || null,
    manufacturer_name: cardInfo["Manufacturer Name"] || null,
    release_date: cardInfo["Release Date"] || null,
    authentic: cardInfo["Authentic"] || null,
    // Pokemon-specific fields
    pokemon_type: cardDetails["Pokemon Type"] || null,
    pokemon_stage: cardDetails["Pokemon Stage"] || null,
    hp: cardDetails["HP"] || null,
    card_type: cardDetails["Card Type"] || null,
    rarity_description: cardDetails["Rarity"] || null,
    autographed: cardDetails["Autographed"] || null,
    estimated_market_value: estimatedValue["Estimated Market Value"] || null,
    estimated_range: estimatedValue["Estimated Range"] || null,
    estimate_confidence: estimatedValue["Estimate Confidence"] || null
  };
}

// Extract Pokemon-specific fields from conversational v4.2 JSON
function extractPokemonFieldsFromConversational(conversationalJSON: any) {
  try {
    // Parse JSON if it's a string
    const data = typeof conversationalJSON === 'string' ? JSON.parse(conversationalJSON) : conversationalJSON;

    // Extract from v4.2 JSON structure
    const cardInfo = data.card_info || {};

    console.log('[Pokemon Field Extraction] card_info:', cardInfo);

    return {
      card_name: cardInfo.card_name || null,
      card_set: cardInfo.set_name || null,
      card_number: cardInfo.card_number || null,
      release_date: cardInfo.year || null,
      manufacturer_name: cardInfo.manufacturer || null,
      serial_numbering: cardInfo.serial_number || null,
      authentic: cardInfo.authentic !== undefined ? cardInfo.authentic : null,
      // Pokemon-specific fields from v4.2 JSON
      pokemon_type: cardInfo.pokemon_type || null,
      pokemon_stage: cardInfo.pokemon_stage || null,
      hp: cardInfo.hp || null,
      card_type: cardInfo.card_type || null,
      rarity_description: cardInfo.rarity_or_variant || null,
      autographed: cardInfo.autographed !== undefined ? cardInfo.autographed : null,
      pokemon_featured: cardInfo.player_or_character || null
    };
  } catch (error) {
    console.error('[Pokemon Field Extraction] Error parsing conversational JSON:', error);
    return {};
  }
}

// Main GET handler for Pokemon cards
export async function GET(request: NextRequest, { params }: PokemonCardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  // Check for query parameters
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';
  const statusOnly = searchParams.get('status_only') === 'true';

  console.log(`[GET /api/pokemon/${cardId}] Starting Pokemon card request (force_regrade: ${forceRegrade}, status_only: ${statusOnly})`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // STATUS-ONLY MODE: Just return the current card state without acquiring lock or starting grading
  // This is used by the background polling system to check if grading is complete
  if (statusOnly) {
    console.log(`[GET /api/pokemon/${cardId}] Status-only check requested`);

    const supabase = supabaseServer();
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, conversational_grading, raw_decimal_grade, dcm_grade_whole, category")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.log(`[GET /api/pokemon/${cardId}] Status-only 404: error=${cardError?.message || 'none'}, code=${cardError?.code || 'none'}, card exists=${!!card}`);
      return NextResponse.json({ error: "Card not found", debug: cardError?.message }, { status: 404 });
    }

    // Check if card has complete grading
    const hasCompleteGrading =
      (card.conversational_grading && card.conversational_grading.length > 0) ||
      (card.raw_decimal_grade && card.dcm_grade_whole);

    // Check if currently processing (in the lock map)
    const isProcessing = processingPokemonCards.has(cardId);

    console.log(`[GET /api/pokemon/${cardId}] Status-only result: complete=${hasCompleteGrading}, processing=${isProcessing}`);

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

  // Check if already processing this Pokemon card
  if (processingPokemonCards.has(cardId)) {
    console.log(`[GET /api/pokemon/${cardId}] Pokemon card already being processed, returning 429`);
    return NextResponse.json(
      { error: "Pokemon card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingPokemonCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get Pokemon card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .eq("category", "Pokemon") // Ensure it's a Pokemon card
      .single();

    if (cardError || !card) {
      console.error(`[GET /api/pokemon/${cardId}] Card lookup error:`, cardError);
      console.log(`[GET /api/pokemon/${cardId}] Card data:`, card);
      return NextResponse.json({ error: "Pokemon card not found" }, { status: 404 });
    }

    console.log(`[GET /api/pokemon/${cardId}] Pokemon card found`);

    // 🔒 VISIBILITY CHECK: Verify user has permission to view this card
    const cardVisibility = card.visibility || 'private'; // Default to private if not set

    if (cardVisibility === 'private') {
      // Private card - only owner can view
      // Get user_id from query parameter (client-side directAuth uses localStorage)
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('user_id');

      if (!userId) {
        console.log(`[GET /api/pokemon/${cardId}] 🔒 Private card access denied - not authenticated`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card. Please log in if this is your card.",
          visibility: "private"
        }, { status: 403 });
      }

      if (card.user_id !== userId) {
        console.log(`[GET /api/pokemon/${cardId}] 🔒 Private card access denied - user ${userId} is not owner ${card.user_id}`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card.",
          visibility: "private"
        }, { status: 403 });
      }

      console.log(`[GET /api/pokemon/${cardId}] ✅ Private card access granted to owner ${userId}`);
    } else {
      // Public card - anyone can view
      console.log(`[GET /api/pokemon/${cardId}] 🌐 Public card - access granted`);
    }

    // ⭐ Fetch card owner's founder status (for founder emblem on card labels)
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
        console.error(`[GET /api/pokemon/${cardId}] Error fetching owner founder status:`, err);
      }
    }

    // Create signed URLs for Pokemon card images (parallel for speed)
    console.log(`[GET /api/pokemon/${cardId}] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const [frontUrl, backUrl] = await Promise.all([
      createSignedUrl(supabase, "cards", card.front_path),
      createSignedUrl(supabase, "cards", card.back_path)
    ]);

    if (!frontUrl || !backUrl) {
      console.error(`[GET /api/pokemon/${cardId}] Failed to create signed URLs. Front: ${frontUrl}, Back: ${backUrl}`);
      return NextResponse.json({ error: "Failed to access Pokemon card images" }, { status: 500 });
    }
    console.log(`[GET /api/pokemon/${cardId}] Signed URLs created successfully`);

    // Check if Pokemon card already has complete grading data
    // Card is complete if:
    // 1. Has ai_grading AND numeric grades (decimal AND whole), OR
    // 2. Has ai_grading AND N/A grade (null) with a complete conversational grading report (for altered cards)
    const hasCompleteGrading =
      (card.ai_grading && card.raw_decimal_grade && card.dcm_grade_whole) ||
      (card.ai_grading && card.conversational_grading && card.conversational_grading.length > 0);

    // Skip cache if force_regrade is requested
    if (hasCompleteGrading && !forceRegrade) {
      console.log(`[GET /api/pokemon/${cardId}] Pokemon card already fully processed, returning existing result`);

      // ALWAYS parse conversational_grading to extract corners/edges/surface data
      // Even if sub_scores exists, we need the detailed analysis for display
      let parsedConversationalData = null;
      if (card.conversational_grading) {
        try {
          console.log('[POKEMON CACHE] Parsing cached conversational_grading JSON...');
          const jsonData = JSON.parse(card.conversational_grading);

          // 🔍 DEBUG: Log surface data structure
          console.log('[POKEMON CACHE DEBUG] Surface data structure:', JSON.stringify(jsonData.surface, null, 2));

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
                summary: jsonData.surface?.front?.summary || jsonData.surface?.front_summary || 'Surface analysis not available',
                finish_type: jsonData.surface?.front?.finish_type || null  // Include finish type if available
              },
              // Back surface
              back_surface: {
                defects: jsonData.surface?.back?.defects || [],
                analysis: jsonData.surface?.back?.condition || jsonData.surface?.back?.analysis || 'No analysis available',
                sub_score: jsonData.raw_sub_scores?.surface_back || 0,
                summary: jsonData.surface?.back?.summary || jsonData.surface?.back_summary || 'Surface analysis not available'
              }
            },
            // 🔒 OCR VALIDATION: Validate card_info against OCR breakdown to catch AI hallucination
            card_info: validateAndFixCardNumberFromOcr(jsonData.card_info || null),
            transformedDefects: {
              front: jsonData.defect_summary?.front || null,
              back: jsonData.defect_summary?.back || null
            },
            case_detection: jsonData.case_detection || null,
            professional_grade_estimates: jsonData.professional_grade_estimates || null
          };

          // Calculate professional grade estimates if not stored in JSON
          if (!parsedConversationalData.professional_grade_estimates && parsedConversationalData.decimal_grade) {
            try {
              console.log('[POKEMON CACHE] 🔧 Calculating professional grade estimates...');

              // Parse centering ratios
              const parseCentering = (ratio: string | undefined): [number, number] | undefined => {
                if (!ratio || ratio === 'N/A') return undefined;
                const parts = ratio.split('/').map(Number);
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  return [parts[0], parts[1]] as [number, number];
                }
                return undefined;
              };

              // Check if autograph is manufacturer-authenticated
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

              console.log(`[POKEMON CACHE] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}`);
            } catch (mapperError) {
              console.error('[POKEMON CACHE] ⚠️ Professional mapper failed:', mapperError);
            }
          }

          console.log('[POKEMON CACHE] ✅ Parsed cached JSON successfully');
        } catch (error) {
          console.error('[POKEMON CACHE] ⚠️ Failed to parse cached JSON:', error);
        }
      }

      // 🔧 FIX: Merge parsed card_info with column values - column values take priority
      // This ensures manual edits to conversational_card_info column are reflected
      const mergedCardInfo = parsedConversationalData?.card_info
        ? {
            ...parsedConversationalData.card_info,
            // Column values override parsed values (for manual edits)
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
          conversational_final_grade_summary: parsedConversationalData.final_grade_summary,  // 🆕 Overall summary
          conversational_sub_scores: parsedConversationalData.sub_scores,
          conversational_condition_label: parsedConversationalData.condition_label,
          conversational_image_confidence: parsedConversationalData.image_confidence,
          conversational_centering_ratios: parsedConversationalData.centering_ratios,
          conversational_card_info: mergedCardInfo,  // 🔧 Use merged card_info
          conversational_corners_edges_surface: parsedConversationalData.corners_edges_surface,
          conversational_case_detection: parsedConversationalData.case_detection,
          conversational_defects_front: parsedConversationalData.transformedDefects.front,
          conversational_defects_back: parsedConversationalData.transformedDefects.back,
          estimated_professional_grades: parsedConversationalData.professional_grade_estimates
        }),
        front_url: frontUrl,
        back_url: backUrl,
        processing_time: card.processing_time,  // Use stored value, not recalculated
        // ⭐ Card owner's founder status (for founder emblem on public card labels)
        owner_is_founder: ownerIsFounder,
        owner_show_founder_badge: ownerShowFounderBadge
      });
    }

    // If incomplete grading OR force_regrade is requested, process it
    if (!hasCompleteGrading) {
      console.log(`[GET /api/pokemon/${cardId}] Pokemon card needs grading analysis`);
    } else if (forceRegrade) {
      console.log(`[GET /api/pokemon/${cardId}] 🔄 Force re-grade requested, bypassing cache`);

      // Clear ALL cached verification data to ensure fresh grading
      console.log(`[GET /api/pokemon/${cardId}] 🧹 Clearing cached pokemon_api_* fields for fresh re-grade`);
      const { error: clearError } = await supabase
        .from('cards')
        .update({
          pokemon_api_id: null,
          pokemon_api_data: null,
          pokemon_api_verified: false,
          pokemon_api_verified_at: null,
          pokemon_api_confidence: null,
          pokemon_api_method: null,
          // Also clear the card info fields that get overwritten by verification
          card_number: null,
          card_set: null,
          release_date: null,
          // Clear label data so it gets regenerated
          label_data: null
        })
        .eq('id', cardId);

      if (clearError) {
        console.error(`[GET /api/pokemon/${cardId}] Failed to clear cached fields:`, clearError);
      } else {
        console.log(`[GET /api/pokemon/${cardId}] ✅ Cleared cached pokemon_api_* and card info fields`);
      }
    }

    // 🎯 PRIMARY: Conversational AI grading (v4.2 JSON format)
    console.log(`[GET /api/pokemon/${cardId}] Starting Pokemon card conversational AI grading (v4.2)...`);
    let conversationalGradingResult = null;
    let conversationalResultV3_3: any = null; // Store full result for enhanced data
    let isJSONMode = false; // Track if we're using JSON format
    let gradingResult = null; // Legacy field for backward compatibility

    if (frontUrl && backUrl) {
      try {
        console.log(`[POKEMON CONVERSATIONAL AI v4.2] 🎯 Starting PRIMARY grading with Pokemon-specific prompt...`);

        // Check if user provided condition report hints
        const userConditionReport = card.user_condition_processed || null;
        if (userConditionReport) {
          console.log(`[GET /api/pokemon/${cardId}] 📋 User condition report found: ${userConditionReport.total_defects_reported || 0} defects reported`);
        }

        const conversationalResult = await gradeCardConversational(frontUrl, backUrl, 'pokemon', {
          userConditionReport: userConditionReport
        });
        conversationalGradingResult = conversationalResult.markdown_report;

        // Store full result for enhanced data extraction
        conversationalResultV3_3 = conversationalResult;

        // Detect if we're using JSON format (v4.0+)
        isJSONMode = conversationalResult.meta?.version === 'conversational-v4.2-json' ||
                     conversationalResult.meta?.version === 'conversational-v4.0-json';
        console.log(`[POKEMON CONVERSATIONAL AI] Output format detected: ${isJSONMode ? 'JSON (v4.2)' : 'Markdown (v3.8)'}`);

        console.log(`[GET /api/pokemon/${cardId}] ✅ Conversational grading completed: ${conversationalResult.extracted_grade?.decimal_grade || 'N/A'}`);

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
            console.error(`[GET /api/pokemon/${cardId}] Failed to create legacy gradingResult:`, e);
          }
        }
      } catch (error: any) {
        console.error(`[GET /api/pokemon/${cardId}] ⚠️ Conversational grading failed:`, error.message);
        return NextResponse.json({
          error: "Failed to grade Pokemon card. Please try again or contact support.",
          details: error.message
        }, { status: 500 });
      }
    }

    // 🆕 Parse conversational JSON to extract structured fields
    let conversationalGradingData = null;
    if (conversationalGradingResult) {
      try {
        console.log(`[GET /api/pokemon/${cardId}] Parsing conversational JSON...`);
        const jsonData = JSON.parse(conversationalGradingResult);

        // 🆕 v6.0 THREE-PASS GRADING: Check for grading_passes.averaged_rounded
        const threePassData = jsonData.grading_passes;
        const hasThreePass = threePassData?.averaged_rounded?.final !== undefined;

        if (hasThreePass) {
          console.log(`[GET /api/pokemon/${cardId}] ✅ THREE-PASS GRADING detected`);
          console.log(`[GET /api/pokemon/${cardId}] Pass 1: ${threePassData.pass_1?.final}, Pass 2: ${threePassData.pass_2?.final}, Pass 3: ${threePassData.pass_3?.final}`);
          console.log(`[GET /api/pokemon/${cardId}] Averaged: ${threePassData.averaged?.final?.toFixed(2)}, Variance: ${threePassData.variance}, Consistency: ${threePassData.consistency}`);
        } else {
          console.log(`[GET /api/pokemon/${cardId}] ⚠️ No three-pass data found, using direct scores`);
        }

        // Map JSON to structured data format
        // 🎯 THREE-PASS: Use averaged_rounded when available, fallback to direct values
        const avgRounded = threePassData?.averaged_rounded;

        // 🔧 v6.2: Fix any grade mismatches in the summary text
        const actualDecimalGrade = avgRounded?.final ?? jsonData.scoring?.final_grade ?? jsonData.final_grade?.decimal_grade ?? null;
        const rawSummary = jsonData.final_grade?.summary || null;
        const correctedSummary = rawSummary && actualDecimalGrade !== null
          ? fixSummaryGradeMismatch(rawSummary, actualDecimalGrade)
          : rawSummary;

        conversationalGradingData = {
          // Handle three-pass, v5.0, and v4.2 formats (priority order)
          decimal_grade: actualDecimalGrade,
          whole_grade: avgRounded?.final ? Math.floor(avgRounded.final) : (jsonData.scoring?.rounded_grade ?? jsonData.final_grade?.whole_grade ?? null),
          grade_range: jsonData.image_quality?.grade_uncertainty || jsonData.scoring?.grade_range || jsonData.final_grade?.grade_range || '±0.5',
          condition_label: jsonData.final_grade?.condition_label || null,
          final_grade_summary: correctedSummary,
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
          // 🔒 OCR VALIDATION: Validate card_info against OCR breakdown to catch AI hallucination
          card_info: validateAndFixCardNumberFromOcr(jsonData.card_info || null),
          case_detection: jsonData.case_detection || null,
          professional_slab: jsonData.slab_detection || null,  // 🔧 FIX: Master rubric outputs slab_detection, not professional_slab
          professional_grade_estimates: jsonData.professional_grade_estimates || null,
          meta: jsonData.metadata || null
        };

        console.log(`[GET /api/pokemon/${cardId}] ✅ Parsed conversational data:`, {
          grade: conversationalGradingData.decimal_grade,
          sub_scores: conversationalGradingData.sub_scores,
          has_defects: !!(conversationalGradingData.transformedDefects?.front)
        });

        // 🎯 Call backend deterministic mapper for professional grade estimates
        if (conversationalGradingData.decimal_grade && conversationalGradingData.decimal_grade !== 'N/A') {
          try {
            console.log(`[GET /api/pokemon/${cardId}] 🔧 Calling professional grade mapper (deterministic)...`);

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

            console.log(`[GET /api/pokemon/${cardId}] 🔍 Autograph detection: type=${autographType}, flag=${hasAutographedFlag}, rarity=${hasAutographRarity}, name=${hasAutographInName}, rarityFeatures=${hasRarityAutograph}, authentic=${isAuthentic} → isAuthenticated=${isAuthenticatedAutograph}`);

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
              console.log(`[GET /api/pokemon/${cardId}] ✅ Set card_info.autographed = true (authenticated autograph detected)`);
            }

            console.log(`[GET /api/pokemon/${cardId}] ✅ Professional estimates: PSA ${professionalEstimates.PSA.estimated_grade}, BGS ${professionalEstimates.BGS.estimated_grade}, SGC ${professionalEstimates.SGC.estimated_grade}, CGC ${professionalEstimates.CGC.estimated_grade}`);
          } catch (mapperError) {
            console.error(`[GET /api/pokemon/${cardId}] ⚠️ Professional mapper failed:`, mapperError);
            conversationalGradingData.professional_grade_estimates = null;
          }
        } else {
          console.log(`[GET /api/pokemon/${cardId}] ⏭️ Skipping professional mapper (grade is N/A or null)`);
          conversationalGradingData.professional_grade_estimates = null;
        }

        // 🆕 HYBRID SET IDENTIFICATION: Check if we need API lookup
        const cardInfo = conversationalGradingData.card_info;

        // 🇯🇵 JAPANESE CARD DETECTION: Check if card has Japanese text
        // Detects hiragana (3040-309F), katakana (30A0-30FF), and kanji (4E00-9FFF)
        const hasJapaneseText = (text: string | null | undefined): boolean => {
          if (!text) return false;
          return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
        };

        const isJapaneseCard = hasJapaneseText(cardInfo?.card_name) ||
                               hasJapaneseText(cardInfo?.player_or_character) ||
                               hasJapaneseText(cardInfo?.set_name) ||
                               cardInfo?.language === 'ja' ||
                               cardInfo?.language === 'japanese';

        // 🇯🇵 JAPANESE DATABASE VALIDATION: Query pokemon_cards_ja for Japanese cards
        let dbValidationApplied = false;
        if (isJapaneseCard && cardInfo?.card_number) {
          try {
            const cardName = cardInfo.card_name || cardInfo.player_or_character;
            const cardNumber = cardInfo.card_number;

            console.log(`[GET /api/pokemon/${cardId}] 🇯🇵 Japanese card detected, validating against pokemon_cards_ja`);
            console.log(`[GET /api/pokemon/${cardId}] 🔍 Searching: name="${cardName}", number="${cardNumber}"`);

            // Try to find the Japanese card in our database
            let jaQuery = supabase
              .from('pokemon_cards_ja')
              .select('id, name, name_english, local_id, set_id, set_name, set_printed_total, set_release_date, rarity, illustrator, image_url')
              .eq('local_id', cardNumber)
              .order('set_release_date', { ascending: false })
              .limit(10);

            // If we have a name, filter by it too
            if (cardName) {
              jaQuery = supabase
                .from('pokemon_cards_ja')
                .select('id, name, name_english, local_id, set_id, set_name, set_printed_total, set_release_date, rarity, illustrator, image_url')
                .eq('local_id', cardNumber)
                .or(`name.ilike.%${cardName}%,name_english.ilike.%${cardName}%`)
                .order('set_release_date', { ascending: false })
                .limit(10);
            }

            const { data: jaMatches, error: jaError } = await jaQuery;

            if (!jaError && jaMatches && jaMatches.length > 0) {
              // Found match(es) in Japanese database
              // Try to find best match by name similarity
              let bestMatch = jaMatches[0];
              if (cardName && jaMatches.length > 1) {
                const exactMatch = jaMatches.find(m =>
                  m.name === cardName ||
                  m.name_english?.toLowerCase() === cardName.toLowerCase()
                );
                if (exactMatch) bestMatch = exactMatch;
              }

              console.log(`[GET /api/pokemon/${cardId}] ✅ JAPANESE DB MATCH FOUND:`);
              console.log(`  - Japanese name: ${bestMatch.name}`);
              console.log(`  - English name: ${bestMatch.name_english || 'N/A'}`);
              console.log(`  - Set: ${bestMatch.set_name} (${bestMatch.set_id})`);
              console.log(`  - Number: ${bestMatch.local_id}/${bestMatch.set_printed_total}`);

              // Fill in card_info with Japanese database values
              cardInfo.set_name = bestMatch.set_name;
              cardInfo.set_id = bestMatch.set_id;
              cardInfo.set_total = bestMatch.set_printed_total?.toString();
              cardInfo.card_number_raw = `${bestMatch.local_id}/${bestMatch.set_printed_total}`;
              cardInfo.language = 'ja';
              cardInfo.tcgdex_id = bestMatch.id;
              cardInfo.tcgdex_image_url = bestMatch.image_url;

              // Add English name if available
              if (bestMatch.name_english) {
                cardInfo.name_english = bestMatch.name_english;
              }

              // Extract year from set_release_date
              if (bestMatch.set_release_date) {
                const yearMatch = bestMatch.set_release_date.toString().match(/^(\d{4})/);
                if (yearMatch) {
                  cardInfo.year = yearMatch[1];
                }
              }

              // Add rarity and illustrator if available
              if (bestMatch.rarity) {
                cardInfo.rarity_or_variant = bestMatch.rarity;
              }
              if (bestMatch.illustrator) {
                cardInfo.illustrator = bestMatch.illustrator;
              }

              cardInfo.needs_api_lookup = false;
              cardInfo.validated_source = 'pokemon_cards_ja';
              dbValidationApplied = true;

              console.log(`[GET /api/pokemon/${cardId}] ✅ Japanese card info enriched from TCGdex database`);
            } else {
              console.log(`[GET /api/pokemon/${cardId}] ⚠️ No Japanese DB match for "${cardName}" #${cardNumber}, using AI values`);
            }
          } catch (jaValidationError) {
            console.error(`[GET /api/pokemon/${cardId}] ⚠️ Japanese DB validation error:`, jaValidationError);
          }
        }

        // 🔧 ENGLISH DATABASE VALIDATION: Query local pokemon_cards by name + number to validate/correct AI's values
        // This fixes issues where AI changes "125/094" to "125/109" or uses wrong set/year based on its knowledge
        // Skip if already validated as Japanese card
        // 🔒 CRITICAL: Use OCR-derived set_total to filter database (prevents finding wrong set)
        if (!dbValidationApplied && !isJapaneseCard && cardInfo?.player_or_character && cardInfo?.card_number) {
          try {
            const pokemonName = cardInfo.player_or_character;
            const cardNumber = cardInfo.card_number; // Numerator only, e.g., "4"
            // Use OCR override values if available
            const ocrOverride = cardInfo._ocr_override;
            const ocrDerivedTotal = ocrOverride?.ocr_reconstructed?.split('/')?.[1] || cardInfo.set_total;

            console.log(`[GET /api/pokemon/${cardId}] 🔍 Validating card number against local DB: name="${pokemonName}", number="${cardNumber}", ocr_derived_total="${ocrDerivedTotal || 'N/A'}"`);

            // Build query - ALWAYS filter by OCR-derived denominator when available
            let query = supabase
              .from('pokemon_cards')
              .select('name, number, set_printed_total, set_name, set_id, set_release_date')
              .ilike('name', `%${pokemonName}%`)
              .eq('number', cardNumber);

            // 🔒 CRITICAL: Filter by OCR-derived denominator to find correct set
            // This prevents finding Celebrations (25 cards) when OCR shows /102 (Base Set)
            if (ocrDerivedTotal && !isNaN(parseInt(ocrDerivedTotal))) {
              console.log(`[GET /api/pokemon/${cardId}] 🔒 OCR FILTER: set_printed_total=${ocrDerivedTotal}`);
              query = query.eq('set_printed_total', parseInt(ocrDerivedTotal));
            }

            const { data: dbMatches, error: dbError } = await query
              .order('set_release_date', { ascending: false })
              .limit(5);

            if (!dbError && dbMatches && dbMatches.length > 0) {
              // Found match(es) - use database values as source of truth
              const bestMatch = dbMatches.find(m => m.name.toLowerCase().includes(pokemonName.toLowerCase())) || dbMatches[0];
              const dbSetTotal = bestMatch.set_printed_total?.toString();
              const aiSetTotal = cardInfo.set_total;
              const aiSetName = cardInfo.set_name;

              console.log(`[GET /api/pokemon/${cardId}] 🎯 DB Match found: ${bestMatch.name} from ${bestMatch.set_name} (${dbSetTotal} cards)`);

              // Extract year from set_release_date (format: "2025-01-15" or similar)
              let dbYear: string | null = null;
              if (bestMatch.set_release_date) {
                const yearMatch = bestMatch.set_release_date.toString().match(/^(\d{4})/);
                if (yearMatch) {
                  dbYear = yearMatch[1];
                }
              }

              // Always update from DB when we have a match - DB is source of truth
              const needsCorrection = (dbSetTotal && dbSetTotal !== aiSetTotal) ||
                                       (bestMatch.set_name && bestMatch.set_name !== aiSetName) ||
                                       (dbYear && dbYear !== cardInfo.year);

              if (needsCorrection) {
                console.log(`[GET /api/pokemon/${cardId}] ✅ DB CORRECTION APPLIED:`);
                console.log(`  - Card number: AI="${cardNumber}/${aiSetTotal}" → DB="${cardNumber}/${dbSetTotal}"`);
                console.log(`  - Set name: AI="${aiSetName}" → DB="${bestMatch.set_name}"`);
                console.log(`  - Year: AI="${cardInfo.year}" → DB="${dbYear}"`);

                // Correct ALL card_info values with database values
                if (dbSetTotal) {
                  cardInfo.set_total = dbSetTotal;
                  cardInfo.card_number_raw = `${cardNumber}/${dbSetTotal}`;
                }
                cardInfo.set_name = bestMatch.set_name;
                if (dbYear) {
                  cardInfo.year = dbYear;
                }
                cardInfo.needs_api_lookup = false; // Already resolved from local DB
                dbValidationApplied = true;
              } else {
                console.log(`[GET /api/pokemon/${cardId}] ✅ DB VALIDATED: All values match database`);
              }
            } else {
              console.log(`[GET /api/pokemon/${cardId}] ⚠️ No DB match for "${pokemonName}" #${cardNumber}, using AI values`);
            }
          } catch (dbValidationError) {
            console.error(`[GET /api/pokemon/${cardId}] ⚠️ DB validation error:`, dbValidationError);
            // Continue with AI values if DB lookup fails
          }
        }

        // 🔧 If DB validation applied corrections, update the raw JSON string too
        // This ensures conversational_grading column has correct values for frontend parsing
        if (dbValidationApplied && conversationalGradingResult) {
          try {
            const updatedJson = JSON.parse(conversationalGradingResult);
            if (updatedJson.card_info) {
              updatedJson.card_info.set_name = cardInfo.set_name;
              updatedJson.card_info.set_total = cardInfo.set_total;
              updatedJson.card_info.card_number_raw = cardInfo.card_number_raw;
              updatedJson.card_info.year = cardInfo.year;
              updatedJson.card_info.needs_api_lookup = false;

              // 🇯🇵 Add Japanese-specific fields if this is a Japanese card
              if (isJapaneseCard) {
                updatedJson.card_info.language = 'ja';
                updatedJson.card_info.validated_source = 'pokemon_cards_ja';
                if (cardInfo.tcgdex_id) updatedJson.card_info.tcgdex_id = cardInfo.tcgdex_id;
                if (cardInfo.tcgdex_image_url) updatedJson.card_info.tcgdex_image_url = cardInfo.tcgdex_image_url;
                if (cardInfo.name_english) updatedJson.card_info.name_english = cardInfo.name_english;
                if (cardInfo.set_id) updatedJson.card_info.set_id = cardInfo.set_id;
                if (cardInfo.rarity_or_variant) updatedJson.card_info.rarity_or_variant = cardInfo.rarity_or_variant;
                if (cardInfo.illustrator) updatedJson.card_info.illustrator = cardInfo.illustrator;
              }
            }
            conversationalGradingResult = JSON.stringify(updatedJson);
            console.log(`[GET /api/pokemon/${cardId}] ✅ Updated raw JSON with DB-corrected values${isJapaneseCard ? ' (Japanese)' : ''}`);
          } catch (jsonUpdateError) {
            console.error(`[GET /api/pokemon/${cardId}] ⚠️ Failed to update raw JSON:`, jsonUpdateError);
          }
        }

        // Skip API lookup for Japanese cards (they use TCGdex, not Pokemon TCG API)
        const needsApiLookup = !isJapaneseCard && (
                               cardInfo?.needs_api_lookup === true ||
                               ((!cardInfo?.set_name || cardInfo?.set_name === null) && !!cardInfo?.card_number));

        console.log(`[GET /api/pokemon/${cardId}] 🔍 Set identification check:`, {
          set_name: cardInfo?.set_name || 'null',
          card_number: cardInfo?.card_number || 'null',
          needs_api_lookup_flag: cardInfo?.needs_api_lookup,
          will_call_api: needsApiLookup ? 'YES' : 'NO'
        });

        if (needsApiLookup) {
          console.log(`[GET /api/pokemon/${cardId}] 🔍 Calling Pokemon TCG API for set lookup...`);

          try {
            // 🆕 ENHANCED: Use all available card number data for better API lookup
            // Priority: card_number_raw (full printed) > constructed from parts > card_number alone
            const cardNumberRaw = cardInfo.card_number_raw;  // Full printed: "251/264", "SWSH039", "SVP EN 085"
            const cardNumberNumerator = cardInfo.card_number;  // Numerator only: "251", "SWSH039", "085"
            const setTotal = cardInfo.set_total;  // Denominator: "264", "TG30", etc.
            const cardFormat = cardInfo.card_number_format;  // "fraction", "swsh_promo", "sv_promo", etc.
            const setCode = cardInfo.set_code;  // 3-letter code: "SVI", "PAL", "FST"

            // Construct the best card number string for lookup:
            // 1. Use card_number_raw if available (contains full printed number)
            // 2. Otherwise construct from numerator + set_total for fractions
            // 3. Fall back to just the numerator
            let cardNumber: string;
            if (cardNumberRaw) {
              cardNumber = cardNumberRaw;
            } else if (cardNumberNumerator && setTotal && cardFormat === 'fraction') {
              cardNumber = `${cardNumberNumerator}/${setTotal}`;
            } else {
              cardNumber = cardNumberNumerator;
            }

            const pokemonName = cardInfo.player_or_character;
            const year = cardInfo.year;

            console.log(`[GET /api/pokemon/${cardId}] 📊 Card number data:`, {
              card_number_raw: cardNumberRaw || 'null',
              card_number: cardNumberNumerator || 'null',
              set_total: setTotal || 'null',
              card_number_format: cardFormat || 'null',
              set_code: setCode || 'null',
              constructed_lookup: cardNumber || 'null'
            });

            if (cardNumber) {
              const apiResult = await lookupSetByCardNumber(
                cardNumber,
                pokemonName,
                year,
                { setCode, cardFormat }  // 🆕 Pass additional context for smarter lookups
              );

              if (apiResult.success) {
                console.log(`[GET /api/pokemon/${cardId}] ✅ API lookup successful:`, apiResult.set_name);

                // Merge API results back into card_info
                conversationalGradingData.card_info.set_name = apiResult.set_name;
                conversationalGradingData.card_info.set_id = apiResult.set_id;
                conversationalGradingData.card_info.set_year = apiResult.set_year;
                conversationalGradingData.card_info.set_era = apiResult.set_era;
                conversationalGradingData.card_info.set_confidence = apiResult.set_confidence;
                conversationalGradingData.card_info.set_identifier_source = apiResult.set_identifier_source;
                conversationalGradingData.card_info.set_identifier_reason = apiResult.set_identifier_reason;
                conversationalGradingData.card_info.needs_api_lookup = false; // Resolved
              } else {
                console.warn(`[GET /api/pokemon/${cardId}] ⚠️ API lookup failed:`, apiResult.error);
                // Keep original AI values and log reason
                if (conversationalGradingData.card_info.set_identifier_reason) {
                  conversationalGradingData.card_info.set_identifier_reason = apiResult.set_identifier_reason;
                }
              }
            } else {
              console.warn(`[GET /api/pokemon/${cardId}] ⚠️ Cannot lookup set: card_number not extracted`);
            }
          } catch (error: any) {
            console.error(`[GET /api/pokemon/${cardId}] ⚠️ Set lookup error:`, error.message);
            // Continue with AI's original values if API fails
          }
        } else if (cardInfo?.set_name) {
          console.log(`[GET /api/pokemon/${cardId}] ✅ AI identified set from mini table: ${cardInfo.set_name}`);
        } else {
          console.warn(`[GET /api/pokemon/${cardId}] ⚠️ No set information available and no card_number to lookup`);
        }

      } catch (error) {
        console.error(`[GET /api/pokemon/${cardId}] ⚠️ Failed to parse conversational JSON:`, error);
      }
    }

    // Extract Pokemon card grade information
    const { rawGrade, wholeGrade, confidence } = extractPokemonGradeInfo(gradingResult);

    // Extract key fields for database columns (Pokemon-specific)
    const cardFieldsLegacy = extractPokemonCardFields(gradingResult);

    // Extract Pokemon-specific fields from conversational v4.2 JSON
    // Helper to parse HP value - handles ranges like "300-360" by taking first number
    const parseHpValue = (hp: any): number | null => {
      if (hp === null || hp === undefined) return null;
      if (typeof hp === 'number') return hp;
      if (typeof hp === 'string') {
        // Extract first number from string (handles "300-360", "300+", "300 HP", etc.)
        const match = hp.match(/(\d+)/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          return isNaN(parsed) ? null : parsed;
        }
      }
      return null;
    };

    const cardFieldsConversational = conversationalGradingData?.card_info
      ? {
          card_name: conversationalGradingData.card_info.card_name || null,
          card_set: conversationalGradingData.card_info.set_name || null,
          card_number: conversationalGradingData.card_info.card_number || null,
          release_date: conversationalGradingData.card_info.year || null,
          manufacturer_name: conversationalGradingData.card_info.manufacturer || null,
          serial_numbering: conversationalGradingData.card_info.serial_number || null,
          authentic: conversationalGradingData.card_info.authentic !== undefined ? conversationalGradingData.card_info.authentic : null,
          pokemon_type: conversationalGradingData.card_info.pokemon_type || null,
          pokemon_stage: conversationalGradingData.card_info.pokemon_stage || null,
          hp: parseHpValue(conversationalGradingData.card_info.hp),
          card_type: conversationalGradingData.card_info.card_type || null,
          rarity_description: conversationalGradingData.card_info.rarity_or_variant || null,
          autographed: conversationalGradingData.card_info.autographed !== undefined ? conversationalGradingData.card_info.autographed : null,
          pokemon_featured: conversationalGradingData.card_info.player_or_character || null
        }
      : {};

    // Merge fields: conversational v4.2 takes priority over legacy
    const cardFields = {
      ...cardFieldsLegacy,
      ...cardFieldsConversational
    };


    // Update database with comprehensive Pokemon card data
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

      // Individual searchable/sortable columns (Pokemon-specific - merged from both sources)
      ...cardFields,

      // Processing metadata
      processing_time: Date.now() - startTime
    };

    // Generate standardized label data for consistent display across all contexts
    const cardForLabel: CardForLabel = {
      id: cardId,
      category: 'Pokemon',
      serial: card.serial,
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_card_info: conversationalGradingData?.card_info || null,
      card_name: cardFields.card_name || card.card_name,
      card_set: cardFields.card_set || card.card_set,
      card_number: cardFields.card_number || card.card_number,
      featured: cardFields.pokemon_featured || card.featured,
      pokemon_featured: cardFields.pokemon_featured || card.pokemon_featured,
      release_date: cardFields.release_date || card.release_date,
      serial_numbering: conversationalGradingData?.card_info?.serial_number || card.serial_numbering,
      first_print_rookie: conversationalGradingData?.card_info?.rookie_or_first === true ? 'true' : card.first_print_rookie,
      holofoil: cardFields.holofoil || card.holofoil,
    };
    const labelData = generateLabelData(cardForLabel);
    (updateData as any).label_data = labelData;

    console.log(`[GET /api/pokemon/${cardId}] Generated label data:`, {
      primaryName: labelData.primaryName,
      contextLine: labelData.contextLine,
      featuresLine: labelData.featuresLine,
      grade: labelData.gradeFormatted
    });

    // 🔒 FINAL SAFETY CHECK: Enforce OCR override values before save
    // This catches any code paths that may have overwritten our OCR-derived values
    const ocrOverride = conversationalGradingData?.card_info?._ocr_override;
    if (ocrOverride?.denominator_lookup_used && ocrOverride?.final_set_name) {
      console.log(`[GET /api/pokemon/${cardId}] 🔒 FINAL OCR ENFORCEMENT: Applying OCR-derived values`);
      console.log(`  - OCR reconstructed: "${ocrOverride.ocr_reconstructed}"`);
      console.log(`  - card_set: "${cardFields.card_set}" → "${ocrOverride.final_set_name}"`);
      console.log(`  - release_date: "${cardFields.release_date}" → "${ocrOverride.final_year}"`);

      // Override card fields with OCR-derived values
      cardFields.card_set = ocrOverride.final_set_name;
      cardFields.release_date = ocrOverride.final_year;

      // Also update the card_info object for consistency
      if (conversationalGradingData?.card_info) {
        conversationalGradingData.card_info.set_name = ocrOverride.final_set_name;
        conversationalGradingData.card_info.year = ocrOverride.final_year;
        conversationalGradingData.card_info.card_number_raw = ocrOverride.ocr_reconstructed;
      }

      // Update updateData directly
      updateData.card_set = ocrOverride.final_set_name;
      (updateData as any).release_date = ocrOverride.final_year;
      updateData.conversational_card_info = conversationalGradingData?.card_info || null;
    }

    console.log(`[GET /api/pokemon/${cardId}] Updating database with extracted Pokemon fields:`, {
      card_name: cardFields.card_name,
      card_set: cardFields.card_set,
      pokemon_type: cardFields.pokemon_type,
      pokemon_stage: cardFields.pokemon_stage,
      grade: wholeGrade,
      ocr_corrected: !!ocrOverride?.denominator_lookup_used
    });

    const { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    if (updateError) {
      console.error(`[GET /api/pokemon/${cardId}] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to save Pokemon card grading results" }, { status: 500 });
    }

    // 🎴 Pokemon TCG API Verification (Post-Grading) - NON-BLOCKING
    // Fire-and-forget: Don't wait for Pokemon TCG API, it can timeout
    // The TCGPlayer URL will be available on next page load from cache
    try {
      console.log(`[GET /api/pokemon/${cardId}] 🔍 Starting Pokemon TCG API verification (non-blocking)...`);

      // Fire-and-forget: Call verify endpoint in the background
      // We don't await this - the response returns immediately while verification runs
      fetch(`${request.nextUrl.origin}/api/pokemon/verify?force=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: cardId,
          card_info: conversationalGradingData?.card_info || null
        })
      }).then(async (verifyResponse) => {
        if (verifyResponse.ok) {
          const pokemonApiVerification = await verifyResponse.json();
          console.log(`[GET /api/pokemon/${cardId}] ✅ Background Pokemon TCG API verification complete:`, {
            verified: pokemonApiVerification.verified,
            pokemon_api_id: pokemonApiVerification.pokemon_api_id,
            confidence: pokemonApiVerification.confidence
          });
        } else {
          console.warn(`[GET /api/pokemon/${cardId}] ⚠️ Background Pokemon TCG API verification failed`);
        }
      }).catch((verifyError: any) => {
        console.error(`[GET /api/pokemon/${cardId}] ⚠️ Background Pokemon TCG API verification error:`, verifyError.message);
      });
    } catch (verifyError: any) {
      // Non-fatal error - card grading succeeded, just verification scheduling failed
      console.error(`[GET /api/pokemon/${cardId}] ⚠️ Failed to start background verification:`, verifyError.message);
    }

    console.log(`[GET /api/pokemon/${cardId}] Pokemon card request completed in ${Date.now() - startTime}ms`);

    // Return updated Pokemon card data with all structured fields
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
      // ⭐ Card owner's founder status (for founder emblem on public card labels)
      owner_is_founder: ownerIsFounder,
      owner_show_founder_badge: ownerShowFounderBadge
    });

  } catch (error: any) {
    console.error(`[GET /api/pokemon/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to process Pokemon card: " + error.message },
      { status: 500 }
    );
  } finally {
    processingPokemonCards.delete(cardId);
    console.log(`[GET /api/pokemon/${cardId}] Removed from processing set`);
  }
}

// PATCH handler for updating Pokemon card data (e.g., clearing cached grading)
export async function PATCH(request: NextRequest, { params }: PokemonCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[PATCH /api/pokemon/${cardId}] Starting Pokemon card update request`);

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

    console.log(`[PATCH /api/pokemon/${cardId}] Update data:`, body);

    // Update the Pokemon card
    const { data, error } = await supabase
      .from("cards")
      .update(body)
      .eq("id", cardId)
      .select()
      .single();

    if (error) {
      console.error(`[PATCH /api/pokemon/${cardId}] Update failed:`, error);
      return NextResponse.json({ error: "Failed to update Pokemon card" }, { status: 500 });
    }

    console.log(`[PATCH /api/pokemon/${cardId}] Pokemon card updated successfully`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[PATCH /api/pokemon/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to update Pokemon card: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE handler for removing Pokemon cards
export async function DELETE(request: NextRequest, { params }: PokemonCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[DELETE /api/pokemon/${cardId}] Starting Pokemon card deletion request`);

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Get the Pokemon card and verify ownership
    const { data: card, error: fetchError } = await supabase
      .from("cards")
      .select("front_path, back_path, user_id")
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      console.error(`[DELETE /api/pokemon/${cardId}] Pokemon card not found:`, fetchError);
      return NextResponse.json({ error: "Pokemon card not found" }, { status: 404 });
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

    // Delete Pokemon card record
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error(`[DELETE /api/pokemon/${cardId}] Deletion failed:`, deleteError);
      return NextResponse.json({ error: "Failed to delete Pokemon card" }, { status: 500 });
    }

    console.log(`[DELETE /api/pokemon/${cardId}] Pokemon card deleted successfully`);
    return NextResponse.json({ success: true, message: "Pokemon card deleted successfully" });

  } catch (error: any) {
    console.error(`[DELETE /api/pokemon/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to delete Pokemon card: " + error.message },
      { status: 500 }
    );
  }
}