import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  gradeCardWithVision,
  extractGradeMetrics,
  performDetailedInspection,
  estimateProfessionalGrades,
  estimateProfessionalGradesWithDeterministicMapper,
  gradeCardConversational, // 🎯 PRIMARY grading system
  type VisionGradeResult,
  type DetailedInspectionResult
} from "@/lib/visionGrader";
import {
  analyzeOpenCVReliability,
  generateOpenCVSummaryForLLM,
  type OpenCVMetrics
} from "@/lib/opencvAnalyzer";
import {
  parseConversationalV3_5,
  type ConversationalGradingV3_5
} from "@/lib/conversationalParserV3_5";
// Legacy parser for old cached cards (v3.2 and earlier) - DEPRECATED
import {
  parseConversationalGradingV3
} from "@/lib/deprecated/conversationalParserV3";
import {
  parseConversationalDefects,
  parseCenteringMeasurements,
  parseGradingMetadata
} from "@/lib/conversationalDefectParser";

// Track cards currently being processed
const processingCards = new Map<string, number>();
const MAX_CONCURRENT_PROCESSING = 3;

// Signed URL cache
const signedUrlCache = new Map<string, { url: string; expires: number }>();

// Clean up stuck processing cards (older than 5 minutes) and expired URLs
const cleanupStuckCards = () => {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);

  for (const [cardId, timestamp] of processingCards.entries()) {
    if (timestamp < fiveMinutesAgo) {
      console.log(`[GRADING API CLEANUP] Removing stuck card ${cardId} from processing set`);
      processingCards.delete(cardId);
    }
  }

  const fiftyMinutesAgo = now - (50 * 60 * 1000);
  for (const [path, cachedData] of signedUrlCache.entries()) {
    if (cachedData.expires < fiftyMinutesAgo) {
      console.log(`[GRADING API CLEANUP] Removing expired signed URL cache for ${path}`);
      signedUrlCache.delete(path);
    }
  }
};

// Cached signed URL generation
async function createSignedUrl(supabase: any, bucket: string, path: string): Promise<string | null> {
  try {
    const now = Date.now();
    const cached = signedUrlCache.get(path);

    if (cached && cached.expires > now) {
      console.log(`[CACHE] Using cached signed URL for ${path}`);
      return cached.url;
    }

    console.log(`[CACHE] Creating new signed URL for ${path}`);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (error) {
      console.error(`[GRADING API] Failed to create signed URL for ${path}:`, error);
      return null;
    }

    signedUrlCache.set(path, {
      url: data.signedUrl,
      expires: now + (50 * 60 * 1000)
    });

    return data.signedUrl;
  } catch (error) {
    console.error(`[GRADING API] Error creating signed URL for ${path}:`, error);
    return null;
  }
}


// Types
type VisionGradeRequest = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/vision-grade/[id]
 *
 * Direct Vision Grader v1 - Single GPT-4o vision API call for card grading
 * Replaces complex 3-stage pipeline with simplified approach
 */
