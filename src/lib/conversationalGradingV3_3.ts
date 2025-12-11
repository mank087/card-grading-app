/**
 * Conversational Grading v3.3/v3.5 PATCHED v2 - Enhanced Features
 *
 * This module provides TypeScript interfaces and utility functions for the v3.3/v3.5
 * conversational grading system with defect coordinates, rarity classification,
 * and advanced scoring logic. Supports both v3.3 and v3.5 PATCHED v2 formats.
 */

// ============================================================================
// INTERFACES - v3.3 Data Structures
// ============================================================================

/**
 * Defect coordinate with percentage-based position (0-100)
 * Always relative to top-left corner of card
 */
export interface DefectCoordinate {
  x: number; // 0-100 percentage horizontal
  y: number; // 0-100 percentage vertical
  defect_type: 'scratch' | 'dent' | 'crease' | 'print_line' | 'pressure_mark' | 'other';
  severity: 'Microscopic' | 'Minor' | 'Moderate' | 'Heavy';
  description: string;
  side: 'front' | 'back';
  cross_side_verified?: boolean;
}

/**
 * Rarity classification following v3.3 10-tier hierarchy
 */
export interface RarityClassification {
  rarity_tier: '1-of-1 / Unique' | 'Super Short Print (SSP)' | 'Short Print (SP)' |
                'Authenticated Autograph' | 'Memorabilia / Relic' | 'Parallel / Insert Variant' |
                'Rookie / Debut / First Edition' | 'Limited Edition / Event Issue' |
                'Commemorative / Promo' | 'Base / Common' | 'Unconfirmed';
  serial_number_fraction: string | null; // e.g., "12/99"
  autograph_type: 'on-card' | 'sticker' | 'unverified' | 'none';
  memorabilia_type: string | null; // patch, fabric, relic, jersey, etc.
  finish_material: string; // foil, matte, refractor, chrome, etc.
  rookie_flag: 'yes' | 'no' | 'potential';
  subset_insert_name: string | null;
  special_attributes: string[]; // die-cut, acetate, booklet, metal, etc.
  rarity_notes: string;
}

/**
 * Cross-side verification result for structural damage detection
 */
export type CrossSideVerificationResult =
  | 'Confirmed Structural Crease'
  | 'Confirmed Dent / Indentation'
  | 'Uncertain Artifact'
  | 'Cleared Reflection'
  | null;

/**
 * Enhanced grading metadata from v3.3
 */
export interface GradingMetadataV3_3 {
  weighted_total_pre_cap: number; // Score before any caps applied
  capped_grade_reason: string | null; // Explanation if capped
  conservative_rounding_applied: boolean; // True if rounded down
  lighting_conditions_notes: string; // Environmental conditions
  cross_side_verification_result: CrossSideVerificationResult;
  image_confidence: 'A' | 'B' | 'C' | 'D';
}

/**
 * Complete v3.3 conversational grading result
 * Extends the basic ConversationalGradeResult with v3.3 enhancements
 */
export interface ConversationalGradeResultV3_3 {
  markdown_report: string;
  extracted_grade: {
    decimal_grade: number | null;
    whole_grade: number | null;
    uncertainty: string;
  };
  rarity_classification?: RarityClassification;
  defect_coordinates_front: DefectCoordinate[];
  defect_coordinates_back: DefectCoordinate[];
  grading_metadata: GradingMetadataV3_3;
  meta: {
    model: string;
    timestamp: string;
    version: 'conversational-v3.3' | 'conversational-v3.5-patched-v2';
    prompt_version: 'Conversational_Grading_v3.3' | 'Conversational_Grading_v3.5_PATCHED_v2';
  };
}

// ============================================================================
// CONSERVATIVE ROUNDING LOGIC
// ============================================================================

/**
 * Apply conservative rounding rule from v3.3
 *
 * Rule: If weighted total is fractional (9.5, 8.5, etc.) AND any uncertainty exists,
 * round down to next lower half-point.
 *
 * @param weightedTotal - Calculated weighted grade
 * @param imageConfidence - Image quality grade (A/B/C/D)
 * @param crossCheckStatus - Cross-side verification result
 * @returns Object with final grade and flag indicating if rounding was applied
 */
