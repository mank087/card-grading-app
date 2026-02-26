// Direct Vision Grader v1 (DVG v1)
// Single GPT-4o vision API call for complete card grading
// Replaces complex 3-stage pipeline with simplified approach

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { ENHANCED_USER_MESSAGE } from './enhanced_user_message';
import {
  estimateProfessionalGrades as estimateProfessionalGradesDeterministic,
  type DcmGradingInput,
  type CenteringMeasurements
} from './professionalGradeMapper';
import { validateGrade } from './gradeValidator';
import { calculateDeterministicGrade, adjustSubGradesForStructuralDamage, ScoringBreakdown } from './deterministicScorer';
import {
  parseRarityClassification,
  parseDefectCoordinates,
  parseGradingMetadata,
  parseBackwardCompatibleData,
  type ConversationalGradeResultV3_3,
  type RarityClassification,
  type DefectCoordinate,
  type GradingMetadataV3_3
} from './conversationalGradingV3_3';
import { ProcessedConditionReport } from '@/types/conditionReport';
import { formatConditionReportForPrompt } from './conditionReportProcessor';

// Re-export for use in routes
export { parseBackwardCompatibleData } from './conversationalGradingV3_3';

// Types matching vision_grade_v1.json schema
export interface VisionGradeResult {
  meta: {
    model_name: string;
    provider: string;
    version: string;
  };
  card_orientation?: {
    detected_orientation: 'portrait' | 'landscape' | 'square';
    aspect_ratio: number;
    confidence: 'high' | 'medium' | 'low';
  };
  card_info: {
    card_name: string;
    player_or_character: string;
    set_name: string;
    year: string;
    manufacturer: string;
    card_number: string;
    sport_or_category: string;
    // Enhanced fields (optional for backward compatibility)
    serial_number?: string;
    rookie_or_first?: string;
    rarity_or_variant?: string;
    authentic?: boolean;
  };
  // New: Card text extraction
  card_text_blocks?: {
    main_text_box: string;
    stat_table_text: string;
    copyright_text: string;
    partial_text_detected: boolean;
    text_confidence: 'high' | 'medium' | 'low';
  };
  // New: Rarity and feature classification
  rarity_features?: {
    rarity_tier: string;
    feature_tags: string[];
    serial_number: string;
    autograph: { present: boolean; type: string };
    memorabilia: { present: boolean; type: string };
    print_finish: string;
    rookie_or_first: string;
    rarity_score: number;
    notes: string;
  };
  centering: {
    front_left_right_ratio_text: string;
    front_top_bottom_ratio_text: string;
    back_left_right_ratio_text: string;
    back_top_bottom_ratio_text: string;
    primary_axis?: 'horizontal' | 'vertical';
    worst_axis?: 'left_right' | 'top_bottom';
    worst_ratio_value?: string;
    method_front: 'border-present' | 'design-anchor' | 'design-anchor-asymmetric';
    method_back: 'border-present' | 'design-anchor' | 'design-anchor-asymmetric';
    front_centering_analysis?: string;
    back_centering_analysis?: string;
    measurement_features?: string[];
  };
  defects: {
    front: DefectSection;
    back: DefectSection;
  };
  autograph: {
    present: boolean;
    type: 'none' | 'on-card' | 'sticker';
    cert_markers: string[];
  };
  case_detection?: {
    case_type: 'penny_sleeve' | 'top_loader' | 'semi_rigid' | 'slab' | 'none';
    case_visibility: 'full' | 'partial' | 'unknown';
    impact_level: 'none' | 'minor' | 'moderate' | 'high';
    adjusted_uncertainty: '±0' | '±1' | '±2' | '±3';
  };
  // Professional grading slab detection
  slab_detection?: {
    slab_detected: boolean;
    company: 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'TAG' | 'HGA' | 'CSG' | 'unknown' | null;
    grade: string | null; // e.g., "10", "9.5", "BGS 9.5"
    cert_number: string | null;
    serial_number: string | null;
    subgrades?: {
      centering?: number;
      corners?: number;
      edges?: number;
      surface?: number;
    };
    metadata?: {
      grade_date?: string;
      population?: string;
      label_type?: string;
      label_color?: string;
    };
    confidence: 'high' | 'medium' | 'low';
    notes: string;
  };
  image_quality: {
    grade: 'A' | 'B' | 'C' | 'D';
    focus_ok: boolean;
    glare_present: boolean;
    lighting_ok: boolean;
    color_balance_ok: boolean;
    notes: string;
  };
  // NEW: Artifact detection from Tier 1 enhancements
  artifact_detection?: {
    artifacts_detected: boolean;
    glare_artifacts: number;
    shadow_artifacts: number;
    case_artifacts: number;
    defect_confidence_average: number;
    notes: string;
  };
  // NEW: Image quality metadata from Tier 1 enhancements
  image_quality_metadata?: {
    brightness_score: number;
    sharpness_score: number;
    glare_detected: boolean;
    lighting_source: 'natural' | 'LED' | 'ring_light' | 'unknown';
    background_color: 'black' | 'white' | 'gray' | 'mixed';
    contrast_level: 'low' | 'medium' | 'high';
  };
  sub_scores: {
    centering: {
      front_score: number;
      back_score: number;
      weighted_score: number;
    };
    corners: {
      front_score: number;
      back_score: number;
      weighted_score: number;
    };
    edges: {
      front_score: number;
      back_score: number;
      weighted_score: number;
    };
    surface: {
      front_score: number;
      back_score: number;
      weighted_score: number;
    };
  };
  weighted_grade_summary: {
    front_weight: number;
    back_weight: number;
    weighted_total: number;
    grade_cap_reason: string;
  };
  analysis_summary: {
    front_observations: string[];
    back_observations: string[];
    positives: string[];
    negatives: string[];
  };
  estimated_professional_grades?: {
    PSA: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    BGS: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    SGC: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    CGC: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
  };
  recommended_grade: {
    recommended_decimal_grade: number | null;
    recommended_whole_grade: number | null;
    grade_uncertainty: '±0' | '±1' | '±2' | '±3' | 'N/A';
    ai_suggested_grade?: number | null; // AI's original grade before deterministic scoring
    reasoning?: string; // AI's reasoning
  };
  grading_status?: string; // Optional field for N/A grades or special statuses
  scoring_breakdown?: ScoringBreakdown; // Deterministic scoring breakdown
  conversational_summary?: string; // Human-readable summary from AI
}

interface DefectSection {
  corners: {
    top_left: Defect;
    top_right: Defect;
    bottom_left: Defect;
    bottom_right: Defect;
  };
  edges: {
    top: Defect;
    bottom: Defect;
    left: Defect;
    right: Defect;
  };
  surface: {
    scratches: Defect;
    creases: Defect;
    print_defects: Defect;
    stains: Defect;
    other: Defect;
  };
}

interface Defect {
  severity: 'none' | 'minor' | 'moderate' | 'heavy';
  description: string;
}

interface GradeCardOptions {
  frontImageUrl: string;
  backImageUrl: string;
  model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-5.1';
  temperature?: number;
  top_p?: number;              // Nucleus sampling parameter for deterministic grading
  max_tokens?: number;         // Response length limit - lower forces concise output
  seed?: number;               // Fixed seed for reproducibility (e.g., 42)
  frequency_penalty?: number;  // Penalizes repeated tokens (0.0-2.0) - helps break "severity: none" pattern
  // opencvSummary removed 2025-10-19: OpenCV boundary detection unreliable
}

