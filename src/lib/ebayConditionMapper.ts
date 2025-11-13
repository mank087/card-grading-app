/**
 * eBay Card Condition Mapper
 * Maps AI grading results to eBay's card condition categories
 * Based on: https://pages.ebay.com/cardconditions/
 */

export type EbayCondition = 'Near Mint or Better' | 'Excellent' | 'Very Good' | 'Poor';

interface DefectSection {
  corners: {
    top_left: { severity: string; description: string };
    top_right: { severity: string; description: string };
    bottom_left: { severity: string; description: string };
    bottom_right: { severity: string; description: string };
  };
  edges: {
    top: { severity: string; description: string };
    bottom: { severity: string; description: string };
    left: { severity: string; description: string };
    right: { severity: string; description: string };
  };
  surface: {
    scratches: { severity: string; description: string };
    creases: { severity: string; description: string };
    print_defects: { severity: string; description: string };
    stains: { severity: string; description: string };
    other: { severity: string; description: string };
  };
}

interface VisionGradeResult {
  recommended_grade: {
    recommended_decimal_grade: number | null;
  };
  defects: {
    front: DefectSection;
    back: DefectSection;
  };
  grading_status?: string;
}

/**
 * Maps AI grading result to eBay condition category
 *
 * eBay Criteria:
 * - Near Mint or Better: Minor corner/edge chipping, no discoloration, minor surface indentations, no creases, minor scratches, no staining
 * - Excellent: Moderate corner wear, slightly rough edges, minor discoloration, moderate surface indentations, minor surface wrinkles, moderate scratches, minor staining
 * - Very Good: Rounding on all corners, moderate-to-heavy chipping, moderate-to-major discoloration, moderate-to-major surface indentations, multiple creases, moderate-to-major scratches with slight paper loss, moderate-to-major staining
 * - Poor: Major rounding/missing corners, major chipping with paper loss, major discoloration, major surface indentations, multiple major creases, major scratches with paper loss/tears/pinholes, major staining
 */
