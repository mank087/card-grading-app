/**
 * Deterministic Card Scoring System
 *
 * Philosophy: Start from 10.0, subtract points for each detected defect
 * Backend calculates score, AI only detects and describes defects
 *
 * Date: 2025-10-20
 * Version: 1.0
 */

export interface ScoringBreakdown {
  base_score: number;
  corner_deductions: number;
  corner_details: string[];
  edge_deductions: number;
  edge_details: string[];
  surface_deductions: number;
  surface_details: string[];
  centering_deductions: number;
  centering_details: string[];
  structural_damage: boolean;
  structural_damage_type?: string;
  total_deductions: number;
  calculated_grade: number;
  final_grade: number; // After rounding to 0.5 increments
  grade_explanation: string;
}

/**
 * Calculate corner deductions from defect data
 * Max deduction: -3.0 total (increased from -2.0 in v5.13)
 *
 * v5.13 UPDATE: Increased deductions for stricter grading
 * - Minor: 0.1 → 0.25
 * - Moderate: 0.25 → 0.50
 * - Heavy: 0.5 → 1.00
 */
function calculateCornerDeductions(defects: any): { deductions: number; details: string[] } {
  const details: string[] = [];
  let deductions = 0;

  const processCorner = (corner: any, location: string, side: string) => {
    if (!corner || !corner.severity || corner.severity === 'none') return;

    const severity = corner.severity.toLowerCase();
    const description = corner.description || 'No description';

    if (severity === 'minor') {
      deductions += 0.25;  // Was 0.1
      details.push(`${side} ${location}: Minor whitening (-0.25)`);
    } else if (severity === 'moderate') {
      deductions += 0.50;  // Was 0.25
      details.push(`${side} ${location}: Moderate whitening (-0.50)`);
    } else if (severity === 'heavy') {
      deductions += 1.00;  // Was 0.5
      details.push(`${side} ${location}: Heavy wear (-1.00)`);
    }
  };

  // Process front corners
  if (defects?.front?.corners) {
    const corners = defects.front.corners;
    processCorner(corners.top_left, 'Top-Left', 'Front');
    processCorner(corners.top_right, 'Top-Right', 'Front');
    processCorner(corners.bottom_left, 'Bottom-Left', 'Front');
    processCorner(corners.bottom_right, 'Bottom-Right', 'Front');
  }

  // Process back corners
  if (defects?.back?.corners) {
    const corners = defects.back.corners;
    processCorner(corners.top_left, 'Top-Left', 'Back');
    processCorner(corners.top_right, 'Top-Right', 'Back');
    processCorner(corners.bottom_left, 'Bottom-Left', 'Back');
    processCorner(corners.bottom_right, 'Bottom-Right', 'Back');
  }

  // Cap at -3.0 maximum (increased from -2.0 in v5.13)
  if (deductions > 3.0) {
    details.push(`Corner deductions capped at -3.0 (was -${deductions.toFixed(2)})`);
    deductions = 3.0;
  }

  return { deductions, details };
}

/**
 * Calculate edge deductions from defect data
 * Max deduction: -2.5 total (increased from -1.5 in v5.13)
 *
 * v5.13 UPDATE: Increased deductions for stricter grading
 * - Minor: 0.1 → 0.25
 * - Moderate: 0.25 → 0.50
 * - Heavy: 0.5 → 1.00
 */