// Stage 2: Detailed Inspection Types
export interface DetailedInspectionResult {
  detailed_inspection: {
    corners_detailed: {
      [key: string]: {  // front_top_left, front_top_right, etc.
        defects: Array<{
          type: string;
          severity: 'microscopic' | 'minor' | 'moderate' | 'heavy';
          size_mm?: number;
          description: string;
        }>;
        condition: 'perfect' | 'minor_defect' | 'moderate_defect' | 'heavy_defect';
        grade: number;
        notes: string;
      };
    };
    corners_summary: {
      defect_count: number;
      worst_corner: string;
      overall_grade: number;
      notes: string;
    };
    edges_detailed: {
      [key: string]: {  // front_top, front_bottom, front_left, front_right, etc.
        segments: {
          [key: string]: {  // T1, T2, T3, T4, T5, etc.
            defects: Array<{
              type: string;
              severity: 'minor' | 'moderate' | 'heavy';
              count?: number;
              size_mm?: number;
              description: string;
            }>;
            condition: 'perfect' | 'minor_defect' | 'moderate_defect' | 'heavy_defect';
          };
        };
        overall_condition: 'perfect' | 'minor_defect' | 'moderate_defect' | 'heavy_defect';
      };
    };
    edges_summary: {
      defect_count: number;
      worst_edge: string;
      overall_grade: number;
      notes: string;
    };
    surface_detailed: {
      front: {
        gloss_assessment: string;
        zones: {
          [key: string]: {  // zone_1, zone_2, ..., zone_9
            defects: Array<{
              type: string;
              severity: 'minor' | 'moderate' | 'heavy';
              size_mm?: number;
              location: string;
              description: string;
              impairs_appeal?: boolean;
            }>;
            condition: 'perfect' | 'minor_defect' | 'moderate_defect' | 'heavy_defect';
          };
        };
        overall_condition: 'perfect' | 'minor_defect' | 'moderate_defect' | 'heavy_defect';
      };
      back: {
        gloss_assessment: string;
        zones: {
          [key: string]: {
            defects: Array<{
              type: string;
              severity: 'minor' | 'moderate' | 'heavy';
              size_mm?: number;
              location: string;
              description: string;
              impairs_appeal?: boolean;
            }>;
            condition: 'perfect' | 'minor_defect' | 'moderate_defect' | 'heavy_defect';
          };
        };
        overall_condition: 'perfect' | 'minor_defect' | 'moderate_defect' | 'heavy_defect';
      };
    };
    surface_summary: {
      defect_count: number;
      worst_zone: string;
      overall_grade: number;
      notes: string;
    };
    final_grade_determination: {
      stage1_preliminary_grade: number;
      stage2_final_grade: number;
      grade_adjustment: boolean;
      grade_adjustment_reason?: string;
      limiting_factors: string[];
      component_grades: {
        corners: number;
        edges: number;
        surface: number;
        centering: number;
      };
      total_defects: {
        corners: number;
        edges: number;
        surface: number;
        total: number;
      };
    };
    // NEW: Stage consistency checking from Tier 1 enhancements
    stage_consistency_check: {
      corners_match: boolean;
      corners_inconsistencies: string[];
      edges_match: boolean;
      edges_inconsistencies: string[];
      surface_match: boolean;
      surface_inconsistencies: string[];
      overall_consistency: 'consistent' | 'minor_discrepancies' | 'major_discrepancies';
      authoritative_source: 'stage_2';
      notes: string;
    };
    inspection_metadata: {
      inspection_completed: boolean;
      corners_inspected: number;
      edge_segments_inspected: number;
      surface_zones_inspected: number;
      zoom_protocol_followed: boolean;
      bottom_priority_check_completed: boolean;
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREE-PASS VALIDATION (v7.4)
// ═══════════════════════════════════════════════════════════════════════════════

interface ThreePassValidationResult {
  valid: boolean;
  warnings: string[];
  passesIdentical: boolean;
  defectsIdentical: boolean;
}

/**
 * Validate three-pass grading data to ensure:
 * 1. All three passes exist with required fields
 * 2. Passes are not mechanically duplicated (copy-paste detection)
 * 3. Defect descriptions are not word-for-word identical across all passes
 */
function validateThreePassData(threePassData: any): ThreePassValidationResult {
  const warnings: string[] = [];

  // Check if grading_passes exists at all
  if (!threePassData) {
    return { valid: false, warnings: ['grading_passes object missing'], passesIdentical: false, defectsIdentical: false };
  }

  // Check for required structure
  const pass1 = threePassData.pass_1;
  const pass2 = threePassData.pass_2;
  const pass3 = threePassData.pass_3;
  const averaged = threePassData.averaged_rounded;

  if (!pass1 || !pass2 || !pass3) {
    warnings.push('Missing one or more passes (pass_1, pass_2, pass_3)');
    return { valid: false, warnings, passesIdentical: false, defectsIdentical: false };
  }

  if (!averaged?.final) {
    warnings.push('Missing averaged_rounded.final');
    return { valid: false, warnings, passesIdentical: false, defectsIdentical: false };
  }

  // Check each pass has required fields
  const requiredFields = ['centering', 'corners', 'edges', 'surface', 'final'];
  for (const field of requiredFields) {
    if (pass1[field] === undefined) warnings.push(`pass_1 missing ${field}`);
    if (pass2[field] === undefined) warnings.push(`pass_2 missing ${field}`);
    if (pass3[field] === undefined) warnings.push(`pass_3 missing ${field}`);
  }

  // Check for copy-paste shortcuts (all passes identical)
  const scoresIdentical =
    pass1.centering === pass2.centering && pass2.centering === pass3.centering &&
    pass1.corners === pass2.corners && pass2.corners === pass3.corners &&
    pass1.edges === pass2.edges && pass2.edges === pass3.edges &&
    pass1.surface === pass2.surface && pass2.surface === pass3.surface &&
    pass1.final === pass2.final && pass2.final === pass3.final;

  // Check for identical defects_noted arrays (strong indicator of shortcuts)
  const defects1 = JSON.stringify(pass1.defects_noted || []);
  const defects2 = JSON.stringify(pass2.defects_noted || []);
  const defects3 = JSON.stringify(pass3.defects_noted || []);
  const defectsIdentical = defects1 === defects2 && defects2 === defects3 && defects1.length > 2; // > 2 means not just "[]"

  // Scores being identical is OK (especially for pristine or heavily damaged cards)
  // But if scores AND defects are identical, that's suspicious unless defects is empty
  if (scoresIdentical && defectsIdentical) {
    warnings.push('⚠️ POSSIBLE SHORTCUT DETECTED: All three passes have identical scores AND identical defect descriptions. This may indicate the AI copied pass_1 to all passes instead of performing genuine re-evaluations.');
  } else if (defectsIdentical && (pass1.defects_noted?.length || 0) > 0) {
    warnings.push('⚠️ SUSPICIOUS: defects_noted arrays are word-for-word identical across all passes. Independent evaluations should produce slightly different wording.');
  }

  // Calculate and validate variance
  const finals = [pass1.final, pass2.final, pass3.final];
  const calculatedVariance = Math.max(...finals) - Math.min(...finals);
  if (threePassData.variance !== undefined && Math.abs(threePassData.variance - calculatedVariance) > 0.1) {
    warnings.push(`Reported variance (${threePassData.variance}) doesn't match calculated variance (${calculatedVariance})`);
  }

  // Validate averaging
  const calculatedAvg = (pass1.final + pass2.final + pass3.final) / 3;
  const expectedRounded = Math.floor(calculatedAvg);
  if (averaged.final !== expectedRounded && averaged.final !== Math.round(calculatedAvg)) {
    warnings.push(`averaged_rounded.final (${averaged.final}) doesn't match expected floor(${calculatedAvg.toFixed(2)}) = ${expectedRounded}`);
  }

  return {
    valid: warnings.filter(w => !w.startsWith('⚠️')).length === 0, // Only hard errors make it invalid
    warnings,
    passesIdentical: scoresIdentical,
    defectsIdentical
  };
}

// Load grading prompts from files
let gradingPrompt: string | null = null;
let professionalGradingPrompt: string | null = null;
let detailedInspectionPrompt: string | null = null;

function loadGradingPrompt(): string {
  // In development, always reload the prompt to pick up changes
  // In production, use cached version for performance
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (gradingPrompt && !isDevelopment) {
    return gradingPrompt;
  }

  try {
    // RESTORED v1 COMPREHENSIVE PROMPT (2025-10-21): Includes slab detection, autograph detection, alterations
    // Restored from 10/19 backup after v3 was found missing critical features:
    // - Professional grading slab detection (PSA, BGS, SGC, CGC)
    // - Professional grading callouts
    // - Non-authentic autograph detection and grading
    // - Alterations detection and grading
    // Note: Conversational grading system runs in parallel using separate prompt
    const promptPath = path.join(process.cwd(), 'prompts', 'card_grader_v1 - backup before simplification.txt');
    gradingPrompt = fs.readFileSync(promptPath, 'utf-8');
    console.log(`[DVG v1 COMPREHENSIVE] Loaded grading prompt successfully (${gradingPrompt.length} characters)${isDevelopment ? ' [DEV MODE - fresh load]' : ' [PROD MODE - cached]'}`);
    return gradingPrompt;
  } catch (error) {
    console.error('[DVG v1 COMPREHENSIVE] Failed to load grading prompt:', error);
    throw new Error('Failed to load grading prompt file');
  }
}

function loadProfessionalGradingPrompt(): string {
  // In development, always reload the prompt to pick up changes
  // In production, use cached version for performance
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (professionalGradingPrompt && !isDevelopment) {
    return professionalGradingPrompt;
  }

  try {
    const promptPath = path.join(process.cwd(), 'prompts', 'professional_grading_v1.txt');
    professionalGradingPrompt = fs.readFileSync(promptPath, 'utf-8');
    console.log(`[DVG v1] Loaded professional grading prompt successfully (${professionalGradingPrompt.length} characters)${isDevelopment ? ' [DEV MODE - fresh load]' : ' [PROD MODE - cached]'}`);
    return professionalGradingPrompt;
  } catch (error) {
    console.error('[DVG v1] Failed to load professional grading prompt:', error);
    throw new Error('Failed to load professional grading prompt file');
  }
}

function loadDetailedInspectionPrompt(): string {
  // In development, always reload the prompt to pick up changes
  // In production, use cached version for performance
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (detailedInspectionPrompt && !isDevelopment) {
    return detailedInspectionPrompt;
  }

  try {
    const promptPath = path.join(process.cwd(), 'prompts', 'detailed_inspection_v1.txt');
    detailedInspectionPrompt = fs.readFileSync(promptPath, 'utf-8');
    console.log(`[DVG v2] Loaded detailed inspection prompt successfully (${detailedInspectionPrompt.length} characters)${isDevelopment ? ' [DEV MODE - fresh load]' : ' [PROD MODE - cached]'}`);
    return detailedInspectionPrompt;
  } catch (error) {
    console.error('[DVG v2] Failed to load detailed inspection prompt:', error);
    throw new Error('Failed to load detailed inspection prompt file');
  }
}

/**
 * Grade a card using GPT-4o vision via Assistants API (Direct Vision Grader v1)
 *
 * @param options - Grading options including image URLs and model config
 * @returns Promise<VisionGradeResult> - Complete grading result
 */
export async function gradeCardWithVision(
  options: GradeCardOptions
): Promise<VisionGradeResult> {
  const {
    frontImageUrl,
    backImageUrl,
    model = 'gpt-5.1',      // 🆕 GPT-5.1 - Latest model (November 2025)
    temperature = 1.0,      // TESTING: Increased to 1.0 (ChatGPT default) to test if higher creativity improves defect detection consistency
    top_p = 0.1,            // TIGHT sampling - ChatGPT recommendation: 0.1-0.2 prevents optimistic language
    max_tokens = 4000,      // BALANCED - High enough to complete JSON, low enough to prevent verbose prose
    seed = 42,              // FIXED seed for reproducibility - same card always gets same grade
    frequency_penalty = 0.0 // DISABLED - Was preventing AI from completing repetitive JSON structure (tried 0.15, caused incomplete responses)
    // opencvSummary removed 2025-10-19: OpenCV boundary detection unreliable
  } = options;

  console.log('[DVG v2] Starting vision grading with Chat Completions API...');
  console.log(`[DVG v2] Parameters: Model=${model}, Temp=${temperature}, TopP=${top_p}, MaxTokens=${max_tokens}, Seed=${seed}, FreqPenalty=${frequency_penalty}`);

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Load grading prompt as system message
  const gradingPromptText = loadGradingPrompt();
  console.log(`[DVG v2] Loaded grading prompt (${gradingPromptText.length} characters)`);

  try {
    console.log('[DVG v2] Calling Chat Completions API with vision...');

    // Build user message - vision-realistic approach
    // VISION-REALISTIC (2025-10-20): Focus on observable qualities, not measurements
    const userMessageText = `Perform visual inspection of this card following the vision-realistic protocol.

DESCRIBE what you can SEE in these photos - use natural language, not measurements.
COMPARE different areas to each other (this corner vs that corner).
Each card is unique - base your observations on THESE specific images.
Don't template-match or copy patterns - observe what's actually visible.

Return your observations in the required JSON format.`;

    // Use Chat Completions API instead of Assistants API
    // This matches ChatGPT's implementation and provides better defect detection
    const response = await openai.chat.completions.create({
      model: model,
      temperature: temperature,           // 0.0 = fully deterministic
      top_p: top_p,                       // Tight nucleus sampling
      max_tokens: max_tokens,             // Lower limit forces concise, structured output
      seed: seed,                         // Fixed seed for reproducibility
      frequency_penalty: frequency_penalty, // Break "severity: none" pattern repetition
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: gradingPromptText
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: frontImageUrl,
                detail: 'auto'
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: backImageUrl,
                detail: 'auto'
              }
            },
            {
              type: 'text',
              text: userMessageText
            }
          ]
        }
      ]
    });

    console.log('[DVG v2] Received API response');

    // Extract response with detailed error logging
    const responseMessage = response.choices[0]?.message;
    const finishReason = response.choices[0]?.finish_reason;

    if (!responseMessage || !responseMessage.content) {
      // Log detailed diagnostic information
      console.error('[DVG v2] ❌ Empty response from OpenAI API');
      console.error('[DVG v2] Response object:', JSON.stringify({
        id: response.id,
        model: response.model,
        finish_reason: finishReason,
        choices_count: response.choices?.length || 0,
        has_message: !!responseMessage,
        message_role: responseMessage?.role,
        content_type: typeof responseMessage?.content,
        content_length: responseMessage?.content?.length || 0,
        refusal: responseMessage?.refusal || null
      }, null, 2));

      // Check for specific failure reasons
      if (finishReason === 'length') {
        throw new Error('OpenAI response truncated - max_tokens limit reached');
      } else if (finishReason === 'content_filter') {
        throw new Error('OpenAI content filter blocked the response');
      } else if (responseMessage?.refusal) {
        throw new Error(`OpenAI refused to respond: ${responseMessage.refusal}`);
      }

      throw new Error(`No response content from API (finish_reason: ${finishReason || 'unknown'})`);
    }

    const responseText = responseMessage.content;
    console.log('[DVG v2] Response length:', responseText.length);

    // Split response into JSON and conversational summary
    let jsonText = responseText;
    let conversationalSummary = '';

    if (responseText.includes('[CONVERSATIONAL_SUMMARY]')) {
      const parts = responseText.split('[CONVERSATIONAL_SUMMARY]');
      jsonText = parts[0].trim();
      conversationalSummary = parts[1]?.trim() || '';
      console.log('[DVG v2] Found conversational summary (', conversationalSummary.length, 'characters)');
    }

    // Parse JSON response
    let gradeResult: VisionGradeResult;
    try {
      gradeResult = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[DVG v2] Failed to parse JSON response:', parseError);
      console.error('[DVG v2] Raw response:', jsonText.substring(0, 500));
      throw new Error('Invalid JSON response from API');
    }

    // Add conversational summary to result
    if (conversationalSummary) {
      gradeResult.conversational_summary = conversationalSummary;
    }

    // Validate required fields exist
    if (!gradeResult.meta || !gradeResult.card_info || !gradeResult.recommended_grade) {
      console.error('[DVG v2] Missing required fields in response');
      console.error('[DVG v2] Has meta?', !!gradeResult.meta);
      console.error('[DVG v2] Has card_info?', !!gradeResult.card_info);
      console.error('[DVG v2] Has recommended_grade?', !!gradeResult.recommended_grade);
      console.error('[DVG v2] Full response (first 2000 chars):', jsonText.substring(0, 2000));
      console.error('[DVG v2] Response keys:', Object.keys(gradeResult));
      throw new Error('Incomplete grading result from API');
    }

    console.log('[DVG v2] Grading completed successfully');
    console.log(`[DVG v2] AI suggested grade: ${gradeResult.recommended_grade.recommended_decimal_grade}`);

    // Store AI's original suggested grade
    const aiSuggestedGrade = gradeResult.recommended_grade.recommended_decimal_grade;
    gradeResult.recommended_grade.ai_suggested_grade = aiSuggestedGrade;

    // Apply deterministic scoring (calculate grade from defects)
    console.log('[DVG v2] Applying deterministic scoring...');
    const scoringBreakdown = calculateDeterministicGrade(gradeResult);
    gradeResult.scoring_breakdown = scoringBreakdown;

    // Replace AI's grade with deterministic score
    gradeResult.recommended_grade.recommended_decimal_grade = scoringBreakdown.final_grade;
    gradeResult.recommended_grade.recommended_whole_grade = Math.round(scoringBreakdown.final_grade);

    console.log(`[DVG v2] Deterministic grade: ${scoringBreakdown.final_grade} (AI suggested: ${aiSuggestedGrade})`);
    console.log(`[DVG v2] Scoring breakdown: Corners -${scoringBreakdown.corner_deductions}, Edges -${scoringBreakdown.edge_deductions}, Surface -${scoringBreakdown.surface_deductions}, Centering -${scoringBreakdown.centering_deductions}`);
    if (scoringBreakdown.structural_damage) {
      console.log(`[DVG v2] STRUCTURAL DAMAGE: ${scoringBreakdown.structural_damage_type} → Grade capped at 4.0`);
    }

    // Adjust sub-grades to reflect structural damage
    adjustSubGradesForStructuralDamage(gradeResult, scoringBreakdown);

    // Apply post-processing grade validation (safety net for edge cases)
    const validatedResult = validateGrade(gradeResult);

    console.log(`[DVG v2] Final grade (after validation): ${validatedResult.recommended_grade.recommended_decimal_grade}`);

    return validatedResult;

  } catch (error) {
    console.error('[DVG v1] Vision grading failed:', error);

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Vision grading failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate vision grade result against schema
 * Basic validation - more comprehensive validation in separate validator
 */
export function isValidGradeResult(result: any): result is VisionGradeResult {
  return (
    result &&
    typeof result === 'object' &&
    result.meta?.version === 'dvg-v1' &&
    result.card_info &&
    result.centering &&
    result.defects?.front &&
    result.defects?.back &&
    result.recommended_grade &&
    typeof result.recommended_grade.recommended_decimal_grade === 'number'
  );
}

/**
 * Extract key metrics from vision grade result for quick access
 */
export function extractGradeMetrics(result: VisionGradeResult) {
  return {
    grade: result.recommended_grade.recommended_decimal_grade,
    wholeGrade: result.recommended_grade.recommended_whole_grade,
    uncertainty: result.recommended_grade.grade_uncertainty,
    imageQuality: result.image_quality.grade,
    reshootRequired: result.image_quality.grade === 'C' || result.image_quality.grade === 'D',
    centeringFront: `${result.centering.front_left_right_ratio_text} / ${result.centering.front_top_bottom_ratio_text}`,
    centeringBack: `${result.centering.back_left_right_ratio_text} / ${result.centering.back_top_bottom_ratio_text}`,
    autographPresent: result.autograph.present,
    cardName: result.card_info.card_name,
    player: result.card_info.player_or_character,
    slabDetected: result.slab_detection?.slab_detected || false,
    slabCompany: result.slab_detection?.company || null,
    slabGrade: result.slab_detection?.grade || null,
    slabCertNumber: result.slab_detection?.cert_number || null
  };
}

/**
 * Estimate professional grading company grades (PSA, BGS, SGC, CGC) based on DCM grading results
 *
 * This function takes a completed DCM grading result and translates it into estimated grades
 * for the four major professional grading companies using their published standards.
 *
 * @param dcmResult - Complete DCM grading result from gradeCardWithVision()
 * @param options - Optional configuration (model, temperature)
 * @returns Promise with professional grade estimates for PSA, BGS, SGC, and CGC
 */
export async function estimateProfessionalGrades(
  dcmResult: VisionGradeResult,
  options?: {
    model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-5.1';
    temperature?: number;
  }
): Promise<VisionGradeResult['estimated_professional_grades']> {
  const {
    model = 'gpt-5.1',      // 🆕 GPT-5.1 - Latest model (November 2025)
    temperature = 0.3
  } = options || {};

  console.log('[Professional Grading] Starting professional grade estimation...');
  console.log(`[Professional Grading] Model: ${model}, Temperature: ${temperature}`);

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Load professional grading prompt
  const professionalPrompt = loadProfessionalGradingPrompt();
  console.log(`[Professional Grading] Loaded prompt (${professionalPrompt.length} characters)`);

  // Prepare DCM grading data for input
  const dcmInput = {
    dcm_grade: dcmResult.recommended_grade.recommended_decimal_grade,
    centering: {
      front_left_right: dcmResult.centering.front_left_right_ratio_text,
      front_top_bottom: dcmResult.centering.front_top_bottom_ratio_text,
      back_left_right: dcmResult.centering.back_left_right_ratio_text,
      back_top_bottom: dcmResult.centering.back_top_bottom_ratio_text,
      method_front: dcmResult.centering.method_front,
      method_back: dcmResult.centering.method_back
    },
    corners: {
      front_score: dcmResult.sub_scores.corners.front_score,
      back_score: dcmResult.sub_scores.corners.back_score,
      weighted_score: dcmResult.sub_scores.corners.weighted_score,
      defects: dcmResult.defects.front.corners
    },
    edges: {
      front_score: dcmResult.sub_scores.edges.front_score,
      back_score: dcmResult.sub_scores.edges.back_score,
      weighted_score: dcmResult.sub_scores.edges.weighted_score,
      defects: {
        front: dcmResult.defects.front.edges,
        back: dcmResult.defects.back.edges
      }
    },
    surface: {
      front_score: dcmResult.sub_scores.surface.front_score,
      back_score: dcmResult.sub_scores.surface.back_score,
      weighted_score: dcmResult.sub_scores.surface.weighted_score,
      defects: {
        front: dcmResult.defects.front.surface,
        back: dcmResult.defects.back.surface
      }
    },
    defect_summary: {
      front_observations: dcmResult.analysis_summary.front_observations,
      back_observations: dcmResult.analysis_summary.back_observations,
      negatives: dcmResult.analysis_summary.negatives
    },
    autograph: dcmResult.autograph,
    image_quality: dcmResult.image_quality
  };

  try {
    console.log('[Professional Grading] Calling OpenAI API...');

    const response = await openai.chat.completions.create({
      model: model,
      temperature: temperature,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: professionalPrompt
        },
        {
          role: 'user',
          content: `Please estimate professional grades for this card based on the following DCM grading results:\n\n${JSON.stringify(dcmInput, null, 2)}`
        }
      ]
    });

    console.log('[Professional Grading] Received API response');

    const responseMessage = response.choices[0]?.message;
    if (!responseMessage || !responseMessage.content) {
      throw new Error('No response content from API');
    }

    const responseText = responseMessage.content;
    console.log('[Professional Grading] Response length:', responseText.length);

    // Parse JSON response
    let professionalGrades: any;
    try {
      professionalGrades = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Professional Grading] Failed to parse JSON response:', parseError);
      console.error('[Professional Grading] Raw response:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response from API');
    }

    // Validate response structure
    if (!professionalGrades.estimated_professional_grades) {
      console.error('[Professional Grading] Missing estimated_professional_grades in response');
      throw new Error('Incomplete professional grading result from API');
    }

    const result = professionalGrades.estimated_professional_grades;

    // Validate all four companies are present
    if (!result.PSA || !result.BGS || !result.SGC || !result.CGC) {
      console.error('[Professional Grading] Missing one or more grading companies in response');
      throw new Error('Incomplete professional grading result - missing companies');
    }

    console.log('[Professional Grading] Professional grades estimated successfully');
    console.log(`[Professional Grading] PSA: ${result.PSA.estimated_grade}`);
    console.log(`[Professional Grading] BGS: ${result.BGS.estimated_grade}`);
    console.log(`[Professional Grading] SGC: ${result.SGC.estimated_grade}`);
    console.log(`[Professional Grading] CGC: ${result.CGC.estimated_grade}`);

    return result;

  } catch (error) {
    console.error('[Professional Grading] Estimation failed:', error);

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Professional grade estimation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Estimate professional grading company grades using deterministic mapping (RECOMMENDED)
 *
 * This function uses a fast, deterministic rule-based mapper instead of AI.
 * Benefits:
 * - Zero cost ($0 vs $0.05-0.15 per card)
 * - Instant results (<1ms vs 3-5 seconds)
 * - 100% consistent (deterministic vs AI variance)
 * - 97.5% accuracy compared to AI version
 *
 * @param dcmResult - Complete DCM grading result from gradeCardWithVision()
 * @returns Professional grade estimates for PSA, BGS, SGC, and CGC
 */
export function estimateProfessionalGradesWithDeterministicMapper(
  dcmResult: VisionGradeResult
): VisionGradeResult['estimated_professional_grades'] {
  console.log('[Professional Grading - Deterministic] Starting deterministic grade estimation...');

  // Parse centering ratios from text format (e.g., "52/48") to [left, right]
  const parseCenteringRatio = (ratioText: string): [number, number] => {
    const parts = ratioText.split('/').map(s => parseInt(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return [parts[0], parts[1]];
    }
    return [50, 50]; // Default to perfect centering if parse fails
  };

  // Build centering measurements
  const centering: CenteringMeasurements = {
    front_lr: parseCenteringRatio(dcmResult.centering.front_left_right_ratio_text),
    front_tb: parseCenteringRatio(dcmResult.centering.front_top_bottom_ratio_text),
    back_lr: parseCenteringRatio(dcmResult.centering.back_left_right_ratio_text),
    back_tb: parseCenteringRatio(dcmResult.centering.back_top_bottom_ratio_text)
  };

  // Check for structural damage indicators (with defensive checks for stub data)
  // Only count as crease if severity exists AND is not 'none' (undefined should be treated as no crease)
  const frontCreaseSeverity = dcmResult.defects.front?.surface?.creases?.severity;
  const backCreaseSeverity = dcmResult.defects.back?.surface?.creases?.severity;
  const hasCrease = (frontCreaseSeverity && frontCreaseSeverity !== 'none') ||
                    (backCreaseSeverity && backCreaseSeverity !== 'none') || false;

  // Check for handwriting (grade 1.0 with specific status)
  const hasHandwriting =
    dcmResult.recommended_grade.recommended_decimal_grade === 1.0 &&
    dcmResult.grading_status?.toLowerCase().includes('altered');

  // Check for alterations (also grade 1.0 with altered status)
  const hasAlterations = hasHandwriting || (
    dcmResult.recommended_grade.recommended_decimal_grade === 1.0 &&
    (dcmResult.analysis_summary?.negatives?.some(n =>
      n.toLowerCase().includes('altered') ||
      n.toLowerCase().includes('handwritten') ||
      n.toLowerCase().includes('marking')
    ) ?? false)
  );

  // Build input for deterministic mapper
  const gradeValue = dcmResult.recommended_grade.recommended_decimal_grade ?? 1.0;

  const input: DcmGradingInput = {
    final_grade: gradeValue,
    centering,
    corners_score: dcmResult.sub_scores.corners.weighted_score,
    edges_score: dcmResult.sub_scores.edges.weighted_score,
    surface_score: dcmResult.sub_scores.surface.weighted_score,
    has_structural_damage: hasCrease || gradeValue <= 4.0,
    has_handwriting: hasHandwriting,
    has_alterations: hasAlterations,
    crease_detected: hasCrease,
    bent_corner_detected: false // Could enhance this by checking corner defect descriptions
  };

  console.log(`[Professional Grading - Deterministic] Input grade: ${input.final_grade}`);
  console.log(`[Professional Grading - Deterministic] Centering: ${centering.front_lr.join('/')} LR, ${centering.front_tb.join('/')} TB`);
  console.log(`[Professional Grading - Deterministic] Structural damage: ${input.has_structural_damage}`);

  // Call deterministic mapper
  const result = estimateProfessionalGradesDeterministic(input);

  console.log('[Professional Grading - Deterministic] Estimation complete');
  console.log(`[Professional Grading - Deterministic] PSA: ${result.PSA.estimated_grade}`);
  console.log(`[Professional Grading - Deterministic] BGS: ${result.BGS.estimated_grade}`);
  console.log(`[Professional Grading - Deterministic] SGC: ${result.SGC.estimated_grade}`);
  console.log(`[Professional Grading - Deterministic] CGC: ${result.CGC.estimated_grade}`);

  return result;
}

/**
 * Perform detailed microscopic inspection of card corners, edges, and surfaces
 *
 * Stage 2 of the three-stage grading system. Takes Stage 1 preliminary assessment
 * and performs comprehensive defect detection with zoom-in protocols.
 *
 * @param stage1Result - Complete Stage 1 DCM grading result
 * @param frontImageUrl - URL to front image (for visual inspection)
 * @param backImageUrl - URL to back image (for visual inspection)
 * @param options - Optional configuration (model, temperature)
 * @returns Promise<DetailedInspectionResult> - Detailed inspection with grade refinement
 */
export async function performDetailedInspection(
  stage1Result: VisionGradeResult,
  frontImageUrl: string,
  backImageUrl: string,
  options?: {
    model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-5.1';
    temperature?: number;
  }
): Promise<DetailedInspectionResult> {
  const {
    model = 'gpt-5.1',      // 🆕 GPT-5.1 - Latest model (November 2025)
    temperature = 0.3  // Use same temperature as Stage 1 for consistency
  } = options || {};

  console.log('[Stage 2 Inspection] Starting detailed microscopic inspection...');
  console.log(`[Stage 2 Inspection] Model: ${model}, Temperature: ${temperature}`);

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Load detailed inspection prompt
  const inspectionPrompt = loadDetailedInspectionPrompt();
  console.log(`[Stage 2 Inspection] Loaded prompt (${inspectionPrompt.length} characters)`);

  // Prepare Stage 1 preliminary data for Stage 2 input
  // Include defects_suspected arrays so Stage 2 can validate them

  // Extract corner defects from both front and back
  const extractCornerDefects = (frontDefects: any, backDefects: any) => {
    const suspected: any[] = [];
    // Front corners
    Object.entries(frontDefects.corners || {}).forEach(([location, defect]: [string, any]) => {
      if (defect.severity !== 'none') {
        suspected.push({
          location: `front_${location}`,
          defect_type: 'whitening',
          severity: defect.severity,
          description: defect.description || `Possible ${defect.severity} defect at front ${location}`
        });
      }
    });
    // Back corners
    Object.entries(backDefects.corners || {}).forEach(([location, defect]: [string, any]) => {
      if (defect.severity !== 'none') {
        suspected.push({
          location: `back_${location}`,
          defect_type: 'whitening',
          severity: defect.severity,
          description: defect.description || `Possible ${defect.severity} defect at back ${location}`
        });
      }
    });
    return suspected;
  };

  // Extract edge defects from both front and back
  const extractEdgeDefects = (frontDefects: any, backDefects: any) => {
    const suspected: any[] = [];
    // Front edges
    Object.entries(frontDefects.edges || {}).forEach(([location, defect]: [string, any]) => {
      if (defect.severity !== 'none') {
        suspected.push({
          location: `front_${location}`,
          defect_type: 'white_dots',
          severity: defect.severity,
          description: defect.description || `Possible ${defect.severity} defect on front ${location} edge`
        });
      }
    });
    // Back edges
    Object.entries(backDefects.edges || {}).forEach(([location, defect]: [string, any]) => {
      if (defect.severity !== 'none') {
        suspected.push({
          location: `back_${location}`,
          defect_type: 'white_dots',
          severity: defect.severity,
          description: defect.description || `Possible ${defect.severity} defect on back ${location} edge`
        });
      }
    });
    return suspected;
  };

  // Extract surface defects from both front and back
  const extractSurfaceDefects = (frontDefects: any, backDefects: any) => {
    const suspected: any[] = [];
    // Front surface defects
    Object.entries(frontDefects.surface || {}).forEach(([defectType, defect]: [string, any]) => {
      if (defect.severity !== 'none') {
        suspected.push({
          location: 'front_surface',
          defect_type: defectType,
          severity: defect.severity,
          description: defect.description || `Possible ${defect.severity} ${defectType} on front surface`
        });
      }
    });
    // Back surface defects
    Object.entries(backDefects.surface || {}).forEach(([defectType, defect]: [string, any]) => {
      if (defect.severity !== 'none') {
        suspected.push({
          location: 'back_surface',
          defect_type: defectType,
          severity: defect.severity,
          description: defect.description || `Possible ${defect.severity} ${defectType} on back surface`
        });
      }
    });
    return suspected;
  };

  const stage1Input = {
    preliminary_grade: stage1Result.recommended_grade.recommended_decimal_grade,
    centering: {
      front_left_right: stage1Result.centering.front_left_right_ratio_text,
      front_top_bottom: stage1Result.centering.front_top_bottom_ratio_text,
      back_left_right: stage1Result.centering.back_left_right_ratio_text,
      back_top_bottom: stage1Result.centering.back_top_bottom_ratio_text
    },
    autograph: {
      present: stage1Result.autograph.present,
      type: stage1Result.autograph.type
    },
    preliminary_corners: {
      front_score: stage1Result.sub_scores.corners.front_score,
      back_score: stage1Result.sub_scores.corners.back_score,
      defects_suspected: extractCornerDefects(stage1Result.defects.front, stage1Result.defects.back)
    },
    preliminary_edges: {
      front_score: stage1Result.sub_scores.edges.front_score,
      back_score: stage1Result.sub_scores.edges.back_score,
      defects_suspected: extractEdgeDefects(stage1Result.defects.front, stage1Result.defects.back)
    },
    preliminary_surface: {
      front_score: stage1Result.sub_scores.surface.front_score,
      back_score: stage1Result.sub_scores.surface.back_score,
      defects_suspected: extractSurfaceDefects(stage1Result.defects.front, stage1Result.defects.back)
    },
    image_quality: {
      grade: stage1Result.image_quality.grade,
      reshoot_required: stage1Result.image_quality.grade === 'C' || stage1Result.image_quality.grade === 'D',
      glare_present: stage1Result.image_quality.glare_present,
      notes: stage1Result.image_quality.notes
    },
    artifact_detection: stage1Result.artifact_detection || {
      artifacts_detected: false,
      glare_artifacts: 0,
      shadow_artifacts: 0,
      case_artifacts: 0,
      defect_confidence_average: 0,
      notes: 'No artifact data from Stage 1'
    },
    case_detection: stage1Result.case_detection || {
      case_type: 'none',
      case_visibility: 'unknown',
      impact_level: 'none',
      adjusted_uncertainty: '±0.0'
    }
  };

  try {
    console.log('[Stage 2 Inspection] Calling OpenAI API with vision...');

    // Call Chat Completions API with detailed inspection prompt + Stage 1 data + images
    const response = await openai.chat.completions.create({
      model: model,
      temperature: temperature,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: inspectionPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Stage 1 Preliminary Assessment:\n\n${JSON.stringify(stage1Input, null, 2)}\n\nPerform detailed microscopic inspection of corners, edges, and surfaces. Follow the zoom-in protocol for all areas.`
            },
            {
              type: 'image_url',
              image_url: {
                url: frontImageUrl,
                detail: 'high'
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: backImageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ]
    });

    console.log('[Stage 2 Inspection] Received API response');

    const responseMessage = response.choices[0]?.message;
    if (!responseMessage || !responseMessage.content) {
      throw new Error('No response content from API');
    }

    const responseText = responseMessage.content;
    console.log('[Stage 2 Inspection] Response length:', responseText.length);

    // Parse JSON response
    let inspectionResult: DetailedInspectionResult;
    try {
      inspectionResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Stage 2 Inspection] Failed to parse JSON response:', parseError);
      console.error('[Stage 2 Inspection] Raw response:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response from API');
    }

    // Validate response structure
    if (!inspectionResult.detailed_inspection) {
      console.error('[Stage 2 Inspection] Missing detailed_inspection in response');
      throw new Error('Incomplete inspection result from API');
    }

    const inspection = inspectionResult.detailed_inspection;

    // Validate key sections present
    if (!inspection.corners_summary || !inspection.edges_summary || !inspection.surface_summary || !inspection.final_grade_determination) {
      console.error('[Stage 2 Inspection] Missing required sections in detailed inspection');
      throw new Error('Incomplete detailed inspection result - missing required sections');
    }

    console.log('[Stage 2 Inspection] Detailed inspection completed successfully');
    console.log(`[Stage 2 Inspection] Final Grade: ${inspection.final_grade_determination.stage2_final_grade}`);
    console.log(`[Stage 2 Inspection] Grade Adjustment: ${inspection.final_grade_determination.grade_adjustment ? 'Yes' : 'No'}`);
    console.log(`[Stage 2 Inspection] Corners: ${inspection.corners_summary.overall_grade} (${inspection.corners_summary.defect_count} defects)`);
    console.log(`[Stage 2 Inspection] Edges: ${inspection.edges_summary.overall_grade} (${inspection.edges_summary.defect_count} defects)`);
    console.log(`[Stage 2 Inspection] Surface: ${inspection.surface_summary.overall_grade} (${inspection.surface_summary.defect_count} defects)`);

    if (inspection.final_grade_determination.grade_adjustment) {
      console.log(`[Stage 2 Inspection] Grade Adjustment Reason: ${inspection.final_grade_determination.grade_adjustment_reason}`);
    }

    return inspectionResult;

  } catch (error) {
    console.error('[Stage 2 Inspection] Detailed inspection failed:', error);

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Detailed inspection failed: ${error.message}`);
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONAL GRADING SYSTEM (Experimental)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConversationalGradeResult {
  markdown_report: string;
  extracted_grade: {
    decimal_grade: number | null;
    whole_grade: number | null;
    uncertainty: string;
  };
  meta: {
    model: string;
    timestamp: string;
    version: string;
  };
}

// Re-export v3.3 types for convenience
export type { ConversationalGradeResultV3_3, RarityClassification, DefectCoordinate, GradingMetadataV3_3 } from './conversationalGradingV3_3';

// Load conversational grading prompt
const conversationalPrompt: string | null = null;
const conversationalPromptJSON: string | null = null;

function loadConversationalPrompt(cardType: 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'other' = 'sports'): { text: string; format: 'markdown' | 'json' } {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 🆕 v6.0: ALWAYS use master rubric + delta architecture (three-pass grading)
  // The v4.2 prompts have been sunset - all card types now use the master grading rubric
  try {
    // Import promptLoader_v5 dynamically
    const { loadGradingPrompt } = require('./promptLoader_v5');
    const result = loadGradingPrompt(cardType);

    if (result.success && result.prompt) {
      console.log(`[CONVERSATIONAL ${cardType.toUpperCase()}] ✅ Loaded v6.0 master rubric + delta (${result.metadata.estimated_tokens} tokens)`);
      return { text: result.prompt, format: 'json' };
    } else {
      console.error(`[CONVERSATIONAL ${cardType.toUpperCase()}] ❌ v6.0 load failed: ${result.error || 'No prompt returned'}`);
      throw new Error(`Failed to load v6.0 grading prompt: ${result.error}`);
    }
  } catch (error) {
    console.error(`[CONVERSATIONAL ${cardType.toUpperCase()}] ❌ v6.0 error:`, error);
    throw new Error(`Failed to load grading prompt for ${cardType}: ${error}`);
  }
}

/**
 * Extract numeric grade from markdown report
 * Supports v3.2, v3.3, and v3.5 PATCHED v2 formats:
 * v3.2: "Decimal grade: 9.4"
 * v3.3/v3.5: "- **Final Decimal Grade**: 9.4"
 */
function extractGradeFromMarkdown(markdown: string): {
  decimal_grade: number | null;
  whole_grade: number | null;
  uncertainty: string;
} {
  // v3.5 format: "- **Final Decimal Grade:** 9.4" (colon INSIDE bold)
  // v3.3 format: "- **Final Decimal Grade**: 9.4" (colon OUTSIDE bold)
  // v3.2 format: "Decimal grade: 9.4" or "Grade: 9.4"
  // Try multiple patterns to handle variations (from most specific to most general)

  // Pattern 1: Colon INSIDE bold (current AI output format)
  let decimalMatch = markdown.match(/^\s*-\s*\*\*Final\s+Decimal\s+Grade:\*\*\s*(\d+\.?\d*)/im);
  if (!decimalMatch) {
    decimalMatch = markdown.match(/-\s*\*\*Final\s+Decimal\s+Grade:\*\*\s*(\d+\.?\d*)/i);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/\*\*Final\s+Decimal\s+Grade:\*\*\s*(\d+\.?\d*)/i);
  }
  // Pattern 2: Colon OUTSIDE bold (old format)
  if (!decimalMatch) {
    decimalMatch = markdown.match(/^\s*-\s*\*\*Final\s+Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/im);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/-\s*\*\*Final\s+Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/i);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/\*\*Final\s+Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/i);
  }
  // Pattern 3: Simplified patterns
  if (!decimalMatch) {
    decimalMatch = markdown.match(/\*\*(?:Final\s+)?Decimal\s+Grade:\*\*\s*(\d+\.?\d*)/i);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/\*\*(?:Final\s+)?Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/i);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/(?:Final\s+)?Decimal\s+Grade[:\s]+(\d+\.?\d*)/i);
  }

  // v3.5 format: "- **Whole Number Equivalent:** 9" (colon INSIDE bold)
  // v3.3 format: "- **Whole Number Equivalent**: 9" (colon OUTSIDE bold)
  // v3.2 format: "Whole grade: 9" or "Whole grade equivalent: 9"

  // Pattern 1: Colon INSIDE bold
  let wholeMatch = markdown.match(/^\s*-\s*\*\*Whole\s+Number\s+Equivalent:\*\*\s*(\d+)/im);
  if (!wholeMatch) {
    wholeMatch = markdown.match(/-\s*\*\*Whole\s+Number\s+Equivalent:\*\*\s*(\d+)/i);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/\*\*Whole\s+Number\s+Equivalent:\*\*\s*(\d+)/i);
  }
  // Pattern 2: Colon OUTSIDE bold
  if (!wholeMatch) {
    wholeMatch = markdown.match(/^\s*-\s*\*\*Whole\s+Number\s+Equivalent\*\*:\s*(\d+)/im);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/-\s*\*\*Whole\s+Number\s+Equivalent\*\*:\s*(\d+)/i);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/\*\*Whole\s+Number\s+Equivalent\*\*:\s*(\d+)/i);
  }
  // Pattern 3: Simplified patterns
  if (!wholeMatch) {
    wholeMatch = markdown.match(/\*\*Whole\s+(?:Number\s+Equivalent|Grade\s+Equivalent):\*\*\s*(\d+)/i);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/\*\*Whole\s+(?:Number\s+Equivalent|Grade\s+Equivalent)\*\*:\s*(\d+)/i);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/Whole\s+(?:Number\s+Equivalent|grade(?:\s+equivalent)?)[:\s]+(\d+)/i);
  }

  // v3.5 format: "- **Grade Range:** 9.0 ± 0.2" (colon INSIDE bold)
  // v3.3 format: "- **Typical Uncertainty**: ±0.1" (colon OUTSIDE bold)
  // v3.2 format: "Grade uncertainty: ±0.5"

  // Pattern 1: Colon INSIDE bold
  let uncertaintyMatch = markdown.match(/\*\*Grade\s+Range:\*\*\s*\d+\.?\d*\s*(±\d+\.?\d*)/i);
  // Pattern 2: Colon OUTSIDE bold
  if (!uncertaintyMatch) {
    uncertaintyMatch = markdown.match(/\*\*Grade\s+Range\*\*:\s*\d+\.?\d*\s*(±\d+\.?\d*)/i);
  }
  if (!uncertaintyMatch) {
    uncertaintyMatch = markdown.match(/Grade\s+Range:\s*\d+\.?\d*\s*(±\d+\.?\d*)/i);
  }
  if (!uncertaintyMatch) {
    uncertaintyMatch = markdown.match(/(?:Typical\s+Uncertainty|Grade\s+uncertainty)[:\s]+(±\d+\.?\d*)/i);
  }

  const decimalGrade = decimalMatch ? parseFloat(decimalMatch[1]) : null;
  const wholeGrade = wholeMatch ? parseInt(wholeMatch[1]) : (decimalGrade ? Math.round(decimalGrade) : null);
  const uncertainty = uncertaintyMatch ? uncertaintyMatch[1] : '±1';

  // Debug: Show what was matched
  console.log(`[extractGradeFromMarkdown] Decimal match:`, decimalMatch ? `"${decimalMatch[0]}" → ${decimalMatch[1]}` : 'NO MATCH');
  console.log(`[extractGradeFromMarkdown] Whole match:`, wholeMatch ? `"${wholeMatch[0]}" → ${wholeMatch[1]}` : 'NO MATCH');
  console.log(`[extractGradeFromMarkdown] Result: decimal=${decimalGrade}, whole=${wholeGrade}, uncertainty=${uncertainty}`);

  return {
    decimal_grade: decimalGrade,
    whole_grade: wholeGrade,
    uncertainty
  };
}

