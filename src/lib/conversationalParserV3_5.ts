/**
 * conversationalParserV3_5.ts
 *
 * Purpose-built parser for Conversational Grading v3.5 PATCHED v2
 * Clean implementation - no backward compatibility, exact format matching
 *
 * Format: ## [STEP N] TITLE with ### A. Subsections
 * Date: October 24, 2025
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ConversationalGradingV3_5 {
  // Main grade
  decimal_grade: number;
  whole_grade: number;
  grade_range: string;
  condition_label: string;

  // Image quality
  image_confidence: string; // A, B, C
  image_justification: string;

  // Card info
  card_info: CardInfo;

  // Professional slab detection
  professional_slab: ProfessionalSlabData;

  // Sub-scores
  sub_scores: SubScores;

  // Centering ratios
  centering: CenteringRatios;

  // Defects
  corners: CornerDefects;
  edges: EdgeDefects;
  surface: SurfaceDefects;

  // Cross-verification
  cross_verification: CrossVerification;

  // Final report sections
  defect_pattern: string;
  final_calculation: FinalCalculation;
  statistical_control: string;
  appendix: string;

  // Metadata
  meta: MetaData;

  // Checklist
  checklist: Checklist;

  // Front/Back summaries for centering display
  front_summary: string | null;
  back_summary: string | null;

  // Raw markdown for frontend display
  full_markdown: string;
}

export interface CardInfo {
  card_name: string | null;
  player: string | null;
  set_name: string | null;
  year: string | null;
  manufacturer: string | null;
  card_number: string | null;
  sport: string | null;
  subset: string | null;
  serial_number: string | null;
  rookie_card: boolean;
  autographed: boolean;
  memorabilia: boolean;
  rarity_tier: string | null;
}

export interface ProfessionalSlabData {
  detected: boolean;
  company: string | null;          // "PSA", "BGS", "SGC", "CGC", "HGA"
  grade: string | null;             // "10", "9.5", "9"
  grade_description: string | null; // "Gem Mint", "Mint", "Pristine"
  cert_number: string | null;       // "12345678"
  sub_grades: string | null;        // "9.5/9.5/10/9.5" (BGS only)
}

export interface SubScores {
  centering: { front: number; back: number; weighted: number };
  corners: { front: number; back: number; weighted: number };
  edges: { front: number; back: number; weighted: number };
  surface: { front: number; back: number; weighted: number };
  weighted_total: number;
}

export interface CenteringRatios {
  front_lr: string; // "55/45"
  front_tb: string; // "50/50"
  back_lr: string;
  back_tb: string;
}

export interface CornerDefects {
  front: {
    top_left: string;
    top_right: string;
    bottom_left: string;
    bottom_right: string;
    score: number;
  };
  back: {
    top_left: string;
    top_right: string;
    bottom_left: string;
    bottom_right: string;
    score: number;
  };
}

export interface EdgeDefects {
  front: {
    left: string;
    right: string;
    top: string;
    bottom: string;
    score: number;
  };
  back: {
    left: string;
    right: string;
    top: string;
    bottom: string;
    score: number;
  };
}

export interface SurfaceDefects {
  front: {
    defects: string;
    score: number;
  };
  back: {
    defects: string;
    score: number;
  };
}

export interface CrossVerification {
  centering_correlation: string;
  corner_consistency: string;
  edge_pattern: string;
  structural_verification: string;
  holder_artifacts: string;
}

export interface FinalCalculation {
  weighted_total_pre_cap: number;
  capped_grade: number | null;
  final_decimal_grade: number;
  grade_range: string;
  whole_number_equivalent: number;
  condition_label: string;
  confidence_note: string;
}

export interface MetaData {
  prompt_version: string;
  model: string;
  evaluated_at: string;
  enhancements: string;
  patches_applied: string;
}

export interface Checklist {
  autograph_verified: boolean;
  handwritten_markings: boolean;
  structural_damage: boolean;
  both_sides_present: boolean;
  confidence_letter: string;
  condition_label_assigned: boolean;
  all_steps_completed: boolean;
  centering_method_used: string;
  modern_features_identified: boolean;
  trimming_check_performed: boolean;
  grade_cap_applied: string;
  conservative_rounding_applied: boolean;
}

// ============================================================================
// Main Parser Function
// ============================================================================

export function parseConversationalV3_5(markdown: string): ConversationalGradingV3_5 | null {
  if (!markdown || !markdown.trim()) {
    console.error('[PARSER V3.5] Empty markdown provided');
    return null;
  }

  console.log('[PARSER V3.5] Starting parse of v3.5 PATCHED v2 markdown...');

  try {
    // Split into steps
    const steps = splitIntoSteps(markdown);

    // Parse blocks first (they're everywhere in the markdown)
    const subScores = parseSubscoresBlock(markdown);
    const checklist = parseChecklistBlock(markdown);
    const meta = parseMetaBlock(markdown);

    // Parse individual steps
    const cardInfo = parseStep1_CardInfo(steps.get(1) || '');
    const professionalSlab = parseProfessionalSlabData(steps.get(1) || '');
    const imageQuality = parseStep2_ImageQuality(steps.get(2) || '');
    const frontEval = parseStep3_FrontEvaluation(steps.get(3) || '');
    const backEval = parseStep4_BackEvaluation(steps.get(4) || '');
    const crossVerif = parseStep5_CrossVerification(steps.get(5) || '');
    const defectPattern = parseStep6_DefectPattern(steps.get(6) || '');
    const finalCalc = parseStep10_FinalCalculation(steps.get(10) || '');
    const statisticalControl = parseStep14_StatisticalControl(steps.get(14) || '');
    const appendix = parseStep15_Appendix(steps.get(15) || '');

    // Extract front and back centering summaries
    const frontSummary = frontEval.centering.summary || null;
    const backSummary = backEval.centering.summary || null;

    // Assemble final result
    const result: ConversationalGradingV3_5 = {
      decimal_grade: finalCalc.final_decimal_grade,
      whole_grade: finalCalc.whole_number_equivalent,
      grade_range: finalCalc.grade_range,
      condition_label: finalCalc.condition_label,

      image_confidence: imageQuality.confidence,
      image_justification: imageQuality.justification,

      card_info: cardInfo,
      professional_slab: professionalSlab,
      sub_scores: subScores,

      centering: {
        front_lr: frontEval.centering.lr,
        front_tb: frontEval.centering.tb,
        back_lr: backEval.centering.lr,
        back_tb: backEval.centering.tb,
      },

      corners: {
        front: frontEval.corners,
        back: backEval.corners,
      },

      edges: {
        front: frontEval.edges,
        back: backEval.edges,
      },

      surface: {
        front: frontEval.surface,
        back: backEval.surface,
      },

      cross_verification: crossVerif,
      defect_pattern: defectPattern,
      final_calculation: finalCalc,
      statistical_control: statisticalControl,
      appendix: appendix,

      meta: meta,
      checklist: checklist,

      // Centering summaries for frontend display
      front_summary: frontSummary,
      back_summary: backSummary,

      full_markdown: markdown,
    };

    console.log('[PARSER V3.5] ✅ Parse complete');
    console.log('[PARSER V3.5] Extracted grade:', result.decimal_grade);
    console.log('[PARSER V3.5] Centering ratios:', result.centering);

    return result;

  } catch (error) {
    console.error('[PARSER V3.5] ❌ Parse failed:', error);
    return null;
  }
}

// ============================================================================
// Step Splitter
// ============================================================================

function splitIntoSteps(markdown: string): Map<number, string> {
  const steps = new Map<number, string>();
  const stepRegex = /## \[STEP (\d+)\] (.+?)(?=## \[STEP \d+\]|:::SUBSCORES|:::CHECKLIST|:::META|$)/gs;

  let match;
  while ((match = stepRegex.exec(markdown)) !== null) {
    const stepNumber = parseInt(match[1]);
    const stepContent = match[0];
    steps.set(stepNumber, stepContent);
  }

  console.log(`[PARSER V3.5] Split into ${steps.size} steps:`, Array.from(steps.keys()));
  return steps;
}

// ============================================================================
// Block Parsers
// ============================================================================

function parseSubscoresBlock(markdown: string): SubScores {
  const blockMatch = markdown.match(/:::SUBSCORES\s+([\s\S]+?)\s+:::END/);
  if (!blockMatch) {
    console.warn('[PARSER V3.5] No SUBSCORES block found');
    return createEmptySubScores();
  }

  const block = blockMatch[1];
  const extract = (key: string): number => {
    const match = block.match(new RegExp(`${key}:\\s*([\\d.]+)`));
    return match ? parseFloat(match[1]) : 0;
  };

  const result = {
    centering: {
      front: extract('centering_front'),
      back: extract('centering_back'),
      weighted: (extract('centering_front') + extract('centering_back')) / 2,
    },
    corners: {
      front: extract('corners_front'),
      back: extract('corners_back'),
      weighted: (extract('corners_front') + extract('corners_back')) / 2,
    },
    edges: {
      front: extract('edges_front'),
      back: extract('edges_back'),
      weighted: (extract('edges_front') + extract('edges_back')) / 2,
    },
    surface: {
      front: extract('surface_front'),
      back: extract('surface_back'),
      weighted: (extract('surface_front') + extract('surface_back')) / 2,
    },
    weighted_total: extract('weighted_total'),
  };

  console.log('[PARSER V3.5] Parsed SUBSCORES:', result);
  return result;
}

function parseChecklistBlock(markdown: string): Checklist {
  const blockMatch = markdown.match(/:::CHECKLIST\s+([\s\S]+?)\s+:::END/);
  if (!blockMatch) {
    console.warn('[PARSER V3.5] No CHECKLIST block found');
    return createEmptyChecklist();
  }

  const block = blockMatch[1];
  const extractBool = (key: string): boolean => {
    const match = block.match(new RegExp(`${key}:\\s*(true|false)`));
    return match ? match[1] === 'true' : false;
  };

  const extractString = (key: string): string => {
    const match = block.match(new RegExp(`${key}:\\s*(.+?)(?=\\n|$)`));
    return match ? match[1].trim() : '';
  };

  const result: Checklist = {
    autograph_verified: extractBool('autograph_verified'),
    handwritten_markings: extractBool('handwritten_markings'),
    structural_damage: extractBool('structural_damage'),
    both_sides_present: extractBool('both_sides_present'),
    confidence_letter: extractString('confidence_letter'),
    condition_label_assigned: extractBool('condition_label_assigned'),
    all_steps_completed: extractBool('all_steps_completed'),
    centering_method_used: extractString('centering_method_used'),
    modern_features_identified: extractBool('modern_features_identified'),
    trimming_check_performed: extractBool('trimming_check_performed'),
    grade_cap_applied: extractString('grade_cap_applied'),
    conservative_rounding_applied: extractBool('conservative_rounding_applied'),
  };

  console.log('[PARSER V3.5] Parsed CHECKLIST');
  return result;
}

function parseMetaBlock(markdown: string): MetaData {
  const blockMatch = markdown.match(/:::META\s+([\s\S]+?)\s+:::END/);
  if (!blockMatch) {
    console.warn('[PARSER V3.5] No META block found');
    return createEmptyMeta();
  }

  const block = blockMatch[1];
  const extract = (key: string): string => {
    const match = block.match(new RegExp(`${key}:\\s*(.+?)(?=\\n|$)`));
    return match ? match[1].trim() : '';
  };

  return {
    prompt_version: extract('prompt_version'),
    model: extract('model'),
    evaluated_at: extract('evaluated_at_utc'),
    enhancements: extract('enhancements'),
    patches_applied: extract('patches_applied'),
  };
}

// ============================================================================
// Step Parsers
// ============================================================================

function parseStep1_CardInfo(stepContent: string): CardInfo {
  const extractBullet = (key: string): string | null => {
    const pattern = new RegExp(`-\\s*\\*\\*${key}[^:]*\\*\\*:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = stepContent.match(pattern);
    const value = match ? match[1].trim() : null;

    // Check for "None", "Not Visible", "N/A" etc.
    if (value && (value.toLowerCase().includes('none') ||
                  value.toLowerCase().includes('not visible') ||
                  value.toLowerCase() === 'n/a')) {
      return null;
    }

    return value;
  };

  return {
    card_name: extractBullet('Card Name'),
    player: extractBullet('Player'),
    set_name: extractBullet('Set Name'),
    year: extractBullet('Year'),
    manufacturer: extractBullet('Manufacturer'),
    card_number: extractBullet('Card Number'),
    sport: extractBullet('Sport'),
    subset: extractBullet('Subset'),
    serial_number: extractBullet('Serial Number'),
    rookie_card: extractBullet('Rookie Designation')?.toLowerCase().includes('yes') || false,
    autographed: extractBullet('Autograph')?.toLowerCase().includes('yes') || extractBullet('Autograph')?.toLowerCase().includes('signed') || false,
    memorabilia: extractBullet('Memorabilia')?.toLowerCase().includes('yes') || false,
    rarity_tier: extractBullet('Rarity Tier'),
  };
}

function parseProfessionalSlabData(stepContent: string): ProfessionalSlabData {
  // Check if card is in a professional slab
  // Format 1: "- **Professional Grade**: PSA 10 (Gem Mint)" (bullet list)
  // Format 2: "**Professional Grade** | PSA 10 (Gem Mint)" (table)
  const professionalGradeMatch = stepContent.match(/-\s*\*\*Professional Grade\*\*:\s*(.+?)(?=\n|$)/i) ||
                                  stepContent.match(/\*\*Professional Grade\*\*\s*\|\s*(.+?)(?=\n|$)/i);
  const professionalGradeText = professionalGradeMatch ? professionalGradeMatch[1].trim() : null;

  // Check if no slab detected
  if (!professionalGradeText ||
      professionalGradeText.toLowerCase().includes('none') ||
      professionalGradeText.toLowerCase().includes('not visible') ||
      professionalGradeText.toLowerCase() === 'n/a') {
    return {
      detected: false,
      company: null,
      grade: null,
      grade_description: null,
      cert_number: null,
      sub_grades: null
    };
  }

  // Extract company and grade from format: "PSA 10 (Gem Mint)"
  const gradePattern = /^([A-Z]+)\s+([\d.]+)\s*\(([^)]+)\)/i;
  const gradeMatch = professionalGradeText.match(gradePattern);

  let company: string | null = null;
  let grade: string | null = null;
  let gradeDescription: string | null = null;

  if (gradeMatch) {
    company = gradeMatch[1].toUpperCase(); // PSA, BGS, SGC, CGC, HGA
    grade = gradeMatch[2];                 // 10, 9.5, 9
    gradeDescription = gradeMatch[3];      // Gem Mint, Mint, etc.
  }

  // Extract certification number
  // Format 1: "- **Certification Number**: 12345678" (bullet list)
  // Format 2: "**Certification Number** | 12345678" (table)
  const certMatch = stepContent.match(/-\s*\*\*Certification Number\*\*:\s*(.+?)(?=\n|$)/i) ||
                    stepContent.match(/\*\*Certification Number\*\*\s*\|\s*(.+?)(?=\n|$)/i) ||
                    stepContent.match(/-\s*\*\*Cert #\*\*:\s*(.+?)(?=\n|$)/i);
  let certNumber: string | null = null;
  if (certMatch) {
    const certText = certMatch[1].trim();
    // Extract just the numbers
    const certNumberMatch = certText.match(/[\d-]+/);
    if (certNumberMatch && !certText.toLowerCase().includes('n/a')) {
      certNumber = certNumberMatch[0];
    }
  }

  // Extract BGS sub-grades (if present)
  // Format 1: "- **Sub-Grades**: 9.5/9.5/10/9.5" (bullet list)
  // Format 2: "**Sub-Grades** | 9.5/9.5/10/9.5" (table)
  const subGradesMatch = stepContent.match(/-\s*\*\*Sub-Grades\*\*:\s*([\d.]+\/[\d.]+\/[\d.]+\/[\d.]+)/i) ||
                         stepContent.match(/\*\*Sub-Grades.*?\*\*\s*\|\s*([\d.]+\/[\d.]+\/[\d.]+\/[\d.]+)/i);
  const subGrades = subGradesMatch ? subGradesMatch[1] : null;

  console.log('[PARSER V3.5] Professional slab data:', {
    detected: !!company,
    company,
    grade,
    gradeDescription,
    certNumber,
    subGrades
  });

  return {
    detected: !!company,
    company,
    grade,
    grade_description: gradeDescription,
    cert_number: certNumber,
    sub_grades: subGrades
  };
}

function parseStep2_ImageQuality(stepContent: string): { confidence: string; justification: string } {
  const confidenceMatch = stepContent.match(/-\s*\*\*Image Confidence\*\*:\s*([A-C])/);
  const justificationMatch = stepContent.match(/-\s*\*\*Justification\*\*:\s*(.+?)(?=\n\n|$)/s);

  return {
    confidence: confidenceMatch ? confidenceMatch[1] : 'B',
    justification: justificationMatch ? justificationMatch[1].trim() : '',
  };
}

function parseStep3_FrontEvaluation(stepContent: string) {
  return parseEvaluationStep(stepContent, 'FRONT');
}

function parseStep4_BackEvaluation(stepContent: string) {
  return parseEvaluationStep(stepContent, 'BACK');
}

function parseEvaluationStep(stepContent: string, side: 'FRONT' | 'BACK') {
  // Extract subsections: ### A. Centering, ### B. Corners, etc.
  const subsections = stepContent.split(/(?=### [A-D]\. )/g);

  let centering = { lr: '50/50', tb: '50/50', score: 10 };
  let corners = { top_left: '', top_right: '', bottom_left: '', bottom_right: '', score: 10 };
  let edges = { left: '', right: '', top: '', bottom: '', score: 10 };
  let surface = { defects: '', score: 10 };

  for (const subsection of subsections) {
    if (subsection.includes('### A. Centering')) {
      centering = parseCenteringSubsection(subsection);
    } else if (subsection.includes('### B. Corners')) {
      corners = parseCornersSubsection(subsection);
    } else if (subsection.includes('### C. Edges')) {
      edges = parseEdgesSubsection(subsection);
    } else if (subsection.includes('### D. Surface')) {
      surface = parseSurfaceSubsection(subsection);
    }
  }

  return { centering, corners, edges, surface };
}

function parseCenteringSubsection(subsection: string) {
  const lrMatch = subsection.match(/-\s*\*\*Left\/Right\*\*:\s*(\d+\/\d+)/);
  const tbMatch = subsection.match(/-\s*\*\*Top\/Bottom\*\*:\s*(\d+\/\d+)/);
  const scoreMatch = subsection.match(/-\s*\*\*Centering Sub-Score\*\*:\s*([\d.]+)/);

  // Extract centering analysis/summary
  // Matches both "Centering Analysis" (front) and "Back Centering Analysis" (back)
  const analysisMatch = subsection.match(/-\s*\*\*(?:Back )?Centering Analysis\*\*:\s*(.+?)(?=\n-|\n\n|$)/s);
  const summary = analysisMatch ? analysisMatch[1].trim() : null;

  return {
    lr: lrMatch ? lrMatch[1] : '50/50',
    tb: tbMatch ? tbMatch[1] : '50/50',
    score: scoreMatch ? parseFloat(scoreMatch[1]) : 10,
    summary: summary,
  };
}

function parseCornersSubsection(subsection: string) {
  const extractCorner = (corner: string): string => {
    const pattern = new RegExp(`-\\s*\\*\\*${corner}\\*\\*:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = subsection.match(pattern);
    return match ? match[1].trim() : 'Not assessed';
  };

  const scoreMatch = subsection.match(/-\s*\*\*Corners Sub-Score\*\*:\s*([\d.]+)/);

  return {
    top_left: extractCorner('Top Left'),
    top_right: extractCorner('Top Right'),
    bottom_left: extractCorner('Bottom Left'),
    bottom_right: extractCorner('Bottom Right'),
    score: scoreMatch ? parseFloat(scoreMatch[1]) : 10,
  };
}

function parseEdgesSubsection(subsection: string) {
  const extractEdge = (edge: string): string => {
    const pattern = new RegExp(`-\\s*\\*\\*${edge}\\*\\*:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = subsection.match(pattern);
    return match ? match[1].trim() : 'Not assessed';
  };

  const scoreMatch = subsection.match(/-\s*\*\*Edges Sub-Score\*\*:\s*([\d.]+)/);

  return {
    left: extractEdge('Left'),
    right: extractEdge('Right'),
    top: extractEdge('Top'),
    bottom: extractEdge('Bottom'),
    score: scoreMatch ? parseFloat(scoreMatch[1]) : 10,
  };
}

function parseSurfaceSubsection(subsection: string) {
  const defectsMatch = subsection.match(/-\s*\*\*Defects\*\*:\s*(.+?)(?=\n-|\n\n|$)/s);
  const scoreMatch = subsection.match(/-\s*\*\*Surface Sub-Score\*\*:\s*([\d.]+)/);

  return {
    defects: defectsMatch ? defectsMatch[1].trim() : 'None visible',
    score: scoreMatch ? parseFloat(scoreMatch[1]) : 10,
  };
}

function parseStep5_CrossVerification(stepContent: string): CrossVerification {
  const extract = (key: string): string => {
    const pattern = new RegExp(`-\\s*\\*\\*${key}\\*\\*:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = stepContent.match(pattern);
    return match ? match[1].trim() : 'Not checked';
  };

  return {
    centering_correlation: extract('Centering Correlation'),
    corner_consistency: extract('Corner Damage Consistency'),
    edge_pattern: extract('Edge Wear Pattern'),
    structural_verification: extract('Structural Damage Verification'),
    holder_artifacts: extract('Holder/Case Artifacts'),
  };
}

function parseStep6_DefectPattern(stepContent: string): string {
  const match = stepContent.match(/-\s*\*\*Defect Pattern\*\*:\s*(.+?)(?=\n\n|$)/s);
  return match ? match[1].trim() : '';
}

function parseStep10_FinalCalculation(stepContent: string): FinalCalculation {
  const extractValue = (key: string): string => {
    const pattern = new RegExp(`-\\s*\\*\\*${key}\\*\\*:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = stepContent.match(pattern);
    return match ? match[1].trim() : '';
  };

  const weightedTotal = extractValue('Weighted Total \\(Pre-Cap\\)');
  const cappedGrade = extractValue('Capped Grade');
  const finalGrade = extractValue('Final Decimal Grade');
  const gradeRange = extractValue('Grade Range');
  const wholeGrade = extractValue('Whole Number Equivalent');
  const conditionLabel = extractValue('Condition Label');
  const confidenceNote = extractValue('Confidence Note');

  return {
    weighted_total_pre_cap: weightedTotal ? parseFloat(weightedTotal) : 0,
    capped_grade: cappedGrade ? parseFloat(cappedGrade) : null,
    final_decimal_grade: finalGrade ? parseFloat(finalGrade) : 0,
    grade_range: gradeRange,
    whole_number_equivalent: wholeGrade ? parseInt(wholeGrade) : 0,
    condition_label: conditionLabel,
    confidence_note: confidenceNote,
  };
}

function parseStep14_StatisticalControl(stepContent: string): string {
  const match = stepContent.match(/-\s*(.+?)(?=\n\n|$)/s);
  return match ? match[1].trim() : '';
}

function parseStep15_Appendix(stepContent: string): string {
  return stepContent.trim();
}

// ============================================================================
// Helper Functions - Create Empty Objects
// ============================================================================

function createEmptySubScores(): SubScores {
  return {
    centering: { front: 0, back: 0, weighted: 0 },
    corners: { front: 0, back: 0, weighted: 0 },
    edges: { front: 0, back: 0, weighted: 0 },
    surface: { front: 0, back: 0, weighted: 0 },
    weighted_total: 0,
  };
}

function createEmptyChecklist(): Checklist {
  return {
    autograph_verified: false,
    handwritten_markings: false,
    structural_damage: false,
    both_sides_present: true,
    confidence_letter: 'B',
    condition_label_assigned: false,
    all_steps_completed: false,
    centering_method_used: 'border-present',
    modern_features_identified: false,
    trimming_check_performed: false,
    grade_cap_applied: 'false',
    conservative_rounding_applied: false,
  };
}

function createEmptyMeta(): MetaData {
  return {
    prompt_version: 'unknown',
    model: 'unknown',
    evaluated_at: '',
    enhancements: '',
    patches_applied: '',
  };
}