function calculateEdgeDeductions(defects: any): { deductions: number; details: string[] } {
  const details: string[] = [];
  let deductions = 0;

  const processEdge = (edge: any, location: string, side: string) => {
    if (!edge || !edge.severity || edge.severity === 'none') return;

    const severity = edge.severity.toLowerCase();
    const description = edge.description || 'No description';

    if (severity === 'minor') {
      deductions += 0.25;  // Was 0.1
      details.push(`${side} ${location} Edge: Minor roughness (-0.25)`);
    } else if (severity === 'moderate') {
      deductions += 0.50;  // Was 0.25
      details.push(`${side} ${location} Edge: Moderate chipping/dots (-0.50)`);
    } else if (severity === 'heavy') {
      deductions += 1.00;  // Was 0.5
      details.push(`${side} ${location} Edge: Heavy wear (-1.00)`);
    }
  };

  // Process front edges
  if (defects?.front?.edges) {
    const edges = defects.front.edges;
    processEdge(edges.top, 'Top', 'Front');
    processEdge(edges.bottom, 'Bottom', 'Front');
    processEdge(edges.left, 'Left', 'Front');
    processEdge(edges.right, 'Right', 'Front');
  }

  // Process back edges
  if (defects?.back?.edges) {
    const edges = defects.back.edges;
    processEdge(edges.top, 'Top', 'Back');
    processEdge(edges.bottom, 'Bottom', 'Back');
    processEdge(edges.left, 'Left', 'Back');
    processEdge(edges.right, 'Right', 'Back');
  }

  // Cap at -2.5 maximum (increased from -1.5 in v5.13)
  if (deductions > 2.5) {
    details.push(`Edge deductions capped at -2.5 (was -${deductions.toFixed(2)})`);
    deductions = 2.5;
  }

  return { deductions, details };
}

/**
 * Calculate surface deductions from defect data
 * Max deduction: -3.5 total (increased from -2.5 in v5.13, excluding structural damage)
 */
function calculateSurfaceDeductions(defects: any): { deductions: number; details: string[] } {
  const details: string[] = [];
  let deductions = 0;

  const processSurface = (surface: any, side: string) => {
    if (!surface) return;

    // Scratches
    if (surface.scratches?.severity && surface.scratches.severity !== 'none') {
      const severity = surface.scratches.severity.toLowerCase();
      const description = (surface.scratches.description || '').toLowerCase();

      if (severity === 'minor') {
        // Count hairlines in description
        if (description.includes('1 ') || description.includes('one ')) {
          deductions += 0.1;
          details.push(`${side}: 1 hairline scratch (-0.1)`);
        } else if (description.includes('2-3') || description.includes('few')) {
          deductions += 0.25;
          details.push(`${side}: 2-3 hairline scratches (-0.25)`);
        } else {
          deductions += 0.1;
          details.push(`${side}: Minor scratch (-0.1)`);
        }
      } else if (severity === 'moderate') {
        deductions += 0.5;
        details.push(`${side}: Moderate scratches (-0.5)`);
      } else if (severity === 'heavy') {
        deductions += 0.75;
        details.push(`${side}: Heavy scratches (-0.75)`);
      }
    }

    // Print defects
    if (surface.print_defects?.severity && surface.print_defects.severity !== 'none') {
      const severity = surface.print_defects.severity.toLowerCase();
      const description = (surface.print_defects.description || '').toLowerCase();

      if (severity === 'minor') {
        // Try to count dots from description
        if (description.match(/\b1\b/) || description.includes('one ') || description.includes('single')) {
          deductions += 0.1;
          details.push(`${side}: 1-3 print dots (-0.1)`);
        } else if (description.match(/\b[4-9]\b/) || description.includes('few') || description.includes('several')) {
          deductions += 0.25;
          details.push(`${side}: 4-10 print dots (-0.25)`);
        } else {
          deductions += 0.1;
          details.push(`${side}: Minor print defects (-0.1)`);
        }
      } else if (severity === 'moderate') {
        deductions += 0.5;
        details.push(`${side}: 10+ print dots (-0.5)`);
      } else if (severity === 'heavy') {
        deductions += 0.5;
        details.push(`${side}: Heavy print defects (-0.5)`);
      }
    }

    // Creases (should be caught by structural damage check, but include for completeness)
    if (surface.creases?.severity && surface.creases.severity !== 'none') {
      // This should trigger structural damage cap, but document it
      details.push(`${side}: CREASE DETECTED (triggers 4.0 grade cap)`);
    }

    // Stains
    if (surface.stains?.severity && surface.stains.severity !== 'none') {
      const severity = surface.stains.severity.toLowerCase();

      if (severity === 'minor') {
        deductions += 0.25;
        details.push(`${side}: Minor stain/discoloration (-0.25)`);
      } else if (severity === 'moderate') {
        deductions += 0.5;
        details.push(`${side}: Moderate stain (-0.5)`);
      } else if (severity === 'heavy') {
        deductions += 1.0;
        details.push(`${side}: Heavy stain (-1.0)`);
      }
    }

    // Other surface issues
    if (surface.other?.severity && surface.other.severity !== 'none') {
      const severity = surface.other.severity.toLowerCase();

      if (severity === 'minor') {
        deductions += 0.25;
        details.push(`${side}: Other minor surface issue (-0.25)`);
      } else if (severity === 'moderate') {
        deductions += 0.5;
        details.push(`${side}: Other moderate surface issue (-0.5)`);
      } else if (severity === 'heavy') {
        deductions += 1.0;
        details.push(`${side}: Other heavy surface issue (-1.0)`);
      }
    }
  };

  // Process front surface
  if (defects?.front?.surface) {
    processSurface(defects.front.surface, 'Front');
  }

  // Process back surface
  if (defects?.back?.surface) {
    processSurface(defects.back.surface, 'Back');
  }

  // Cap at -2.5 maximum
  if (deductions > 2.5) {
    details.push(`Surface deductions capped at -2.5 (was -${deductions.toFixed(2)})`);
    deductions = 2.5;
  }

  return { deductions, details };
}

