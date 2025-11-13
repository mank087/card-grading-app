// DCM Card Condition Assessment System
// Maps binary visual inspection flags to standardized condition terminology

export type ConditionLevel = 'Mint' | 'Excellent' | 'Good' | 'Fair';

export interface CategoryCondition {
  name: string;
  condition: ConditionLevel;
  defectCount: number;
  flagsDetected: string[];
}

export interface DCMConditionAssessment {
  overallCondition: ConditionLevel;
  categoryConditions: {
    cornerQuality: CategoryCondition;
    edgeIntegrity: CategoryCondition;
    surfaceCondition: CategoryCondition;
    printQuality: CategoryCondition;
    structuralIntegrity: CategoryCondition;
    authenticity: CategoryCondition;
  };
  conditionSummary: string;
  assessmentScore: number; // 0-100 score for internal use
}

// Visual inspection flags structure (matches our current system)
export interface VisualInspectionResults {
  // Centering
  off_center_detected?: boolean;
  miscut_detected?: boolean;
  diamond_cut_detected?: boolean;
  keystone_distortion_detected?: boolean;

  // Corners Front
  corners_front_whitening?: boolean;
  corners_front_rounding?: boolean;
  corners_front_fraying?: boolean;
  corners_front_soft?: boolean;
  corners_front_bent?: boolean;
  corners_front_delamination?: boolean;

  // Corners Back
  corners_back_whitening?: boolean;
  corners_back_rounding?: boolean;
  corners_back_fraying?: boolean;
  corners_back_soft?: boolean;
  corners_back_bent?: boolean;
  corners_back_delamination?: boolean;

  // Edges Front
  edges_front_whitening?: boolean;
  edges_front_chipping?: boolean;
  edges_front_nicks?: boolean;
  edges_front_fraying?: boolean;
  edges_front_separation?: boolean;
  edges_front_cut_marks?: boolean;

  // Edges Back
  edges_back_whitening?: boolean;
  edges_back_chipping?: boolean;
  edges_back_nicks?: boolean;
  edges_back_fraying?: boolean;
  edges_back_separation?: boolean;
  edges_back_cut_marks?: boolean;

  // Surface Front
  surface_front_scratches?: boolean;
  surface_front_scuffs?: boolean;
  surface_front_print_lines?: boolean;
  surface_front_dents?: boolean;
  surface_front_creases?: boolean;
  surface_front_stains?: boolean;
  surface_front_wear?: boolean;
  surface_front_ink_smear?: boolean;
  surface_front_impressions?: boolean;

  // Surface Back
  surface_back_scratches?: boolean;
  surface_back_scuffs?: boolean;
  surface_back_print_lines?: boolean;
  surface_back_dents?: boolean;
  surface_back_creases?: boolean;
  surface_back_stains?: boolean;
  surface_back_wear?: boolean;
  surface_back_ink_smear?: boolean;
  surface_back_impressions?: boolean;

  // Print/Manufacturing
  print_misregistration?: boolean;
  print_ink_spots?: boolean;
  print_roller_lines?: boolean;
  print_holo_scratches?: boolean;
  print_foil_peeling?: boolean;
  print_color_variance?: boolean;
  print_border_variance?: boolean;

  // Alterations
  altered_trimmed?: boolean;
  altered_recolored?: boolean;
  altered_pressed?: boolean;
  altered_writing?: boolean;
  altered_bleached?: boolean;
  altered_rebacked?: boolean;
}

// Helper function to count true flags in a category
function countDefects(flags: boolean[], flagNames: string[]): { count: number; detected: string[] } {
  const detected: string[] = [];
  let count = 0;

  flags.forEach((flag, index) => {
    if (flag) {
      count++;
      detected.push(flagNames[index]);
    }
  });

  return { count, detected };
}