export async function GET(request: NextRequest, { params }: VisionGradeRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  // Check for force_regrade query parameter
  const { searchParams } = new URL(request.url);
  const forceRegrade = searchParams.get('force_regrade') === 'true';

  console.log(`[GRADING API] Starting vision grading for card ${cardId} (force_regrade: ${forceRegrade})`);

  // Clean up stuck cards first
  cleanupStuckCards();

  // Check if already processing
  if (processingCards.has(cardId)) {
    const processingStartTime = processingCards.get(cardId)!;
    const processingDuration = Date.now() - processingStartTime;

    if (processingDuration > 120000) {
      console.log(`[GRADING API] Processing stuck for ${processingDuration}ms, allowing retry`);
      processingCards.delete(cardId);
    } else {
      console.log(`[GRADING API] Card already being processed for ${processingDuration}ms, returning 429`);
      return NextResponse.json(
        {
          error: "Card is being processed. Please wait and refresh.",
          processing_duration: processingDuration,
          estimated_time_remaining: Math.max(0, 120000 - processingDuration)
        },
        { status: 429 }
      );
    }
  }

  // Check global rate limit
  if (processingCards.size >= MAX_CONCURRENT_PROCESSING) {
    console.log(`[GRADING API] Global rate limit exceeded (${processingCards.size}/${MAX_CONCURRENT_PROCESSING})`);
    return NextResponse.json(
      {
        error: `System is currently processing ${processingCards.size} cards. Please wait and try again.`,
        concurrent_processing_count: processingCards.size,
        max_concurrent: MAX_CONCURRENT_PROCESSING
      },
      { status: 429 }
    );
  }

  try {
    processingCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.error(`[GRADING API] Card lookup error:`, cardError);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    console.log(`[GRADING API] Card found: ${card.card_name || 'Unknown'}`);

    // Check if card already has DVG grading (either numeric or N/A grade)
    // Skip cache if force_regrade is true
    if (!forceRegrade && card.dvg_grading && (card.dvg_decimal_grade !== undefined || card.dvg_grade_uncertainty === 'N/A')) {
      console.log(`[CONVERSATIONAL AI] Card already graded with DVG v2, returning existing result`);
      console.log(`[CONVERSATIONAL AI] 🧪 Conversational grading in cached card:`, card.conversational_grading ? `${card.conversational_grading.substring(0, 100)}...` : 'NULL');

      const frontUrl = await createSignedUrl(supabase, "cards", card.front_path);
      const backUrl = await createSignedUrl(supabase, "cards", card.back_path);

      if (!frontUrl || !backUrl) {
        console.error(`[CONVERSATIONAL AI] Failed to create signed URLs`);
        return NextResponse.json({ error: "Failed to access card images" }, { status: 500 });
      }

      // Parse conversational grading data from cached response (JSON v4.0 or markdown v3.8)
      let parsedConversationalData = null;
      if (card.conversational_grading) {
        try {
          // 🔄 v4.0: Check if this is JSON format first
          if (card.conversational_grading.trim().startsWith('{')) {
            console.log('[CONVERSATIONAL AI CACHE] 🆕 Detected JSON format (v4.0)');
            const jsonData = JSON.parse(card.conversational_grading);

            // Map JSON to parsedConversationalData structure
            parsedConversationalData = {
              decimal_grade: jsonData.final_grade?.decimal_grade ?? null,
              whole_grade: jsonData.final_grade?.whole_grade ?? null,
              grade_range: jsonData.image_quality?.grade_uncertainty || jsonData.final_grade?.grade_range || '±0.5',  // 🔧 FIX: Prioritize ± format over range
              condition_label: jsonData.final_grade?.condition_label || null,
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
              centering: {
                front_lr: jsonData.centering?.front?.left_right || 'N/A',
                front_tb: jsonData.centering?.front?.top_bottom || 'N/A',
                back_lr: jsonData.centering?.back?.left_right || 'N/A',
                back_tb: jsonData.centering?.back?.top_bottom || 'N/A'
              },
              professional_slab: jsonData.slab_detection?.detected ? {  // 🔧 FIX: Master rubric outputs slab_detection, not professional_slab
                detected: true,
                company: jsonData.slab_detection.company || null,
                grade: jsonData.slab_detection.grade || null,
                grade_description: jsonData.slab_detection.grade_description || null,
                cert_number: jsonData.slab_detection.cert_number || null,
                sub_grades: jsonData.slab_detection.sub_grades || null
              } : null,
              card_info: jsonData.card_info || null,
              case_detection: jsonData.case_detection || null,
              meta: {
                version: 'conversational-v4.0-json',
                prompt_version: jsonData.metadata?.prompt_version || 'Conversational_Grading_v4.0_JSON'
              }
            };
            console.log('[CONVERSATIONAL AI CACHE] ✅ Parsed JSON format successfully');
          } else {
            // v3.8 or earlier: Try markdown parsers
            console.log('[CONVERSATIONAL AI CACHE] Detected markdown format (v3.8 or earlier)');
            const { parseConversationalV3_5 } = await import('@/lib/conversationalParserV3_5');
            parsedConversationalData = parseConversationalV3_5(card.conversational_grading);
          }
        } catch (err) {
          // Fallback to v3 parser for old cards (pre-v3.5) - DEPRECATED
          try {
            console.warn('[CONVERSATIONAL AI] v3.5 parse failed, trying v3 fallback:', err);
            const { parseConversationalGradingV3 } = await import('@/lib/deprecated/conversationalParserV3');
            parsedConversationalData = parseConversationalGradingV3(card.conversational_grading);
          } catch (fallbackErr) {
            console.warn('[CONVERSATIONAL AI] Failed to parse cached conversational grading:', fallbackErr);
          }
        }
      }

      return NextResponse.json({
        ...card,
        front_url: frontUrl,
        back_url: backUrl,
        processing_time: 0,
        grading_system: 'dvg-v2',
        // Include professional grades if they exist in the cached data
        estimated_professional_grades: card.estimated_professional_grades || null,
        // 🎯 PRIMARY: Conversational AI grading v3.2 (all fields)
        conversational_grading: card.conversational_grading || null,
        conversational_decimal_grade: card.conversational_decimal_grade || null,
        conversational_whole_grade: card.conversational_whole_grade || null,
        conversational_grade_uncertainty: card.conversational_grade_uncertainty || null,
        conversational_sub_scores: card.conversational_sub_scores || null,
        conversational_weighted_summary: card.conversational_weighted_summary || null,
        conversational_centering_ratios: parsedConversationalData?.centering_ratios || null,
        // v3.2 NEW fields
        conversational_condition_label: card.conversational_condition_label || parsedConversationalData?.condition_label || null,
        conversational_image_confidence: card.conversational_image_confidence || parsedConversationalData?.image_confidence || null,
        conversational_case_detection: card.conversational_case_detection || parsedConversationalData?.case_detection || null,
        conversational_validation_checklist: card.conversational_validation_checklist || parsedConversationalData?.validation_checklist || null,
        conversational_front_summary: card.conversational_front_summary || parsedConversationalData?.front_summary || null,
        conversational_back_summary: card.conversational_back_summary || parsedConversationalData?.back_summary || null,
        conversational_card_info: card.conversational_card_info || parsedConversationalData?.card_info || null,  // 🔧 FIX: Check database first
        conversational_corners_edges_surface: card.conversational_corners_edges_surface || null,  // 🆕 JSON details for corners/edges/surface
        conversational_meta: parsedConversationalData?.meta || null
      });
    }

    // Create signed URLs for card images
    console.log(`[GRADING API] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const frontUrl = await createSignedUrl(supabase, "cards", card.front_path);
    const backUrl = await createSignedUrl(supabase, "cards", card.back_path);

    if (!frontUrl || !backUrl) {
      console.error(`[GRADING API] Failed to create signed URLs`);
      return NextResponse.json({ error: "Failed to access card images" }, { status: 500 });
    }

    console.log(`[GRADING API] Signed URLs created successfully`);

    // DISABLED 2025-10-19: OpenCV boundary detection unreliable
    // OpenCV was causing more problems than it solved:
    // - False slab detection on raw cards
    // - Wrong boundary detection (97% = full frame, 44% = too small)
    // - Inaccurate centering measurements (25.3/74.7 on good cards)
    // - Edge/corner/surface measurements invalid when boundaries wrong
    // Decision: Use GPT-4o Vision only - it can assess everything visually and reliably
    /*
    console.log(`[OpenCV Stage 0] Starting OpenCV analysis...`);
    let opencvMetrics: any = null;

    try {
      const opencvResponse = await fetch(`${request.nextUrl.origin}/api/opencv-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontUrl,
          backUrl
        })
      });

      if (opencvResponse.ok) {
        opencvMetrics = await opencvResponse.json();
        console.log(`[OpenCV Stage 0] Analysis complete`);
        console.log(`[OpenCV Stage 0] Centering (front L/R):`, opencvMetrics.front?.centering?.lr_ratio);
        console.log(`[OpenCV Stage 0] Edge defects detected:`,
          opencvMetrics.front?.edge_segments ?
          Object.values(opencvMetrics.front.edge_segments).flat().reduce((sum: number, seg: any) => sum + seg.whitening_count, 0) :
          'N/A');
      } else {
        console.warn(`[OpenCV Stage 0] Analysis failed (${opencvResponse.status}), continuing with LLM-only grading`);
        const errorData = await opencvResponse.json();
        console.warn(`[OpenCV Stage 0] Error:`, errorData);
      }
    } catch (opencvError: any) {
      console.warn(`[OpenCV Stage 0] Analysis failed, continuing with LLM-only grading:`, opencvError.message);
      // Continue without OpenCV metrics - LLM will still grade the card
    }

    // Analyze OpenCV reliability and generate LLM-friendly summary
    const opencvReliability = analyzeOpenCVReliability(opencvMetrics);
    console.log(`[OpenCV Reliability] ${opencvReliability.reason}`);
    console.log(`[OpenCV Reliability] Confidence: ${opencvReliability.confidence}`);
    console.log(`[OpenCV Reliability] Use centering: ${opencvReliability.use_opencv_centering}, Use edges: ${opencvReliability.use_opencv_edges}`);

    if (opencvReliability.grade_cap) {
      console.log(`[OpenCV Grade Cap] Maximum ${opencvReliability.grade_cap} - ${opencvReliability.grade_cap_reason}`);
    }

    const opencvSummary = generateOpenCVSummaryForLLM(opencvMetrics, opencvReliability);
    */

    // ⏸️ TEMPORARILY DISABLED (2025-10-21): DVG v2 grading disabled for testing
    // Testing conversational AI grading as primary system
    // Will re-enable after conversational AI is fully implemented
    console.log(`[CONVERSATIONAL AI] ⏸️ DVG v2 grading DISABLED - using conversational AI only`);

    // Create stub visionResult to maintain code flow
    const visionResult: VisionGradeResult = {
      recommended_grade: {
        recommended_decimal_grade: null,
        recommended_whole_grade: null,
        grade_uncertainty: "N/A",
        grading_notes: "DVG v2 disabled - conversational AI only"
      },
      card_info: {
        card_name: card.card_name || "Unknown",
        player_or_character: card.featured || "Unknown",
        manufacturer: card.manufacturer || "Unknown",
        year: card.release_date || "Unknown",
        set_name: card.card_set || "Unknown",
        subset: "",
        card_number: card.card_number || "",
        sport_or_category: card.card_type || "sports",
        serial_number: "",
        rookie_or_first: "unknown",
        rarity_or_variant: "",
        authentic: true
      },
      centering: {
        front_left_right_ratio_text: "N/A",
        front_top_bottom_ratio_text: "N/A",
        back_left_right_ratio_text: "N/A",
        back_top_bottom_ratio_text: "N/A",
        method_front: "disabled",
        method_back: "disabled"
      },
      defects: { total_count: 0, defect_list: [] },
      sub_scores: {
        centering: { front_score: 0, back_score: 0, weighted_score: 0 },
        corners: { front_score: 0, back_score: 0, weighted_score: 0 },
        edges: { front_score: 0, back_score: 0, weighted_score: 0 },
        surface: { front_score: 0, back_score: 0, weighted_score: 0 }
      },
      image_quality: { grade: "N/A", reasoning: "DVG v2 disabled" },
      analysis_summary: { positives: [], negatives: [], key_factors: [] },
      autograph: { present: false },
      slab_detection: { slab_detected: false },
      rarity_features: {},
      card_text_blocks: [],
      grading_status: "DVG v2 disabled - conversational AI only",
      meta: { model_name: "disabled", version: "disabled", timestamp: new Date().toISOString() }
    } as VisionGradeResult;

    console.log(`[CONVERSATIONAL AI] Stub visionResult created, skipping DVG v2 grading`);

    // SAFETY NET v6.0: Enforce whole number grades (no decimals)
    // Round any non-integer grades DOWN to whole number
    if (visionResult.recommended_grade.recommended_decimal_grade !== null) {
      const rawGrade = visionResult.recommended_grade.recommended_decimal_grade;
      const roundedGrade = Math.floor(rawGrade); // v6.0: Always round DOWN

      if (rawGrade !== roundedGrade) {
        console.log(`[GRADE ENFORCEMENT v6.0] AI returned non-integer grade ${rawGrade}, rounding down to ${roundedGrade}`);
        visionResult.recommended_grade.recommended_decimal_grade = roundedGrade;
        // Also update whole grade to match
        visionResult.recommended_grade.recommended_whole_grade = roundedGrade;
      }
    }

    // Extract key metrics
    const metrics = extractGradeMetrics(visionResult);

    // 🎯 PRIMARY GRADING SYSTEM: Conversational AI v3.5 PATCHED v2 (2025-10-24)
    // Conversational AI calculates independent grade with 10 critical patches
    let conversationalGradingResult: string | null = null;
    let conversationalGradingData: ConversationalGradingDataV3 | null = null;
    let conversationalResultV3_3: any = null; // Store full result for enhanced data
    let isJSONMode = false; // 🆕 v4.0: Track if we're using JSON format

    if (frontUrl && backUrl) {
      try {
        console.log(`[CONVERSATIONAL AI v3.5 PATCHED v2] 🎯 Starting PRIMARY grading with 10 critical patches...`);
        const conversationalResult = await gradeCardConversational(frontUrl, backUrl);
        conversationalGradingResult = conversationalResult.markdown_report;

        // 🆕 v3.3: Store full result for enhanced data extraction
        conversationalResultV3_3 = conversationalResult;

        // 🆕 v4.0: Detect if we're using JSON format (check metadata)
        isJSONMode = conversationalResult.meta?.version === 'conversational-v4.0-json';
        console.log(`[CONVERSATIONAL AI] Output format detected: ${isJSONMode ? 'JSON (v4.0)' : 'Markdown (v3.8)'}`);

        let parsedJSONData = null;
        if (isJSONMode) {
          // Parse JSON response directly
          try {
            parsedJSONData = JSON.parse(conversationalGradingResult);
            console.log(`[CONVERSATIONAL AI JSON] ✅ Successfully parsed JSON response`);
          } catch (jsonParseError) {
            console.error(`[CONVERSATIONAL AI JSON] ⚠️ Failed to parse JSON, falling back to markdown parsing:`, jsonParseError);
            // Fall back to markdown parsing if JSON parse fails
          }
        }

        // Build conversationalGradingData from JSON or markdown parsing
        if (parsedJSONData) {
          // 🆕 v4.0 JSON MODE - Extract data directly from JSON
          console.log(`[CONVERSATIONAL AI JSON] 📦 Extracting data from JSON structure...`);

          conversationalGradingData = {
            decimal_grade: parsedJSONData.final_grade?.decimal_grade ?? null,
            whole_grade: parsedJSONData.final_grade?.whole_grade ?? null,
            grade_uncertainty: parsedJSONData.final_grade?.grade_range || '±0.5',
            condition_label: parsedJSONData.final_grade?.condition_label || null,
            final_grade_summary: parsedJSONData.final_grade?.summary || null,
            image_confidence: parsedJSONData.image_quality?.confidence_letter || null,
            sub_scores: {
              centering: {
                front: parsedJSONData.raw_sub_scores?.centering_front || 0,
                back: parsedJSONData.raw_sub_scores?.centering_back || 0,
                weighted: parsedJSONData.weighted_scores?.centering_weighted || 0
              },
              corners: {
                front: parsedJSONData.raw_sub_scores?.corners_front || 0,
                back: parsedJSONData.raw_sub_scores?.corners_back || 0,
                weighted: parsedJSONData.weighted_scores?.corners_weighted || 0
              },
              edges: {
                front: parsedJSONData.raw_sub_scores?.edges_front || 0,
                back: parsedJSONData.raw_sub_scores?.edges_back || 0,
                weighted: parsedJSONData.weighted_scores?.edges_weighted || 0
              },
              surface: {
                front: parsedJSONData.raw_sub_scores?.surface_front || 0,
                back: parsedJSONData.raw_sub_scores?.surface_back || 0,
                weighted: parsedJSONData.weighted_scores?.surface_weighted || 0
              }
            },
            centering_ratios: {
              front_lr: parsedJSONData.centering?.front?.left_right || 'N/A',
              front_tb: parsedJSONData.centering?.front?.top_bottom || 'N/A',
              back_lr: parsedJSONData.centering?.back?.left_right || 'N/A',
              back_tb: parsedJSONData.centering?.back?.top_bottom || 'N/A'
            },
            // Extract quality tiers (v5.0+)
            centering_front_quality_tier: parsedJSONData.centering?.front?.quality_tier,
            centering_back_quality_tier: parsedJSONData.centering?.back?.quality_tier,
            slab_detection: parsedJSONData.professional_slab?.detected ? {
              detected: true,
              company: parsedJSONData.professional_slab.company || null,
              grade: parsedJSONData.professional_slab.grade || null,
              grade_description: parsedJSONData.professional_slab.grade_description || null,
              cert_number: parsedJSONData.professional_slab.cert_number || null,
              serial_number: null,
              subgrades: parsedJSONData.professional_slab.sub_grades ? {
                raw: parsedJSONData.professional_slab.sub_grades
              } : null
            } : null,
            card_info: parsedJSONData.card_info || null,
            case_detection: parsedJSONData.case_detection || null,
            weighted_sub_scores: {
              centering: parsedJSONData.weighted_scores?.centering_weighted || null,
              corners: parsedJSONData.weighted_scores?.corners_weighted || null,
              edges: parsedJSONData.weighted_scores?.edges_weighted || null,
              surface: parsedJSONData.weighted_scores?.surface_weighted || null
            },
            limiting_factor: parsedJSONData.weighted_scores?.limiting_factor || null,
            preliminary_grade: parsedJSONData.weighted_scores?.preliminary_grade || null,
            // 🆕 Extract professional grade estimates from JSON (if provided by AI)
            professional_grade_estimates: parsedJSONData.professional_grade_estimates || null,
            // 🔄 Transform nested JSON structure to flat format for frontend compatibility
            transformedDefects: (parsedJSONData.corners || parsedJSONData.edges || parsedJSONData.surface) ? {
              front: {
                corners: {
                  condition: `TL: ${parsedJSONData.corners?.front?.top_left?.condition || 'N/A'}, TR: ${parsedJSONData.corners?.front?.top_right?.condition || 'N/A'}, BL: ${parsedJSONData.corners?.front?.bottom_left?.condition || 'N/A'}, BR: ${parsedJSONData.corners?.front?.bottom_right?.condition || 'N/A'}`,
                  defects: [
                    ...(parsedJSONData.corners?.front?.top_left?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'top_left corner'
                    })),
                    ...(parsedJSONData.corners?.front?.top_right?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'top_right corner'
                    })),
                    ...(parsedJSONData.corners?.front?.bottom_left?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'bottom_left corner'
                    })),
                    ...(parsedJSONData.corners?.front?.bottom_right?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'bottom_right corner'
                    }))
                  ]
                },
                edges: {
                  condition: `Top: ${parsedJSONData.edges?.front?.top?.condition || 'N/A'}, Bottom: ${parsedJSONData.edges?.front?.bottom?.condition || 'N/A'}, Left: ${parsedJSONData.edges?.front?.left?.condition || 'N/A'}, Right: ${parsedJSONData.edges?.front?.right?.condition || 'N/A'}`,
                  defects: [
                    // Transform edge defect strings to objects with severity
                    ...(parsedJSONData.edges?.front?.top?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'top edge'
                    })),
                    ...(parsedJSONData.edges?.front?.bottom?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'bottom edge'
                    })),
                    ...(parsedJSONData.edges?.front?.left?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'left edge'
                    })),
                    ...(parsedJSONData.edges?.front?.right?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'right edge'
                    }))
                  ]
                },
                surface: {
                  condition: parsedJSONData.surface?.front?.analysis || 'No data',
                  defects: (parsedJSONData.surface?.front?.defects || []).map((d: any) => ({
                    description: d.description || d.type || 'Unknown defect',
                    severity: d.severity || 'minor',
                    location: d.location || 'unknown',
                    type: d.type
                  }))
                }
              },
              back: {
                corners: {
                  condition: `TL: ${parsedJSONData.corners?.back?.top_left?.condition || 'N/A'}, TR: ${parsedJSONData.corners?.back?.top_right?.condition || 'N/A'}, BL: ${parsedJSONData.corners?.back?.bottom_left?.condition || 'N/A'}, BR: ${parsedJSONData.corners?.back?.bottom_right?.condition || 'N/A'}`,
                  defects: [
                    ...(parsedJSONData.corners?.back?.top_left?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'top_left corner'
                    })),
                    ...(parsedJSONData.corners?.back?.top_right?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'top_right corner'
                    })),
                    ...(parsedJSONData.corners?.back?.bottom_left?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'bottom_left corner'
                    })),
                    ...(parsedJSONData.corners?.back?.bottom_right?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'bottom_right corner'
                    }))
                  ]
                },
                edges: {
                  condition: `Top: ${parsedJSONData.edges?.back?.top?.condition || 'N/A'}, Bottom: ${parsedJSONData.edges?.back?.bottom?.condition || 'N/A'}, Left: ${parsedJSONData.edges?.back?.left?.condition || 'N/A'}, Right: ${parsedJSONData.edges?.back?.right?.condition || 'N/A'}`,
                  defects: [
                    // Transform edge defect strings to objects with severity
                    ...(parsedJSONData.edges?.back?.top?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'top edge'
                    })),
                    ...(parsedJSONData.edges?.back?.bottom?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'bottom edge'
                    })),
                    ...(parsedJSONData.edges?.back?.left?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'left edge'
                    })),
                    ...(parsedJSONData.edges?.back?.right?.defects || []).map((d: string) => ({
                      description: d,
                      severity: 'minor',
                      location: 'right edge'
                    }))
                  ]
                },
                surface: {
                  condition: parsedJSONData.surface?.back?.analysis || 'No data',
                  defects: (parsedJSONData.surface?.back?.defects || []).map((d: any) => ({
                    description: d.description || d.type || 'Unknown defect',
                    severity: d.severity || 'minor',
                    location: d.location || 'unknown',
                    type: d.type
                  }))
                }
              }
            } : null,
            // 🔄 Raw defects structure for ebayConditionMapper compatibility
            rawDefectsForEbay: parsedJSONData.corners ? {
              front: {
                corners: {
                  top_left: { severity: 'none', description: parsedJSONData.corners?.front?.top_left?.condition || 'Mint' },
                  top_right: { severity: 'none', description: parsedJSONData.corners?.front?.top_right?.condition || 'Mint' },
                  bottom_left: { severity: 'none', description: parsedJSONData.corners?.front?.bottom_left?.condition || 'Mint' },
                  bottom_right: { severity: 'none', description: parsedJSONData.corners?.front?.bottom_right?.condition || 'Mint' }
                },
                edges: {
                  top: { severity: 'none', description: parsedJSONData.edges?.front?.top?.condition || 'Clean' },
                  bottom: { severity: 'none', description: parsedJSONData.edges?.front?.bottom?.condition || 'Clean' },
                  left: { severity: 'none', description: parsedJSONData.edges?.front?.left?.condition || 'Clean' },
                  right: { severity: 'none', description: parsedJSONData.edges?.front?.right?.condition || 'Clean' }
                },
                surface: {
                  scratches: { severity: 'none', description: 'No scratches' },
                  creases: { severity: 'none', description: 'No creases' },
                  print_defects: { severity: 'none', description: 'No print defects' },
                  stains: { severity: 'none', description: 'No stains' },
                  other: { severity: 'none', description: 'No other defects' }
                }
              },
              back: {
                corners: {
                  top_left: { severity: 'none', description: parsedJSONData.corners?.back?.top_left?.condition || 'Mint' },
                  top_right: { severity: 'none', description: parsedJSONData.corners?.back?.top_right?.condition || 'Mint' },
                  bottom_left: { severity: 'none', description: parsedJSONData.corners?.back?.bottom_left?.condition || 'Mint' },
                  bottom_right: { severity: 'none', description: parsedJSONData.corners?.back?.bottom_right?.condition || 'Mint' }
                },
                edges: {
                  top: { severity: 'none', description: parsedJSONData.edges?.back?.top?.condition || 'Clean' },
                  bottom: { severity: 'none', description: parsedJSONData.edges?.back?.bottom?.condition || 'Clean' },
                  left: { severity: 'none', description: parsedJSONData.edges?.back?.left?.condition || 'Clean' },
                  right: { severity: 'none', description: parsedJSONData.edges?.back?.right?.condition || 'Clean' }
                },
                surface: {
                  scratches: { severity: 'none', description: 'No scratches' },
                  creases: { severity: 'none', description: 'No creases' },
                  print_defects: { severity: 'none', description: 'No print defects' },
                  stains: { severity: 'none', description: 'No stains' },
                  other: { severity: 'none', description: 'No other defects' }
                }
              }
            } : null,
            meta: {
              version: 'conversational-v4.0-json',
              prompt_version: parsedJSONData.metadata?.prompt_version || 'Conversational_Grading_v4.0_JSON',
              evaluated_at_utc: parsedJSONData.metadata?.timestamp || new Date().toISOString()
            },
            front_observations: null,
            back_observations: null
          };

          console.log(`[CONVERSATIONAL AI JSON] ✅ Grading completed: ${conversationalGradingData.decimal_grade}`);
          console.log(`[CONVERSATIONAL AI JSON] Condition Label:`, conversationalGradingData.condition_label);
          console.log(`[CONVERSATIONAL AI JSON] Image Confidence:`, conversationalGradingData.image_confidence);
          console.log(`[CONVERSATIONAL AI JSON] Weighted Scores:`, conversationalGradingData.weighted_sub_scores);
          console.log(`[CONVERSATIONAL AI JSON] Limiting Factor:`, conversationalGradingData.limiting_factor);
          console.log(`[CONVERSATIONAL AI JSON] 🐛 DEBUG - transformedDefects:`, JSON.stringify(conversationalGradingData.transformedDefects, null, 2));

        } else {
          // ✅ v3.8 MARKDOWN MODE - Parse v3.5 PATCHED v2 markdown with purpose-built parser
          console.log(`[CONVERSATIONAL AI v3.5] Parsing markdown with v3.5 parser...`);
          const { parseConversationalV3_5 } = await import('@/lib/conversationalParserV3_5');
          const parsedV3_5Data = parseConversationalV3_5(conversationalGradingResult);

          if (!parsedV3_5Data) {
            throw new Error('Failed to parse v3.5 PATCHED v2 response with v3.5 parser');
          }

          // Build conversationalGradingData from v3.5 parser result
          conversationalGradingData = {
            decimal_grade: parsedV3_5Data.decimal_grade,
            whole_grade: parsedV3_5Data.whole_grade,
            grade_uncertainty: parsedV3_5Data.grade_range,
            condition_label: parsedV3_5Data.condition_label,
            image_confidence: parsedV3_5Data.image_confidence,
            sub_scores: parsedV3_5Data.sub_scores,
            centering_ratios: parsedV3_5Data.centering, // v3.5 uses "centering" not "centering_ratios"
            slab_detection: parsedV3_5Data.professional_slab?.detected ? {
              detected: true,
              company: parsedV3_5Data.professional_slab.company,
              grade: parsedV3_5Data.professional_slab.grade,
              grade_description: parsedV3_5Data.professional_slab.grade_description,
              cert_number: parsedV3_5Data.professional_slab.cert_number,
              serial_number: null,
              subgrades: parsedV3_5Data.professional_slab.sub_grades ? {
                raw: parsedV3_5Data.professional_slab.sub_grades
              } : null
            } : null,
            card_info: parsedV3_5Data.card_info,
            front_observations: null,
            back_observations: null
          };

          console.log(`[CONVERSATIONAL AI v3.5] ✅ Grading completed: ${conversationalGradingData.decimal_grade}`);
          console.log(`[CONVERSATIONAL AI v3.5] Condition Label:`, conversationalGradingData.condition_label);
          console.log(`[CONVERSATIONAL AI v3.5] Image Confidence:`, conversationalGradingData.image_confidence);
          console.log(`[CONVERSATIONAL AI v3.5] Sub-scores:`, conversationalGradingData.sub_scores);

          if (conversationalGradingData.slab_detection?.detected) {
            console.log(`[CONVERSATIONAL AI v3.5] 🏆 Professional Slab Detected:`, {
              company: conversationalGradingData.slab_detection.company,
              grade: conversationalGradingData.slab_detection.grade,
              grade_description: conversationalGradingData.slab_detection.grade_description,
              cert_number: conversationalGradingData.slab_detection.cert_number,
              sub_grades: conversationalGradingData.slab_detection.subgrades
            });
          }
        }

        // 🔍 VALIDATION: Check front/back image verification
        if (conversationalGradingData.front_back_verification) {
          const verification = conversationalGradingData.front_back_verification;
          console.log(`[FRONT/BACK VERIFICATION] Assessment:`, verification.assessment);
          console.log(`[FRONT/BACK VERIFICATION] Confidence:`, verification.confidence);

          if (verification.assessment === 'MISMATCH_DETECTED') {
            console.error(`[FRONT/BACK VERIFICATION] ❌ MISMATCH DETECTED - Rejecting upload`);
            console.error(`[FRONT/BACK VERIFICATION] Discrepancies:`, verification.discrepancies);
            console.error(`[FRONT/BACK VERIFICATION] Explanation:`, verification.explanation);

            // Return error response with detailed mismatch information
            return NextResponse.json({
              error: 'MISMATCH_DETECTED',
              message: 'The front and back images appear to be from different cards',
              details: {
                discrepancies: verification.discrepancies || [],
                explanation: verification.explanation || 'Front and back images do not match',
                confidence: verification.confidence || 'high'
              }
            }, { status: 400 });
          }

          if (verification.assessment === 'UNCERTAIN' && verification.confidence === 'low') {
            console.warn(`[FRONT/BACK VERIFICATION] ⚠️ UNCERTAIN match with low confidence`);
            console.warn(`[FRONT/BACK VERIFICATION] Discrepancies:`, verification.discrepancies);
            // Allow processing to continue but log warning
          }

          console.log(`[FRONT/BACK VERIFICATION] ✅ Images match - proceeding with grading`);
        } else {
          console.warn(`[FRONT/BACK VERIFICATION] ⚠️ No front_back_verification data in response (old prompt version?)`);
        }

        // 🎯 Update visionResult with conversational AI data for professional grade estimation
        console.log(`[CONVERSATIONAL AI v3.5] Updating visionResult with conversational AI data...`);

        // Update recommended grade
        visionResult.recommended_grade = {
          recommended_decimal_grade: conversationalGradingData.decimal_grade,
          recommended_whole_grade: conversationalGradingData.whole_grade,
          grade_uncertainty: conversationalGradingData.grade_uncertainty || "N/A",
          grading_notes: conversationalGradingData.condition_label || "Graded by conversational AI v3.5 PATCHED v2"
        };

        // Update centering ratios from conversational AI
        if (conversationalGradingData.centering_ratios) {
          visionResult.centering = {
            front_left_right_ratio_text: conversationalGradingData.centering_ratios.front_lr || "N/A",
            front_top_bottom_ratio_text: conversationalGradingData.centering_ratios.front_tb || "N/A",
            back_left_right_ratio_text: conversationalGradingData.centering_ratios.back_lr || "N/A",
            back_top_bottom_ratio_text: conversationalGradingData.centering_ratios.back_tb || "N/A",
            method_front: "conversational AI v3.5",
            method_back: "conversational AI v3.5"
          };
          console.log(`[CONVERSATIONAL AI v3.5] Centering ratios updated:`, visionResult.centering);
        }

        // Update sub-scores from conversational AI
        if (conversationalGradingData.sub_scores) {
          visionResult.sub_scores = {
            centering: {
              front_score: conversationalGradingData.sub_scores.centering.front,
              back_score: conversationalGradingData.sub_scores.centering.back,
              weighted_score: conversationalGradingData.sub_scores.centering.weighted
            },
            corners: {
              front_score: conversationalGradingData.sub_scores.corners.front,
              back_score: conversationalGradingData.sub_scores.corners.back,
              weighted_score: conversationalGradingData.sub_scores.corners.weighted
            },
            edges: {
              front_score: conversationalGradingData.sub_scores.edges.front,
              back_score: conversationalGradingData.sub_scores.edges.back,
              weighted_score: conversationalGradingData.sub_scores.edges.weighted
            },
            surface: {
              front_score: conversationalGradingData.sub_scores.surface.front,
              back_score: conversationalGradingData.sub_scores.surface.back,
              weighted_score: conversationalGradingData.sub_scores.surface.weighted
            }
          };
          console.log(`[CONVERSATIONAL AI v3.5] Sub-scores updated`);
        }

        // Update grading status
        visionResult.grading_status = conversationalGradingData.condition_label || "Gradable";

        console.log(`[CONVERSATIONAL AI v3.5] ✅ visionResult updated with conversational AI data`);

        // 🔄 CONDITIONAL API CALLS: Only run redundant extractions in markdown mode
        // In JSON mode, all data is already extracted above - skip these 3 API calls!
        if (!parsedJSONData) {
          console.log(`[CONVERSATIONAL AI] ℹ️ Markdown mode detected - running 3 additional extraction calls...`);

          // 🆕 JSON CARD INFO: Lightweight extraction (no full grading)
          // Extract card info using a minimal prompt for structured JSON
          try {
          console.log(`[JSON CARD INFO] Calling lightweight card info extraction...`);

          const openai = new (await import('openai')).default({
            apiKey: process.env.OPENAI_API_KEY,
          });

          const cardInfoResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.2,
            top_p: 1.0,
            seed: 42,
            max_tokens: 500,  // Keep it small - we only need card info
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `You are a professional trading card information extractor. Analyze the card images carefully and extract ALL visible information with maximum accuracy.

Return ONLY a JSON object with this exact structure:
{
  "card_name": "string or null",
  "player_or_character": "string or null",
  "set_name": "string or null",
  "year": "string or null",
  "manufacturer": "string or null",
  "card_number": "string or null",
  "sport_or_category": "string or null",
  "serial_number": "string or null",
  "rookie_or_first": "boolean",
  "rarity_or_variant": "string or null",
  "authentic": "boolean",
  "subset": "string or null",
  "autographed": "boolean",
  "memorabilia": "string or null",
  "pokemon_type": "string or null",
  "pokemon_stage": "string or null",
  "hp": "string or null",
  "card_type": "string or null"
}

═══════════════════════════════════════════════════════════════════════════════
POKEMON CARD EXTRACTION GUIDE (Follow Step-by-Step)
═══════════════════════════════════════════════════════════════════════════════

[STEP 1] CARD NAME & CHARACTER
─────────────────────────────────
• card_name: Read the LARGE text at the top of the card
  - Include ALL suffixes and designations
  - Examples: "Pikachu VMAX", "Charizard ex", "Mega Lucario EX", "Radiant Greninja"

• player_or_character: Extract ONLY the Pokemon species name
  - Remove: EX, GX, VMAX, VSTAR, V, ex, Mega, Radiant, & (ampersand), -EX, -GX
  - Examples:
    * "Pikachu VMAX" → "Pikachu"
    * "Mega Lucario EX" → "Lucario"
    * "Charizard & Braixen GX" → "Charizard & Braixen"
    * "Radiant Greninja" → "Greninja"

[STEP 2] SET NAME (CRITICAL - Read Carefully!)
─────────────────────────────────
Pokemon cards display set information in MULTIPLE locations. Check ALL:

LOCATION 1 - Bottom of Card Front:
  • Look for small text near the card number
  • Usually appears as: "[Set Name] [Card#]/[Total]"
  • Example: "XY—Furious Fists 179/162"

LOCATION 2 - Card Back:
  • Check bottom of card back for set name
  • Often appears near copyright or logo

LOCATION 3 - Set Symbol:
  • Small icon on right side of card (indicates set but not name)

EXTRACTION RULES:
  • PRIORITY 1: Extract FULL set name if visible (e.g., "XY Furious Fists", "Sword & Shield")
  • PRIORITY 2: If only abbreviation visible, use it (e.g., "XY", "SWSH", "SV")
  • PRIORITY 3: If set code + expansion visible, combine (e.g., "SV1a", "XY3")

COMMON SET NAME FORMATS:
  • Vintage: "Base Set", "Jungle", "Fossil", "Team Rocket", "Gym Heroes"
  • Modern Full: "Sword & Shield", "Sun & Moon", "XY Furious Fists", "Scarlet & Violet"
  • Abbreviated: "SWSH", "SM", "XY", "SV"
  • Expansion: "Battle Styles", "Evolving Skies", "Lost Origin", "Paldea Evolved"

[STEP 3] YEAR & MANUFACTURER
─────────────────────────────────
• year: Find copyright symbol © on bottom of card
  - Extract ONLY the 4-digit year
  - Example: "©2014 Pokémon/Nintendo" → "2014"
  - Example: "©2024 Pokémon. ©1995-2024 Nintendo" → "2024"

• manufacturer: For all Pokemon cards use "The Pokemon Company"
  - Even if you see "Nintendo" or "Wizards of the Coast", use "The Pokemon Company"

[STEP 4] CARD NUMBER
─────────────────────────────────
Look at BOTTOM RIGHT of card front:
  • Format: [Number]/[Total] or [Number]/[Total] [Set Code]
  • Extract the COMPLETE number text as shown
  • Examples:
    * "179/162" → "179/162"
    * "044/185" → "044/185"
    * "SV1a 001/073" → "001/073" (extract just the number portion)

[STEP 5] RARITY & VARIANT
─────────────────────────────────
Check card number AND symbols:

NUMBER-BASED RARITY:
  • Secret Rare: Card number > set total (e.g., 179/162, 195/185)
  • Regular: Card number ≤ set total

SYMBOL-BASED RARITY (bottom right corner):
  • ⭐⭐ (Two stars) → Ultra Rare
  • ⭐ (One star) → Rare / Holo Rare
  • ◆ (Diamond) → Uncommon
  • ● (Circle) → Common
  • Special symbols → Promo / Special

VISUAL INDICATORS:
  • Gold/Metal card → Gold Rare / Gold Secret Rare
  • Rainbow pattern → Rainbow Rare
  • Full art illustration → Full Art [Rarity]
  • Textured/embossed → Ultra Rare / Secret Rare

FINAL FORMAT:
  • Combine number + symbol: "Secret Rare", "Rare Holo", "Uncommon", "Common"
  • Add special attributes: "Gold Secret Rare", "Rainbow Rare Ultra Rare"

[STEP 6] SUBSET / INSERT (Pokemon-Specific)
─────────────────────────────────
Pokemon subsets identify special card categories:

EVOLUTION/FORM SUBSETS:
  • "Mega Evolution" - Cards with "Mega" in name (e.g., Mega Lucario EX)
  • "VMAX" - Cards with VMAX designation
  • "VSTAR" - Cards with VSTAR designation
  • "Radiant Collection" - Radiant Pokemon cards

ART STYLE SUBSETS:
  • "Full Art" - Character covers entire card
  • "Alternate Art" - Special illustration version
  • "Trainer Gallery" - Special trainer-focused subset
  • "Character Rare" - Full art character cards
  • "Special Art Rare" - Unique artistic style

VINTAGE SUBSETS:
  • "1st Edition" - Has 1st Edition stamp
  • "Shadowless" - Base Set cards without shadow
  • "Unlimited" - Standard printing

EXTRACTION RULES:
  1. Check card name for Mega/VMAX/VSTAR → auto-assign subset
  2. Look for "Full Art" style (character fills card) → "Full Art"
  3. Check for subset text in small print on borders
  4. Check set-specific insert designations

[STEP 7] POKEMON-SPECIFIC FIELDS
─────────────────────────────────
• pokemon_type: Look for TYPE SYMBOL (usually top right)
  - Fire (🔥), Water (💧), Grass (🌿), Lightning (⚡), Psychic (👁), Fighting (👊)
  - Darkness (🌙), Metal (⚙️), Fairy (✨), Dragon (🐉), Colorless (⭐)
  - Extract as text: "Fire", "Water", "Grass", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless"

• pokemon_stage: Look near Pokemon name (top left area)
  - Basic: No evolution indicator
  - Stage 1: "Stage 1" text with arrow
  - Stage 2: "Stage 2" text with arrow
  - Special: "VMAX", "VSTAR", "ex", "GX", "EX", "Mega", "Radiant", "Prime", "Legend"

• hp: Large number in TOP RIGHT corner
  - Extract the number: "HP 340" → "340", "120 HP" → "120"

• card_type: Identify card category
  - Pokémon: Has Pokemon character and HP
  - Trainer: No HP, says "Trainer" or subcategory
  - Supporter: Trainer card with "Supporter" text
  - Item: Trainer card with "Item" text
  - Stadium: Trainer card with "Stadium" text
  - Energy: Energy symbol, no HP
  - Special Energy: Energy with special name/effect

[STEP 8] AUTHENTICITY & CATEGORY
─────────────────────────────────
• authentic: Check for official licensing marks
  - Look for: "TM", "©", "The Pokemon Company", official set symbol
  - true if looks professionally printed with official marks
  - false if appears fake, proxy, or custom-made

• sport_or_category: "Pokemon" for all Pokemon cards

═══════════════════════════════════════════════════════════════════════════════
SPORTS CARD SPECIFIC RULES
═══════════════════════════════════════════════════════════════════════════════
• rookie_or_first: Look for "RC", "ROOKIE" designation (sports cards only)
• memorabilia: Note if card contains jersey, patch, autograph relic (sports cards only)
• subset: Sports card inserts like "Prizm Silver", "Gold Standard", "Hall of Fame"

═══════════════════════════════════════════════════════════════════════════════
GENERAL EXTRACTION RULES
═══════════════════════════════════════════════════════════════════════════════
1. Read ALL visible text on both front and back of card
2. Extract information even if partially visible or unclear
3. Use null ONLY if information is completely absent or unreadable
4. Be SPECIFIC and ACCURATE - avoid generic descriptions
5. Double-check all numbers and spelling
6. Prioritize information from the card itself over assumptions`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: frontUrl, detail: 'high' }
                  },
                  {
                    type: 'image_url',
                    image_url: { url: backUrl, detail: 'high' }
                  },
                  {
                    type: 'text',
                    text: 'Extract the card information from these images.'
                  }
                ]
              }
            ]
          });

          const cardInfoJson = JSON.parse(cardInfoResponse.choices[0]?.message?.content || '{}');

          // Override conversational_card_info with JSON data (no parsing needed!)
          if (cardInfoJson) {
            conversationalGradingData.card_info = cardInfoJson;
            console.log(`[JSON CARD INFO] ✅ Card info extracted from JSON:`, cardInfoJson);
          }
        } catch (error: any) {
          console.error(`[JSON CARD INFO] ⚠️ JSON card info extraction failed, falling back to parsed data:`, error.message);
          // Not fatal - continue with parsed data from conversational markdown
        }

        // 🆕 JSON CASE DETECTION: Extract from markdown report (already analyzed in STEP 2)
        try {
          console.log(`[JSON CASE DETECTION] Extracting case detection from markdown report...`);

          // Case detection is already in the markdown report from STEP 2
          // Handle markdown bold formatting: **Case Type:** or Case Type:
          const caseTypeMatch = conversationalGradingResult.match(/(?:\*\*)?Case Type(?:\*\*)?[:\s]*(\w[\w\s-]+)/i);
          const visibilityMatch = conversationalGradingResult.match(/(?:\*\*)?Visibility(?:\*\*)?[:\s]*(\w+)/i);
          const impactMatch = conversationalGradingResult.match(/(?:\*\*)?Impact Level(?:\*\*)?[:\s]*(\w+)/i);
          const notesMatch = conversationalGradingResult.match(/(?:\*\*)?Notes(?:\*\*)?[:\s]*(.+?)(?:\n|$)/i);

          if (caseTypeMatch) {
            const caseType = caseTypeMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
            const visibility = visibilityMatch ? visibilityMatch[1].trim().toLowerCase() : 'full';
            const impact = impactMatch ? impactMatch[1].trim().toLowerCase() : 'none';
            const notes = notesMatch ? notesMatch[1].trim() : null;

            conversationalGradingData.case_detection = {
              case_type: caseType,
              visibility: visibility,
              impact_level: impact,
              notes: notes
            };
            console.log(`[JSON CASE DETECTION] ✅ Case detected from markdown:`, conversationalGradingData.case_detection);
          } else {
            console.log(`[JSON CASE DETECTION] ℹ️ No case detection found in markdown, assuming none`);
            conversationalGradingData.case_detection = {
              case_type: 'none',
              visibility: 'full',
              impact_level: 'none',
              notes: null
            };
          }
        } catch (error: any) {
          console.error(`[JSON CASE DETECTION] ⚠️ Case detection extraction failed:`, error.message);
          // Not fatal - set default values
          conversationalGradingData.case_detection = {
            case_type: 'none',
            visibility: 'full',
            impact_level: 'none',
            notes: null
          };
        }

        // 🆕 JSON GRADE EXTRACTION: Get main grading data with structured JSON
        try {
          console.log(`[JSON GRADE] Extracting main grade data with JSON...`);

          const openai = new (await import('openai')).default({
            apiKey: process.env.OPENAI_API_KEY,
          });

          const gradeExtractionResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.1,  // Very low temp for consistency
            top_p: 1.0,
            seed: 42,
            max_tokens: 400,  // Small - just need core grading data
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `Extract the final grading results from the provided markdown report. Return ONLY a JSON object:

{
  "decimal_grade": number,
  "whole_grade": number,
  "grade_uncertainty": "string",
  "condition_label": "string",
  "image_confidence": "string"
}

FIELD DEFINITIONS:

**decimal_grade**: The final numeric grade on a 1.0-10.0 scale (e.g., 9.5, 8.0, 7.5)
- Look for: "Final Decimal Grade", "Final Grade", "Decimal Grade"
- Must be a number between 1.0 and 10.0
- Use increments of 0.5 (e.g., 9.5, 9.0, 8.5, etc.)
- If card is not gradable, use null

**whole_grade**: The whole number equivalent (e.g., 9, 8, 7)
- Look for: "Whole Number Equivalent", "Whole Grade"
- Round to nearest integer

**grade_uncertainty**: The uncertainty/range (e.g., "±0.5", "±0.25", "±1.0")
- Look for: "Grade Range", "Uncertainty", "Grade Uncertainty"
- Format as "±X.X"
- Common values: "±0.0", "±0.25", "±0.5", "±1.0"

**condition_label**: The condition descriptor (e.g., "Mint (M)", "Near Mint (NM)", "Gem Mint (GM)")
- Look for: "Condition Label"
- Common values: "Gem Mint (GM)", "Mint (M)", "Near Mint (NM)", "Excellent (EX)", "Very Good (VG)", "Good (G)", "Fair (F)", "Poor (P)"

**image_confidence**: The image quality grade (A, B, C, or D)
- Look for: "Image Confidence", "Confidence Letter"
- Must be exactly one letter: A, B, C, or D
- A = Excellent, B = Good, C = Fair, D = Poor

**centering_weighted**: The weighted centering score (front 55% + back 45%)
- Look in the :::WEIGHTED_SCORES block for "Centering Weighted: X.X"
- Format: "Centering Weighted: 9.0" (plain text, no markdown, no bullets)
- Must be a number between 0.0 and 10.0
- This is the calculated weighted average, not the raw front/back scores

**corners_weighted**: The weighted corners score (front 55% + back 45%)
- Look in the :::WEIGHTED_SCORES block for "Corners Weighted: X.X"
- Format: "Corners Weighted: 8.5" (plain text, no markdown, no bullets)
- Must be a number between 0.0 and 10.0

**edges_weighted**: The weighted edges score (front 55% + back 45%)
- Look in the :::WEIGHTED_SCORES block for "Edges Weighted: X.X"
- Format: "Edges Weighted: 9.0" (plain text, no markdown, no bullets)
- Must be a number between 0.0 and 10.0

**surface_weighted**: The weighted surface score (front 55% + back 45%)
- Look in the :::WEIGHTED_SCORES block for "Surface Weighted: X.X"
- Format: "Surface Weighted: 8.0" (plain text, no markdown, no bullets)
- Must be a number between 0.0 and 10.0

**limiting_factor**: Which category determined the final grade
- Look in the :::WEIGHTED_SCORES block for "Limiting Factor: category"
- Format: "Limiting Factor: Surface" (then convert to lowercase: "surface")
- Must be one of: "centering", "corners", "edges", "surface" (LOWERCASE ONLY)
- This is the category with the lowest weighted score

**preliminary_grade**: The grade before caps are applied (minimum of weighted scores)
- Look in the :::WEIGHTED_SCORES block for "Preliminary Grade (before caps): X.X"
- Format: "Preliminary Grade (before caps): 8.0" (plain text)
- Must be a number between 0.0 and 10.0
- This should equal the minimum of the four weighted scores

CRITICAL INSTRUCTIONS:
- Extract EXACTLY what the report says, do not calculate or infer
- decimal_grade and whole_grade must be numbers, not strings
- All weighted scores must be numbers between 0.0 and 10.0
- limiting_factor must be lowercase: centering, corners, edges, or surface
- If a value is not found, use null
- Return valid JSON only`
              },
              {
                role: 'user',
                content: `Extract the grading data from this markdown report:\n\n${conversationalGradingResult}`
              }
            ]
          });

          const gradeJson = JSON.parse(gradeExtractionResponse.choices[0]?.message?.content || '{}');

          // Override conversationalGradingData with JSON extraction (more reliable!)
          if (gradeJson && (gradeJson.decimal_grade !== null && gradeJson.decimal_grade !== undefined)) {
            console.log(`[JSON GRADE] ✅ Grade data extracted from JSON:`, gradeJson);

            // Override parsed values with JSON values
            conversationalGradingData.decimal_grade = gradeJson.decimal_grade;
            conversationalGradingData.whole_grade = gradeJson.whole_grade || Math.round(gradeJson.decimal_grade);
            conversationalGradingData.grade_uncertainty = gradeJson.grade_uncertainty || conversationalGradingData.grade_uncertainty;
            conversationalGradingData.condition_label = gradeJson.condition_label || conversationalGradingData.condition_label;
            conversationalGradingData.image_confidence = gradeJson.image_confidence || conversationalGradingData.image_confidence;

            // 🆕 v3.8: Extract weighted scores and limiting factor
            conversationalGradingData.weighted_sub_scores = {
              centering: gradeJson.centering_weighted || null,
              corners: gradeJson.corners_weighted || null,
              edges: gradeJson.edges_weighted || null,
              surface: gradeJson.surface_weighted || null
            };
            // Ensure limiting_factor is lowercase (centering/corners/edges/surface)
            conversationalGradingData.limiting_factor = gradeJson.limiting_factor ? gradeJson.limiting_factor.toLowerCase() : null;
            conversationalGradingData.preliminary_grade = gradeJson.preliminary_grade || null;

            console.log(`[JSON GRADE] 📊 Final grading data:`, {
              decimal: conversationalGradingData.decimal_grade,
              whole: conversationalGradingData.whole_grade,
              uncertainty: conversationalGradingData.grade_uncertainty,
              condition: conversationalGradingData.condition_label,
              confidence: conversationalGradingData.image_confidence,
              weighted_scores: conversationalGradingData.weighted_sub_scores,
              limiting_factor: conversationalGradingData.limiting_factor
            });

            // Also update visionResult.recommended_grade with JSON data
            visionResult.recommended_grade = {
              recommended_decimal_grade: conversationalGradingData.decimal_grade,
              recommended_whole_grade: conversationalGradingData.whole_grade,
              grade_uncertainty: conversationalGradingData.grade_uncertainty || "N/A",
              grading_notes: conversationalGradingData.condition_label || "Graded by conversational AI v3.5 PATCHED v2"
            };
          } else {
            console.log(`[JSON GRADE] ⚠️ No grade found in JSON, using parsed markdown data`);
          }
        } catch (error: any) {
          console.error(`[JSON GRADE] ⚠️ Grade extraction failed, falling back to parsed data:`, error.message);
          // Not fatal - continue with parsed data from conversational markdown
        }

        // 🆕 JSON CORNERS/EDGES/SURFACE EXTRACTION: Get detailed analysis with structured JSON
        try {
          console.log(`[JSON DETAILS] Extracting corners/edges/surface details with JSON...`);

          const openai = new (await import('openai')).default({
            apiKey: process.env.OPENAI_API_KEY,
          });

          const detailsExtractionResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.1,
            top_p: 1.0,
            seed: 42,
            max_tokens: 3000,  // Larger - need full details for all corners/edges/surface
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `Extract corners, edges, and surface analysis from the grading report. Return ONLY a JSON object:

{
  "front_corners": {
    "top_left": "string",
    "top_right": "string",
    "bottom_left": "string",
    "bottom_right": "string",
    "summary": "string",
    "sub_score": number
  },
  "back_corners": {
    "top_left": "string",
    "top_right": "string",
    "bottom_left": "string",
    "bottom_right": "string",
    "summary": "string",
    "sub_score": number
  },
  "front_edges": {
    "top": "string",
    "bottom": "string",
    "left": "string",
    "right": "string",
    "summary": "string",
    "sub_score": number
  },
  "back_edges": {
    "top": "string",
    "bottom": "string",
    "left": "string",
    "right": "string",
    "summary": "string",
    "sub_score": number
  },
  "front_surface": {
    "analysis": "string",
    "summary": "string",
    "sub_score": number
  },
  "back_surface": {
    "analysis": "string",
    "summary": "string",
    "sub_score": number
  }
}

EXTRACTION RULES:
- Extract the detailed analysis text for each corner, edge, and surface
- For corners: Look for "Top Left:", "Top Right:", "Bottom Left:", "Bottom Right:" in STEP 3 and STEP 4
- For edges: Look for "Top Edge:", "Bottom Edge:", "Left Edge:", "Right Edge:" in STEP 3 and STEP 4
- For surface: Look for "Front Surface Analysis:", "Back Surface Analysis:" or "Surface Analysis:" sections
- Extract the summary text for each section (usually 2-3 sentences)
- Extract the sub-scores (0.0-10.0 scale)
- If a section is not found, use null for that field
- Include the full text with measurements and context-aware analysis`
              },
              {
                role: 'user',
                content: `Extract the corners/edges/surface details from this markdown report:\n\n${conversationalGradingResult}`
              }
            ]
          });

          const detailsJson = JSON.parse(detailsExtractionResponse.choices[0]?.message?.content || '{}');

          if (detailsJson) {
            console.log(`[JSON DETAILS] ✅ Corners/Edges/Surface extracted from JSON`);

            // Store in conversationalGradingData for database save
            conversationalGradingData.corners_edges_surface_json = detailsJson;

            console.log(`[JSON DETAILS] 📊 Extracted details:`, {
              front_corners: detailsJson.front_corners?.sub_score,
              back_corners: detailsJson.back_corners?.sub_score,
              front_edges: detailsJson.front_edges?.sub_score,
              back_edges: detailsJson.back_edges?.sub_score,
              front_surface: detailsJson.front_surface?.sub_score,
              back_surface: detailsJson.back_surface?.sub_score
            });
          }
        } catch (error: any) {
          console.error(`[JSON DETAILS] ⚠️ Details extraction failed, falling back to parsed data:`, error.message);
          // Not fatal - continue with parsed data from conversational markdown
        }

        } else {
          // 🚀 JSON MODE - Skip all 3 redundant API calls!
          console.log(`[CONVERSATIONAL AI JSON] ✅ JSON mode detected - skipping 3 redundant extraction calls`);
          console.log(`[CONVERSATIONAL AI JSON] 💾 All data already extracted from JSON response`);
          console.log(`[CONVERSATIONAL AI JSON] ⚡ Time saved: ~60-90 seconds`);
          console.log(`[CONVERSATIONAL AI JSON] 💰 Cost saved: ~69% (eliminated 3 API calls)`);

          // ✨ Create corners_edges_surface_json from JSON data for frontend display
          console.log(`[CONVERSATIONAL AI JSON] 🎨 Creating corners_edges_surface_json for frontend`);
          console.log(`[CONVERSATIONAL AI JSON] 🐛 DEBUG conversationalGradingData.sub_scores:`, JSON.stringify(conversationalGradingData.sub_scores, null, 2));

          conversationalGradingData.corners_edges_surface_json = {
            // Centering summaries (for "Centering Details" section)
            front_centering: {
              summary: parsedJSONData.centering?.front_summary ||
                       parsedJSONData.centering?.front?.summary ||
                       parsedJSONData.centering?.front?.analysis ||  // Fallback to analysis field
                       'Perfect centering on both axes'
            },
            back_centering: {
              summary: parsedJSONData.centering?.back_summary ||
                       parsedJSONData.centering?.back?.summary ||
                       parsedJSONData.centering?.back?.analysis ||  // Fallback to analysis field
                       'Perfect centering on both axes'
            },
            // Front corners
            front_corners: {
              top_left: parsedJSONData.corners?.front?.top_left?.condition || 'N/A',
              top_right: parsedJSONData.corners?.front?.top_right?.condition || 'N/A',
              bottom_left: parsedJSONData.corners?.front?.bottom_left?.condition || 'N/A',
              bottom_right: parsedJSONData.corners?.front?.bottom_right?.condition || 'N/A',
              sub_score: conversationalGradingData.sub_scores?.corners?.front || 0,
              summary: parsedJSONData.corners?.front_summary || parsedJSONData.corners?.front?.summary || 'Corner analysis not available'
            },
            // Back corners
            back_corners: {
              top_left: parsedJSONData.corners?.back?.top_left?.condition || 'N/A',
              top_right: parsedJSONData.corners?.back?.top_right?.condition || 'N/A',
              bottom_left: parsedJSONData.corners?.back?.bottom_left?.condition || 'N/A',
              bottom_right: parsedJSONData.corners?.back?.bottom_right?.condition || 'N/A',
              sub_score: conversationalGradingData.sub_scores?.corners?.back || 0,
              summary: parsedJSONData.corners?.back_summary || parsedJSONData.corners?.back?.summary || 'Corner analysis not available'
            },
            // Front edges
            front_edges: {
              top: parsedJSONData.edges?.front?.top?.condition || 'N/A',
              bottom: parsedJSONData.edges?.front?.bottom?.condition || 'N/A',
              left: parsedJSONData.edges?.front?.left?.condition || 'N/A',
              right: parsedJSONData.edges?.front?.right?.condition || 'N/A',
              sub_score: conversationalGradingData.sub_scores?.edges?.front || 0,
              summary: parsedJSONData.edges?.front_summary || parsedJSONData.edges?.front?.summary || 'Edge analysis not available'
            },
            // Back edges
            back_edges: {
              top: parsedJSONData.edges?.back?.top?.condition || 'N/A',
              bottom: parsedJSONData.edges?.back?.bottom?.condition || 'N/A',
              left: parsedJSONData.edges?.back?.left?.condition || 'N/A',
              right: parsedJSONData.edges?.back?.right?.condition || 'N/A',
              sub_score: conversationalGradingData.sub_scores?.edges?.back || 0,
              summary: parsedJSONData.edges?.back_summary || parsedJSONData.edges?.back?.summary || 'Edge analysis not available'
            },
            // Front surface
            front_surface: {
              defects: parsedJSONData.surface?.front?.defects || [],  // Pass full defects array
              analysis: parsedJSONData.surface?.front?.analysis || 'No analysis available',
              sub_score: conversationalGradingData.sub_scores?.surface?.front || 0,
              summary: parsedJSONData.surface?.front_summary || parsedJSONData.surface?.front?.summary || 'Surface analysis not available'
            },
            // Back surface
            back_surface: {
              defects: parsedJSONData.surface?.back?.defects || [],  // Pass full defects array
              analysis: parsedJSONData.surface?.back?.analysis || 'No analysis available',
              sub_score: conversationalGradingData.sub_scores?.surface?.back || 0,
              summary: parsedJSONData.surface?.back_summary || parsedJSONData.surface?.back?.summary || 'Surface analysis not available'
            }
          };

          console.log(`[CONVERSATIONAL AI JSON] ✅ corners_edges_surface_json created:`, JSON.stringify({
            front_corners_score: conversationalGradingData.corners_edges_surface_json.front_corners.sub_score,
            back_corners_score: conversationalGradingData.corners_edges_surface_json.back_corners.sub_score,
            front_edges_score: conversationalGradingData.corners_edges_surface_json.front_edges.sub_score,
            back_edges_score: conversationalGradingData.corners_edges_surface_json.back_edges.sub_score,
            front_surface_score: conversationalGradingData.corners_edges_surface_json.front_surface.sub_score,
            back_surface_score: conversationalGradingData.corners_edges_surface_json.back_surface.sub_score
          }, null, 2));
        }

      } catch (error: any) {
        console.error(`[CONVERSATIONAL AI] ❌ Conversational grading failed:`, error.message);
        conversationalGradingResult = null;
        conversationalGradingData = null;
        // Return error since this is now the primary grading system
        return NextResponse.json(
          { error: `Conversational AI grading failed: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // 🎯 Check if this is an N/A grade AFTER updating visionResult with conversational AI data
    // This must happen after visionResult is updated, otherwise stub data causes false N/A detection
    const isNAGrade = visionResult.recommended_grade.recommended_decimal_grade === null;
    console.log(`[CONVERSATIONAL AI] isNAGrade check: ${isNAGrade} (grade: ${visionResult.recommended_grade.recommended_decimal_grade})`);

    // Extract slab detection data - prioritize conversational AI v3.2 data
    const slabData = conversationalGradingData?.slab_detection || visionResult.slab_detection;
    const slabDetected = slabData?.detected || slabData?.slab_detected || false;
    let aiVsSlabComparison: string | null = null;

    // If slab is detected, generate comparison between professional grade and AI grade
    if (slabDetected && slabData) {
      const professionalGrade = slabData.grade;
      const aiGrade = conversationalGradingData?.decimal_grade || visionResult.recommended_grade.recommended_decimal_grade;

      if (professionalGrade && aiGrade !== null) {
        const profGradeNum = parseFloat(professionalGrade);
        const gradeDiff = Math.abs(profGradeNum - aiGrade);

        if (gradeDiff === 0) {
          aiVsSlabComparison = `AI grade (${aiGrade}) matches professional grade exactly.`;
        } else if (gradeDiff <= 0.5) {
          aiVsSlabComparison = `AI grade (${aiGrade}) is within 0.5 points of professional grade (${professionalGrade}). Close agreement.`;
        } else if (gradeDiff <= 1.0) {
          aiVsSlabComparison = `AI grade (${aiGrade}) differs from professional grade (${professionalGrade}) by ${gradeDiff.toFixed(1)} points. Moderate discrepancy - slab holder may affect AI analysis.`;
        } else {
          aiVsSlabComparison = `AI grade (${aiGrade}) differs significantly from professional grade (${professionalGrade}) by ${gradeDiff.toFixed(1)} points. Large discrepancy - slab holder likely affects AI visibility.`;
        }
      } else if (professionalGrade && aiGrade === null) {
        aiVsSlabComparison = `Professional grade: ${professionalGrade}. AI grade: N/A (card not gradable due to alteration or defect).`;
      }
    }

    // Convert DVG v1 result to legacy ai_grading format for frontend compatibility
    const legacyGrading = {
      "Final Score": {
        "Overall Grade": isNAGrade ? "N/A" : visionResult.recommended_grade.recommended_decimal_grade
      },
      "Card Information": {
        "Card Name": visionResult.card_info.card_name,
        "Card Set": visionResult.card_info.set_name,
        "Card Number": visionResult.card_info.card_number,
        "Manufacturer Name": visionResult.card_info.manufacturer,
        "Release Date": visionResult.card_info.year,
        "Category": visionResult.card_info.sport_or_category,
        "Authentic": "Yes",
        // Enhanced fields
        "Serial Number": visionResult.card_info.serial_number || "N/A",
        "Rookie/First": visionResult.card_info.rookie_or_first || "unknown",
        "Rarity/Variant": visionResult.card_info.rarity_or_variant || "Base",
        "Authentic Flag": visionResult.card_info.authentic !== undefined ? visionResult.card_info.authentic : true
      },
      "Card Details": {
        "Player(s)/Character(s) Featured": visionResult.card_info.player_or_character,
        "Rookie/First Print": visionResult.card_info.rookie_or_first === 'true' ? "Yes" : visionResult.card_info.rookie_or_first === 'false' ? "No" : "Unknown",
        "Autographed": visionResult.autograph.present ? "Yes" : "No"
      },
      "Grading (DCM Master Scale)": {
        "Final Grade (After Deductions)": isNAGrade ? "N/A" : visionResult.recommended_grade.recommended_decimal_grade,
        "Decimal Final Grade": isNAGrade ? "N/A" : visionResult.recommended_grade.recommended_decimal_grade,
        "Whole Number Grade": isNAGrade ? "N/A" : visionResult.recommended_grade.recommended_whole_grade,
        "Image Quality Cap Applied": visionResult.image_quality.grade === 'C' || visionResult.image_quality.grade === 'D' ? "Yes" : "No",
        "Centering Starting Grade": isNAGrade ? "N/A" : 10,
        "Grading Status": visionResult.grading_status || (isNAGrade ? "N/A - Unverified autograph or alteration detected" : "Gradable")
      },
      "Centering_Measurements": {
        front_x_axis_ratio: visionResult.centering.front_left_right_ratio_text,
        front_y_axis_ratio: visionResult.centering.front_top_bottom_ratio_text,
        back_x_axis_ratio: visionResult.centering.back_left_right_ratio_text,
        back_y_axis_ratio: visionResult.centering.back_top_bottom_ratio_text,
        front_centering_method: visionResult.centering.method_front,
        back_centering_method: visionResult.centering.method_back
      },
      "Visual_Inspection_Results": {
        positives: visionResult.analysis_summary?.positives || [],
        negatives: visionResult.analysis_summary?.negatives || []
      },
      // DVG metadata
      dvg_v2_data: visionResult,
      dvg_version: 'dvg-v2',
      dvg_image_quality: visionResult.image_quality,

      // NEW: Enhanced card information fields
      card_text_blocks: visionResult.card_text_blocks,
      rarity_features: visionResult.rarity_features
    };

    // ✨ NEW: Parse markdown into structured data ONCE here (v3.3 structured data migration)
    // 🔄 Skip markdown parsing in JSON mode - data already extracted
    let structuredDefects = null;
    let structuredCentering = null;
    let structuredMetadata = null;

    if (isJSONMode) {
      console.log(`[CONVERSATIONAL AI JSON] ⏭️ Skipping markdown parsers - data already extracted from JSON`);

      // Populate structured data from JSON extraction
      structuredCentering = {
        front_left_right: conversationalGradingData?.centering_ratios?.front_lr || 'N/A',
        front_top_bottom: conversationalGradingData?.centering_ratios?.front_tb || 'N/A',
        back_left_right: conversationalGradingData?.centering_ratios?.back_lr || 'N/A',
        back_top_bottom: conversationalGradingData?.centering_ratios?.back_tb || 'N/A',
        centering_score: conversationalGradingData?.sub_scores?.centering?.weighted || 0,
        // Extract quality tiers (v5.0+)
        front_quality_tier: conversationalGradingData?.centering_front_quality_tier,
        back_quality_tier: conversationalGradingData?.centering_back_quality_tier
      };

      console.log('[CONVERSATIONAL AI JSON] ✅ Structured centering data populated from JSON:', structuredCentering);
    } else {
      console.log(`[CONVERSATIONAL AI] 🔄 Parsing markdown into structured data...`);
      structuredDefects = parseConversationalDefects(conversationalGradingResult);
      structuredCentering = parseCenteringMeasurements(conversationalGradingResult);
      structuredMetadata = parseGradingMetadata(conversationalGradingResult);

      console.log('[CONVERSATIONAL AI] ✅ Parsed structured data:', {
        hasDefects: !!structuredDefects,
        hasFrontDefects: !!structuredDefects?.front,
        hasBackDefects: !!structuredDefects?.back,
        hasCentering: !!structuredCentering,
        hasMetadata: !!structuredMetadata
      });
    }

    // Update database with grading results
    console.log(`[CONVERSATIONAL AI] Updating database with grading results...`);

    const { error: updateError } = await supabase
      .from("cards")
      .update({
        // OpenCV Stage 0 metrics (DISABLED 2025-10-19: OpenCV unreliable)
        opencv_metrics: null,

        // DVG v1 specific fields (DISABLED for testing - stub data only)
        dvg_grading: visionResult,
        dvg_decimal_grade: isNAGrade ? null : visionResult.recommended_grade.recommended_decimal_grade,
        dvg_whole_grade: isNAGrade ? null : visionResult.recommended_grade.recommended_whole_grade,
        dvg_grade_uncertainty: visionResult.recommended_grade.grade_uncertainty,

        // 🎯 PRIMARY: Conversational AI grading v3.2 (2025-10-22)
        conversational_grading: conversationalGradingResult,
        conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
        conversational_whole_grade: conversationalGradingData?.whole_grade || null,
        conversational_grade_uncertainty: conversationalGradingData?.grade_uncertainty || null,
        conversational_sub_scores: conversationalGradingData?.sub_scores || null,
        conversational_weighted_summary: conversationalGradingData?.weighted_summary || null,
        // v3.2 NEW fields
        conversational_condition_label: conversationalGradingData?.condition_label || null,
        conversational_final_grade_summary: conversationalGradingData?.final_grade_summary || null,
        conversational_image_confidence: conversationalGradingData?.image_confidence || null,
        conversational_case_detection: conversationalGradingData?.case_detection || null,
        conversational_slab_detection: conversationalGradingData?.slab_detection || null,  // 🆕 v4.0 JSON: Professional slab detection (PSA/BGS/SGC/CGC)
        // 🆕 v4.2: Front/Back Image Verification (mismatch detection)
        front_back_verified: conversationalGradingData?.front_back_verification?.images_match ?? null,
        front_back_verification_assessment: conversationalGradingData?.front_back_verification?.assessment || null,
        front_back_verification_confidence: conversationalGradingData?.front_back_verification?.confidence || null,
        front_back_verification_notes: conversationalGradingData?.front_back_verification
          ? JSON.stringify({
              discrepancies: conversationalGradingData.front_back_verification.discrepancies || [],
              explanation: conversationalGradingData.front_back_verification.explanation || '',
              special_case: conversationalGradingData.front_back_verification.special_case || null
            })
          : null,
        // 🆕 v3.8: Weakest Link Scoring
        conversational_weighted_sub_scores: conversationalGradingData?.weighted_sub_scores || null,
        conversational_limiting_factor: conversationalGradingData?.limiting_factor || null,
        conversational_preliminary_grade: conversationalGradingData?.preliminary_grade || null,
        conversational_validation_checklist: conversationalGradingData?.validation_checklist || null,
        conversational_front_summary: conversationalGradingData?.front_summary || null,
        conversational_back_summary: conversationalGradingData?.back_summary || null,
        conversational_card_info: conversationalGradingData?.card_info || null,  // 🔧 FIX: Save card_info for memorabilia/special features display
        conversational_corners_edges_surface: conversationalGradingData?.corners_edges_surface_json || null,  // 🆕 JSON details for corners/edges/surface (frontend display)
        conversational_prompt_version: conversationalGradingData?.meta?.prompt_version || 'v3.2',
        conversational_evaluated_at: conversationalGradingData?.meta?.evaluated_at_utc ? new Date(conversationalGradingData.meta.evaluated_at_utc) : new Date(),

        // Legacy ai_grading field for frontend compatibility
        ai_grading: legacyGrading,

        // Also update legacy fields for compatibility
        raw_decimal_grade: isNAGrade ? null : visionResult.recommended_grade.recommended_decimal_grade,
        dcm_grade_whole: isNAGrade ? null : visionResult.recommended_grade.recommended_whole_grade,

        // 🎯 Card info from Conversational AI (primary source)
        card_name: conversationalGradingData?.card_info?.card_name || card.card_name || visionResult.card_info.card_name,
        featured: conversationalGradingData?.card_info?.player_or_character || card.featured,
        card_set: conversationalGradingData?.card_info?.set_name || card.card_set,
        manufacturer_name: conversationalGradingData?.card_info?.manufacturer || card.manufacturer_name,
        release_date: conversationalGradingData?.card_info?.year || card.release_date,
        card_number: conversationalGradingData?.card_info?.card_number || card.card_number,
        rookie_card: conversationalGradingData?.card_info?.rookie_card !== undefined
          ? conversationalGradingData.card_info.rookie_card
          : card.rookie_card,
        autograph_type: conversationalGradingData?.card_info?.autographed
          ? 'on-card'
          : (card.autograph_type || 'none'),
        memorabilia_type: conversationalGradingData?.card_info?.memorabilia
          ? 'unknown'
          : (card.memorabilia_type || 'none'),
        rarity_tier: conversationalResultV3_3?.rarity_classification?.rarity_tier || conversationalGradingData?.card_info?.rarity_tier || card.rarity_tier,

        // 🆕 v3.3: Enhanced conversational grading fields
        ...(conversationalResultV3_3 && {
          // Rarity classification
          serial_number_fraction: conversationalResultV3_3.rarity_classification?.serial_number_fraction || null,
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

        // ✨ NEW: Structured defect data (v3.3 structured data migration)
        // 🔄 Use transformed defects from JSON mode if available, otherwise use parsed markdown
        conversational_defects_front: conversationalGradingData?.transformedDefects?.front || structuredDefects?.front || null,
        conversational_defects_back: conversationalGradingData?.transformedDefects?.back || structuredDefects?.back || null,
        conversational_centering: structuredCentering,
        conversational_metadata: structuredMetadata,

        // 🐛 DEBUG: Log what's being saved
        ...(console.log('[CONVERSATIONAL AI] 🐛 Saving to database:', {
          defects_front_exists: !!(conversationalGradingData?.transformedDefects?.front || structuredDefects?.front),
          defects_back_exists: !!(conversationalGradingData?.transformedDefects?.back || structuredDefects?.back),
          centering_exists: !!structuredCentering
        }), {}),

        // Image quality
        dvg_image_quality: visionResult.image_quality.grade,
        dvg_reshoot_required: metrics.reshootRequired,

        // Centering
        dvg_centering_front_lr: visionResult.centering.front_left_right_ratio_text,
        dvg_centering_front_tb: visionResult.centering.front_top_bottom_ratio_text,
        dvg_centering_back_lr: visionResult.centering.back_left_right_ratio_text,
        dvg_centering_back_tb: visionResult.centering.back_top_bottom_ratio_text,

        // Summary
        dvg_positives: visionResult.analysis_summary?.positives || [],
        dvg_negatives: visionResult.analysis_summary?.negatives || [],

        // Metadata
        dvg_model: visionResult.meta.model_name,
        dvg_version: visionResult.meta.version,

        // Professional grading slab detection (from conversational AI v3.2)
        slab_detected: slabDetected,
        slab_company: slabData?.company || null,
        slab_grade: slabData?.grade || null,
        slab_grade_description: slabData?.grade_description || null,
        slab_cert_number: slabData?.cert_number || null,
        slab_serial: slabData?.serial_number || null,
        slab_subgrades: slabData?.subgrades || null,
        slab_metadata: null, // v3.2 doesn't extract metadata yet
        ai_vs_slab_comparison: aiVsSlabComparison
      })
      .eq("id", cardId);

    if (updateError) {
      console.error(`[CONVERSATIONAL AI] Failed to update card:`, updateError);
      return NextResponse.json(
        { error: "Failed to save grading results" },
        { status: 500 }
      );
    }

    console.log(`[CONVERSATIONAL AI] DCM grading saved successfully`);

    // Stage 2: Detailed Inspection (comprehensive corner/edge/surface analysis)
    // ⚠️ DISABLED - Stage 2 paused per user request (2025-10-15)
    // Stage 1 now has comprehensive microscopic detection, Stage 2 not providing additional value
    // let detailedInspection: DetailedInspectionResult | undefined;

    // // Only perform detailed inspection for gradable cards (not N/A)
    // if (!isNAGrade) {
    //   try {
    //     console.log(`[STAGE 2 DISABLED] Starting detailed microscopic inspection...`);
    //     detailedInspection = await performDetailedInspection(visionResult, frontUrl, backUrl, {
    //       model: 'gpt-4o',
    //       temperature: 0.3
    //     });

    //     console.log(`[STAGE 2 DISABLED] Detailed inspection completed successfully`);

    //     // Check if Stage 2 adjusted the grade based on detailed findings
    //     const stage1Grade = visionResult.recommended_grade.recommended_decimal_grade;
    //     const stage2Grade = detailedInspection.detailed_inspection.final_grade_determination.stage2_final_grade;
    //     const gradeAdjusted = detailedInspection.detailed_inspection.final_grade_determination.grade_adjustment;

    //     if (gradeAdjusted && stage2Grade !== stage1Grade) {
    //       console.log(`[STAGE 2 DISABLED] Grade adjusted: ${stage1Grade} → ${stage2Grade}`);
    //       console.log(`[STAGE 2 DISABLED] Reason: ${detailedInspection.detailed_inspection.final_grade_determination.grade_adjustment_reason}`);

    //       // Update the main visionResult with Stage 2's final grade
    //       visionResult.recommended_grade.recommended_decimal_grade = stage2Grade;
    //       visionResult.recommended_grade.recommended_whole_grade = Math.round(stage2Grade);

    //       // Add Stage 2 adjustment note to analysis summary
    //       visionResult.analysis_summary.negatives.push(
    //         `Grade adjusted from ${stage1Grade} to ${stage2Grade} after detailed inspection: ${detailedInspection.detailed_inspection.final_grade_determination.grade_adjustment_reason}`
    //       );
    //     } else {
    //       console.log(`[STAGE 2 DISABLED] Grade confirmed at ${stage2Grade} (no adjustment needed)`);
    //     }

    //     // Merge detailed inspection into visionResult for complete data
    //     (visionResult as any).detailed_inspection = detailedInspection.detailed_inspection;

    //     // Update database with detailed inspection results and potentially adjusted grade
    //     const { error: inspectionUpdateError } = await supabase
    //       .from("cards")
    //       .update({
    //         // Update DVG grading with merged data (includes detailed inspection)
    //         dvg_grading: visionResult,
    //         // Update grade fields if adjusted
    //         dvg_decimal_grade: visionResult.recommended_grade.recommended_decimal_grade,
    //         dvg_whole_grade: visionResult.recommended_grade.recommended_whole_grade,
    //         // Update legacy fields for compatibility
    //         raw_decimal_grade: visionResult.recommended_grade.recommended_decimal_grade,
    //         dcm_grade_whole: visionResult.recommended_grade.recommended_whole_grade,
    //         // Update analysis summary with adjustment notes
    //         dvg_negatives: visionResult.analysis_summary.negatives
    //       })
    //       .eq("id", cardId);

    //     if (inspectionUpdateError) {
    //       console.error(`[STAGE 2 DISABLED] Failed to save detailed inspection:`, inspectionUpdateError);
    //       // Don't fail the whole request - Stage 1 grade is already saved
    //     } else {
    //       console.log(`[STAGE 2 DISABLED] Detailed inspection saved to database`);
    //       if (gradeAdjusted) {
    //         console.log(`[STAGE 2 DISABLED] Updated grade in database: ${stage2Grade}`);
    //       }
    //     }

    //     // Log detailed inspection summary
    //     const totalDefects = detailedInspection.detailed_inspection.final_grade_determination.total_defects.total;
    //     const cornerDefects = detailedInspection.detailed_inspection.final_grade_determination.total_defects.corners;
    //     const edgeDefects = detailedInspection.detailed_inspection.final_grade_determination.total_defects.edges;
    //     const surfaceDefects = detailedInspection.detailed_inspection.final_grade_determination.total_defects.surface;

    //     console.log(`[STAGE 2 DISABLED] Inspection Summary:`);
    //     console.log(`  - Total Defects: ${totalDefects} (Corners: ${cornerDefects}, Edges: ${edgeDefects}, Surface: ${surfaceDefects})`);
    //     console.log(`  - Component Grades: C${detailedInspection.detailed_inspection.final_grade_determination.component_grades.corners} E${detailedInspection.detailed_inspection.final_grade_determination.component_grades.edges} S${detailedInspection.detailed_inspection.final_grade_determination.component_grades.surface}`);

    //   } catch (inspectionError: any) {
    //     console.error(`[STAGE 2 DISABLED] Detailed inspection failed:`, inspectionError);
    //     // Don't fail the whole request - Stage 1 grade is already saved
    //     // Detailed inspection will be undefined in response
    //   }
    // } else {
    //   console.log(`[STAGE 2 DISABLED] Skipping detailed inspection for N/A grade`);
    // }

    console.log(`[CONVERSATIONAL AI] Stage 2 disabled - proceeding directly to Stage 3 (Professional Grading)`);

    // Stage 3: Estimate professional grades (PSA, BGS, SGC, CGC)
    // This is done asynchronously after DCM grading is saved
    let professionalGrades: VisionGradeResult['estimated_professional_grades'] | undefined;

    // Check if conversational AI already provided professional estimates (e.g., for AA grades)
    if (conversationalGradingData?.professional_grade_estimates) {
      console.log(`[CONVERSATIONAL AI] Using professional grade estimates from conversational AI response`);
      professionalGrades = conversationalGradingData.professional_grade_estimates;

      // Save to database
      try {
        const { error: profUpdateError } = await supabase
          .from("cards")
          .update({
            estimated_professional_grades: professionalGrades
          })
          .eq("id", cardId);

        if (profUpdateError) {
          console.error(`[CONVERSATIONAL AI] Failed to save professional grades from AI:`, profUpdateError);
        } else {
          console.log(`[CONVERSATIONAL AI] Professional grades from AI saved to database`);
        }
      } catch (error) {
        console.error(`[CONVERSATIONAL AI] Error saving professional grades:`, error);
      }
    }
    // Only estimate professional grades for gradable cards (not N/A) if AI didn't provide them
    else if (!isNAGrade) {
      try {
        console.log(`[CONVERSATIONAL AI] Starting professional grade estimation (deterministic mapper)...`);
        console.log(`[CONVERSATIONAL AI] visionResult centering:`, visionResult.centering);
        console.log(`[CONVERSATIONAL AI] visionResult grade:`, visionResult.recommended_grade.recommended_decimal_grade);
        professionalGrades = estimateProfessionalGradesWithDeterministicMapper(visionResult);

        console.log(`[CONVERSATIONAL AI] Professional grades estimated successfully (deterministic)`);
        console.log(`[CONVERSATIONAL AI] Professional grades result:`, JSON.stringify(professionalGrades, null, 2));

        // Update database with professional grades
        const { error: profUpdateError } = await supabase
          .from("cards")
          .update({
            estimated_professional_grades: professionalGrades
          })
          .eq("id", cardId);

        if (profUpdateError) {
          console.error(`[CONVERSATIONAL AI] Failed to save professional grades:`, profUpdateError);
          // Don't fail the whole request - DCM grade is already saved
        } else {
          console.log(`[CONVERSATIONAL AI] Professional grades saved to database`);
        }

      } catch (profError: any) {
        console.error(`[CONVERSATIONAL AI] Professional grade estimation failed:`, profError);
        // Don't fail the whole request - DCM grade is already saved
        // Professional grades will be undefined in response
      }
    } else {
      console.log(`[CONVERSATIONAL AI] Skipping professional grade estimation for N/A grade (no AI estimates provided)`);
    }

    // 🎴 Pokemon API Verification (Post-Grading)
    // For Pokemon cards, verify card details against Pokemon TCG API and persist
    let pokemonApiVerification = null;
    const cardCategory = conversationalGradingData?.card_info?.sport_or_category || card.category;

    if (cardCategory === 'Pokemon') {
      console.log(`[POKEMON API] Starting post-grading verification for Pokemon card`);
      try {
        // Call the Pokemon verify API endpoint
        const verifyResponse = await fetch(`${request.nextUrl.origin}/api/pokemon/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_id: cardId,
            card_info: conversationalGradingData?.card_info || null
          })
        });

        if (verifyResponse.ok) {
          pokemonApiVerification = await verifyResponse.json();
          console.log(`[POKEMON API] Verification complete:`, {
            verified: pokemonApiVerification.verified,
            pokemon_api_id: pokemonApiVerification.pokemon_api_id,
            confidence: pokemonApiVerification.confidence,
            corrections: pokemonApiVerification.corrections?.length || 0
          });

          // If corrections were made, log them
          if (pokemonApiVerification.corrections?.length > 0) {
            console.log(`[POKEMON API] Card info corrections applied:`, pokemonApiVerification.corrections);
          }
        } else {
          console.warn(`[POKEMON API] Verification request failed:`, verifyResponse.status);
        }
      } catch (pokemonError: any) {
        console.error(`[POKEMON API] Verification error:`, pokemonError.message);
        // Don't fail grading - Pokemon verification is optional enhancement
      }
    }

    // 🃏 MTG Scryfall API Verification (Post-Grading)
    // For MTG cards, verify card details against Scryfall API and persist
    let mtgApiVerification = null;

    if (cardCategory === 'MTG') {
      console.log(`[MTG API] Starting post-grading verification for MTG card`);
      try {
        // Call the MTG verify API endpoint
        const verifyResponse = await fetch(`${request.nextUrl.origin}/api/mtg/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_id: cardId,
            card_info: conversationalGradingData?.card_info || null
          })
        });

        if (verifyResponse.ok) {
          mtgApiVerification = await verifyResponse.json();
          console.log(`[MTG API] Verification complete:`, {
            verified: mtgApiVerification.verified,
            mtg_api_id: mtgApiVerification.mtg_api_id,
            confidence: mtgApiVerification.confidence,
            corrections: mtgApiVerification.corrections?.length || 0
          });

          // If corrections were made, log them
          if (mtgApiVerification.corrections?.length > 0) {
            console.log(`[MTG API] Card info corrections applied:`, mtgApiVerification.corrections);
          }
        } else {
          console.warn(`[MTG API] Verification request failed:`, verifyResponse.status);
        }
      } catch (mtgError: any) {
        console.error(`[MTG API] Verification error:`, mtgError.message);
        // Don't fail grading - MTG verification is optional enhancement
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`[CONVERSATIONAL AI] Complete grading process finished in ${processingTime}ms`);
    console.log(`[CONVERSATIONAL AI] About to return professional grades:`, professionalGrades ? 'EXISTS' : 'NULL');

    // Return complete result
    return NextResponse.json({
      id: cardId,
      // 🎯 Card info from Conversational AI (primary source)
      card_name: conversationalGradingData?.card_info?.card_name || visionResult.card_info.card_name,
      player: conversationalGradingData?.card_info?.player_or_character || visionResult.card_info.player_or_character,
      set_name: conversationalGradingData?.card_info?.set_name || visionResult.card_info.set_name,
      year: conversationalGradingData?.card_info?.year || visionResult.card_info.year,
      manufacturer: conversationalGradingData?.card_info?.manufacturer || visionResult.card_info.manufacturer,
      card_number: conversationalGradingData?.card_info?.card_number || visionResult.card_info.card_number,
      featured: conversationalGradingData?.card_info?.player_or_character || visionResult.card_info.player_or_character,
      rookie_card: conversationalGradingData?.card_info?.rookie_card,
      autographed: conversationalGradingData?.card_info?.autographed,
      memorabilia: conversationalGradingData?.card_info?.memorabilia,
      rarity_tier: conversationalGradingData?.card_info?.rarity_tier,

      // Grading results
      dvg_grading: visionResult,
      dvg_decimal_grade: isNAGrade ? null : visionResult.recommended_grade.recommended_decimal_grade,
      dvg_whole_grade: isNAGrade ? null : visionResult.recommended_grade.recommended_whole_grade,
      dvg_grade_uncertainty: visionResult.recommended_grade.grade_uncertainty,
      grading_status: visionResult.grading_status,

      // Professional grade estimates (PSA, BGS, SGC, CGC)
      estimated_professional_grades: professionalGrades || null,

      // 🎯 PRIMARY: Conversational AI grading v3.2 (2025-10-22)
      conversational_grading: conversationalGradingResult,
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_grade_uncertainty: conversationalGradingData?.grade_uncertainty || null,
      conversational_sub_scores: conversationalGradingData?.sub_scores || null,
      conversational_weighted_summary: conversationalGradingData?.weighted_summary || null,
      conversational_centering_ratios: conversationalGradingData?.centering_ratios || null,
      // v3.2 NEW fields
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_image_confidence: conversationalGradingData?.image_confidence || null,
      conversational_case_detection: conversationalGradingData?.case_detection || null,
      // 🆕 v3.8: Weakest Link Scoring
      conversational_weighted_sub_scores: conversationalGradingData?.weighted_sub_scores || null,
      conversational_limiting_factor: conversationalGradingData?.limiting_factor || null,
      conversational_preliminary_grade: conversationalGradingData?.preliminary_grade || null,
      conversational_validation_checklist: conversationalGradingData?.validation_checklist || null,
      conversational_front_summary: conversationalGradingData?.front_summary || null,
      conversational_back_summary: conversationalGradingData?.back_summary || null,
      conversational_card_info: conversationalGradingData?.card_info || null,
      conversational_corners_edges_surface: conversationalGradingData?.corners_edges_surface_json || null,  // 🆕 JSON details for corners/edges/surface
      conversational_meta: conversationalGradingData?.meta || null,

      // Legacy ai_grading for frontend compatibility
      ai_grading: legacyGrading,

      // Legacy compatibility
      raw_decimal_grade: isNAGrade ? null : visionResult.recommended_grade.recommended_decimal_grade,
      dcm_grade_whole: isNAGrade ? null : visionResult.recommended_grade.recommended_whole_grade,

      // Professional grading slab detection (from conversational AI v3.2)
      slab_detected: slabDetected,
      slab_company: slabData?.company || null,
      slab_grade: slabData?.grade || null,
      slab_grade_description: slabData?.grade_description || null,
      slab_cert_number: slabData?.cert_number || null,
      slab_serial: slabData?.serial_number || null,
      slab_subgrades: slabData?.subgrades || null,
      slab_metadata: null, // v3.2 doesn't extract metadata yet
      slab_confidence: null, // v3.2 doesn't provide confidence score
      slab_notes: null, // v3.2 doesn't provide notes
      ai_vs_slab_comparison: aiVsSlabComparison,

      // Image URLs
      front_url: frontUrl,
      back_url: backUrl,

      // Metadata
      processing_time: processingTime,
      grading_system: 'dvg-v2',
      reshoot_required: metrics.reshootRequired,
      image_quality: visionResult.image_quality.grade,

      // 🎴 Pokemon API Verification (for Pokemon cards only)
      pokemon_api_verification: pokemonApiVerification || null,

      // 🃏 MTG Scryfall API Verification (for MTG cards only)
      mtg_api_verification: mtgApiVerification || null
    });

  } catch (error: any) {
    console.error(`[CONVERSATIONAL AI] Unexpected error:`, error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  } finally {
    processingCards.delete(cardId);
  }
}