/**
 * Calculate centering deductions
 * Max deduction: -1.0 total
 */
function calculateCenteringDeductions(centering: any): { deductions: number; details: string[] } {
  const details: string[] = [];
  let deductions = 0;

  if (!centering) {
    return { deductions: 0, details: ['No centering data available'] };
  }

  // Parse centering ratios - look for worst axis
  const parseRatio = (text: string): number => {
    if (!text) return 50;

    // Extract numbers from ratio descriptions like "55/45" or "slightly-left"
    const match = text.match(/(\d+)\/(\d+)/);
    if (match) {
      const left = parseInt(match[1]);
      const right = parseInt(match[2]);
      return Math.max(left, right); // Return the larger number (worse centering)
    }

    // Handle text descriptions
    const lowerText = text.toLowerCase();
    if (lowerText.includes('centered') || lowerText === 'centered') return 50;
    if (lowerText.includes('slightly')) return 57; // Approximate 57/43
    if (lowerText.includes('noticeably')) return 65; // Approximate 65/35

    return 50; // Default to centered if can't parse
  };

  // Get worst centering from all four measurements
  const frontLR = parseRatio(centering.front_left_right_ratio_text);
  const frontTB = parseRatio(centering.front_top_bottom_ratio_text);
  const backLR = parseRatio(centering.back_left_right_ratio_text);
  const backTB = parseRatio(centering.back_top_bottom_ratio_text);

  const worstCentering = Math.max(frontLR, frontTB, backLR, backTB);
  const worstAxis = centering.worst_axis || 'unknown';
  const worstRatio = centering.worst_ratio_value || 'unknown';

  // Apply deductions based on worst centering
  if (worstCentering <= 55) {
    deductions = 0;
    details.push(`Centering excellent (${worstCentering}/${100-worstCentering} or better): No deduction`);
  } else if (worstCentering <= 60) {
    deductions = 0.25;
    details.push(`Centering slightly off (${worstCentering}/${100-worstCentering}): -0.25 points`);
  } else if (worstCentering <= 70) {
    deductions = 0.5;
    details.push(`Centering noticeably off (${worstCentering}/${100-worstCentering}): -0.5 points`);
  } else if (worstCentering <= 75) {
    deductions = 0.75;
    details.push(`Centering heavily off (${worstCentering}/${100-worstCentering}): -0.75 points`);
  } else {
    deductions = 1.0;
    details.push(`Centering extremely off (${worstCentering}/${100-worstCentering}): -1.0 points`);
  }

  return { deductions, details };
}