export function applyConservativeRounding(
  weightedTotal: number,
  imageConfidence: 'A' | 'B' | 'C' | 'D',
  crossCheckStatus: CrossSideVerificationResult
): { finalGrade: number; roundingApplied: boolean } {

  // Check if uncertainty exists
  const hasUncertainty =
    imageConfidence !== 'A' || // Image quality below perfect
    crossCheckStatus === 'Uncertain Artifact'; // Unconfirmed defect

  // Check if score is fractional half-point (9.5, 8.5, 7.0, etc.)
  const isFractional = (weightedTotal % 0.5) === 0;

  // Apply conservative rounding if both conditions met
  if (hasUncertainty && isFractional) {
    return {
      finalGrade: Math.max(weightedTotal - 0.5, 0), // Round down, minimum 0
      roundingApplied: true
    };
  }

  return {
    finalGrade: weightedTotal,
    roundingApplied: false
  };
}

// ============================================================================
// CENTERING CAP VALIDATION
// ============================================================================

/**
 * Centering cap table from v3.3 specification
 */
const CENTERING_CAPS: Array<{ maxRatio: number; maxScore: number }> = [
  { maxRatio: 55, maxScore: 10.0 },
  { maxRatio: 60, maxScore: 9.5 },
  { maxRatio: 65, maxScore: 9.0 },
  { maxRatio: 70, maxScore: 8.0 },
  { maxRatio: Infinity, maxScore: 7.0 }, // > 70/30
];

/**
 * Apply centering cap based on worst-axis ratio
 *
 * @param centeringScore - Calculated centering score
 * @param worstAxisRatio - Worst centering ratio as string (e.g., "65/35")
 * @returns Capped score (cannot exceed limit for ratio)
 */
