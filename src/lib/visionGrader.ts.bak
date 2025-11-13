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
    adjusted_uncertainty: '±0.0' | '±0.25' | '±0.5' | '±1.0';
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
    grade_uncertainty: '±0.0' | '±0.25' | '±0.5' | '±1.0' | 'N/A';
  };
  grading_status?: string; // Optional field for N/A grades or special statuses
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
  model?: 'gpt-4o' | 'gpt-4o-mini';
  temperature?: number;
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
    const promptPath = path.join(process.cwd(), 'prompts', 'card_grader_v1.txt');
    gradingPrompt = fs.readFileSync(promptPath, 'utf-8');
    console.log(`[DVG v1] Loaded grading prompt successfully (${gradingPrompt.length} characters)${isDevelopment ? ' [DEV MODE - fresh load]' : ' [PROD MODE - cached]'}`);
    return gradingPrompt;
  } catch (error) {
    console.error('[DVG v1] Failed to load grading prompt:', error);
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
    model = 'gpt-4o',
    temperature = 0.3 // Use lower temperature (0.3) for consistent, strict defect detection
    // opencvSummary removed 2025-10-19: OpenCV boundary detection unreliable
  } = options;

  console.log('[DVG v2] Starting vision grading with Chat Completions API...');
  console.log(`[DVG v2] Model: ${model}, Temperature: ${temperature}`);

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Load grading prompt as system message
  const gradingPromptText = loadGradingPrompt();
  console.log(`[DVG v2] Loaded grading prompt (${gradingPromptText.length} characters)`);

  try {
    console.log('[DVG v2] Calling Chat Completions API with vision...');

    // Build user message text with enhanced edge/surface defect detection
    // (OpenCV summary removed 2025-10-19: OpenCV unreliable)
    const userMessageText = ENHANCED_USER_MESSAGE;\n**CRITICAL - CHECK THIS FIRST:**\n- Look for ANY protective covering: penny sleeve, top loader, semi-rigid holder, slab\n- Penny sleeves appear as CLEAR PLASTIC with visible edges/seams around the card\n- Top loaders are rigid plastic cases with open top\n- Semi-rigids are stiff plastic holders\n- Slabs are professionally sealed hard cases (PSA, BGS, CGC, etc.)\n- If card is in ANY case/sleeve → Set case_detection.case_type to the appropriate value\n- Document case presence in image_quality.notes: "Card in [case type] - may affect defect visibility"\n- Penny sleeves especially can obscure fine defects and create glare\n\n🔴 PRIORITY 0B: IMAGE QUALITY - CORNER VISIBILITY CHECK\nBEFORE GRADING: Verify ALL 8 corners (4 front + 4 back) are FULLY VISIBLE in frame.\n- Corner is "CUT OFF" if tip extends beyond frame or touches image border\n- If ANY corner cut off → Image Quality grade "C" (±0.5) - document which corners in notes\n- If 2+ corners cut off → Image Quality grade "D" (±1.0)\n- NEVER assign grade "A" or "B" if ANY corner is cut off\n\n🔴 PRIORITY 1: UNVERIFIED AUTOGRAPH CHECK (GRADE: N/A - ALTERATION)\n**CRITICAL - CHECK THIS FIRST BEFORE GRADING:**\n- Look for ANY handwritten signature, autograph, or ink writing on front or back\n- If you see an AUTOGRAPH (handwritten signature with player name/initials):\n  → Check for manufacturer authentication: hologram, foil stamp, "Certified Autograph" text, serial number\n  → If NO authentication markers visible → ❌ AUTOMATIC GRADE 1.0 (Altered - unverified autograph)\n  → If authentication IS visible → Card is gradable normally\n- ❌ NEVER grade an unverified autograph higher than 1.0\n- Common unverified autographs: Signatures obtained in-person, through-the-mail, or added post-production without manufacturer certification\n\n🔴 PRIORITY 2: CREASES & STRUCTURAL DAMAGE (GRADE CAP: 4.0 OR LOWER)\n- Scan ENTIRE card surface (front and back) for ANY visible lines, folds, or indentations\n- Look for BENT CORNERS (corners that don\'t lie flat, appear raised or deformed)\n- Check for SURFACE CREASES (any line visible from reflected light, especially mid-card)\n- Examine card at ANGLES to catch light reflection that reveals creases\n- ❌ If you find ANY crease or bent corner → AUTOMATIC MAX GRADE 4.0\n- Common locations: Mid-card horizontal creases, corner bends, diagonal folds\n\n🔴 PRIORITY 3: HANDWRITTEN MARKINGS (NON-AUTOGRAPH)\n- Check BOTH sides (especially back) for ANY pen, pencil, or marker writing\n- Numbers, letters, symbols, prices (e.g., "100", "$5", initials)\n- ❌ Any handwritten marking → AUTOMATIC GRADE 1.0\n\n🔴 PRIORITY 4: EDGE DEFECTS - SYSTEMATIC SCAN (ALL 4 EDGES)\n**⚠️ YOU MUST EXAMINE EVERY EDGE - DO NOT ASSUME PERFECTION ⚠️**\n\n1. **TOP EDGE** (Scan LEFT TO RIGHT across entire edge):\n   - WHITE DOTS/SPOTS (small isolated light spots 0.1-0.5mm from edge chipping)\n   - CONTINUOUS WHITENING (linear white bands along edge)\n   - EDGE CHIPPING (missing material exposing card stock)\n   - ROUGHNESS (uneven or jagged edge texture)\n   - ⚠️ Top edges are OFTEN damaged but frequently missed - LOOK CLOSELY\n\n2. **BOTTOM EDGE** (MOST commonly damaged - Scan LEFT TO RIGHT):\n   - WHITE DOTS/SPOTS (small isolated light spots - NOT just continuous lines)\n   - CONTINUOUS WHITENING (linear white bands along edge)\n   - EDGE CHIPPING (missing material exposing card stock)\n   - ROUGHNESS (uneven or jagged edge texture)\n   - ⚠️ Bottom edges have defects on 70% of cards - If you find ZERO defects, RECHECK\n\n3. **LEFT & RIGHT EDGES** (Scan TOP TO BOTTOM):\n   - Same defect types as above\n   - Divide each edge into 5 segments and inspect each\n\n4. **ALL FOUR CORNERS:** Check EACH corner tip for whitening (even < 0.1mm), bent/raised corners\n\n⚠️ CRITICAL: White dots appear as tiny ISOLATED light spots (0.1-0.5mm each) - NOT continuous lines. Look for BOTH dot patterns AND line patterns. FINDING ZERO EDGE DEFECTS IS EXTREMELY RARE - if you see none, you are likely missing them.\n\n🔴 PRIORITY 5: SURFACE DEFECTS - SCAN FRONT AND BACK COMPLETELY\n**⚠️ SCAN ENTIRE SURFACE - DO NOT JUST GLANCE ⚠️**\n\n1. **WHITE DOTS/SPOTS ON SURFACE** (MOST commonly missed defect):\n   - Small white or light-colored dots/spots on card face (NOT on edges)\n   - Print dots: White spots on printed areas (0.1-1mm diameter)\n   - Appear as isolated light spots against darker backgrounds\n   - Check BOTTOM THIRD of card surface especially - most common location\n   - Even ONE white dot on surface = NOT a 10.0 grade\n\n2. **SCRATCHES:**\n   - Any visible lines on surface (hairline or visible)\n   - Check at different angles to catch light reflection\n\n3. **PRINT DEFECTS:**\n   - Print dots, lines, hickeys (donut shapes)\n   - Missing ink, color misalignment\n   - Out-of-focus printing\n\n4. **STAINS & DISCOLORATION:**\n   - Wax stains, water damage, yellowing\n   - Ink marks, foreign substances\n\n5. **SURFACE DAMAGE:**\n   - Dents, indentations, **CREASES**\n   - Any fold lines or surface distortions\n\n⚠️ CRITICAL: Surface white dots/print defects are EASILY MISSED. Scan the ENTIRE surface methodically - divide into zones and check each. If you report "no surface defects" on a card, you are likely missing something.\n\n⚠️ CRITICAL REMINDERS:\n- If you detect an UNVERIFIED AUTOGRAPH → Grade 1.0 (Altered)\n- If you detect a CREASE or BENT CORNER → Maximum grade 4.0\n- If you detect HANDWRITTEN MARKING → Grade 1.0 (Altered)\n- If you detect ANY edge/corner defect → Card is NOT a 10.0\n- Grade 10.0 is < 1% of cards - most high-quality cards are 9.0-9.5\n- Be APPROPRIATELY CRITICAL - look for defects, don\'t assume perfection';

    // Use Chat Completions API instead of Assistants API
    // This matches ChatGPT's implementation and provides better defect detection
    const response = await openai.chat.completions.create({
      model: model,
      temperature: temperature,
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
                detail: 'high'
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: backImageUrl,
                detail: 'high'
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

    // Extract response
    const responseMessage = response.choices[0]?.message;
    if (!responseMessage || !responseMessage.content) {
      throw new Error('No response content from API');
    }

    const responseText = responseMessage.content;
    console.log('[DVG v2] Response length:', responseText.length);

    // Parse JSON response
    let gradeResult: VisionGradeResult;
    try {
      gradeResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[DVG v2] Failed to parse JSON response:', parseError);
      console.error('[DVG v2] Raw response:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response from API');
    }

    // Validate required fields exist
    if (!gradeResult.meta || !gradeResult.card_info || !gradeResult.recommended_grade) {
      console.error('[DVG v2] Missing required fields in response');
      throw new Error('Incomplete grading result from API');
    }

    console.log('[DVG v2] Grading completed successfully');
    console.log(`[DVG v2] Grade: ${gradeResult.recommended_grade.recommended_decimal_grade}`);

    return gradeResult;

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
    model?: 'gpt-4o' | 'gpt-4o-mini';
    temperature?: number;
  }
): Promise<VisionGradeResult['estimated_professional_grades']> {
  const {
    model = 'gpt-4o',
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

  // Check for structural damage indicators
  const hasCrease =
    dcmResult.defects.front.surface.creases.severity !== 'none' ||
    dcmResult.defects.back.surface.creases.severity !== 'none';

  // Check for handwriting (grade 1.0 with specific status)
  const hasHandwriting =
    dcmResult.recommended_grade.recommended_decimal_grade === 1.0 &&
    dcmResult.grading_status?.toLowerCase().includes('altered');

  // Check for alterations (also grade 1.0 with altered status)
  const hasAlterations = hasHandwriting || (
    dcmResult.recommended_grade.recommended_decimal_grade === 1.0 &&
    (dcmResult.analysis_summary.negatives.some(n =>
      n.toLowerCase().includes('altered') ||
      n.toLowerCase().includes('handwritten') ||
      n.toLowerCase().includes('marking')
    ))
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
    model?: 'gpt-4o' | 'gpt-4o-mini';
    temperature?: number;
  }
): Promise<DetailedInspectionResult> {
  const {
    model = 'gpt-4o',
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