/**
 * Check for structural damage (creases, bent corners)
 * Returns true if structural damage found (auto-cap at 4.0)
 */
function checkStructuralDamage(defects: any): { hasDamage: boolean; damageType: string } {
  if (!defects) {
    return { hasDamage: false, damageType: '' };
  }

  // Check for creases
  const hasCrease =
    (defects.front?.surface?.creases?.severity && defects.front.surface.creases.severity !== 'none') ||
    (defects.back?.surface?.creases?.severity && defects.back.surface.creases.severity !== 'none');

  if (hasCrease) {
    return { hasDamage: true, damageType: 'Crease detected' };
  }

  // Check for bent/folded corners
  const checkCornerForBent = (corner: any): boolean => {
    if (!corner || !corner.description) return false;
    const desc = corner.description.toLowerCase();
    return desc.includes('bent') || desc.includes('folded') ||
           desc.includes('does not lie flat') || desc.includes('raised') ||
           desc.includes('warped');
  };

  const allCorners = [
    defects.front?.corners?.top_left,
    defects.front?.corners?.top_right,
    defects.front?.corners?.bottom_left,
    defects.front?.corners?.bottom_right,
    defects.back?.corners?.top_left,
    defects.back?.corners?.top_right,
    defects.back?.corners?.bottom_left,
    defects.back?.corners?.bottom_right,
  ];

  for (const corner of allCorners) {
    if (checkCornerForBent(corner)) {
      return { hasDamage: true, damageType: 'Bent/folded corner detected' };
    }
  }

  return { hasDamage: false, damageType: '' };
}

/**
 * Main scoring function
 * Calculates deterministic grade from defect data
 */
export function calculateDeterministicGrade(result: any): ScoringBreakdown {
  const BASE_SCORE = 10.0;

  // Check for structural damage first
  const structuralCheck = checkStructuralDamage(result.defects);

  if (structuralCheck.hasDamage) {
    // Structural damage - auto-cap at 4.0
    return {
      base_score: BASE_SCORE,
      corner_deductions: 0,
      corner_details: [],
      edge_deductions: 0,
      edge_details: [],
      surface_deductions: 0,
      surface_details: [],
      centering_deductions: 0,
      centering_details: [],
      structural_damage: true,
      structural_damage_type: structuralCheck.damageType,
      total_deductions: 6.0, // Conceptually, structural damage is a massive deduction
      calculated_grade: 4.0,
      final_grade: 4.0,
      grade_explanation: `STRUCTURAL DAMAGE: ${structuralCheck.damageType}. Automatic grade cap at 4.0. ` +
                         `Cards with creases or bent corners cannot receive grades above 4.0 per industry standards.`
    };
  }

  // Calculate deductions for each category
  const corners = calculateCornerDeductions(result.defects);
  const edges = calculateEdgeDeductions(result.defects);
  const surface = calculateSurfaceDeductions(result.defects);
  const centering = calculateCenteringDeductions(result.centering);

  // v5.13: Calculate cumulative penalty for widespread wear
  // Cards with defects in multiple categories receive additional penalty
  let categoriesWithDefects = 0;
  if (corners.deductions > 0) categoriesWithDefects++;
  if (edges.deductions > 0) categoriesWithDefects++;
  if (surface.deductions > 0) categoriesWithDefects++;
  if (centering.deductions > 0) categoriesWithDefects++;

  let cumulativePenalty = 0;
  let cumulativePenaltyNote = '';
  if (categoriesWithDefects >= 4) {
    cumulativePenalty = 1.0;
    cumulativePenaltyNote = ` Cumulative penalty (-1.0) applied for defects in all 4 categories.`;
  } else if (categoriesWithDefects >= 3) {
    cumulativePenalty = 0.5;
    cumulativePenaltyNote = ` Cumulative penalty (-0.5) applied for defects in 3 categories.`;
  }

  const totalDeductions = corners.deductions + edges.deductions + surface.deductions + centering.deductions + cumulativePenalty;
  const calculatedGrade = Math.max(1.0, BASE_SCORE - totalDeductions); // Never below 1.0

  // Round to nearest 0.5
  const finalGrade = Math.round(calculatedGrade * 2) / 2;

  // Build explanation
  const gradeExplanation = `Grade calculated from base 10.0 with ${totalDeductions.toFixed(2)} points in deductions: ` +
    `Corners (-${corners.deductions.toFixed(2)}), Edges (-${edges.deductions.toFixed(2)}), ` +
    `Surface (-${surface.deductions.toFixed(2)}), Centering (-${centering.deductions.toFixed(2)}).` +
    `${cumulativePenaltyNote} ` +
    `Calculated: ${calculatedGrade.toFixed(2)}, Final: ${finalGrade} (rounded to nearest 0.5).`;

  return {
    base_score: BASE_SCORE,
    corner_deductions: corners.deductions,
    corner_details: corners.details,
    edge_deductions: edges.deductions,
    edge_details: edges.details,
    surface_deductions: surface.deductions,
    surface_details: surface.details,
    centering_deductions: centering.deductions,
    centering_details: centering.details,
    structural_damage: false,
    total_deductions: totalDeductions,
    calculated_grade: calculatedGrade,
    final_grade: finalGrade,
    grade_explanation: gradeExplanation
  };
}

