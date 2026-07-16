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
import { getConditionFromGrade } from './conditionAssessment';
import { runZoomInspection, ZoomResult, humanizeZoomRegion, verifyStructuralClaim } from './zoomInspection';
import { buildFinalSummary, reconcileFaceProse } from './gradeNarrator';

// Re-export for use in routes
export { parseBackwardCompatibleData } from './conversationalGradingV3_3';

// Single source of truth for the deployed prompt/engine version. Routes must stamp
// cards.conversational_prompt_version from this constant — the model-emitted
// meta.prompt_version is unreliable (echoes stale strings from prompt examples).
export const DCM_PROMPT_VERSION = 'DCM_Grading_v9.4.2';

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
// DEFECT COUNTING HELPER (v8.4 — for Grade 10 threshold)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Count defects per category and total across the AI response JSON.
 * Returns { corners, edges, surface, centering, total }
 * Used for Grade 10 threshold (total) and subgrade 10 exceptions (per-category).
 */
function countDefectsByCategory(jsonData: any): { corners: number; edges: number; surface: number; centering: number; total: number } {
  const counts = { corners: 0, edges: 0, surface: 0, centering: 0, total: 0 };
  try {
    // v9.0: support the CONVERSATIONAL shape (top-level corners/edges/surface sections,
    // each with .front/.back) — previously this only read the legacy VisionGradeResult
    // `jsonData.defects.{front,back}` shape and silently returned 0 for every live grade.
    if (!jsonData?.defects && (jsonData?.corners || jsonData?.edges || jsonData?.surface)) {
      for (const cat of ['corners', 'edges', 'surface'] as const) {
        for (const side of ['front', 'back']) {
          const sec = jsonData[cat]?.[side];
          if (!sec) continue;
          if (Array.isArray(sec.defects)) counts[cat] += sec.defects.length;
          // corner/edge sections also nest per-position objects with their own defects arrays
          for (const v of Object.values(sec) as any[]) {
            if (v && typeof v === 'object' && Array.isArray(v.defects)) counts[cat] += v.defects.length;
          }
        }
      }
      counts.total = counts.corners + counts.edges + counts.surface + counts.centering;
      return counts;
    }

    const defects = jsonData?.defects;
    if (!defects) return counts;

    for (const side of ['front', 'back']) {
      const sideData = defects[side];
      if (!sideData) continue;

      // Count corner defects
      if (sideData.corners) {
        for (const corner of Object.values(sideData.corners) as any[]) {
          if (corner?.defects && Array.isArray(corner.defects) && corner.defects.length > 0) {
            counts.corners += corner.defects.length;
          }
        }
      }

      // Count edge defects
      if (sideData.edges) {
        for (const edge of Object.values(sideData.edges) as any[]) {
          if (edge?.defects && Array.isArray(edge.defects) && edge.defects.length > 0) {
            counts.edges += edge.defects.length;
          }
        }
      }

      // Count surface defects
      if (sideData.surface?.defects && Array.isArray(sideData.surface.defects)) {
        counts.surface += sideData.surface.defects.length;
      }
    }
  } catch {
    // If structure is unexpected, assume defects exist (conservative)
    return { corners: 1, edges: 1, surface: 1, centering: 1, total: 4 };
  }
  counts.total = counts.corners + counts.edges + counts.surface + counts.centering;
  return counts;
}

