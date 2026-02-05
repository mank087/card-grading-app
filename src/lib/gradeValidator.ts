/**
 * Post-Processing Grade Validation
 *
 * Enforces grade caps based on ChatGPT's forensic analysis recommendations.
 * Acts as a safety net to prevent grade inflation even if AI outputs optimistic grades.
 *
 * Based on: GRADING_INSTRUCTION_HARDENING_PLAN.md - STEP 8
 * Date: 2025-10-19
 * Updated: 2025-10-20 - Added statistical hard cap option
 */

import { VisionGradeResult } from './visionGrader';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION - Grade Validator Settings
// ═══════════════════════════════════════════════════════════════════════════════

// TESTING MODE (2025-10-20): Temporarily disabled to test simplified prompt
// When true, validator only LOGS potential caps but does NOT modify grades
// This lets us see if the simplified prompt makes AI naturally find defects
export const VALIDATOR_LOG_ONLY_MODE = false;  // ENABLED - Enforcing all caps

// Statistical Hard Cap: Always block 10.0 to enforce <1% statistical rarity
// Only applies if VALIDATOR_LOG_ONLY_MODE = false
export const ENABLE_STATISTICAL_HARD_CAP = false;  // Default: false (use defect-based caps only)

// ═══════════════════════════════════════════════════════════════════════════════

export interface GradeCapResult {
  original_grade: number | null;
  capped_grade: number | null;
  cap_applied: boolean;
  cap_reasons: string[];
}

/**
 * Enforce grade caps based on defect findings and validation checks
 *
 * This function implements hard caps that override the AI's grade if:
 * 1. Perfect-gate checks failed
 * 2. Micro-findings show non-zero defect counts
 * 3. Multiple categories have defects
 * 4. High grade uncertainty
 */