export function mapToEbayCondition(grading: VisionGradeResult): EbayCondition {
  // Handle missing grading data
  if (!grading || !grading.recommended_grade) {
    // Default to Near Mint or Better when we don't have grading data
    return 'Near Mint or Better';
  }

  // Handle N/A grades (altered cards, unverified autographs, etc.)
  if (grading.recommended_grade.recommended_decimal_grade === null) {
    return 'Poor'; // Altered/damaged cards fall into Poor category
  }

  // Handle incomplete DVG data (stub when DVG v2 disabled)
  if (!grading.defects || !grading.defects.front || !grading.defects.back) {
    // Default to Near Mint or Better when we don't have defect data
    return 'Near Mint or Better';
  }

  const grade = grading.recommended_grade.recommended_decimal_grade;
  const frontDefects = grading.defects.front;
  const backDefects = grading.defects.back;

  // Count severe defects across both sides
  const cornerDefects = countDefectsBySeverity([
    frontDefects.corners.top_left,
    frontDefects.corners.top_right,
    frontDefects.corners.bottom_left,
    frontDefects.corners.bottom_right,
    backDefects.corners.top_left,
    backDefects.corners.top_right,
    backDefects.corners.bottom_left,
    backDefects.corners.bottom_right,
  ]);

  const edgeDefects = countDefectsBySeverity([
    frontDefects.edges.top,
    frontDefects.edges.bottom,
    frontDefects.edges.left,
    frontDefects.edges.right,
    backDefects.edges.top,
    backDefects.edges.bottom,
    backDefects.edges.left,
    backDefects.edges.right,
  ]);

  const surfaceDefects = {
    scratches: countDefectsBySeverity([frontDefects.surface.scratches, backDefects.surface.scratches]),
    creases: countDefectsBySeverity([frontDefects.surface.creases, backDefects.surface.creases]),
    stains: countDefectsBySeverity([frontDefects.surface.stains, backDefects.surface.stains]),
    printDefects: countDefectsBySeverity([frontDefects.surface.print_defects, backDefects.surface.print_defects]),
  };

  // POOR: Multiple major creases, major corner/edge damage, or grade below 4.0
  if (
    surfaceDefects.creases.heavy >= 2 || // Multiple major creases
    cornerDefects.heavy >= 1 || // Major corner rounding/missing
    edgeDefects.heavy >= 1 || // Major chipping with paper loss
    surfaceDefects.scratches.heavy >= 1 || // Major scratches with paper loss
    surfaceDefects.stains.heavy >= 1 || // Major staining
    grade < 4.0
  ) {
    return 'Poor';
  }

  // VERY GOOD: Multiple creases, rounding on all corners, or grade 4.0-6.5
  if (
    surfaceDefects.creases.moderate >= 2 || // Multiple creases
    surfaceDefects.creases.heavy >= 1 || // At least one major crease
    cornerDefects.moderate >= 4 || // Rounding on all four corners
    edgeDefects.moderate >= 2 || // Moderate-to-heavy chipping
    surfaceDefects.scratches.moderate >= 2 || // Moderate-to-major scratches
    surfaceDefects.stains.moderate >= 1 || // Moderate-to-major staining
    (grade >= 4.0 && grade < 7.0)
  ) {
    return 'Very Good';
  }

  // EXCELLENT: Minor surface wrinkles, moderate corner wear, or grade 7.0-8.5
  if (
    surfaceDefects.creases.minor >= 1 || // Minor surface wrinkles
    cornerDefects.moderate >= 1 || // Moderate corner wear
    edgeDefects.moderate >= 1 || // Slightly rough edges
    surfaceDefects.scratches.moderate >= 1 || // Moderate scratches
    surfaceDefects.stains.minor >= 1 || // Minor staining
    cornerDefects.minor >= 2 || // Multiple dinged corners
    (grade >= 7.0 && grade < 9.0)
  ) {
    return 'Excellent';
  }

  // NEAR MINT OR BETTER: Minimal defects, grade 9.0+
  return 'Near Mint or Better';
}

/**
 * Helper function to count defects by severity level
 */
function countDefectsBySeverity(defects: Array<{ severity: string; description: string }>) {
  const counts = {
    none: 0,
    minor: 0,
    moderate: 0,
    heavy: 0,
  };

  defects.forEach((defect) => {
    // 🔄 Defensive: Handle defects that might not have severity property
    if (!defect || typeof defect !== 'object') {
      console.warn('[ebayConditionMapper] Invalid defect:', defect);
      return;
    }

    if (!defect.severity) {
      console.warn('[ebayConditionMapper] Defect missing severity property:', defect);
      counts.minor++; // Default to minor for defects without severity
      return;
    }

    const severity = defect.severity.toLowerCase();
    if (severity === 'none') counts.none++;
    else if (severity === 'minor') counts.minor++;
    else if (severity === 'moderate') counts.moderate++;
    else if (severity === 'heavy') counts.heavy++;
  });

  return counts;
}

/**
 * Get color class for eBay condition badge
 */
export function getEbayConditionColor(condition: EbayCondition): string {
  switch (condition) {
    case 'Near Mint or Better':
      return 'text-green-700';
    case 'Excellent':
      return 'text-blue-700';
    case 'Very Good':
      return 'text-yellow-700';
    case 'Poor':
      return 'text-red-700';
  }
}

/**
 * Get description for eBay condition
 */
export function getEbayConditionDescription(condition: EbayCondition): string {
  switch (condition) {
    case 'Near Mint or Better':
      return 'Minor chipping, no creases, minimal wear';
    case 'Excellent':
      return 'Moderate corner wear, minor surface wrinkles';
    case 'Very Good':
      return 'Rounding on corners, multiple creases allowed';
    case 'Poor':
      return 'Major damage, multiple major creases';
  }
}