/** Backward-compatible wrapper */
function countAllDefects(jsonData: any): number {
  return countDefectsByCategory(jsonData).total;
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
                detail: 'high' // v8.8: pinned (was 'auto' — OpenAI silently varied the resolution tier per call)
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: backImageUrl,
                detail: 'high' // v8.8: pinned (was 'auto')
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
/**
 * v8.8: Force every explicit final-grade claim inside the AI's narrative summary to match
 * the server-computed grade, and guarantee a canonical closing statement. The AI writes the
 * summary BEFORE the server clamps the grade, so without this a card can display "the final
 * grade is 8" next to a stored grade of 6 (observed in production, card eca620ab).
 */
export function reconcileSummaryWithGrade(summary: string | undefined | null, grade: number, conditionLabel: string): string {
  const canonical = `Final grade: ${grade} (${conditionLabel}).`;
  if (!summary || !summary.trim()) return canonical;

  let s = summary
    // "final grade of 8" / "final grade is 8" / "final grade: 8"
    .replace(/(final\s+grade\s*(?:of|is|:)?\s*)(\d{1,2}(?:\.\d)?)/gi, `$1${grade}`)
    // "overall grade of 8" / "grade of 8"
    .replace(/((?:overall\s+)?grade\s+of\s+)(\d{1,2}(?:\.\d)?)/gi, `$1${grade}`)
    // "receives/earns/warrants/yields/resulting in (a|an) (final grade of) 8"
    .replace(/((?:receives?|earns?|warrants?|yields?|yielding|resulting\s+in|results\s+in|graded(?:\s+at)?)\s+(?:a|an)?\s*(?:final\s+)?(?:grade\s+(?:of\s+)?)?)(\d{1,2}(?:\.\d)?)\b/gi, `$1${grade}`)
    // "8/10"
    .replace(/\b\d{1,2}(?:\.\d)?(\s*\/\s*10)\b/g, `${grade}$1`);

  // Guarantee the canonical statement is present and correct regardless of prose.
  if (!new RegExp(`final\\s+grade[^.!]*\\b${grade}\\b`, 'i').test(s)) {
    s = s.replace(/\s*$/, '') + ' ' + canonical;
  }
  return s;
}

/**
 * v9.0: DCM grades are INDEPENDENT — strip comparative grading-company references from
 * customer-facing narrative text (defense in depth behind the prompt prohibition).
 * Factual slab references ("encapsulated in the PSA slab") are preserved.
 */
export function scrubGradingCompanyReferences(text: string | undefined | null): string {
  if (!text) return text || '';
  return text
    // "equivalent to a PSA 9", "would likely receive a BGS 8.5", "meets the threshold for PSA 10"
    .replace(/\b(?:equivalent to|comparable to|consistent with|would (?:likely )?(?:receive|grade|earn|be)|meets? the threshold for|matching|aligns? with)\s+(?:a\s+|an\s+)?(?:PSA|BGS|CGC|SGC|Beckett|TAG|HGA|CSG)[\s-]*(?:\d+(?:\.\d+)?|Gem\s*Mint|Mint)?\s*(?:standards?|equivalents?|requirements?)?/gi,
      'per professional grading standards ')
    // Bare "PSA 9" style tokens (a digit follows the company) — slab facts like "PSA slab" are untouched
    .replace(/\b(?:PSA|BGS|CGC|SGC|Beckett|TAG|HGA|CSG)[\s-]+(\d+(?:\.\d+)?)\b/g, 'grade $1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1');
}

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
    temperature = 0.3,  // 🎯 v8.9: with the real n=3 ensemble, moderate diversity between the
                        // independent completions HELPS — the server-side median absorbs the noise.
                        // (At 0.1 the 3 samples are near-clones and the ensemble degenerates.)
    max_tokens = 16000, // 🔧 Increased to 16K - v5.11 rubric requires extensive JSON output
    top_p = 0.9,        // v8.9: widened with the median ensemble (was 0.5 in v8.8)
    seed = 7,           // 🔒 v8.8: Fixed seed restored (best-effort determinism; removed in v8.5)
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
  console.log(`[CONVERSATIONAL ${cardType.toUpperCase()}] Parameters: Model=${model}, Temp=${temperature}, TopP=${top_p}, MaxTokens=${max_tokens}`);

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Load conversational prompt (supports both markdown and JSON formats, card-type specific)
  const { text: promptText, format: outputFormat } = loadConversationalPrompt(cardType);
  console.log(`[CONVERSATIONAL ${cardType.toUpperCase()}] Output format: ${outputFormat.toUpperCase()}`);

  // v8.9 STAGE B: regioned zoom inspection runs IN PARALLEL with the main ensemble call
  // (both need only the image URLs), so it adds ~zero wall-clock. Findings merge into the
  // recalc below and can only LOWER scores. A zoom failure never fails the grade.
  const zoomPromise: Promise<ZoomResult> | null =
    outputFormat === 'json' ? runZoomInspection(frontImageUrl, backImageUrl) : null;

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
      top_p: top_p,
      max_completion_tokens: max_tokens,  // GPT-5.1 uses max_completion_tokens instead of max_tokens
      seed: seed,          // v8.8: best-effort determinism — same card + same images → same grade
      n: outputFormat === 'json' ? 3 : 1, // v8.9: ENSEMBLE — 3 independent completions in ONE call,
                                          // decoded in parallel server-side (≈ single-completion latency).
                                          // Median consensus computed below. Replaces the fake in-output
                                          // three-pass system (one completion copying itself 3×).
      // v9.3: ONE shared cache key for all card types. The ~72K-token master rubric
      // precedes the per-type delta in every prompt, so all 8 types share the same
      // cache prefix — but per-type keys routed each type to its own shard, measured
      // live (2026-07-10) as a 0% cross-type hit right after a 100% same-type hit.
      // Low-volume types (lorcana/ygo/starwars/mtg) were cold-missing ~every call
      // (~$0.10/card extra). A shared key lets any grade warm the prefix for all
      // types; the delta suffix past the shared prefix is billed fresh either way.
      // Routing-only: zero effect on model output.
      prompt_cache_key: 'dcm-grader-rubric-v5',
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
                detail: 'high' // v8.8: pinned (was 'auto' — OpenAI silently varied the resolution tier per call)
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: backImageUrl,
                detail: 'high' // v8.8: pinned (was 'auto')
              }
            },
            {
              type: 'text',
              text: outputFormat === 'json'
                ? `Grade these card images following the JSON schema defined in the prompt.

🔍 GRADING REQUIREMENTS:
- Check for structural damage (creases, bent corners) — ANY crease or bent corner = AUTOMATIC 4.0 grade cap
- MANDATORY CARD FLATNESS CHECK on both faces: is the card's outline straight on all four edges? Any corner or edge lifting off the surface (shadows/gaps under the card)? Any abrupt lighting-plane break along a line (bright band meeting dull band = fold)? A line crossing design boundaries on BOTH faces at the same location = crease. A card that does not lie flat is NEVER 8+.
- Check for suspicious lines on BOTH front and back at same location
- Grade accurately based on what you can genuinely see — report real defects honestly, do not invent defects
- If the card appears clean after thorough inspection, Grade 10 is the correct result
- Remember: photo-based grading has resolution limits — ambiguous marks at extreme zoom that could be JPEG artifacts should NOT be treated as defects
- Each card is unique - base observations on THESE specific images
${conditionReportSection?.has_user_hints ? `
${conditionReportSection.full_prompt_text}` : ''}
Return ONLY the JSON object with all required fields filled.`
                : `Grade these card images following the structured report format.

🔍 GRADING REQUIREMENTS:
- Check for structural damage (creases, bent corners) — ANY crease or bent corner = AUTOMATIC 4.0 grade cap
- Check for suspicious lines on BOTH front and back at same location
- Grade accurately based on what you can genuinely see — report real defects honestly, do not invent defects
- If the card appears clean after thorough inspection, Grade 10 is the correct result
- Remember: photo-based grading has resolution limits — ambiguous marks at extreme zoom that could be JPEG artifacts should NOT be treated as defects
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

    // v8.8: log real prompt-cache performance — previously only logged on the error path,
    // leaving us blind to whether the ~78k-token system prompt was actually being cached.
    const usage: any = (response as any).usage;
    if (usage) {
      const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
      console.log(`[CONVERSATIONAL] Tokens: prompt=${usage.prompt_tokens} (cached=${cachedTokens}, ${usage.prompt_tokens ? Math.round((cachedTokens / usage.prompt_tokens) * 100) : 0}% hit), completion=${usage.completion_tokens}`);
    }

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
      // JSON MODE — v8.9 ENSEMBLE: parse every completion (n=3)
      // ═══════════════════════════════════════════════════════════
      console.log('[CONVERSATIONAL JSON] Parsing ensemble completions...');

      const candidates: any[] = [];
      for (const choice of response.choices) {
        const content = choice?.message?.content;
        if (!content) continue;
        try { candidates.push(JSON.parse(content)); }
        catch { console.warn('[CONVERSATIONAL JSON] ⚠️ Discarding unparseable ensemble completion'); }
      }
      if (candidates.length === 0) {
        throw new Error('Failed to parse JSON response from AI');
      }
      console.log(`[CONVERSATIONAL JSON] ✅ ${candidates.length}/${response.choices.length} ensemble completions parsed`);

      // Per-completion category scores: prefer weighted_scores (= MIN of faces per the
      // rubric), fall back to MIN(raw faces), then the section objects' per-face scores.
      const catScore = (j: any, cat: string): number | null => {
        const w = j.weighted_scores?.[`${cat}_weighted`];
        if (typeof w === 'number') return w;
        const f = j.raw_sub_scores?.[`${cat}_front`], b = j.raw_sub_scores?.[`${cat}_back`];
        if (typeof f === 'number' && typeof b === 'number') return Math.min(f, b);
        const sf = j[cat]?.front?.score, sb = j[cat]?.back?.score;
        if (typeof sf === 'number' && typeof sb === 'number') return Math.min(sf, sb);
        return null;
      };
      const finalOf = (j: any): number | null => {
        const d = j.final_grade?.decimal_grade;
        if (typeof d === 'number') return d;
        const cats = ['centering', 'corners', 'edges', 'surface'].map(c => catScore(j, c));
        return cats.every(v => typeof v === 'number') ? Math.min(...(cats as number[])) : null;
      };

      const scored = candidates
        .map(j => ({
          j,
          final: finalOf(j),
          cats: {
            centering: catScore(j, 'centering'),
            corners: catScore(j, 'corners'),
            edges: catScore(j, 'edges'),
            surface: catScore(j, 'surface'),
          },
        }))
        .filter(x => x.final != null && Object.values(x.cats).every(v => v != null));
      if (scored.length === 0) {
        throw new Error('No ensemble completion contained usable scores');
      }

      // MEDIAN-PICK: the completion whose final grade is the median becomes the displayed
      // result (identity, narratives, per-face detail). The other completions feed only
      // the consensus math and the uncertainty band.
      const byFinal = [...scored].sort((a, b) => (a.final! - b.final!));
      let base = byFinal[Math.floor((byFinal.length - 1) / 2)];

      // 🚨 STRUCTURAL-DAMAGE MINORITY REPORT (v8.9): structural damage must NOT be
      // median-outvoted. The failure costs are asymmetric — a creased card sold as
      // "Mint" is a guaranteed customer dispute; a conservative grade is a support
      // ticket. If ANY completion affirmatively detected structural damage, that
      // completion becomes the base (lowest-final detector if several).
      const structuralDetectors = byFinal.filter(x => x.j?.structural_damage?.detected === true);
      const structuralDisagreement = structuralDetectors.length > 0 && structuralDetectors.length < scored.length;
      // v9.1: only let a structural detection override the median-pick when a MAJORITY
      // of completions agree. A lone completion misreading a foil reflection / embossed
      // line as a crease should not hijack the narrative (and the cap requires the same
      // corroboration downstream). Zoom-confirmed structural still applies via the merge.
      const structuralMajority = structuralDetectors.length >= Math.ceil(scored.length / 2);
      if (structuralMajority && base.j?.structural_damage?.detected !== true) {
        base = structuralDetectors[0]; // lowest final among detectors (byFinal is sorted)
        console.log(`[CONVERSATIONAL JSON] 🚨 Structural damage reported by ${structuralDetectors.length}/${scored.length} completions (majority) — overriding median-pick with the detecting completion (final=${base.final})`);
      } else if (structuralDetectors.length > 0) {
        console.log(`[CONVERSATIONAL JSON] structural flagged by ${structuralDetectors.length}/${scored.length} (not majority) — keeping median-pick; cap decision deferred to corroboration check`);
      }
      const jsonData: any = base.j;
      console.log(`[CONVERSATIONAL JSON] Ensemble finals: [${scored.map(x => x.final).join(', ')}] → base=${base.final}${structuralDetectors.length ? ` (structural detections: ${structuralDetectors.length})` : ''}`);

      // Compact per-completion defect list for the synthesized pass records (keeps the
      // stored/display shape informative with REAL per-evaluation content)
      const defectListOf = (j: any): string[] => {
        const out: string[] = [];
        const walk = (node: any, depth: number) => {
          if (!node || typeof node !== 'object' || depth > 4 || out.length >= 6) return;
          if (Array.isArray((node as any).defects)) {
            for (const d of (node as any).defects) {
              if (out.length < 6 && typeof d === 'string') out.push(d);
            }
          }
          for (const v of Object.values(node)) walk(v, depth + 1);
        };
        for (const cat of ['centering', 'corners', 'edges', 'surface']) walk(j[cat], 0);
        return out;
      };

      // Synthesize grading_passes from the REAL independent completions so every
      // downstream consumer (routes, card detail, PDFs) keeps its existing shape.
      // Pad by repeating the base if fewer than 3 completions survived parsing.
      const passSrc = [scored[0], scored[1] ?? base, scored[2] ?? base];
      const finalsArr = passSrc.map(x => x.final as number);
      const medOf = (vals: number[]) => vals.slice().sort((a, b) => a - b)[1];
      const preMed = {
        centering: medOf(passSrc.map(x => x.cats.centering as number)),
        corners: medOf(passSrc.map(x => x.cats.corners as number)),
        edges: medOf(passSrc.map(x => x.cats.edges as number)),
        surface: medOf(passSrc.map(x => x.cats.surface as number)),
        final: medOf(finalsArr),
      };
      const finalSpread = Math.max(...finalsArr) - Math.min(...finalsArr);
      jsonData.grading_passes = {
        pass_1: { ...passSrc[0].cats, final: passSrc[0].final, defects_noted: defectListOf(passSrc[0].j) },
        pass_2: { ...passSrc[1].cats, final: passSrc[1].final, defects_noted: defectListOf(passSrc[1].j) },
        pass_3: { ...passSrc[2].cats, final: passSrc[2].final, defects_noted: defectListOf(passSrc[2].j) },
        // Prefilled so validateThreePassData accepts the synthesized object; the recalc
        // below recomputes and overwrites these with the authoritative values.
        averaged: { ...preMed },
        averaged_rounded: { ...preMed },
        variance: finalSpread,
        consistency: finalSpread === 0 ? 'high' : finalSpread <= 1 ? 'moderate' : 'low', // 'moderate' matches the display components + card.ts type
        consensus_notes: [`v8.9 server-side ensemble: ${scored.length} independent completions (n=${response.choices.length}), median consensus`],
      };

      // 🆕 v8.4 THREE-PASS GRADING: Backend recalculation from raw pass data
      // Priority: Server-side recalculation > AI's averaged_rounded > final_grade > scoring
      const threePassData = jsonData.grading_passes;

      // v8.9: the passes object is synthesized by US from parsed completions — it is valid
      // by construction. The legacy validator rejects wide variance (e.g. a structural-damage
      // disagreement like [3,10,9]) which is precisely when the ensemble math matters most,
      // so it is advisory-only here.
      const threePassValidation = validateThreePassData(threePassData);
      if (!threePassValidation.valid) {
        console.log(`[GRADE RECALC] (advisory) legacy validator flags on synthesized ensemble: ${threePassValidation.warnings.join('; ')}`);
      }
      const hasThreePass = true;

      let extractedGrade: { decimal_grade: number | null; whole_grade: number | null; uncertainty: string };

      if (hasThreePass) {
        const pass1 = threePassData.pass_1;
        const pass2 = threePassData.pass_2;
        const pass3 = threePassData.pass_3;

        // 🎯 v8.4: SERVER-SIDE RECALCULATION — don't trust AI math
        // Step 1: Recalculate averaged scores from raw pass data
        const serverAvg = {
          centering: (pass1.centering + pass2.centering + pass3.centering) / 3,
          corners: (pass1.corners + pass2.corners + pass3.corners) / 3,
          edges: (pass1.edges + pass2.edges + pass3.edges) / 3,
          surface: (pass1.surface + pass2.surface + pass3.surface) / 3,
          final: (pass1.final + pass2.final + pass3.final) / 3
        };

        // Step 2 (v8.9): MEDIAN consensus across the independent ensemble completions.
        // Median is robust to a single outlier evaluation (mean is not): (9,9,6) → 9.
        // It also subsumes the old v8.5 consensusBoost — median of (10,10,9) is 10.
        const med3 = (a: number, b: number, c: number) => [a, b, c].sort((x, y) => x - y)[1];
        const [f1, f2, f3] = [pass1.final, pass2.final, pass3.final];
        const boostedAvg = {
          centering: med3(pass1.centering, pass2.centering, pass3.centering),
          corners: med3(pass1.corners, pass2.corners, pass3.corners),
          edges: med3(pass1.edges, pass2.edges, pass3.edges),
          surface: med3(pass1.surface, pass2.surface, pass3.surface),
          final: med3(f1, f2, f3)
        };

        // Step 3: Round subgrades to whole integers using STANDARD rounding (v8.5)
        // Standard rounding: 9.5 → 10, 9.4 → 9, 8.5 → 9, 8.4 → 8
        // This replaces floor rounding which systematically suppressed grades
        const defectCounts = countDefectsByCategory(jsonData);

        function roundSubgrade(avg: number, categoryName: string): number {
          const rounded = Math.round(avg);
          console.log(`[GRADE RECALC] ${categoryName}: avg=${avg.toFixed(2)} → rounded=${rounded}`);
          return rounded;
        }

        const serverRounded = {
          centering: roundSubgrade(boostedAvg.centering, 'centering'),
          corners: roundSubgrade(boostedAvg.corners, 'corners'),
          edges: roundSubgrade(boostedAvg.edges, 'edges'),
          surface: roundSubgrade(boostedAvg.surface, 'surface'),
          final: Math.round(boostedAvg.final) // standard rounding for final too
        };

        // Step 3.5 (v8.7): Enforce the rubric's weakest-link invariant at the FACE level.
        // Rubric Section 1.16 + raw_sub_scores spec: category subgrade = MIN(front, back).
        // The three-pass average above can drift ABOVE MIN(front,back) when a pass reports a
        // holistic category score that isn't the min of its own faces (e.g. corners=8 while
        // its faces are 7/7). Averaging those (8,8,7 -> 7.67 -> 8) yields a subgrade higher
        // than both displayed faces, which is impossible under weakest-link and looks broken.
        // Clamp each subgrade down to the weaker of its two faces. This only ever LOWERS a
        // subgrade, so it preserves weakest-link behavior and never inflates a grade.
        if (jsonData.raw_sub_scores) {
          const faceCats = ['centering', 'corners', 'edges', 'surface'] as const;
          for (const cat of faceCats) {
            const f = jsonData.raw_sub_scores[`${cat}_front`];
            const b = jsonData.raw_sub_scores[`${cat}_back`];
            if (f != null && b != null) {
              const faceMin = Math.min(f, b);
              if (serverRounded[cat] > faceMin) {
                console.log(`[GRADE RECALC] 🔒 ${cat}: subgrade ${serverRounded[cat]} exceeded MIN(front,back)=${faceMin} (F:${f} B:${b}); clamping to ${faceMin} per weakest-link`);
                serverRounded[cat] = faceMin;
              }
            }
          }
        }

        // Step 3.7 (v8.9): MERGE ZOOM INSPECTION — regioned crops catch localized damage
        // the holistic passes miss (whitening flecks, corner softening, creases). Zoom
        // findings map to ladder caps deterministically and only ever LOWER scores.
        const zoom = zoomPromise ? await zoomPromise : null;
        const zoomAdjustments: string[] = [];
        // v9.1: per-face caps ACTUALLY applied after the corroboration rule. The
        // pass-fold (Step 6) must read these — folding raw zoom.faceCaps would pull
        // displayed pass rows below the consensus when a cap was corroboration-limited.
        const appliedFaceCaps: Record<string, number> = {};
        // v9.3 RIGID-CASE EXCLUSION: cosmetic zoom findings on a card photographed
        // inside a rigid holder are unreliable — the plastic's reflections, edge
        // shadows and dust read as scratches/stains/whitening at crop resolution
        // (measured: a cased card's cosmetic caps flapped 9↔8 on holder artifacts).
        // Skip COSMETIC caps for cased cards; structural findings still merge below,
        // and the Gem gate independently holds cased cards at ≤9.
        const caseInfoForZoom = jsonData.case_detection || {};
        const rigidCaseForZoom =
          ['top_loader', 'semi_rigid', 'slab'].includes(caseInfoForZoom.case_type) ||
          ['moderate', 'high'].includes(caseInfoForZoom.impact_level);
        if (zoom?.ok && rigidCaseForZoom && Object.keys(zoom.faceCaps).length > 0) {
          console.log(`[GRADE RECALC] 🔎 zoom cosmetic caps SKIPPED (rigid case: ${caseInfoForZoom.case_type}) — structural findings still apply`);
          zoom.faceCaps = {};
        }
        if (zoom?.ok) {
          const faceCats = ['centering', 'corners', 'edges', 'surface'] as const;
          for (const cat of faceCats) {
            if (cat === 'centering') continue; // zoom regions don't measure centering
            const before = serverRounded[cat];
            // v9.1 CORROBORATION RULE: a zoom finding may pull a category at most
            // 2 points below the holistic consensus UNLESS it is corroborated by
            // either (a) 2+ distinct zoom regions for that face+category, or
            // (b) at least one holistic completion scoring within 1 of the cap.
            // Validated regrades showed a single uncorroborated crop verdict
            // overriding three unanimous holistic 10s by 4 points (run-to-run
            // 9↔6 flips on the same card).
            const holisticCatMin = Math.min(
              typeof pass1?.[cat] === 'number' ? pass1[cat] : 10,
              typeof pass2?.[cat] === 'number' ? pass2[cat] : 10,
              typeof pass3?.[cat] === 'number' ? pass3[cat] : 10,
            );
            for (const face of ['front', 'back'] as const) {
              const cap = zoom.faceCaps[`${cat}_${face}`];
              if (cap == null) continue;
              const rawKey = `${cat}_${face}`;
              const regionCount = new Set(
                zoom.defects.filter(d => d.category === cat && d.face === face).map(d => d.region)
              ).size;
              const corroborated = regionCount >= 2 || holisticCatMin <= cap + 1;
              const effectiveCap = corroborated ? cap : Math.max(cap, before - 2);
              if (!corroborated && effectiveCap > cap) {
                console.log(`[GRADE RECALC] 🔎 zoom: ${rawKey} cap ${cap} UNCORROBORATED (1 region, holistic min ${holisticCatMin}) — limited to ${effectiveCap}`);
              }
              let capLoweredSomething = false;
              if (jsonData.raw_sub_scores && typeof jsonData.raw_sub_scores[rawKey] === 'number' && jsonData.raw_sub_scores[rawKey] > effectiveCap) {
                console.log(`[GRADE RECALC] 🔎 zoom: ${rawKey} ${jsonData.raw_sub_scores[rawKey]} → ${effectiveCap} (regioned inspection found defects the holistic pass missed)`);
                jsonData.raw_sub_scores[rawKey] = effectiveCap;
                capLoweredSomething = true;
              }
              if (serverRounded[cat] > effectiveCap) {
                serverRounded[cat] = effectiveCap;
                capLoweredSomething = true;
              }
              if (capLoweredSomething) appliedFaceCaps[rawKey] = effectiveCap;
            }
            if (serverRounded[cat] < before) {
              // v9.1: list ALL findings (was slice(0,2), which under-justified caps)
              const catDefects = zoom.defects.filter(d => d.category === cat);
              // v9.4.2: honest framing for magnification-only findings — "minor" by
              // definition means invisible at normal viewing distance, and stating
              // "minor whitening" flatly on a card the owner sees as clean generated
              // dispute tickets. Say what it is: faint and magnification-only.
              const reasons = catDefects
                .slice(0, 4)
                .map(d => d.severity === 'minor'
                  ? `faint ${d.type} visible only under magnification (${d.face} ${humanizeZoomRegion(d.region)})`
                  : `${d.severity} ${d.type} (${d.face} ${humanizeZoomRegion(d.region)})`)
                .join(', ') + (catDefects.length > 4 ? ` +${catDefects.length - 4} more` : '');
              // Findings-style (no "10→7" delta): the passes now already show the
              // folded score, so state the result + what magnified inspection saw.
              zoomAdjustments.push(`${cat} ${serverRounded[cat]}/10 — ${reasons}`);
            }
          }

          // Surface zoom defects into the section defects arrays for accountability.
          // v9.0: pushed as OBJECTS matching the AI's defect shape — string entries rendered
          // as empty "Defect" boxes on the web detail pages and polluted the coordinate
          // extraction (which maps these arrays as objects).
          for (const d of zoom.defects) {
            if (d.category === 'structural') continue;
            const sec = jsonData[d.category]?.[d.face];
            if (sec && Array.isArray(sec.defects)) {
              sec.defects.push({
                type: d.type,
                severity: d.severity,
                location: `${d.face} ${humanizeZoomRegion(d.region)}`,
                description: d.description,
                source: 'zoom-inspection',
                // v9.4.2: the exact magnified crop this finding was made from —
                // persisted in the stored JSON so every consumer (web detail,
                // mobile, PDF) can show the evidence instead of asserting it.
                evidence_url: d.evidenceUrl ?? null,
                evidence_path: d.evidencePath ?? null,
              });
            }
          }

          // Structural findings from zoom (creases/bends/warps) — merge into structural_damage
          if (zoom.structuralFindings.length > 0) {
            const sd = jsonData.structural_damage || {};
            const existing: any[] = Array.isArray(sd.findings) ? sd.findings : [];
            sd.detected = true;
            sd.has_creases = sd.has_creases || zoom.structuralFindings.some(f => ['crease', 'fold'].includes(f.type));
            sd.has_bent_corners = sd.has_bent_corners || zoom.structuralFindings.some(f => ['bend', 'warp'].includes(f.type));
            sd.findings = [...existing, ...zoom.structuralFindings];
            sd.description = sd.findings.map((f: any, i: number) => `(${i + 1}) ${f.type} — ${f.location}: ${f.description}`).join(' ');
            jsonData.structural_damage = sd;
            console.log(`[GRADE RECALC] 🔎 zoom: ${zoom.structuralFindings.length} structural finding(s) merged — structural cap will apply`);
          }

          // Note zoom contribution in the narrative (grade tokens reconciled later).
          // Skipped when structural findings exist — the summary is rebuilt around the
          // structural damage below, and bolting a defect list onto blind base prose
          // produced contradictory, overlong summaries.
          // v9.1: no summary append here — the narrator rebuilds the summary from
          // final numbers + zoomAdjustments after ALL mutations (Step 6).

          // Explain zoom adjustments in the consensus notes — the three-pass table shows
          // holistic pass scores, so without this a zoom-lowered consensus row looks like
          // it "came from nowhere" (e.g. passes all 10 but consensus 8).
          if (zoomAdjustments.length > 0 && Array.isArray(jsonData.grading_passes?.consensus_notes)) {
            jsonData.grading_passes.consensus_notes.push(
              `Regioned zoom inspection (${zoom.regionsInspected} magnified crops) found defects the holistic passes missed — consensus adjusted: ${zoomAdjustments.join(' | ')}`
            );
          } else if (Array.isArray(jsonData.grading_passes?.consensus_notes)) {
            // v9.3: ALWAYS record that zoom ran, even with zero findings. Previously a
            // clean zoom and a silently-failed zoom were indistinguishable in the stored
            // JSON — which blinded two production investigations (Jul 10: could not
            // tell whether the grade-10 influx correlated with zoom fallbacks).
            jsonData.grading_passes.consensus_notes.push(
              `Regioned zoom inspection ran (${zoom.regionsInspected} magnified crops): no defects found beyond the holistic evaluation.`
            );
          }
        } else if (zoom && !zoom.ok) {
          console.warn(`[GRADE RECALC] ⚠️ zoom inspection unavailable (${zoom.error}) — grading from holistic ensemble only`);
          // v9.3: persist the fallback so the stored JSON shows this card was graded
          // WITHOUT magnified inspection (previously console-only — invisible in the DB).
          if (Array.isArray(jsonData.grading_passes?.consensus_notes)) {
            jsonData.grading_passes.consensus_notes.push(
              `Magnified zoom inspection was unavailable for this grade (${zoom.error}) — assessment is from the holistic ensemble only.`
            );
          }
        }

        // Step 3.8 (v9.2) EVIDENCE RECONCILIATION: a deduction of 2+ points requires a
        // documented defect. Production (2026-07-06, 24/103 cards) showed completions
        // scoring a category 7-8 while their own prose declared it flawless and NO
        // defect existed anywhere — not in any completion's defect arrays, not in the
        // 24-crop zoom inspection ("No whitening... is visible on any of the four
        // corners, supporting a front corner score of 7"). That number is an anchoring
        // artifact, not a judgment — and it flip-flopped on re-shoots (same card
        // grading 8/8/10 within minutes → grade-shopping + user complaints).
        // When a 7-8 category score has ZERO recorded evidence, reconcile it to 9
        // (Mint) — not 10: a 9 is defensible without a documented defect, Gem Mint
        // is not in question here and stays behind its own gates. Guards:
        //   - zoom must have actually run (it is the independent verifier)
        //   - any structural signal (even unconfirmed) blocks reconciliation
        //   - a zoom face-cap on the category blocks it (cap == evidence)
        //   - all passes must agree the category is >= 7 (wild disagreement means
        //     something real is going on — leave it alone)
        const evidenceReconciliations: string[] = [];
        {
          const anyStructuralSignal =
            jsonData.structural_damage?.detected === true ||
            structuralDetectors.length > 0 ||
            !!(zoom?.ok && zoom.structuralFindings.length > 0);
          const sectionHasDefects = (j: any, cat: string): boolean => {
            let found = false;
            const walk = (node: any, depth: number) => {
              if (found || !node || typeof node !== 'object' || depth > 4) return;
              if (Array.isArray((node as any).defects) && (node as any).defects.length > 0) { found = true; return; }
              for (const v of Object.values(node)) walk(v, depth + 1);
            };
            walk(j?.[cat], 0);
            return found;
          };
          if (zoom?.ok && !anyStructuralSignal) {
            for (const cat of ['corners', 'edges', 'surface'] as const) {
              const score = serverRounded[cat];
              if (score < 7 || score > 8) continue;
              if (Object.keys(appliedFaceCaps).some(k => k.startsWith(`${cat}_`))) continue;
              const holisticEvidence = scored.some(x => sectionHasDefects(x.j, cat));
              const zoomEvidence = zoom.defects.some(d => d.category === cat);
              const passesAgreeClean = passSrc.every(x => typeof x.cats[cat] === 'number' && (x.cats[cat] as number) >= 7);
              if (holisticEvidence || zoomEvidence || !passesAgreeClean) continue;
              console.log(`[GRADE RECALC] ⚖️ evidence reconciliation: ${cat} ${score} → 9 (no defect recorded by any completion or the zoom inspection — an unexplained deduction is not evidence)`);
              serverRounded[cat] = 9;
              if (jsonData.raw_sub_scores) {
                for (const face of ['front', 'back'] as const) {
                  const k = `${cat}_${face}`;
                  if (typeof jsonData.raw_sub_scores[k] === 'number' && jsonData.raw_sub_scores[k] < 9) {
                    jsonData.raw_sub_scores[k] = 9;
                  }
                }
              }
              evidenceReconciliations.push(`${cat} ${score}→9`);
            }
            if (evidenceReconciliations.length > 0 && Array.isArray(jsonData.grading_passes?.consensus_notes)) {
              jsonData.grading_passes.consensus_notes.push(
                `Evidence reconciliation: ${evidenceReconciliations.join(', ')} — the evaluations deducted for these categories without recording any defect, and the magnified regioned inspection found none either. Per the rubric, a deduction of 2+ points requires a visible, documented defect, so the unsupported deduction was reconciled to Mint (9).`
              );
            }
          }
        }

        // Step 3.9 (v9.0 COHERENCE): structural damage lives in the SURFACE subgrade.
        // Previously only the FINAL was capped, so a zoom-detected crease produced
        // "final 4 with all subgrades 9-10" — incoherent to the customer. A confirmed
        // crease/bend caps the surface subgrade (and its displayed faces) to the same
        // structural cap, which then flows through weakest-link naturally.
        const structuralFlagged = jsonData.structural_damage?.detected === true;
        const STRUCT_CAP = 4;

        // v9.1 STRUCTURAL CORROBORATION: a hard cap to 4 is catastrophic, so it now
        // requires corroboration. A single completion (or a single zoom read) flagging
        // a "crease" that the others missed is very often a REFLECTION or embossed
        // design line on a foil/metallic/refractor surface — which was tanking pristine
        // premium cards (e.g. Metal Universe "Dark Matter" 10 → 4). Corroborated =
        // a MAJORITY of the holistic completions agree, OR the zoom inspection
        // independently confirmed it. Otherwise the flag is treated as UNCONFIRMED and
        // the grade proceeds normally (with raised uncertainty).
        const structuralVotes = structuralDetectors.length;
        const zoomStructural = !!(zoom?.ok && zoom.structuralFindings.length > 0);
        const structuralCorroborated = structuralVotes >= Math.ceil(scored.length / 2) || zoomStructural;

        // v9.1 STRUCTURAL VERIFICATION: even unanimous crease/bend claims can be a
        // lighting/reflection band on glossy or metallic cards (a broad tonal step,
        // not a thin ridge) — a confirmed-pristine card graded 4 this way with every
        // pass AND zoom agreeing. Before the hard cap applies, a dedicated verifier
        // re-crops the claimed location and answers ONE question: thin physical
        // ridge, or broad lighting band? Fail-safe: on any error the cap stands.
        let structuralVerified = true;
        let structuralVerifyReason = '';
        if (structuralFlagged && structuralCorroborated) {
          const findings = Array.isArray(jsonData.structural_damage?.findings) && jsonData.structural_damage.findings.length > 0
            ? jsonData.structural_damage.findings
            : [{ type: 'crease', location: '', description: jsonData.structural_damage?.description || '' }];
          // v9.4.2: the regioned zoom magnifies every surface quadrant (and center
          // bands) — if it found NO structural damage, that independent read is
          // counter-evidence against a holistic-only crease claim, so verification
          // must be unanimous. Production case: correlated holistic completions
          // co-hallucinated a "crease" in a Pokemon back's printed swirl streaks
          // (grade 4 on a clean card, 9 on the re-shoot minutes later).
          const zoomFoundNoStructural = !!(zoom?.ok && zoom.structuralFindings.length === 0);
          const verdict = await verifyStructuralClaim(frontImageUrl, backImageUrl, findings, { requireUnanimous: zoomFoundNoStructural });
          structuralVerified = verdict.confirmed;
          structuralVerifyReason = verdict.reason;
          if (!structuralVerified && jsonData.structural_damage) {
            console.log(`[GRADE RECALC] ⚠️ structural claim REJECTED by verification: ${verdict.reason}`);
            jsonData.structural_damage.detected = false;
            jsonData.structural_damage.unconfirmed = true;
            jsonData.structural_damage.unconfirmed_note = `A straight line was flagged as a possible crease, but magnified verification identified it as a lighting/reflection band on the card's glossy surface — not physical damage. Grade not capped. (${verdict.reason})`;
          }
        }

        const structuralDetected = structuralFlagged && structuralCorroborated && structuralVerified;

        if (structuralFlagged && !structuralCorroborated) {
          console.log(`[GRADE RECALC] ⚠️ structural UNCORROBORATED (${structuralVotes}/${scored.length} completions, zoom=${zoomStructural}) — NOT capping to 4 (likely reflection/embossed line on a foil/metallic card)`);
          if (jsonData.structural_damage) {
            jsonData.structural_damage.detected = false;
            jsonData.structural_damage.unconfirmed = true;
            jsonData.structural_damage.unconfirmed_note = 'A possible surface line was flagged by a single evaluation but not corroborated by the other evaluations or the magnified inspection — treated as unconfirmed (common on reflective/foil/embossed cards). Grade not capped.';
          }
        }

        if (structuralDetected) {
          if (serverRounded.surface > STRUCT_CAP) {
            console.log(`[GRADE RECALC] 🚨 structural coherence: surface subgrade ${serverRounded.surface} → ${STRUCT_CAP} (corroborated structural damage: ${structuralVotes}/${scored.length} completions${zoomStructural ? ' + zoom' : ''})`);
            serverRounded.surface = STRUCT_CAP;
          }
          if (jsonData.raw_sub_scores) {
            for (const key of ['surface_front', 'surface_back']) {
              if (typeof jsonData.raw_sub_scores[key] === 'number' && jsonData.raw_sub_scores[key] > STRUCT_CAP) {
                jsonData.raw_sub_scores[key] = STRUCT_CAP;
              }
            }
          }
        }

        // Step 4: Apply dominant defect control (weakest subgrade caps the final)
        const subgradeCap = Math.min(serverRounded.centering, serverRounded.corners, serverRounded.edges, serverRounded.surface);
        let finalGrade = Math.min(serverRounded.final, subgradeCap);

        // Step 4.5 (v8.9): SERVER-ENFORCED STRUCTURAL CAP (backstop — Step 3.9 already
        // pulls surface down, so this only fires if that path is ever bypassed).
        if (structuralDetected && finalGrade > STRUCT_CAP) {
          console.log(`[GRADE RECALC] 🚨 STRUCTURAL CAP backstop: capping final ${finalGrade} → ${STRUCT_CAP}`);
          finalGrade = STRUCT_CAP;
        }

        // Step 5: Grade 10 validation — standard rounding handles the math naturally
        // Grade 10 only requires: all subgrades round to 10 AND final rounds to 10
        // The subgradeCap (MIN of subgrades) already enforces this
        // No special exception patches needed with standard rounding
        if (finalGrade === 10 && defectCounts.total > 0) {
          console.log(`[GRADE RECALC] ⚠️ Grade 10 with ${defectCounts.total} defects reported — grade stands (defects may be minor/manufacturing)`);
        }
        if (finalGrade === 10) {
          console.log(`[GRADE RECALC] ✅ Final grade 10 AWARDED: avg=${boostedAvg.final.toFixed(2)}, all subgrades=${serverRounded.centering}/${serverRounded.corners}/${serverRounded.edges}/${serverRounded.surface}`);
        }

        // Step 6: Write corrected values back to the AI response for consistency
        threePassData.averaged = boostedAvg;
        // v8.8: store the CAPPED grade in averaged_rounded.final. The per-category routes read
        // averaged_rounded.final as their primary grade source; before this fix they received the
        // uncapped rounded average, silently bypassing the weakest-link cap computed above.
        threePassData.averaged_rounded = { ...serverRounded, final: finalGrade };

        // v9.1: FOLD the zoom + structural caps into each displayed pass so the
        // Three-Pass table represents the FULL evaluation (magnified inspection
        // included on every pass) instead of the confusing "10/10/10 → 7". Capping
        // is monotonic, so median(capped passes) === capped median === serverRounded:
        // the grade and consensus are UNCHANGED — only the per-pass display becomes
        // internally coherent. (f1/f2/f3, captured raw at :1940, still drive the
        // uncertainty + unanimity gates from the independent holistic agreement.)
        const foldCapFor = (cat: 'centering' | 'corners' | 'edges' | 'surface'): number | null => {
          const caps: number[] = [];
          // v9.1: fold the caps ACTUALLY applied in Step 3.7 (post-corroboration),
          // not raw zoom.faceCaps — an uncorroborated raw cap would fold pass rows
          // BELOW the consensus, breaking the "capped median === serverRounded" invariant.
          const cf = appliedFaceCaps[`${cat}_front`];
          const cb = appliedFaceCaps[`${cat}_back`];
          if (typeof cf === 'number') caps.push(cf);
          if (typeof cb === 'number') caps.push(cb);
          if (structuralDetected && cat === 'surface') caps.push(STRUCT_CAP);
          return caps.length ? Math.min(...caps) : null;
        };
        for (const p of [threePassData.pass_1, threePassData.pass_2, threePassData.pass_3] as any[]) {
          if (!p) continue;
          for (const cat of ['centering', 'corners', 'edges', 'surface'] as const) {
            const cap = foldCapFor(cat);
            if (cap != null && typeof p[cat] === 'number' && p[cat] > cap) p[cat] = cap;
          }
          let pf = Math.min(p.centering, p.corners, p.edges, p.surface);
          if (structuralDetected) pf = Math.min(pf, STRUCT_CAP);
          p.final = pf;
        }
        // Keep the displayed variance/consistency consistent with the folded passes
        const foldedFinals = [threePassData.pass_1.final, threePassData.pass_2.final, threePassData.pass_3.final];
        threePassData.variance = Math.max(...foldedFinals) - Math.min(...foldedFinals);
        threePassData.consistency = threePassData.variance === 0 ? 'high' : threePassData.variance <= 1 ? 'moderate' : 'low';

        // v8.8: honest uncertainty — derived from measured signals, not the AI's self-report.
        // Components: image-confidence letter (A=0,B=1,C=2,D=3), spread between the three pass
        // finals, and whether the server had to lower the model's own average (cap/clamp fired).
        const confidenceLetter = (jsonData.image_quality?.confidence_letter || 'B').toUpperCase();
        const letterUncertainty = ({ A: 0, B: 1, C: 2, D: 3 } as Record<string, number>)[confidenceLetter] ?? 1;
        const passSpread = Math.max(f1, f2, f3) - Math.min(f1, f2, f3);
        const clampLowered = finalGrade < Math.round(boostedAvg.final) ? 1 : 0;
        // v8.9: structural disagreement between ensemble completions = genuine uncertainty.
        // v9.0: ALSO covers zoom-only structural detection (zoom found a crease no holistic
        // completion saw) — the exact case that previously reported ±1 on a capped grade.
        const zoomOnlyStructural = structuralDetected && structuralDetectors.length === 0;
        // v9.1: an UNCORROBORATED structural flag (single evaluation saw a possible line,
        // not confirmed) is genuine uncertainty even though we didn't cap the grade.
        const structuralUnconfirmed = structuralFlagged && !structuralCorroborated;
        const structuralUncertainty = (structuralDisagreement || zoomOnlyStructural || structuralUnconfirmed) ? 2 : 0;
        const uncertaintyValue = Math.min(3, Math.max(letterUncertainty, passSpread, clampLowered, structuralUncertainty));
        const uncertaintyStr = `±${uncertaintyValue}`;

        // v9.1 UNCERTAINTY GATE: never award Gem Mint on evidence the system
        // itself distrusts — a 10 at ±2 literally reads "could be an 8".
        // (Validated regrade awarded 10 (±2) on images flagged as soft.)
        // v9.2b STRICT UNANIMITY GATE: Gem Mint requires all three ensemble
        // completions at 10. The v9.1b `allSubgrades10` escape hatch (10 kept
        // when the four ROUNDED subgrades hit 10 despite a dissenting pass) is
        // REMOVED: since the final follows weakest-link, a final of 10 implies
        // all-10 subgrades, so the hatch was open on essentially every 10 and
        // the unanimity requirement never fired. Measured (Jul 5-10 production):
        // 35.6% of grade-10s were non-unanimous splits ([9,10,10] etc.) that
        // survived only through the hatch, and the 10-rate ran 47-56% vs the
        // 24.5% baseline — the exact over-grading customers reported. A 2-vs-1
        // split straddling the 10 line is a coin flip; it reads Mint (9).
        // (docs/GRADING_TEN_INFLUX_2026-07-10.md)
        // v9.2b CASE GATE: a card inspected through a rigid holder (top loader /
        // semi-rigid / slab, or any case the model says has moderate+ impact)
        // cannot be CONFIRMED flawless — production gave 10/10/10/10 to a card
        // in a magnetic one-touch whose own case_detection said "moderate impact,
        // limits surface inspection". 26% of recent 10s sat in a detected case.
        let gradeCapNote: string | null = null;
        const unanimous10 = Math.min(f1, f2, f3) >= 10;
        const caseInfo = jsonData.case_detection || {};
        const rigidCase =
          ['top_loader', 'semi_rigid', 'slab'].includes(caseInfo.case_type) ||
          ['moderate', 'high'].includes(caseInfo.impact_level);
        if (finalGrade === 10 && (uncertaintyValue >= 2 || rigidCase || !unanimous10)) {
          finalGrade = 9;
          threePassData.averaged_rounded = { ...serverRounded, final: finalGrade };
          if (uncertaintyValue >= 2) {
            gradeCapNote = `The card presents at Gem Mint level, but the photos are not clear enough to confirm a 10 - the grade is held at 9.`;
            console.log(`[GRADE RECALC] ⚖️ uncertainty gate: 10 → 9 (uncertainty ±${uncertaintyValue})`);
          } else if (rigidCase) {
            gradeCapNote = `The card presents at Gem Mint level, but it was photographed inside a rigid holder, which prevents a fully verified surface and edge inspection - the grade is held at 9. For Gem Mint consideration, re-submit with the card photographed outside the holder.`;
            console.log(`[GRADE RECALC] ⚖️ case gate: 10 → 9 (case_type=${caseInfo.case_type}, impact=${caseInfo.impact_level})`);
          } else {
            gradeCapNote = `The card presents at Gem Mint level, but not every independent evaluation confirmed a perfect 10 - Gem Mint requires unanimous confirmation, so the grade is held at 9.`;
            console.log(`[GRADE RECALC] ⚖️ unanimity gate: 10 → 9 (pass finals ${f1}/${f2}/${f3})`);
          }
        }

        // v8.8: the condition label is DERIVED from the final grade — never the AI's prose.
        // (Production showed two grade-6 cards stored as "Excellent" and "Near Mint-Mint".)
        const canonicalConditionLabel = getConditionFromGrade(finalGrade);

        // Override AI's final grade fields with server-calculated values
        if (jsonData.final_grade) {
          jsonData.final_grade.decimal_grade = finalGrade;
          jsonData.final_grade.whole_grade = finalGrade;
          jsonData.final_grade.condition_label = canonicalConditionLabel;
          jsonData.final_grade.grade_range = uncertaintyStr;

          // v9.1 NARRATE-AFTER-CONSENSUS: the displayed summary is REBUILT
          // deterministically from the final post-cap numbers + structured
          // findings. The base completion's prose was authored against its own
          // pre-mutation scores (median, zoom caps, structural caps, weakest-link
          // all land AFTER it was written) and routinely contradicted the
          // displayed grade. The model's prose is preserved for reference.
          jsonData.final_grade.model_summary = scrubGradingCompanyReferences(jsonData.final_grade.summary);
          jsonData.final_grade.summary = buildFinalSummary({
            finalGrade,
            conditionLabel: canonicalConditionLabel,
            uncertainty: uncertaintyStr,
            subgrades: {
              centering: serverRounded.centering,
              corners: serverRounded.corners,
              edges: serverRounded.edges,
              surface: serverRounded.surface,
            },
            structuralDetected,
            structuralFindings: Array.isArray(jsonData.structural_damage?.findings) ? jsonData.structural_damage.findings : [],
            zoomAdjustments,
            gradeCapNote,
            jsonData,
          });

          // Length guard: overlong summaries read badly and can be visually truncated by
          // display surfaces. Trim to ~700 chars at a sentence boundary, always keeping
          // the canonical trailing grade statement intact.
          const MAX_SUMMARY = 700;
          if (jsonData.final_grade.summary.length > MAX_SUMMARY) {
            const text = jsonData.final_grade.summary as string;
            const tailIdx = text.lastIndexOf('Final grade');
            const tail = tailIdx > -1 ? text.slice(tailIdx) : `Final grade: ${finalGrade} (${canonicalConditionLabel}).`;
            let head = text.slice(0, Math.max(0, MAX_SUMMARY - tail.length - 1));
            const lastSentence = head.lastIndexOf('. ');
            if (lastSentence > 200) head = head.slice(0, lastSentence + 1);
            jsonData.final_grade.summary = `${head.trim()} ${tail}`.trim();
          }
          // Recompute the dominant defect from the server subgrades (weakest category)
          const weakestCat = (['centering', 'corners', 'edges', 'surface'] as const)
            .reduce((worst, cat) => serverRounded[cat] < serverRounded[worst] ? cat : worst, 'centering' as 'centering' | 'corners' | 'edges' | 'surface');
          jsonData.final_grade.dominant_defect = weakestCat;
        }
        if (jsonData.weighted_scores) {
          // These AI-authored fields otherwise retain pre-clamp values (observed: preliminary_grade 8 on a stored 6)
          jsonData.weighted_scores.preliminary_grade = finalGrade;
          jsonData.weighted_scores.weakest_subgrade = subgradeCap;
          jsonData.weighted_scores.limiting_factor = (['centering', 'corners', 'edges', 'surface'] as const)
            .find(cat => serverRounded[cat] === subgradeCap) || jsonData.weighted_scores.limiting_factor;
        }
        if (jsonData.image_quality) {
          jsonData.image_quality.grade_uncertainty = uncertaintyStr;
        }

        // Step 7: Also fix raw_sub_scores to derive from pass data (consistency fix)
        // v9.0: weighted_scores sync is INDEPENDENT of raw_sub_scores existing — previously
        // nested inside the raw_sub_scores guard, so a completion without raw faces kept
        // stale AI weighted values while averaged_rounded showed corrected ones.
        if (jsonData.weighted_scores) {
          jsonData.weighted_scores.centering_weighted = serverRounded.centering;
          jsonData.weighted_scores.corners_weighted = serverRounded.corners;
          jsonData.weighted_scores.edges_weighted = serverRounded.edges;
          jsonData.weighted_scores.surface_weighted = serverRounded.surface;
        }
        if (jsonData.raw_sub_scores) {
          // Reconcile front/back scores with server-rounded weighted scores
          // If both front and back are higher than the weighted score, the display
          // becomes confusing (e.g., F:10 B:10 but Score:9). Cap them to match.
          const categories = ['centering', 'corners', 'edges', 'surface'] as const;
          for (const cat of categories) {
            const frontKey = `${cat}_front`;
            const backKey = `${cat}_back`;
            const weightedScore = serverRounded[cat];
            const frontScore = jsonData.raw_sub_scores[frontKey];
            const backScore = jsonData.raw_sub_scores[backKey];

            if (frontScore != null && backScore != null) {
              if (frontScore > weightedScore && backScore > weightedScore) {
                // Both sides scored higher than the three-pass weighted result — cap both
                console.log(`[GRADE RECALC] 🔧 ${cat}: front/back scores (${frontScore}/${backScore}) both exceed weighted (${weightedScore}), capping to ${weightedScore}`);
                jsonData.raw_sub_scores[frontKey] = weightedScore;
                jsonData.raw_sub_scores[backKey] = weightedScore;
              } else if (frontScore > weightedScore && backScore <= weightedScore) {
                // Back is at or below weighted — cap front so weighted average is plausible
                const adjustedFront = Math.min(frontScore, weightedScore + 1);
                if (adjustedFront !== frontScore) {
                  console.log(`[GRADE RECALC] 🔧 ${cat}: front score (${frontScore}) exceeds weighted (${weightedScore}) with back=${backScore}, adjusting front to ${adjustedFront}`);
                  jsonData.raw_sub_scores[frontKey] = adjustedFront;
                }
              } else if (backScore > weightedScore && frontScore <= weightedScore) {
                // Front is at or below weighted — cap back so weighted average is plausible
                const adjustedBack = Math.min(backScore, weightedScore + 1);
                if (adjustedBack !== backScore) {
                  console.log(`[GRADE RECALC] 🔧 ${cat}: back score (${backScore}) exceeds weighted (${weightedScore}) with front=${frontScore}, adjusting back to ${adjustedBack}`);
                  jsonData.raw_sub_scores[backKey] = adjustedBack;
                }
              }
            }
          }
        }

        // v9.1 Step 7.5: reconcile per-face prose score tokens to the FINAL face
        // scores. Face summaries are authored by the base completion against its
        // own numbers; zoom caps / structural caps / the F-B plausibility fix above
        // can lower those numbers afterward. Descriptive wording stays (it's the
        // examiner's observation); numeric claims ("8/10") are corrected so text
        // never quotes a score the page doesn't display.
        for (const cat of ['centering', 'corners', 'edges', 'surface'] as const) {
          for (const face of ['front', 'back'] as const) {
            const section = jsonData[cat]?.[face];
            const faceScore = jsonData.raw_sub_scores?.[`${cat}_${face}`];
            if (!section || typeof faceScore !== 'number') continue;
            if (typeof section.summary === 'string') {
              section.summary = reconcileFaceProse(section.summary, faceScore);
            }
            if (typeof section.condition === 'string') {
              section.condition = reconcileFaceProse(section.condition, faceScore);
            }
          }
          // Centering stores its prose at the category level
          if (cat === 'centering' && jsonData.centering) {
            if (typeof jsonData.centering.front_summary === 'string') {
              jsonData.centering.front_summary = reconcileFaceProse(jsonData.centering.front_summary, jsonData.raw_sub_scores?.centering_front);
            }
            if (typeof jsonData.centering.back_summary === 'string') {
              jsonData.centering.back_summary = reconcileFaceProse(jsonData.centering.back_summary, jsonData.raw_sub_scores?.centering_back);
            }
          }
        }

        // v9.2 Step 7.6: reconcile the STRUCTURED per-category section scores that the
        // "Detailed Grading Analysis" panel renders straight from the grading JSON
        // (corners.front.top_left.score, corners.front.score, corners.score,
        // edges.front.top.score, surface.front.score, centering.front.score, and each
        // category-level `.score`). These are the base completion's PRE-CAP numbers and
        // were never reconciled after the mutations — so a card whose corners were
        // zoom-capped to 8 still rendered "Corner Analysis: every corner 10/10,
        // Overall 10" beside a subgrade tile and summary of 8 (customer-reported
        // contradiction, Jul 2026: "in the report the corners are all graded 10's").
        // The tiles/overall use serverRounded + raw_sub_scores faces; clamp every
        // structured section score DOWN to those same values so no sub-number can
        // display above the grade. Never raise a score — display-only, grade is final.
        {
          const faceCapScore = (cat: 'centering' | 'corners' | 'edges' | 'surface', face: 'front' | 'back'): number => {
            const rf = jsonData.raw_sub_scores?.[`${cat}_${face}`];
            return typeof rf === 'number' ? rf : serverRounded[cat];
          };
          for (const cat of ['centering', 'corners', 'edges', 'surface'] as const) {
            const section = jsonData[cat];
            if (!section || typeof section !== 'object') continue;
            // Category-level rollup score (e.g. corners.score)
            if (typeof section.score === 'number' && section.score > serverRounded[cat]) {
              section.score = serverRounded[cat];
            }
            for (const face of ['front', 'back'] as const) {
              const fsec = section[face];
              if (!fsec || typeof fsec !== 'object') continue;
              const cap = faceCapScore(cat, face);
              let faceClamped = false;
              // Per-face rollup (corners.front.score, surface.front.score, centering.front.score, …)
              if (typeof fsec.score === 'number' && fsec.score > cap) {
                fsec.score = cap;
                faceClamped = true;
              }
              // Per-position scores (corners: top_left/top_right/…; edges: top/bottom/left/right)
              for (const key of Object.keys(fsec)) {
                const pos = (fsec as any)[key];
                if (pos && typeof pos === 'object' && typeof pos.score === 'number' && pos.score > cap) {
                  pos.score = cap;
                  faceClamped = true;
                }
              }
              // When a cap actually lowered this face, append a one-line pointer so a
              // "supporting a perfect score" sentence can't sit beside a clamped number
              // with no on-panel explanation. Additive only — never rewrites the prose.
              if (faceClamped && cap < 10 && typeof fsec.summary === 'string' && !/magnified inspection/i.test(fsec.summary)) {
                fsec.summary = `${fsec.summary.trim()} Magnified inspection adjusted this face to ${cap}/10 — see the limiting factors and condition summary above.`;
              }
            }
          }
        }

        extractedGrade = {
          decimal_grade: finalGrade,
          whole_grade: finalGrade,
          uncertainty: uncertaintyStr // v8.8: measured (letter + pass spread + clamp), not AI self-report
        };

        // Log comparison: AI vs Server
        const aiRounded = threePassData.averaged_rounded;
        console.log(`[GRADE RECALC] ✅ ENSEMBLE GRADING with server-side median consensus`);
        console.log(`[GRADE RECALC] Pass scores: P1=${pass1.final}, P2=${pass2.final}, P3=${pass3.final}`);
        console.log(`[GRADE RECALC] Raw avg: C=${serverAvg.centering.toFixed(2)}, Co=${serverAvg.corners.toFixed(2)}, E=${serverAvg.edges.toFixed(2)}, S=${serverAvg.surface.toFixed(2)}, Final=${serverAvg.final.toFixed(2)}`);
        console.log(`[GRADE RECALC] Boosted avg: C=${boostedAvg.centering.toFixed(2)}, Co=${boostedAvg.corners.toFixed(2)}, E=${boostedAvg.edges.toFixed(2)}, S=${boostedAvg.surface.toFixed(2)}, Final=${boostedAvg.final.toFixed(2)}`);
        console.log(`[GRADE RECALC] Server rounded: C=${serverRounded.centering}, Co=${serverRounded.corners}, E=${serverRounded.edges}, S=${serverRounded.surface}`);
        console.log(`[GRADE RECALC] Subgrade cap=${subgradeCap}, Final grade=${finalGrade}`);
        console.log(`[GRADE RECALC] Variance: ${threePassData.variance}, Consistency: ${threePassData.consistency}`);

        // Log any three-pass warnings
        if (threePassValidation.warnings.length > 0) {
          console.log(`[GRADE RECALC] ⚠️ THREE-PASS WARNINGS:`);
          threePassValidation.warnings.forEach(w => console.log(`   - ${w}`));
        }
      } else {
        // Fallback: Use direct final_grade (for backward compatibility)
        extractedGrade = {
          decimal_grade: jsonData.scoring?.final_grade ?? jsonData.final_grade?.decimal_grade ?? null,
          whole_grade: jsonData.final_grade?.whole_grade ?? (jsonData.scoring?.final_grade ? Math.round(jsonData.scoring.final_grade) : null),
          uncertainty: jsonData.scoring?.grade_range || jsonData.final_grade?.grade_range || jsonData.image_quality?.grade_uncertainty || '±1'
        };
        console.log(`[GRADE RECALC] ⚠️ No three-pass data found, using direct final_grade`);
        console.log(`[GRADE RECALC] ⚠️ THREE-PASS VALIDATION FAILED: ${threePassValidation.warnings.join(', ')}`);
      }

      console.log(`[GRADE RECALC] Final extracted grade: ${extractedGrade.decimal_grade} (${extractedGrade.uncertainty})`);

      // Build rarity classification from JSON
      // v9.1: build to the ACTUAL RarityClassification interface — the previous
      // literal used invented field names (rookie_or_first, serial_number,
      // autograph{...}), so downstream consumers reading rookie_flag /
      // subset_insert_name / serial_number_fraction silently got undefined.
      const rarityClassification: RarityClassification | undefined = jsonData.card_info ? {
        rarity_tier: jsonData.card_info.autographed ? 'Authenticated Autograph'
          : jsonData.card_info.memorabilia ? 'Memorabilia / Relic'
          : jsonData.card_info.rookie_or_first ? 'Rookie / Debut / First Edition'
          : (jsonData.card_info.parallel_type || jsonData.card_info.subset) ? 'Parallel / Insert Variant'
          : 'Unconfirmed',
        serial_number_fraction: jsonData.card_info.serial_numbering || jsonData.card_info.serial_number || null,
        autograph_type: jsonData.card_info.autographed ? 'unverified' : 'none',
        memorabilia_type: jsonData.card_info.memorabilia || null,
        finish_material: jsonData.card_info.print_finish || jsonData.card_info.finish || '',
        rookie_flag: jsonData.card_info.rookie_or_first ? 'yes' : 'no',
        subset_insert_name: jsonData.card_info.subset || null,
        special_attributes: [],
        rarity_notes: '',
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
          version: 'conversational-v9.1-json',
          prompt_version: DCM_PROMPT_VERSION
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
          version: 'conversational-v9.1-markdown',
          prompt_version: DCM_PROMPT_VERSION
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
        errorMessage.includes('500');
        // v8.8: '400' removed — bad-request errors are deterministic; retrying them
        // just tripled latency/cost on permanent failures.

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