// Calculate condition level based on defect count and thresholds
function calculateConditionLevel(defectCount: number, thresholds: [number, number, number]): ConditionLevel {
  if (defectCount === 0) return 'Mint';
  if (defectCount <= thresholds[0]) return 'Excellent';
  if (defectCount <= thresholds[1]) return 'Good';
  return 'Fair';
}

// Assess corner quality (front + back corners)
function assessCornerQuality(inspection: VisualInspectionResults): CategoryCondition {
  const flags = [
    inspection.corners_front_whitening || false,
    inspection.corners_front_rounding || false,
    inspection.corners_front_fraying || false,
    inspection.corners_front_soft || false,
    inspection.corners_front_bent || false,
    inspection.corners_front_delamination || false,
    inspection.corners_back_whitening || false,
    inspection.corners_back_rounding || false,
    inspection.corners_back_fraying || false,
    inspection.corners_back_soft || false,
    inspection.corners_back_bent || false,
    inspection.corners_back_delamination || false,
  ];

  const flagNames = [
    'front whitening', 'front rounding', 'front fraying', 'front soft', 'front bent', 'front delamination',
    'back whitening', 'back rounding', 'back fraying', 'back soft', 'back bent', 'back delamination'
  ];

  const { count, detected } = countDefects(flags, flagNames);
  const condition = calculateConditionLevel(count, [1, 3, 6]); // Mint: 0, Excellent: 1, Good: 2-3, Fair: 4+

  return {
    name: 'Corner Quality',
    condition,
    defectCount: count,
    flagsDetected: detected
  };
}

// Assess edge integrity (front + back edges)
function assessEdgeIntegrity(inspection: VisualInspectionResults): CategoryCondition {
  const flags = [
    inspection.edges_front_whitening || false,
    inspection.edges_front_chipping || false,
    inspection.edges_front_nicks || false,
    inspection.edges_front_fraying || false,
    inspection.edges_front_separation || false,
    inspection.edges_front_cut_marks || false,
    inspection.edges_back_whitening || false,
    inspection.edges_back_chipping || false,
    inspection.edges_back_nicks || false,
    inspection.edges_back_fraying || false,
    inspection.edges_back_separation || false,
    inspection.edges_back_cut_marks || false,
  ];

  const flagNames = [
    'front whitening', 'front chipping', 'front nicks', 'front fraying', 'front separation', 'front cut marks',
    'back whitening', 'back chipping', 'back nicks', 'back fraying', 'back separation', 'back cut marks'
  ];

  const { count, detected } = countDefects(flags, flagNames);
  const condition = calculateConditionLevel(count, [1, 3, 6]); // Mint: 0, Excellent: 1, Good: 2-3, Fair: 4+

  return {
    name: 'Edge Integrity',
    condition,
    defectCount: count,
    flagsDetected: detected
  };
}

// Assess surface condition (front + back surface)
function assessSurfaceCondition(inspection: VisualInspectionResults): CategoryCondition {
  const flags = [
    inspection.surface_front_scratches || false,
    inspection.surface_front_scuffs || false,
    inspection.surface_front_print_lines || false,
    inspection.surface_front_dents || false,
    inspection.surface_front_creases || false,
    inspection.surface_front_stains || false,
    inspection.surface_front_wear || false,
    inspection.surface_front_ink_smear || false,
    inspection.surface_front_impressions || false,
    inspection.surface_back_scratches || false,
    inspection.surface_back_scuffs || false,
    inspection.surface_back_print_lines || false,
    inspection.surface_back_dents || false,
    inspection.surface_back_creases || false,
    inspection.surface_back_stains || false,
    inspection.surface_back_wear || false,
    inspection.surface_back_ink_smear || false,
    inspection.surface_back_impressions || false,
  ];

  const flagNames = [
    'front scratches', 'front scuffs', 'front print lines', 'front dents', 'front creases', 'front stains', 'front wear', 'front ink smear', 'front impressions',
    'back scratches', 'back scuffs', 'back print lines', 'back dents', 'back creases', 'back stains', 'back wear', 'back ink smear', 'back impressions'
  ];

  const { count, detected } = countDefects(flags, flagNames);
  const condition = calculateConditionLevel(count, [2, 5, 9]); // Mint: 0, Excellent: 1-2, Good: 3-5, Fair: 6+

  return {
    name: 'Surface Condition',
    condition,
    defectCount: count,
    flagsDetected: detected
  };
}