export function enforceGradeCaps(result: VisionGradeResult): VisionGradeResult {
  const originalGrade = result.recommended_grade.recommended_decimal_grade;

  // Skip validation for N/A grades (altered cards)
  if (originalGrade === null) {
    return result;
  }

  let cappedGrade = originalGrade;
  const cappedReasons: string[] = [];

  console.log(`[GRADE VALIDATOR] Starting validation for grade ${originalGrade}`);

  // ═════════════════════════════════════════════════════════════════════════
  // STRUCTURAL DAMAGE CAP (HIGHEST PRIORITY - Must be first)
  // ═════════════════════════════════════════════════════════════════════════
  // ANY crease or bent corner = Automatic 4.0 maximum
  if (result.defects) {
    let hasCrease = false;
    let hasBentCorner = false;

    // Check for creases on front or back
    if (result.defects.front?.surface?.creases?.severity !== 'none' && result.defects.front?.surface?.creases?.severity) {
      hasCrease = true;
    }
    if (result.defects.back?.surface?.creases?.severity !== 'none' && result.defects.back?.surface?.creases?.severity) {
      hasCrease = true;
    }

    // Check for bent/folded corners (look for "bent" or "folded" in descriptions)
    const checkCornerForBent = (corner: any): boolean => {
      if (!corner || !corner.description) return false;
      const desc = corner.description.toLowerCase();
      return desc.includes('bent') || desc.includes('folded') || desc.includes('does not lie flat') || desc.includes('raised');
    };

    if (result.defects.front?.corners) {
      const corners = result.defects.front.corners as any;
      if (checkCornerForBent(corners.top_left) || checkCornerForBent(corners.top_right) ||
          checkCornerForBent(corners.bottom_left) || checkCornerForBent(corners.bottom_right)) {
        hasBentCorner = true;
      }
    }

    if (result.defects.back?.corners) {
      const corners = result.defects.back.corners as any;
      if (checkCornerForBent(corners.top_left) || checkCornerForBent(corners.top_right) ||
          checkCornerForBent(corners.bottom_left) || checkCornerForBent(corners.bottom_right)) {
        hasBentCorner = true;
      }
    }

    if (hasCrease) {
      cappedGrade = Math.min(cappedGrade, 4.0);
      cappedReasons.push("STRUCTURAL DAMAGE: Crease detected - automatic 4.0 grade cap");
      console.log(`[GRADE VALIDATOR - STRUCTURAL DAMAGE] Crease detected → Grade capped at 4.0`);
    }

    if (hasBentCorner) {
      cappedGrade = Math.min(cappedGrade, 4.0);
      cappedReasons.push("STRUCTURAL DAMAGE: Bent/folded corner detected - automatic 4.0 grade cap");
      console.log(`[GRADE VALIDATOR - STRUCTURAL DAMAGE] Bent corner detected → Grade capped at 4.0`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STATISTICAL HARD CAP (ChatGPT Recommendation)
  // ═════════════════════════════════════════════════════════════════════════
  // Always block 10 to enforce <1% statistical rarity
  // This is the "give up on AI detection, just cap programmatically" approach
  if (ENABLE_STATISTICAL_HARD_CAP && originalGrade === 10) {
    cappedGrade = 9;
    cappedReasons.push("Statistical rarity enforcement - Grade 10 blocked (occurs in <1% of cards)");
    console.log(`[GRADE VALIDATOR - HARD CAP] 10 blocked by statistical hard cap → 9`);
  }
  // ═════════════════════════════════════════════════════════════════════════

  // CAP 1: Perfect-gate checks (if perfect_gate_checks field exists)
  if ((result as any).perfect_gate_checks) {
    const checks = (result as any).perfect_gate_checks;

    if (checks.corners8_pass === false) {
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push("8-corner audit incomplete or found defects (perfect_gate_checks.corners8_pass = false)");
    }

    if (checks.edges4_pass === false) {
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push("Edge audit incomplete or found defects (perfect_gate_checks.edges4_pass = false)");
    }

    if (checks.centering_two_axis_pass === false) {
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push("Centering outside 50/50-55/45 range (perfect_gate_checks.centering_two_axis_pass = false)");
    }

    if (checks.cross_side_pass === false) {
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push("Cross-side verification incomplete or failed (perfect_gate_checks.cross_side_pass = false)");
    }

    if (checks.image_quality_sufficient === false) {
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push("Image quality insufficient for micro-defect detection (perfect_gate_checks.image_quality_sufficient = false)");
    }
  }

  // CAP 2: Micro-findings summary (if micro_findings_summary field exists)
  if ((result as any).micro_findings_summary) {
    const findings = (result as any).micro_findings_summary;

    if (findings.corner_whitening_mm_sum_front > 0 || findings.corner_whitening_mm_sum_back > 0) {
      const totalWhitening = (findings.corner_whitening_mm_sum_front || 0) + (findings.corner_whitening_mm_sum_back || 0);
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push(`Corner whitening detected (${totalWhitening.toFixed(2)}mm total)`);
    }

    if ((findings.edge_chips_total || 0) > 0 || (findings.edge_whitening_dots_total || 0) > 0) {
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push(`Edge defects detected (${findings.edge_chips_total || 0} chips, ${findings.edge_whitening_dots_total || 0} white dots)`);
    }

    if ((findings.hairline_count_front || 0) > 0 || (findings.hairline_count_back || 0) > 0) {
      const totalHairlines = (findings.hairline_count_front || 0) + (findings.hairline_count_back || 0);
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push(`Hairline scratches detected (${totalHairlines} total)`);
    }

    if ((findings.print_dots_count_front || 0) > 0 || (findings.print_dots_count_back || 0) > 0) {
      const totalPrintDots = (findings.print_dots_count_front || 0) + (findings.print_dots_count_back || 0);
      cappedGrade = Math.min(cappedGrade, 9);
      cappedReasons.push(`Print dots detected (${totalPrintDots} total)`);
    }
  }

  // CAP 3: Multiple defect categories (fallback to legacy defects structure)
  // FIXED: Only count categories with ACTUAL defects (severity = 'minor', 'moderate', or 'heavy')
  if (result.defects) {
    let categoriesWithDefects = 0;

    // Helper function to check if severity indicates actual defects
    const hasDefect = (severity: string | undefined): boolean => {
      return severity === 'minor' || severity === 'moderate' || severity === 'heavy';
    };

    // Check front defects
    if (result.defects.front) {
      if (hasDefect(result.defects.front.corners?.severity)) categoriesWithDefects++;
      if (hasDefect(result.defects.front.edges?.severity)) categoriesWithDefects++;
      if (result.defects.front.surface) {
        const surface = result.defects.front.surface;
        if (hasDefect(surface.scratches?.severity) ||
            hasDefect(surface.print_defects?.severity) ||
            hasDefect(surface.creases?.severity) ||
            hasDefect(surface.stains?.severity) ||
            hasDefect(surface.other?.severity)) {
          categoriesWithDefects++;
        }
      }
    }

    // Check back defects
    if (result.defects.back) {
      if (hasDefect(result.defects.back.corners?.severity)) categoriesWithDefects++;
      if (hasDefect(result.defects.back.edges?.severity)) categoriesWithDefects++;
      if (result.defects.back.surface) {
        const surface = result.defects.back.surface;
        if (hasDefect(surface.scratches?.severity) ||
            hasDefect(surface.print_defects?.severity) ||
            hasDefect(surface.creases?.severity) ||
            hasDefect(surface.stains?.severity) ||
            hasDefect(surface.other?.severity)) {
          categoriesWithDefects++;
        }
      }
    }

    if (categoriesWithDefects >= 2) {
      cappedGrade = Math.min(cappedGrade, 9.0);
      cappedReasons.push(`Multiple defect categories affected (${categoriesWithDefects} categories have defects)`);
      console.log(`[GRADE VALIDATOR - DEFECT CAP] ${categoriesWithDefects} categories with defects → Grade capped at 9.0`);
    }
  }

  // CAP 4: REMOVED in v7.4 - grade_uncertainty is now a display-only reliability indicator
  // The old logic compared a string (e.g., "±1") to a number (0.3) which never worked anyway
  // Uncertainty is now shown to users as: A=±0, B=±1, C=±2, D=±3

  // CAP 5: Statistical reality check - grade 10 should be extremely rare
  // FIXED: Only check for ACTUAL defects, not just !== 'none'
  if (originalGrade === 10.0 && cappedGrade === 10.0) {
    // Helper to check for actual defects (not 'none' or undefined)
    const hasActualDefect = (severity: string | undefined): boolean => {
      return severity === 'minor' || severity === 'moderate' || severity === 'heavy';
    };

    // If still 10.0 after all checks, verify it's truly perfect
    const hasAnyDefect =
      hasActualDefect(result.defects?.front?.corners?.severity) ||
      hasActualDefect(result.defects?.front?.edges?.severity) ||
      hasActualDefect(result.defects?.front?.surface?.scratches?.severity) ||
      hasActualDefect(result.defects?.front?.surface?.print_defects?.severity) ||
      hasActualDefect(result.defects?.back?.corners?.severity) ||
      hasActualDefect(result.defects?.back?.edges?.severity) ||
      hasActualDefect(result.defects?.back?.surface?.scratches?.severity) ||
      hasActualDefect(result.defects?.back?.surface?.print_defects?.severity);

    if (hasAnyDefect) {
      cappedGrade = 9;
      cappedReasons.push("AI assigned 10 but defects were detected in legacy defect structure - safety cap applied");
      console.log(`[GRADE VALIDATOR - 10 SAFETY CHECK] Defects found → Grade capped at 9`);
    }
  }

  // Apply caps if grade was reduced (OR log only if in testing mode)
  if (cappedGrade < originalGrade) {
    if (VALIDATOR_LOG_ONLY_MODE) {
      console.log(`[GRADE VALIDATOR - LOG ONLY] Would cap: AI suggested ${originalGrade}, would cap at ${cappedGrade}`);
      console.log(`[GRADE VALIDATOR - LOG ONLY] Reasons: ${cappedReasons.join('; ')}`);
      console.log(`[GRADE VALIDATOR - LOG ONLY] NOT APPLYING CAP - Testing simplified prompt`);
      // Don't modify grade, just log what would have happened
    } else {
      console.log(`[GRADE CAP APPLIED] AI suggested ${originalGrade}, capped at ${cappedGrade}`);
      console.log(`[GRADE CAP REASONS] ${cappedReasons.join('; ')}`);

      result.recommended_grade.recommended_decimal_grade = cappedGrade;
      result.recommended_grade.recommended_whole_grade = Math.round(cappedGrade);

      // Add grade cap metadata
      (result.recommended_grade as any).grade_cap_applied = true;
      (result.recommended_grade as any).grade_cap_reasons = cappedReasons;
      (result.recommended_grade as any).original_ai_grade = originalGrade;
    }
  } else {
    console.log(`[GRADE VALIDATOR] No caps needed - grade ${originalGrade} validated`);
  }

  return result;
}

/**
 * Validate that grade is a whole number (v7.4: whole number grading system)
 */
export function enforceWholeNumberScale(grade: number | null): number | null {
  if (grade === null) return null;

  const rounded = Math.floor(grade); // v7.4: Floor to whole number

  if (grade !== rounded) {
    console.log(`[GRADE VALIDATOR] Enforcing whole number scale: ${grade} → ${rounded}`);
    return rounded;
  }

  return grade;
}

/**
 * Full validation pipeline
 */
export function validateGrade(result: VisionGradeResult): VisionGradeResult {
  // Step 1: Enforce grade caps based on defects/checks
  const validated = enforceGradeCaps(result);

  // Step 2: Enforce whole number scale (v7.4: no more half-points)
  if (validated.recommended_grade.recommended_decimal_grade !== null) {
    validated.recommended_grade.recommended_decimal_grade = enforceWholeNumberScale(
      validated.recommended_grade.recommended_decimal_grade
    );
    validated.recommended_grade.recommended_whole_grade = validated.recommended_grade.recommended_decimal_grade;
  }

  return validated;
}