export function applyCenteringCap(
  centeringScore: number,
  worstAxisRatio: string
): number {
  // Parse ratio string to get worst side
  const parts = worstAxisRatio.split('/').map(s => parseInt(s.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) {
    console.warn(`[v3.3] Invalid centering ratio: ${worstAxisRatio}, using uncapped score`);
    return centeringScore;
  }

  const worstSide = Math.max(...parts);

  // Find applicable cap
  const cap = CENTERING_CAPS.find(c => worstSide <= c.maxRatio);
  const maxScore = cap?.maxScore ?? 7.0;

  // Apply cap
  const cappedScore = Math.min(centeringScore, maxScore);

  if (cappedScore < centeringScore) {
    console.log(`[v3.3] Centering capped: ${centeringScore} → ${cappedScore} (ratio: ${worstAxisRatio})`);
  }

  return cappedScore;
}

// ============================================================================
// QUANTITATIVE SUB-SCORE DEDUCTION FRAMEWORK
// ============================================================================

/**
 * Deduction ranges by severity level from v3.3 specification
 *
 * v5.13 UPDATE: Increased deductions by ~50% for stricter grading
 * - Visible defects should receive harsher penalties
 * - "Minor" now reserved for defects requiring magnification
 * - "Moderate" is minimum for any clearly visible defect
 */
const SEVERITY_DEDUCTIONS = {
  'Microscopic': { min: 0.2, max: 0.3, avg: 0.25 },   // Was 0.15 avg
  'Minor': { min: 0.5, max: 0.8, avg: 0.65 },         // Was 0.40 avg
  'Moderate': { min: 0.9, max: 1.5, avg: 1.20 },      // Was 0.80 avg
  'Heavy': { min: 1.8, max: 3.0, avg: 2.50 },         // Was 1.50 avg
  'none': { min: 0, max: 0, avg: 0 },
} as const;

/**
 * Calculate sub-score using quantitative deduction framework
 *
 * Each category starts at 10.0 and deducts points for each defect.
 * Uses average deduction value for each severity level.
 *
 * @param defects - Array of defects with severity levels
 * @returns Calculated sub-score (0.0 - 10.0)
 */
export function calculateSubScoreWithDeductions(
  defects: Array<{ severity: keyof typeof SEVERITY_DEDUCTIONS }>
): number {
  let score = 10.0;

  for (const defect of defects) {
    const deduction = SEVERITY_DEDUCTIONS[defect.severity]?.avg ?? 0;
    score -= deduction;
  }

  return Math.max(score, 0); // Never below 0
}

/**
 * Calculate deduction breakdown for transparency
 *
 * @param defects - Array of defects with severity levels
 * @returns Object with total deductions and breakdown by severity
 */
export function calculateDeductionBreakdown(
  defects: Array<{ severity: keyof typeof SEVERITY_DEDUCTIONS }>
): {
  total_deduction: number;
  microscopic_count: number;
  minor_count: number;
  moderate_count: number;
  heavy_count: number;
  microscopic_deduction: number;
  minor_deduction: number;
  moderate_deduction: number;
  heavy_deduction: number;
} {
  const breakdown = {
    total_deduction: 0,
    microscopic_count: 0,
    minor_count: 0,
    moderate_count: 0,
    heavy_count: 0,
    microscopic_deduction: 0,
    minor_deduction: 0,
    moderate_deduction: 0,
    heavy_deduction: 0,
  };

  for (const defect of defects) {
    const severity = defect.severity;
    const deduction = SEVERITY_DEDUCTIONS[severity]?.avg ?? 0;

    breakdown.total_deduction += deduction;

    switch (severity) {
      case 'Microscopic':
        breakdown.microscopic_count++;
        breakdown.microscopic_deduction += deduction;
        break;
      case 'Minor':
        breakdown.minor_count++;
        breakdown.minor_deduction += deduction;
        break;
      case 'Moderate':
        breakdown.moderate_count++;
        breakdown.moderate_deduction += deduction;
        break;
      case 'Heavy':
        breakdown.heavy_count++;
        breakdown.heavy_deduction += deduction;
        break;
    }
  }

  return breakdown;
}

// ============================================================================
// GRADE CAP ENFORCEMENT
// ============================================================================

/**
 * Grade caps from v3.3 specification
 */
const GRADE_CAPS = {
  'structural_crease': 4.0,
  'bent_corner': 4.0,
  'surface_dent': 6.0,
  'unverified_autograph': null, // N/A
  'handwritten_marking': null, // N/A
  'missing_side': null, // N/A
  'confidence_d': null, // N/A
} as const;

/**
 * Apply grade caps based on structural damage or other conditions
 *
 * @param calculatedGrade - Weighted total grade
 * @param crossSideResult - Cross-side verification result
 * @param hasUnverifiedAutograph - True if unverified autograph detected
 * @param hasHandwriting - True if handwritten marking detected
 * @param imageConfidence - Image quality grade
 * @returns Object with capped grade and reason (if applicable)
 */
export function applyGradeCaps(
  calculatedGrade: number,
  crossSideResult: CrossSideVerificationResult,
  hasUnverifiedAutograph: boolean,
  hasHandwriting: boolean,
  imageConfidence: 'A' | 'B' | 'C' | 'D'
): { cappedGrade: number | null; capReason: string | null } {

  // N/A conditions (most severe)
  if (hasHandwriting) {
    return { cappedGrade: null, capReason: 'Handwritten marking detected' };
  }
  if (hasUnverifiedAutograph) {
    return { cappedGrade: null, capReason: 'Unverified autograph present' };
  }
  if (imageConfidence === 'D') {
    return { cappedGrade: null, capReason: 'Image quality insufficient (Grade D)' };
  }

  // Structural damage caps
  if (crossSideResult === 'Confirmed Structural Crease') {
    const capped = Math.min(calculatedGrade, GRADE_CAPS.structural_crease);
    return {
      cappedGrade: capped,
      capReason: capped < calculatedGrade ? 'Confirmed structural crease (max 4.0)' : null
    };
  }

  if (crossSideResult === 'Confirmed Dent / Indentation') {
    const capped = Math.min(calculatedGrade, GRADE_CAPS.surface_dent);
    return {
      cappedGrade: capped,
      capReason: capped < calculatedGrade ? 'Confirmed surface dent (max 6.0)' : null
    };
  }

  // No cap needed
  return { cappedGrade: calculatedGrade, capReason: null };
}

// ============================================================================
// MARKDOWN PARSER - Extract v3.3 Fields
// ============================================================================

/**
 * Parse rarity classification from markdown report
 *
 * Looks for the RARITY & FEATURE CLASSIFICATION section
 */
export function parseRarityClassification(markdown: string): RarityClassification | null {
  try {
    // Look for rarity section
    const rarityMatch = markdown.match(/Rarity Tier:\s*(.+)/i);
    const serialMatch = markdown.match(/Serial Number:\s*(.+)/i);
    const autographMatch = markdown.match(/Autograph Type:\s*(.+)/i);
    const memorabiliaMatch = markdown.match(/Memorabilia Type:\s*(.+)/i);
    const finishMatch = markdown.match(/Finish \/ Material:\s*(.+)/i);
    const rookieMatch = markdown.match(/Rookie Flag:\s*(.+)/i);
    const subsetMatch = markdown.match(/Subset \/ Insert Name:\s*(.+)/i);
    const attributesMatch = markdown.match(/Special Attributes:\s*(.+)/i);
    const notesMatch = markdown.match(/(?:Rarity )?Notes:\s*(.+)/i);

    if (!rarityMatch) {
      return null; // No rarity section found
    }

    return {
      rarity_tier: (rarityMatch[1]?.trim() || 'Unconfirmed') as any,
      serial_number_fraction: serialMatch?.[1]?.trim() === 'None Visible' ? null : (serialMatch?.[1]?.trim() || null),
      autograph_type: (autographMatch?.[1]?.trim().toLowerCase() || 'none') as any,
      memorabilia_type: memorabiliaMatch?.[1]?.trim() === 'none' ? null : (memorabiliaMatch?.[1]?.trim() || null),
      finish_material: finishMatch?.[1]?.trim() || 'Unknown',
      rookie_flag: (rookieMatch?.[1]?.trim().toLowerCase() || 'no') as any,
      subset_insert_name: subsetMatch?.[1]?.trim() || null,
      special_attributes: attributesMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [],
      rarity_notes: notesMatch?.[1]?.trim() || '',
    };
  } catch (error) {
    console.error('[v3.3] Failed to parse rarity classification:', error);
    return null;
  }
}

/**
 * Parse defect coordinates from markdown report
 *
 * Looks for coordinate patterns like "(X%, Y%)" in surface analysis
 */
export function parseDefectCoordinates(markdown: string, side: 'front' | 'back'): DefectCoordinate[] {
  const defects: DefectCoordinate[] = [];

  try {
    // Pattern: word or phrase followed by "at (X%, Y%)"
    const pattern = /(\w+(?:\s+\w+)*)\s+at\s+\((\d+)%,\s*(\d+)%\)/gi;
    let match;

    while ((match = pattern.exec(markdown)) !== null) {
      const description = match[1];
      const x = parseInt(match[2]);
      const y = parseInt(match[3]);

      // Determine defect type from description
      let defect_type: DefectCoordinate['defect_type'] = 'other';
      const desc = description.toLowerCase();
      if (desc.includes('scratch')) defect_type = 'scratch';
      else if (desc.includes('dent')) defect_type = 'dent';
      else if (desc.includes('crease')) defect_type = 'crease';
      else if (desc.includes('print line')) defect_type = 'print_line';
      else if (desc.includes('pressure')) defect_type = 'pressure_mark';

      // Determine severity from context (look for severity keywords nearby)
      let severity: DefectCoordinate['severity'] = 'Minor';
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(markdown.length, match.index + 200);
      const context = markdown.substring(contextStart, contextEnd).toLowerCase();

      if (context.includes('microscopic')) severity = 'Microscopic';
      else if (context.includes('heavy')) severity = 'Heavy';
      else if (context.includes('moderate')) severity = 'Moderate';
      else if (context.includes('minor')) severity = 'Minor';

      defects.push({
        x,
        y,
        defect_type,
        severity,
        description: match[1],
        side
      });
    }

    return defects;
  } catch (error) {
    console.error(`[v3.3] Failed to parse ${side} defect coordinates:`, error);
    return [];
  }
}

/**
 * Parse grading metadata from markdown report
 */
export function parseGradingMetadata(markdown: string): Partial<GradingMetadataV3_3> {
  try {
    const weightedTotalMatch = markdown.match(/Weighted Total:\s*([\d.]+)/i);
    const cappedReasonMatch = markdown.match(/Capped Grade.*?:\s*(.+?)(?:\n|$)/i);
    const roundingMatch = markdown.match(/Conservative Rounding.*?:\s*(.+?)(?:\n|$)/i);
    const lightingMatch = markdown.match(/(?:Lighting Conditions|LIGHTING & IMAGE CONDITIONS).*?:\s*(.+?)(?:\n\n|$)/is);
    const crossSideMatch = markdown.match(/Cross-Side Verification.*?:\s*(.+?)(?:\n|$)/i);
    const confidenceMatch = markdown.match(/Image (?:Quality )?Confidence.*?:\s*([A-D])/i);

    return {
      weighted_total_pre_cap: weightedTotalMatch ? parseFloat(weightedTotalMatch[1]) : undefined,
      capped_grade_reason: cappedReasonMatch?.[1]?.trim() || null,
      conservative_rounding_applied: roundingMatch?.[1]?.toLowerCase().includes('applied') || false,
      lighting_conditions_notes: lightingMatch?.[1]?.trim() || '',
      cross_side_verification_result: (crossSideMatch?.[1]?.trim() || null) as CrossSideVerificationResult,
      image_confidence: (confidenceMatch?.[1] || 'B') as any,
    };
  } catch (error) {
    console.error('[v3.3] Failed to parse grading metadata:', error);
    return {};
  }
}

/**
 * Parse subscores and backward-compatible data from v3.3/v3.5 markdown
 * Extracts data from :::SUBSCORES and :::CHECKLIST blocks for compatibility with existing code
 * Supports both v3.3 and v3.5 PATCHED v2 formats
 */
export function parseBackwardCompatibleData(markdown: string): {
  sub_scores: any;
  centering_ratios: any;
  condition_label: string | null;
  slab_detection: any;
  autograph_verification: string | null;
  handwritten_markings: boolean;
} | null {
  try {
    // Extract SUBSCORES block (same in v3.3 and v3.5 PATCHED v2)
    const subscoresMatch = markdown.match(/:::SUBSCORES\s+([\s\S]+?)\s+:::END/);
    const subscoresRaw = subscoresMatch?.[1] || '';

    const parseValue = (key: string): number => {
      const match = subscoresRaw.match(new RegExp(`${key}:\\s*([\\d.]+)`, 'i'));
      return match ? parseFloat(match[1]) : 0;
    };

    const sub_scores = {
      centering: {
        front: parseValue('centering_front'),
        back: parseValue('centering_back'),
        weighted: (parseValue('centering_front') + parseValue('centering_back')) / 2
      },
      corners: {
        front: parseValue('corners_front'),
        back: parseValue('corners_back'),
        weighted: (parseValue('corners_front') + parseValue('corners_back')) / 2
      },
      edges: {
        front: parseValue('edges_front'),
        back: parseValue('edges_back'),
        weighted: (parseValue('edges_front') + parseValue('edges_back')) / 2
      },
      surface: {
        front: parseValue('surface_front'),
        back: parseValue('surface_back'),
        weighted: (parseValue('surface_front') + parseValue('surface_back')) / 2
      }
    };

    // Extract centering ratios - support both v3.3 and v3.5 formats
    // v3.3: CENTERING (Front) ... Left/Right: 55/45
    // v3.5: A. Centering ... Left/Right: 55/45 OR [STEP 3] FRONT EVALUATION section

    // Try v3.5 format first (within STEP 3/4 FRONT/BACK EVALUATION sections)
    const step3Match = markdown.match(/\[STEP 3\] FRONT (?:ANALYSIS|EVALUATION)[\s\S]*?(?=\[STEP 4\]|$)/i);
    const step4Match = markdown.match(/\[STEP 4\] BACK (?:ANALYSIS|EVALUATION)[\s\S]*?(?=\[STEP 5\]|$)/i);

    // Updated regex to handle markdown formatting (bold **) - both "Left/Right:" and "**Left/Right**:" formats
    let frontLRMatch = step3Match?.[0].match(/(?:\*\*)?Left\/Right(?:\*\*)?:\s*(\d+\/\d+)/i);
    let frontTBMatch = step3Match?.[0].match(/(?:\*\*)?Top\/Bottom(?:\*\*)?:\s*(\d+\/\d+)/i);
    let backLRMatch = step4Match?.[0].match(/(?:\*\*)?Left\/Right(?:\*\*)?:\s*(\d+\/\d+)/i);
    let backTBMatch = step4Match?.[0].match(/(?:\*\*)?Top\/Bottom(?:\*\*)?:\s*(\d+\/\d+)/i);

    // Fallback to v3.3 format if v3.5 not found
    if (!frontLRMatch) {
      frontLRMatch = markdown.match(/CENTERING \(Front\)[\s\S]*?Left\/Right.*?:\s*(\d+\/\d+)/i);
    }
    if (!frontTBMatch) {
      frontTBMatch = markdown.match(/CENTERING \(Front\)[\s\S]*?Top\/Bottom.*?:\s*(\d+\/\d+)/i);
    }
    if (!backLRMatch) {
      backLRMatch = markdown.match(/CENTERING \(Back\)[\s\S]*?Left\/Right.*?:\s*(\d+\/\d+)/i);
    }
    if (!backTBMatch) {
      backTBMatch = markdown.match(/CENTERING \(Back\)[\s\S]*?Top\/Bottom.*?:\s*(\d+\/\d+)/i);
    }

    const centering_ratios = {
      front_lr: frontLRMatch?.[1] || '50/50',
      front_tb: frontTBMatch?.[1] || '50/50',
      back_lr: backLRMatch?.[1] || '50/50',
      back_tb: backTBMatch?.[1] || '50/50'
    };

    // Extract condition label from STEP 6 or STEP 11
    const conditionLabelMatch = markdown.match(/Condition Label.*?:\s*(.+?)(?:\n|$)/i);
    const condition_label = conditionLabelMatch?.[1]?.trim() || null;

    // Extract CHECKLIST block
    const checklistMatch = markdown.match(/:::CHECKLIST\s+([\s\S]+?)\s+:::END/);
    const checklistRaw = checklistMatch?.[1] || '';

    const getChecklistValue = (key: string): string => {
      const match = checklistRaw.match(new RegExp(`${key}:\\s*(.+?)(?=\\n|$)`, 'i'));
      return match?.[1]?.trim() || '';
    };

    const autograph_verified = getChecklistValue('autograph_verified');
    const handwritten_markings_raw = getChecklistValue('handwritten_markings');
    const both_sides_present = getChecklistValue('both_sides_present');

    // Slab detection (not in v3.3, set to default)
    const slab_detection = {
      slab_detected: false,
      slab_type: null,
      slab_notes: null
    };

    return {
      sub_scores,
      centering_ratios,
      condition_label,
      slab_detection,
      autograph_verification: autograph_verified || null,
      handwritten_markings: handwritten_markings_raw.toLowerCase().includes('yes') || handwritten_markings_raw.toLowerCase().includes('detected')
    };
  } catch (error) {
    console.error('[v3.3] Failed to parse backward-compatible data:', error);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConversationalGradingV3_3 = {
  applyConservativeRounding,
  applyCenteringCap,
  calculateSubScoreWithDeductions,
  calculateDeductionBreakdown,
  applyGradeCaps,
  parseRarityClassification,
  parseDefectCoordinates,
  parseGradingMetadata,
  parseBackwardCompatibleData,
  SEVERITY_DEDUCTIONS,
  CENTERING_CAPS,
  GRADE_CAPS,
};

export default ConversationalGradingV3_3;