// Assess print quality
function assessPrintQuality(inspection: VisualInspectionResults): CategoryCondition {
  const flags = [
    inspection.print_misregistration || false,
    inspection.print_ink_spots || false,
    inspection.print_roller_lines || false,
    inspection.print_holo_scratches || false,
    inspection.print_foil_peeling || false,
    inspection.print_color_variance || false,
    inspection.print_border_variance || false,
  ];

  const flagNames = [
    'misregistration', 'ink spots', 'roller lines', 'holo scratches', 'foil peeling', 'color variance', 'border variance'
  ];

  const { count, detected } = countDefects(flags, flagNames);
  const condition = calculateConditionLevel(count, [1, 3, 5]); // Mint: 0, Excellent: 1, Good: 2-3, Fair: 4+

  return {
    name: 'Print Quality',
    condition,
    defectCount: count,
    flagsDetected: detected
  };
}

// Assess structural integrity (centering issues)
function assessStructuralIntegrity(inspection: VisualInspectionResults): CategoryCondition {
  const flags = [
    inspection.off_center_detected || false,
    inspection.miscut_detected || false,
    inspection.diamond_cut_detected || false,
    inspection.keystone_distortion_detected || false,
  ];

  const flagNames = [
    'off center', 'miscut', 'diamond cut', 'keystone distortion'
  ];

  const { count, detected } = countDefects(flags, flagNames);
  const condition = calculateConditionLevel(count, [1, 2, 3]); // Mint: 0, Excellent: 1, Good: 2, Fair: 3+

  return {
    name: 'Structural Integrity',
    condition,
    defectCount: count,
    flagsDetected: detected
  };
}

// Assess authenticity (alterations)
function assessAuthenticity(inspection: VisualInspectionResults): CategoryCondition {
  const flags = [
    inspection.altered_trimmed || false,
    inspection.altered_recolored || false,
    inspection.altered_pressed || false,
    inspection.altered_writing || false,
    inspection.altered_bleached || false,
    inspection.altered_rebacked || false,
  ];

  const flagNames = [
    'trimmed', 'recolored', 'pressed', 'writing/signatures', 'bleached', 'rebacked'
  ];

  const { count, detected } = countDefects(flags, flagNames);

  // Special logic for authenticity - any alteration is significant
  let condition: ConditionLevel = 'Mint';
  if (inspection.altered_writing) {
    condition = 'Fair'; // Uncertified signatures are major concern
  } else if (count > 0) {
    condition = 'Good'; // Other alterations but no writing
  }

  return {
    name: 'Authenticity',
    condition,
    defectCount: count,
    flagsDetected: detected
  };
}

// Generate condition summary based on assessment
function generateConditionSummary(assessment: DCMConditionAssessment): string {
  const { overallCondition, categoryConditions } = assessment;

  const conditions = Object.values(categoryConditions);
  const mintCategories = conditions.filter(c => c.condition === 'Mint').length;
  const excellentCategories = conditions.filter(c => c.condition === 'Excellent').length;
  const goodCategories = conditions.filter(c => c.condition === 'Good').length;
  const fairCategories = conditions.filter(c => c.condition === 'Fair').length;

  let summary = `This card demonstrates ${overallCondition.toLowerCase()} overall condition`;

  if (overallCondition === 'Mint') {
    summary += ' with exceptional preservation showing no visible wear across all categories.';
  } else if (overallCondition === 'Excellent') {
    summary += ` with ${mintCategories} category${mintCategories !== 1 ? 'ies' : 'y'} in mint condition and minimal wear in other areas.`;
  } else if (overallCondition === 'Good') {
    summary += ` with moderate wear patterns affecting ${fairCategories + goodCategories} category${fairCategories + goodCategories !== 1 ? 'ies' : 'y'} while maintaining structural integrity.`;
  } else {
    summary += ` with significant wear affecting multiple areas including ${categoryConditions.authenticity.condition === 'Fair' ? 'authenticity concerns' : 'structural and surface issues'}.`;
  }

  // Add specific notes for major issues
  if (categoryConditions.authenticity.condition === 'Fair') {
    summary += ' Authentication verification recommended due to detected alterations.';
  }

  return summary;
}