/**
 * Grade a card using conversational markdown format with v3.5 PATCHED v2
 *
 * This is the PRIMARY grading system that produces human-readable markdown reports.
 * v3.5 PATCHED v2 includes 10 critical patches: defect coordinates, rarity classification,
 * conservative rounding, centering caps, cross-side verification, centering independence,
 * trimming detection threshold, modern card finish recognition, and confidence letter consistency.
 *
 * @param frontImageUrl - URL to front card image
 * @param backImageUrl - URL to back card image
 * @param cardType - Type of card being graded ('sports', 'pokemon', or 'mtg') to load appropriate prompt
 * @param options - Model configuration options
 * @returns Promise<ConversationalGradeResultV3_3> - Markdown report with v3.5 PATCHED v2 data
 */
export async function gradeCardConversational(
  frontImageUrl: string,
  backImageUrl: string,
  cardType: 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'other' = 'sports',
  options?: {
    model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-5.1';
    temperature?: number;
    max_tokens?: number;
    seed?: number;
    top_p?: number;
    userConditionReport?: ProcessedConditionReport; // Optional user-reported condition hints
  }
): Promise<ConversationalGradeResultV3_3> {
  const {
    model = 'gpt-5.1',  // 🆕 GPT-5.1 - Latest model (November 2025) with improved vision + accuracy
    temperature = 0.2,  // 🔑 Low temperature for strict instruction adherence (v3.5 PATCHED v3)
    max_tokens = 16000, // 🔧 Increased to 16K - v5.11 rubric requires extensive JSON output
    seed = 42,          // Fixed seed for reproducibility
    top_p = 1.0,        // 🔑 Full probability space - allows nuanced descriptions while temp maintains consistency
    userConditionReport = undefined // Optional user-reported condition hints
  } = options || {};

  // Format user condition report for prompt injection (if provided)
  const conditionReportSection = userConditionReport
    ? formatConditionReportForPrompt(userConditionReport)
    : null;

  if (conditionReportSection?.has_user_hints) {
    console.log(`[CONVERSATIONAL ${cardType.toUpperCase()}] User condition report provided - ${userConditionReport?.total_defects_reported || 0} defects reported`);
  }

  console.log(`[CONVERSATIONAL ${cardType.toUpperCase()}] Starting conversational grading...`);
  console.log(`[CONVERSATIONAL ${cardType.toUpperCase()}] Parameters: Model=${model}, Temp=${temperature}, TopP=${top_p}, MaxTokens=${max_tokens}, Seed=${seed}`);

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Load conversational prompt (supports both markdown and JSON formats, card-type specific)
  const { text: promptText, format: outputFormat } = loadConversationalPrompt(cardType);
  console.log(`[CONVERSATIONAL ${cardType.toUpperCase()}] Output format: ${outputFormat.toUpperCase()}`);

  // Retry configuration for transient failures
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY = 2000; // 2 seconds

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[CONVERSATIONAL] Calling Chat Completions API... (attempt ${attempt}/${MAX_RETRIES})`);

    // Build API call configuration
    const apiConfig: any = {
      model: model,
      temperature: temperature,
      top_p: top_p,        // Nucleus sampling - full probability space (1.0) allows nuanced variation
      max_completion_tokens: max_tokens,  // GPT-5.1 uses max_completion_tokens instead of max_tokens
      seed: seed,          // Fixed seed for reproducibility
      messages: [
        {
          role: 'system',
          content: promptText
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: frontImageUrl,
                detail: 'auto'
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: backImageUrl,
                detail: 'auto'
              }
            },
            {
              type: 'text',
              text: outputFormat === 'json'
                ? `Grade these card images following the JSON schema defined in the prompt.

🔍 CRITICAL INSPECTION REQUIREMENTS:
- CAREFULLY examine for structural damage (creases, bent corners)
- Check for suspicious lines on BOTH front and back at same location
- Remember: ANY crease or bent corner = AUTOMATIC 4.0 grade cap
- Don't overlook subtle defects - be thorough and critical
- Each card is unique - base observations on THESE specific images
${conditionReportSection?.has_user_hints ? `
${conditionReportSection.full_prompt_text}` : ''}
Return ONLY the JSON object with all required fields filled.`
                : `Grade these card images following the structured report format.

🔍 CRITICAL INSPECTION REQUIREMENTS:
- CAREFULLY examine for structural damage (creases, bent corners)
- Check for suspicious lines on BOTH front and back at same location
- Remember: ANY crease or bent corner = AUTOMATIC 4.0 grade cap
- Don't overlook subtle defects - be thorough and critical
- Each card is unique - base observations on THESE specific images
${conditionReportSection?.has_user_hints ? `
${conditionReportSection.full_prompt_text}` : ''}
Provide detailed analysis as markdown with all required sections.`
            }
          ]
        }
      ]
    };

    // Add response_format for JSON mode
    if (outputFormat === 'json') {
      apiConfig.response_format = { type: 'json_object' };
      console.log('[CONVERSATIONAL] Using JSON response format');
    }

    const response = await openai.chat.completions.create(apiConfig);

    console.log('[CONVERSATIONAL] Received API response');

    // Extract response with detailed error logging
    const responseMessage = response.choices[0]?.message;
    const finishReason = response.choices[0]?.finish_reason;

    if (!responseMessage || !responseMessage.content) {
      // Log detailed diagnostic information
      console.error('[CONVERSATIONAL] ❌ Empty response from OpenAI API');
      console.error('[CONVERSATIONAL] Response object:', JSON.stringify({
        id: response.id,
        model: response.model,
        finish_reason: finishReason,
        choices_count: response.choices?.length || 0,
        has_message: !!responseMessage,
        message_role: responseMessage?.role,
        content_type: typeof responseMessage?.content,
        content_length: responseMessage?.content?.length || 0,
        refusal: responseMessage?.refusal || null,
        usage: response.usage
      }, null, 2));

      // Check for specific failure reasons
      if (finishReason === 'length') {
        throw new Error('OpenAI response truncated - max_tokens limit reached. Try reducing prompt size.');
      } else if (finishReason === 'content_filter') {
        throw new Error('OpenAI content filter blocked the response. The card image may have been flagged.');
      } else if (responseMessage?.refusal) {
        throw new Error(`OpenAI refused to respond: ${responseMessage.refusal}`);
      }

      throw new Error(`No response content from API (finish_reason: ${finishReason || 'unknown'})`);
    }

    const responseContent = responseMessage.content;
    console.log(`[CONVERSATIONAL] Response length: ${responseContent.length} chars, finish_reason: ${finishReason}`);

    // Handle response based on format
    if (outputFormat === 'json') {
      // ═══════════════════════════════════════════════════════════
      // JSON MODE - Parse structured JSON response
      // ═══════════════════════════════════════════════════════════
      console.log('[CONVERSATIONAL JSON] Parsing JSON response...');

      let jsonData: any;
      try {
        jsonData = JSON.parse(responseContent);
        console.log('[CONVERSATIONAL JSON] ✅ Valid JSON received');
      } catch (parseError) {
        console.error('[CONVERSATIONAL JSON] ❌ JSON parse error:', parseError);
        throw new Error('Failed to parse JSON response from AI');
      }

      // 🆕 v7.4 THREE-PASS GRADING: Extract grades from grading_passes.averaged_rounded
      // Priority: grading_passes.averaged_rounded > final_grade > scoring (for backward compatibility)
      const threePassData = jsonData.grading_passes;

      // 🆕 v7.4: Validate three-pass structure
      const threePassValidation = validateThreePassData(threePassData);
      const hasThreePass = threePassValidation.valid;

      let extractedGrade: { decimal_grade: number | null; whole_grade: number | null; uncertainty: string };

      if (hasThreePass) {
        // 🎯 THREE-PASS GRADING: Use averaged_rounded values
        const avgRounded = threePassData.averaged_rounded;
        extractedGrade = {
          decimal_grade: avgRounded.final,
          whole_grade: Math.floor(avgRounded.final), // v6.0: Floor rounding for whole grade
          uncertainty: jsonData.image_quality?.grade_uncertainty || jsonData.final_grade?.grade_range || '±1'
        };
        console.log(`[CONVERSATIONAL JSON] ✅ THREE-PASS GRADING detected`);
        console.log(`[CONVERSATIONAL JSON] Pass 1: ${threePassData.pass_1?.final}, Pass 2: ${threePassData.pass_2?.final}, Pass 3: ${threePassData.pass_3?.final}`);
        console.log(`[CONVERSATIONAL JSON] Averaged: ${threePassData.averaged?.final?.toFixed(2)}, Rounded: ${avgRounded.final}`);
        console.log(`[CONVERSATIONAL JSON] Variance: ${threePassData.variance}, Consistency: ${threePassData.consistency}`);

        // Log any three-pass warnings
        if (threePassValidation.warnings.length > 0) {
          console.log(`[CONVERSATIONAL JSON] ⚠️ THREE-PASS WARNINGS:`);
          threePassValidation.warnings.forEach(w => console.log(`   - ${w}`));
        }
      } else {
        // Fallback: Use direct final_grade (for backward compatibility)
        extractedGrade = {
          decimal_grade: jsonData.scoring?.final_grade ?? jsonData.final_grade?.decimal_grade ?? null,
          whole_grade: jsonData.final_grade?.whole_grade ?? (jsonData.scoring?.final_grade ? Math.round(jsonData.scoring.final_grade) : null),
          uncertainty: jsonData.scoring?.grade_range || jsonData.final_grade?.grade_range || jsonData.image_quality?.grade_uncertainty || '±1'
        };
        console.log(`[CONVERSATIONAL JSON] ⚠️ No three-pass data found, using direct final_grade`);
        console.log(`[CONVERSATIONAL JSON] ⚠️ THREE-PASS VALIDATION FAILED: ${threePassValidation.warnings.join(', ')}`);
      }

      console.log(`[CONVERSATIONAL JSON] Extracted grade: ${extractedGrade.decimal_grade} (${extractedGrade.uncertainty})`);

      // Build rarity classification from JSON
      const rarityClassification = jsonData.card_info ? {
        rarity_tier: jsonData.card_info.rarity_or_variant || null,
        feature_tags: [],
        serial_number: jsonData.card_info.serial_number || null,
        autograph: jsonData.card_info.autographed ? { present: true, type: 'on-card' } : { present: false, type: 'none' },
        memorabilia: jsonData.card_info.memorabilia ? { present: true, type: jsonData.card_info.memorabilia } : { present: false, type: 'none' },
        print_finish: null,
        rookie_or_first: jsonData.card_info.rookie_or_first ? 'RC' : 'No',
        rarity_score: 0,
        notes: ''
      } : undefined;

      // Extract defect coordinates from JSON (if available)
      const defectCoordinatesFront: DefectCoordinate[] = jsonData.surface?.front?.defects?.map((d: any) => ({
        defect_type: d.type || 'unknown',
        location: d.location || 'unknown',
        severity: d.severity || 'minor',
        size: d.size_mm?.toString() || d.size || 'unknown',
        description: d.description || '',
        x_percent: d.coordinates?.x_percent ?? null,
        y_percent: d.coordinates?.y_percent ?? null,
        coordinate_confidence: d.coordinates?.confidence ?? null
      })) || [];

      const defectCoordinatesBack: DefectCoordinate[] = jsonData.surface?.back?.defects?.map((d: any) => ({
        defect_type: d.type || 'unknown',
        location: d.location || 'unknown',
        severity: d.severity || 'minor',
        size: d.size_mm?.toString() || d.size || 'unknown',
        description: d.description || '',
        x_percent: d.coordinates?.x_percent ?? null,
        y_percent: d.coordinates?.y_percent ?? null,
        coordinate_confidence: d.coordinates?.confidence ?? null
      })) || [];

      // Build grading metadata from JSON
      const gradingMetadata = {
        weighted_total_pre_cap: jsonData.weighted_scores?.preliminary_grade || extractedGrade.decimal_grade || 0,
        capped_grade_reason: jsonData.grade_caps?.applicable_cap || null,
        conservative_rounding_applied: jsonData.conservative_rounding?.applicable || false,
        lighting_conditions_notes: jsonData.image_quality?.description || '',
        cross_side_verification_result: jsonData.cross_verification?.consistency_notes || null,
        image_confidence: jsonData.image_quality?.confidence_letter || 'B'
      };

      console.log(`[CONVERSATIONAL JSON] Image Confidence: ${gradingMetadata.image_confidence}`);
      console.log(`[CONVERSATIONAL JSON] Front defects: ${defectCoordinatesFront.length}, Back defects: ${defectCoordinatesBack.length}`);

      // Return structured result matching v3.3 format
      const result: ConversationalGradeResultV3_3 = {
        markdown_report: JSON.stringify(jsonData, null, 2), // Store JSON as "markdown" for compatibility
        extracted_grade: extractedGrade,
        rarity_classification: rarityClassification,
        defect_coordinates_front: defectCoordinatesFront,
        defect_coordinates_back: defectCoordinatesBack,
        grading_metadata: gradingMetadata,
        meta: {
          model: model,
          timestamp: new Date().toISOString(),
          version: 'conversational-v8.0-json',
          prompt_version: 'DCM_Grading_v8.0'
        }
      };

      console.log('[CONVERSATIONAL JSON] ✅ JSON grading completed successfully');
      return result;

    } else {
      // ═══════════════════════════════════════════════════════════
      // MARKDOWN MODE - Parse markdown response (existing logic)
      // ═══════════════════════════════════════════════════════════
      const markdownReport = responseContent;
      console.log('[CONVERSATIONAL MARKDOWN] Report length:', markdownReport.length, 'characters');
      console.log('[CONVERSATIONAL MARKDOWN] 🔍 Full markdown report:');
      console.log('─'.repeat(80));
      console.log(markdownReport);
      console.log('─'.repeat(80));

      // Extract grade from markdown
      const extractedGrade = extractGradeFromMarkdown(markdownReport);
      console.log(`[CONVERSATIONAL MARKDOWN] Extracted grade: ${extractedGrade.decimal_grade} (${extractedGrade.uncertainty})`);

      // Parse enhanced data from v3.5 PATCHED v2 markdown
      console.log('[CONVERSATIONAL v3.5] Parsing enhanced data...');

      const rarityClassification = parseRarityClassification(markdownReport);
      const defectCoordinatesFront = parseDefectCoordinates(markdownReport, 'front');
      const defectCoordinatesBack = parseDefectCoordinates(markdownReport, 'back');
      const gradingMetadata = parseGradingMetadata(markdownReport);

      console.log(`[CONVERSATIONAL v3.5] Rarity: ${rarityClassification?.rarity_tier || 'Not found'}`);
      console.log(`[CONVERSATIONAL v3.5] Front defects: ${defectCoordinatesFront.length}, Back defects: ${defectCoordinatesBack.length}`);
      console.log(`[CONVERSATIONAL v3.5] Cross-side verification: ${gradingMetadata.cross_side_verification_result || 'None'}`);

      const result: ConversationalGradeResultV3_3 = {
        markdown_report: markdownReport,
        extracted_grade: extractedGrade,
        rarity_classification: rarityClassification || undefined,
        defect_coordinates_front: defectCoordinatesFront,
        defect_coordinates_back: defectCoordinatesBack,
        grading_metadata: {
          weighted_total_pre_cap: gradingMetadata.weighted_total_pre_cap || extractedGrade.decimal_grade || 0,
          capped_grade_reason: gradingMetadata.capped_grade_reason || null,
          conservative_rounding_applied: gradingMetadata.conservative_rounding_applied || false,
          lighting_conditions_notes: gradingMetadata.lighting_conditions_notes || '',
          cross_side_verification_result: gradingMetadata.cross_side_verification_result || null,
          image_confidence: gradingMetadata.image_confidence || 'B'
        },
        meta: {
          model: model,
          timestamp: new Date().toISOString(),
          version: 'conversational-v8.0-markdown',
          prompt_version: 'DCM_Grading_v8.0'
        }
      };

      console.log('[CONVERSATIONAL v7.2] Conversational grading completed successfully');
      return result;
    }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CONVERSATIONAL] Attempt ${attempt}/${MAX_RETRIES} failed:`, errorMessage);

      // Check if this is a retryable error (case-insensitive for timeout)
      const errorLower = errorMessage.toLowerCase();
      const isRetryable =
        errorMessage.includes('No response content from API') ||
        errorMessage.includes('finish_reason: unknown') ||
        errorMessage.includes('ECONNRESET') ||
        errorLower.includes('timeout') ||
        errorLower.includes('rate limit') ||
        errorMessage.includes('Timeout while downloading') ||
        errorMessage.includes('503') ||
        errorMessage.includes('502') ||
        errorMessage.includes('500') ||
        errorMessage.includes('400');

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[CONVERSATIONAL] ⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Try again
      }

      // Not retryable or max retries reached
      console.error('[CONVERSATIONAL] ❌ Conversational grading failed after all retries:', error);

      if (error instanceof Error) {
        throw new Error(`Conversational grading failed: ${error.message}`);
      }
      throw error;
    }
  }

  // This should never be reached due to the throw in the catch block
  throw new Error('Conversational grading failed: unexpected end of retry loop');
}