/**
 * Adjust sub-grades when structural damage is detected
 * Ensures sub-grades reflect the 4.0 cap for damaged cards
 */
export function adjustSubGradesForStructuralDamage(
  result: any,
  scoringBreakdown: ScoringBreakdown
): void {
  if (!scoringBreakdown.structural_damage || !result.sub_scores) {
    return; // No structural damage or no sub_scores to adjust
  }

  const damageType = scoringBreakdown.structural_damage_type || '';

  // If crease detected, cap surface sub-grades at 4.0
  if (damageType.toLowerCase().includes('crease')) {
    console.log('[Deterministic Scorer] Adjusting surface sub-grades for crease (capping at 4.0)');

    if (result.sub_scores.surface) {
      // Cap front, back, and weighted scores at 4.0
      result.sub_scores.surface.front_score = Math.min(result.sub_scores.surface.front_score, 4.0);
      result.sub_scores.surface.back_score = Math.min(result.sub_scores.surface.back_score, 4.0);
      result.sub_scores.surface.weighted_score = Math.min(result.sub_scores.surface.weighted_score, 4.0);

      console.log('[Deterministic Scorer] Surface sub-grades adjusted:', {
        front: result.sub_scores.surface.front_score,
        back: result.sub_scores.surface.back_score,
        weighted: result.sub_scores.surface.weighted_score
      });
    }
  }

  // If bent/folded corner detected, cap corner sub-grades at 4.0
  if (damageType.toLowerCase().includes('bent') || damageType.toLowerCase().includes('folded')) {
    console.log('[Deterministic Scorer] Adjusting corner sub-grades for bent/folded corner (capping at 4.0)');

    if (result.sub_scores.corners) {
      // Cap front, back, and weighted scores at 4.0
      result.sub_scores.corners.front_score = Math.min(result.sub_scores.corners.front_score, 4.0);
      result.sub_scores.corners.back_score = Math.min(result.sub_scores.corners.back_score, 4.0);
      result.sub_scores.corners.weighted_score = Math.min(result.sub_scores.corners.weighted_score, 4.0);

      console.log('[Deterministic Scorer] Corner sub-grades adjusted:', {
        front: result.sub_scores.corners.front_score,
        back: result.sub_scores.corners.back_score,
        weighted: result.sub_scores.corners.weighted_score
      });
    }
  }

  // Note: Other sub-grades (centering, edges) typically aren't affected by structural damage
  // unless they're part of the damage itself, but we preserve them as-is for accuracy
}