// Calculate overall assessment score (0-100)
function calculateAssessmentScore(categoryConditions: DCMConditionAssessment['categoryConditions']): number {
  const conditions = Object.values(categoryConditions);
  const scores = conditions.map(c => {
    switch (c.condition) {
      case 'Mint': return 100;
      case 'Excellent': return 85;
      case 'Good': return 70;
      case 'Fair': return 50;
      default: return 50;
    }
  });

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

// Main function to assess card condition
export function assessCardCondition(inspection: VisualInspectionResults): DCMConditionAssessment {
  // Assess each category
  const cornerQuality = assessCornerQuality(inspection);
  const edgeIntegrity = assessEdgeIntegrity(inspection);
  const surfaceCondition = assessSurfaceCondition(inspection);
  const printQuality = assessPrintQuality(inspection);
  const structuralIntegrity = assessStructuralIntegrity(inspection);
  const authenticity = assessAuthenticity(inspection);

  const categoryConditions = {
    cornerQuality,
    edgeIntegrity,
    surfaceCondition,
    printQuality,
    structuralIntegrity,
    authenticity
  };

  // Calculate overall condition (worst category determines overall, but with weighting)
  const conditions = Object.values(categoryConditions);
  const conditionScores = conditions.map(c => {
    switch (c.condition) {
      case 'Mint': return 4;
      case 'Excellent': return 3;
      case 'Good': return 2;
      case 'Fair': return 1;
      default: return 1;
    }
  });

  // Authenticity issues override everything
  if (authenticity.condition === 'Fair') {
    var overallCondition: ConditionLevel = 'Fair';
  } else {
    const averageScore = conditionScores.reduce((sum, score) => sum + score, 0) / conditionScores.length;
    if (averageScore >= 3.8) overallCondition = 'Mint';
    else if (averageScore >= 3.0) overallCondition = 'Excellent';
    else if (averageScore >= 2.0) overallCondition = 'Good';
    else overallCondition = 'Fair';
  }

  const assessment: DCMConditionAssessment = {
    overallCondition,
    categoryConditions,
    conditionSummary: '', // Will be generated
    assessmentScore: calculateAssessmentScore(categoryConditions)
  };

  // Generate summary
  assessment.conditionSummary = generateConditionSummary(assessment);

  return assessment;
}

// Helper function to get condition color for UI
export function getConditionColor(condition: ConditionLevel): string {
  switch (condition) {
    case 'Mint': return 'text-green-600 bg-green-100 border-green-200';
    case 'Excellent': return 'text-blue-600 bg-blue-100 border-blue-200';
    case 'Good': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    case 'Fair': return 'text-red-600 bg-red-100 border-red-200';
    default: return 'text-gray-600 bg-gray-100 border-gray-200';
  }
}

// Helper function to get condition description
export function getConditionDescription(condition: ConditionLevel): string {
  switch (condition) {
    case 'Mint': return 'Exceptional preservation showing no visible wear or handling';
    case 'Excellent': return 'Minor signs of handling but maintains high quality appearance';
    case 'Good': return 'Moderate wear visible but card remains structurally sound';
    case 'Fair': return 'Significant wear affecting appearance and collectible value';
    default: return 'Condition assessment unavailable';
  }
}