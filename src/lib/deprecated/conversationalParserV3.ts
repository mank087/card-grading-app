/**
 * Conversational Grading Parser V3.2 (DEPRECATED)
 *
 * Parses structured block format with :::SUBSCORES, :::CHECKLIST, :::META blocks
 * Used for v3.2 enhanced prompt with condition labels and validation
 *
 * STATUS: Legacy fallback for old cached cards only
 * REPLACED BY: conversationalParserV3_5.ts
 */

import { roundToValidGrade } from '@/lib/conversationalParser';

export interface ConversationalGradingDataV3 {
  // Main grade
  decimal_grade: number | null;
  whole_grade: number | null;
  grade_uncertainty: string;
  condition_label: string | null; // NEW: "Gem Mint", "Mint", "Near Mint", etc.

  // Sub-scores (v3.2 structured format)
  sub_scores: {
    centering: { front: number; back: number; weighted: number };
    corners: { front: number; back: number; weighted: number };
    edges: { front: number; back: number; weighted: number };
    surface: { front: number; back: number; weighted: number };
  };

  // Weighted summary
  weighted_summary: {
    front_weight: number;
    back_weight: number;
    weighted_total: number;
    grade_cap_reason: string | null;
  };

  // Card information
  card_info: {
    card_name: string | null;
    player_or_character: string | null;
    set_name: string | null;
    year: string | null;
    manufacturer: string | null;
    card_number: string | null;
    sport_category: string | null;
    subset: string | null;
    serial_number: string | null;
    rookie_card: boolean;
    autographed: boolean;
    memorabilia: boolean;
    rarity_tier: string | null;
  };

  // Image quality (NEW for v3.2)
  image_confidence: string | null; // A, B, C, or D

  // Case detection (NEW for v3.5 PATCHED)
  case_detection: {
    case_type: string | null; // none, penny_sleeve, top_loader, one_touch, semi_rigid, slab
    case_visibility: string | null; // full, partial, obscured
    impact_level: string | null; // none, minor, moderate, high
    notes: string | null;
  };

  // Validation checklist (NEW for v3.2)
  validation_checklist: {
    autograph_verified: boolean;
    handwritten_markings: boolean;
    structural_damage: boolean;
    both_sides_present: boolean;
    confidence_letter: string;
    condition_label_assigned: boolean;
    all_steps_completed: boolean;
  };

  // Analysis summaries (NEW for v3.2)
  front_summary: string | null;
  back_summary: string | null;

  // Centering ratios
  centering_ratios: {
    front_lr: string | null;
    front_tb: string | null;
    back_lr: string | null;
    back_tb: string | null;
  };

  // Slab detection (NEW for v3.2)
  slab_detection: {
    slab_detected: boolean;
    company: string | null;
    grade: string | null;
    cert_number: string | null;
    serial_number: string | null;
    label_type: string | null;
    subgrades: {
      centering?: number;
      corners?: number;
      edges?: number;
      surface?: number;
    } | null;
  };

  // Meta (NEW for v3.2)
  meta: {
    prompt_version: string;
    evaluated_at_utc: string | null;
  };

  // Raw markdown (for display)
  raw_markdown: string;
}

/**
 * Strip markdown formatting from text
 */
function stripMarkdown(text: string | null): string | null {
  if (!text) return null;
  // Remove **bold** and *italic* formatting
  return text.replace(/\*\*/g, '').replace(/\*/g, '').trim();
}

/**
 * Parse structured block (:::BLOCKNAME ... :::END format)
 */
function parseStructuredBlock(markdown: string, blockName: string): Record<string, string> {
  const pattern = new RegExp(`:::${blockName}\\s*([\\s\\S]*?):::END`, 'i');
  const match = markdown.match(pattern);

  if (!match) {
    console.log(`[PARSER V3] No ${blockName} block found`);
    return {};
  }

  const blockContent = match[1].trim();
  const data: Record<string, string> = {};

  const lines = blockContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (key && value) {
      data[key] = value;
    }
  }

  console.log(`[PARSER V3] Parsed ${blockName}:`, data);
  return data;
}

/**
 * Parse v3.2 conversational grading markdown
 */
export function parseConversationalGradingV3(markdown: string): ConversationalGradingDataV3 {
  console.log('[PARSER V3] Starting parse of v3.2 conversational grading markdown...');

  // Parse structured blocks
  const subscoresBlock = parseStructuredBlock(markdown, 'SUBSCORES');
  const checklistBlock = parseStructuredBlock(markdown, 'CHECKLIST');
  const metaBlock = parseStructuredBlock(markdown, 'META');

  // Check for N/A grade FIRST
  const naGradeMatch = markdown.match(/\*\*Decimal Grade:\*\*\s*N\/A/i);

  if (naGradeMatch) {
    console.log('[PARSER V3] ⚠️ N/A grade detected (unverified autograph or alteration)');

    const reasonMatch = markdown.match(/\*\*Grade Cap Reason:\*\*\s*(.+?)(?=\n|$)/i);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Card is not gradable';

    return {
      decimal_grade: null,
      whole_grade: null,
      grade_uncertainty: 'N/A',
      condition_label: 'Authentic Altered (AA)',
      sub_scores: {
        centering: { front: 0, back: 0, weighted: 0 },
        corners: { front: 0, back: 0, weighted: 0 },
        edges: { front: 0, back: 0, weighted: 0 },
        surface: { front: 0, back: 0, weighted: 0 }
      },
      weighted_summary: {
        front_weight: 0.55,
        back_weight: 0.45,
        weighted_total: 0,
        grade_cap_reason: reason
      },
      card_info: extractCardInfoV3(markdown),
      image_confidence: extractImageConfidence(markdown),
      case_detection: extractCaseDetection(markdown),
      validation_checklist: parseValidationChecklist(checklistBlock),
      front_summary: extractFrontSummary(markdown),
      back_summary: extractBackSummary(markdown),
      centering_ratios: extractCenteringRatiosV3(markdown),
      slab_detection: extractSlabDetection(markdown),
      meta: {
        prompt_version: metaBlock.prompt_version || 'v3.2',
        evaluated_at_utc: metaBlock.evaluated_at_utc || null
      },
      raw_markdown: markdown
    };
  }

  // Extract decimal grade (v3.5: "- **Final Decimal Grade:** 9.0", v3.2: "Decimal Grade: 9.4")
  // Try multiple patterns to handle variations (from most specific to most general)
  let decimalMatch = markdown.match(/^\s*-\s*\*\*Final\s+Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/im);
  if (!decimalMatch) {
    decimalMatch = markdown.match(/-\s*\*\*Final\s+Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/i);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/\*\*Final\s+Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/i);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/\*\*(?:Final\s+)?Decimal\s+Grade\*\*:\s*(\d+\.?\d*)/i);
  }
  if (!decimalMatch) {
    decimalMatch = markdown.match(/(?:Final\s+)?Decimal\s+Grade[:\s]+(\d+\.?\d*)/i);
  }

  // Extract whole grade (v3.5: "- **Whole Number Equivalent:** 9", v3.2: "Whole grade: 9")
  let wholeMatch = markdown.match(/^\s*-\s*\*\*Whole\s+Number\s+Equivalent\*\*:\s*(\d+)/im);
  if (!wholeMatch) {
    wholeMatch = markdown.match(/-\s*\*\*Whole\s+Number\s+Equivalent\*\*:\s*(\d+)/i);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/\*\*Whole\s+Number\s+Equivalent\*\*:\s*(\d+)/i);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/\*\*Whole\s+(?:Number\s+Equivalent|Grade\s+Equivalent)\*\*:\s*(\d+)/i);
  }
  if (!wholeMatch) {
    wholeMatch = markdown.match(/Whole\s+(?:Number\s+Equivalent|Grade(?:\s+Equivalent)?)[:\s]+(\d+)/i);
  }

  // Extract uncertainty (v3.5: "- **Grade Range:** 9.0 ± 0.2", v3.2: "Grade uncertainty: ±0.5")
  let uncertaintyMatch = markdown.match(/Grade\s+Range:\s*\d+\.?\d*\s*(±\d+\.?\d*)/i);
  if (!uncertaintyMatch) {
    uncertaintyMatch = markdown.match(/\*\*(?:Grade\s+)?(?:Uncertainty|Range)\*\*:\s*([^\n]+)/i);
  }
  if (!uncertaintyMatch) {
    uncertaintyMatch = markdown.match(/(?:Grade\s+)?(?:Uncertainty|Range)[:\s]+([^\n]+)/i);
  }

  const rawGrade = decimalMatch ? parseFloat(decimalMatch[1]) : 0;
  const decimalGrade = rawGrade ? roundToValidGrade(rawGrade) : 0;
  const wholeGrade = wholeMatch ? parseInt(wholeMatch[1]) : Math.round(decimalGrade);
  const uncertainty = uncertaintyMatch ? uncertaintyMatch[1].trim() : '±0.5';

  // Debug: Show what was matched
  console.log(`[PARSER V3] Decimal match result:`, decimalMatch ? `Matched: "${decimalMatch[0]}" → value: ${decimalMatch[1]}` : 'NO MATCH');
  console.log(`[PARSER V3] Whole match result:`, wholeMatch ? `Matched: "${wholeMatch[0]}" → value: ${wholeMatch[1]}` : 'NO MATCH');
  console.log(`[PARSER V3] Uncertainty match result:`, uncertaintyMatch ? `Matched: "${uncertaintyMatch[0]}" → value: ${uncertaintyMatch[1]}` : 'NO MATCH');
  console.log(`[PARSER V3] Extracted main grade: ${rawGrade} → rounded to ${decimalGrade} (whole: ${wholeGrade}, uncertainty: ${uncertainty})`);

  // Extract condition label
  const conditionLabel = extractConditionLabel(markdown, decimalGrade);

  // Parse sub-scores from structured block
  const subScores = parseSubScoresFromBlock(subscoresBlock);

  // Extract weighted summary
  const weightedSummary = extractWeightedSummaryV3(markdown);

  // Extract card information
  const cardInfo = extractCardInfoV3(markdown);

  // Extract image confidence
  const imageConfidence = extractImageConfidence(markdown);

  // Parse validation checklist
  const validationChecklist = parseValidationChecklist(checklistBlock);

  // Extract summaries
  const frontSummary = extractFrontSummary(markdown);
  const backSummary = extractBackSummary(markdown);

  // Extract centering ratios
  const centeringRatios = extractCenteringRatiosV3(markdown);

  // Extract slab detection
  const slabDetection = extractSlabDetection(markdown);

  return {
    decimal_grade: decimalGrade,
    whole_grade: wholeGrade,
    grade_uncertainty: uncertainty,
    condition_label: conditionLabel,
    sub_scores: subScores,
    weighted_summary: weightedSummary,
    card_info: cardInfo,
    image_confidence: imageConfidence,
    case_detection: extractCaseDetection(markdown),
    validation_checklist: validationChecklist,
    front_summary: frontSummary,
    back_summary: backSummary,
    centering_ratios: centeringRatios,
    slab_detection: slabDetection,
    meta: {
      prompt_version: metaBlock.prompt_version || 'v3.2',
      evaluated_at_utc: metaBlock.evaluated_at_utc || null
    },
    raw_markdown: markdown
  };
}

/**
 * Parse sub-scores from :::SUBSCORES block
 */
function parseSubScoresFromBlock(subscoresBlock: Record<string, string>): ConversationalGradingDataV3['sub_scores'] {
  const parseScore = (value: string | undefined): number => {
    if (!value) return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  return {
    centering: {
      front: parseScore(subscoresBlock.centering_front),
      back: parseScore(subscoresBlock.centering_back),
      weighted: parseScore(subscoresBlock.centering_front) * 0.55 + parseScore(subscoresBlock.centering_back) * 0.45
    },
    corners: {
      front: parseScore(subscoresBlock.corners_front),
      back: parseScore(subscoresBlock.corners_back),
      weighted: parseScore(subscoresBlock.corners_front) * 0.55 + parseScore(subscoresBlock.corners_back) * 0.45
    },
    edges: {
      front: parseScore(subscoresBlock.edges_front),
      back: parseScore(subscoresBlock.edges_back),
      weighted: parseScore(subscoresBlock.edges_front) * 0.55 + parseScore(subscoresBlock.edges_back) * 0.45
    },
    surface: {
      front: parseScore(subscoresBlock.surface_front),
      back: parseScore(subscoresBlock.surface_back),
      weighted: parseScore(subscoresBlock.surface_front) * 0.55 + parseScore(subscoresBlock.surface_back) * 0.45
    }
  };
}

/**
 * Extract condition label from markdown
 */
function extractConditionLabel(markdown: string, decimalGrade: number): string {
  // Try to find explicit label in markdown
  const labelMatch = markdown.match(/\*\*Condition Label:\*\*\s*(.+?)(?:\s*\(|$)/i);
  if (labelMatch) {
    return labelMatch[1].trim();
  }

  // Fallback: derive from decimal grade
  if (decimalGrade >= 9.6) return 'Gem Mint (GM)';
  if (decimalGrade >= 9.0) return 'Mint (M)';
  if (decimalGrade >= 8.0) return 'Near Mint (NM)';
  if (decimalGrade >= 6.0) return 'Excellent (EX)';
  if (decimalGrade >= 4.0) return 'Good (G)';
  if (decimalGrade >= 2.0) return 'Fair (F)';
  if (decimalGrade >= 1.0) return 'Poor (P)';
  return 'Unknown';
}

/**
 * Extract image confidence (A/B/C/D)
 */
function extractImageConfidence(markdown: string): string | null {
  const confidenceMatch = markdown.match(/\*\*Image Confidence Score.*?:\*\*\s*([A-D])/i);
  if (confidenceMatch) return confidenceMatch[1];

  // Also check in checklist block
  const checklistMatch = markdown.match(/confidence_letter:\s*([A-E])/i);
  if (checklistMatch) return checklistMatch[1];

  return null;
}

/**
 * Extract case detection (protective case information)
 */
function extractCaseDetection(markdown: string): {
  case_type: string | null;
  case_visibility: string | null;
  impact_level: string | null;
  notes: string | null;
} {
  const caseTypeMatch = markdown.match(/Case Type:\s*(none|penny_sleeve|top_loader|one_touch|semi_rigid|slab)/i);
  const visibilityMatch = markdown.match(/Visibility:\s*(full|partial|obscured)/i);
  const impactMatch = markdown.match(/Impact Level:\s*(none|minor|moderate|high)/i);
  const notesMatch = markdown.match(/(?:Protective Case Detection\s+)?Notes:\s*([^\n]+)/i);

  return {
    case_type: caseTypeMatch ? caseTypeMatch[1].toLowerCase() : 'none',
    case_visibility: visibilityMatch ? visibilityMatch[1].toLowerCase() : 'full',
    impact_level: impactMatch ? impactMatch[1].toLowerCase() : 'none',
    notes: notesMatch ? notesMatch[1].trim() : null
  };
}

/**
 * Parse validation checklist
 */
function parseValidationChecklist(checklistBlock: Record<string, string>): ConversationalGradingDataV3['validation_checklist'] {
  const parseYesNo = (value: string | undefined): boolean => {
    if (!value) return false;
    return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  };

  return {
    autograph_verified: parseYesNo(checklistBlock.autograph_verified),
    handwritten_markings: parseYesNo(checklistBlock.handwritten_markings),
    structural_damage: parseYesNo(checklistBlock.structural_damage),
    both_sides_present: parseYesNo(checklistBlock.both_sides_present),
    confidence_letter: checklistBlock.confidence_letter || 'B',
    condition_label_assigned: parseYesNo(checklistBlock.condition_label_assigned),
    all_steps_completed: parseYesNo(checklistBlock.all_steps_completed)
  };
}

/**
 * Extract front summary from [STEP 3]
 */
function extractFrontSummary(markdown: string): string | null {
  const frontSummaryMatch = markdown.match(/\*\*Front Summary\*\*\s*\n([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
  if (frontSummaryMatch) {
    return frontSummaryMatch[1].trim();
  }
  return null;
}

/**
 * Extract back summary from [STEP 4]
 */
function extractBackSummary(markdown: string): string | null {
  const backSummaryMatch = markdown.match(/\*\*Back Summary\*\*\s*\n([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
  if (backSummaryMatch) {
    return backSummaryMatch[1].trim();
  }
  return null;
}

/**
 * Extract weighted summary
 */
function extractWeightedSummaryV3(markdown: string): ConversationalGradingDataV3['weighted_summary'] {
  const frontWeightMatch = markdown.match(/Front Weight[^:]*:\s*([\d.]+)/i);
  const backWeightMatch = markdown.match(/Back Weight[^:]*:\s*([\d.]+)/i);
  const weightedTotalMatch = markdown.match(/Weighted Total[^:]*:\s*([\d.]+)/i);
  const gradeCapMatch = markdown.match(/Grade Cap Reason[^:]*:\s*(.+?)(?=\n|$)/i);

  return {
    front_weight: frontWeightMatch ? parseFloat(frontWeightMatch[1]) : 0.55,
    back_weight: backWeightMatch ? parseFloat(backWeightMatch[1]) : 0.45,
    weighted_total: weightedTotalMatch ? parseFloat(weightedTotalMatch[1]) : 0,
    grade_cap_reason: gradeCapMatch && gradeCapMatch[1].trim().toLowerCase() !== 'none' ? gradeCapMatch[1].trim() : null
  };
}

/**
 * Extract card information from [STEP 1]
 */
function extractCardInfoV3(markdown: string): ConversationalGradingDataV3['card_info'] {
  // Find STEP 1 section
  const step1Match = markdown.match(/\[STEP 1\] CARD INFORMATION EXTRACTION[\s\S]*?(?=\[STEP 2\]|$)/i);
  const searchSection = step1Match ? step1Match[0] : markdown;

  // Debug: Log the section being searched (first 500 chars for brevity)
  console.log('[PARSER V3] STEP 1 section to search (first 500 chars):', searchSection.substring(0, 500));

  const extractField = (label: string): string | null => {
    // Handle both markdown table format (pipe-separated) and colon format
    // Table format: "Card Name / Title | Double Standard"
    // Colon format: "Card Name: Double Standard"
    const patterns = [
      // Try table format with pipe first (higher priority)
      new RegExp(`${label}[^|\\n]*\\|\\s*\\*\\*(.+?)\\*\\*`, 'i'),
      new RegExp(`${label}[^|\\n]*\\|\\s*(.+?)(?=\\n|$)`, 'i'),
      // Fall back to colon format
      new RegExp(`${label}[^:]*:\\s*\\*\\*(.+?)\\*\\*`, 'i'),
      new RegExp(`${label}[^:]*:\\s*(.+?)(?=\\n|$)`, 'i'),
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = searchSection.match(pattern);

      // Debug log for critical fields - show pattern attempts
      if (label === 'Player' || label === 'Card Name' || label === 'Set' || label === 'Title') {
        console.log(`[PARSER V3] Field "${label}" pattern ${i}: ${pattern.source.substring(0, 50)}... → match:`, match ? match[1] : 'null');
      }

      if (match && match[1]) {
        let value = match[1].trim();
        // Strip markdown and leading/trailing pipes
        value = stripMarkdown(value) || '';
        value = value.replace(/^\|+|\|+$/g, '').trim();

        // Debug log for critical fields
        if (label === 'Player' || label === 'Card Name' || label === 'Set' || label === 'Title') {
          console.log(`[PARSER V3] Field "${label}" raw value:`, match[1], '→ stripped:', value);
        }

        // Comprehensive validation: Filter out invalid, placeholder, and ambiguous values
        const lowerValue = value.toLowerCase();
        const invalidValues = [
          'n/a', 'unknown', 'unclear', 'unclear / not visible', 'not visible',
          'none', 'none visible', 'not shown', 'not present',
          'yes', 'no', '-', '–', '—', 'n.a.', 'tbd', 'tba'
        ];

        // Check if value is valid
        if (value &&
            value.length >= 2 &&  // Minimum length check
            !invalidValues.includes(lowerValue) &&
            !lowerValue.startsWith('unclear') &&
            !lowerValue.startsWith('not ') &&
            !lowerValue.match(/^[^\w\s]+$/)) {  // Not just punctuation
          return value;
        }
      }
    }
    return null;
  };

  const isYes = (label: string): boolean => {
    // Handle both markdown table format and colon format
    const patterns = [
      // Try table format with pipe first
      new RegExp(`${label}[^|\\n]*\\|\\s*\\*\\*(.+?)\\*\\*`, 'i'),
      new RegExp(`${label}[^|\\n]*\\|\\s*(.+?)(?=\\n|$)`, 'i'),
      // Fall back to colon format
      new RegExp(`${label}[^:]*:\\s*\\*\\*(.+?)\\*\\*`, 'i'),
      new RegExp(`${label}[^:]*:\\s*(.+?)(?=\\n|$)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = searchSection.match(pattern);
      if (match && match[1]) {
        const value = stripMarkdown(match[1].trim()) || '';
        const cleanValue = value.replace(/^\|+|\|+$/g, '').trim().toLowerCase();
        // Check for positive indicators: "yes", "on-card", "verified", "present", etc.
        return cleanValue.includes('yes') ||
               cleanValue.includes('on-card') ||
               cleanValue.includes('verified') ||
               cleanValue === 'rc' ||
               cleanValue.includes('(rc)') ||  // 🔧 FIX: Handle "Rookie Card (RC)"
               cleanValue.includes('rookie card') ||  // 🔧 FIX: Handle "Rookie Card"
               cleanValue.includes('rookie') && label.toLowerCase().includes('rookie') ||  // 🔧 FIX: "Rookie" in Rookie field
               (label.toLowerCase().includes('autograph') && cleanValue.includes('autograph'));
      }
    }
    return false;
  };

  // Helper to check if memorabilia/relic is present (handles descriptive values like "Fabric Patch")
  const hasMemorabilia = (): boolean => {
    const memorabiliaValue = extractField('Memorabilia') || extractField('Relic');
    if (!memorabiliaValue) return false;

    const lowerValue = memorabiliaValue.toLowerCase();
    // Return false only if explicitly "none", "no", "n/a", etc.
    const negativeValues = ['none', 'no', 'n/a', 'n.a.', 'not present', 'none visible'];
    return !negativeValues.includes(lowerValue);
  };

  const cardInfo = {
    card_name: extractField('Card Name') || extractField('Title'),
    player_or_character: extractField('Player') || extractField('Character'),
    set_name: extractField('Set'),
    year: extractField('Year'),
    manufacturer: extractField('Manufacturer'),
    card_number: extractField('Card Number'),
    sport_category: extractField('Sport') || extractField('Category'),
    subset: extractField('Subset') || extractField('Insert'),
    serial_number: extractField('Serial Number'),
    rookie_card: isYes('Rookie'),
    autographed: isYes('Autograph'),
    memorabilia: hasMemorabilia(),  // 🔧 FIX: Handle descriptive values like "Fabric Patch"
    rarity_tier: extractField('Rarity Tier')
  };

  console.log('[PARSER V3] Extracted card info:', cardInfo);
  return cardInfo;
}

/**
 * Extract centering ratios
 */
function extractCenteringRatiosV3(markdown: string): ConversationalGradingDataV3['centering_ratios'] {
  // Look in STEP 3 (Front) and STEP 4 (Back)
  const frontSection = markdown.match(/\[STEP 3\][\s\S]*?(?=\[STEP 4\]|$)/i);
  const backSection = markdown.match(/\[STEP 4\][\s\S]*?(?=\[STEP 5\]|$)/i);

  let frontLR = null, frontTB = null, backLR = null, backTB = null;

  if (frontSection) {
    const frontText = frontSection[0];
    // Look for explicit "Left/Right: XX/XX" or "Horizontal: XX/XX" format
    // Handle optional bullets, bold (**), and asterisks
    const lrMatch = frontText.match(/[-*\s]*\*?\*?(?:Left\/Right|Horizontal|L\/R)\*?\*?:?\*?\*?\s*(\d+\/\d+)/i);
    const tbMatch = frontText.match(/[-*\s]*\*?\*?(?:Top\/Bottom|Vertical|T\/B)\*?\*?:?\*?\*?\s*(\d+\/\d+)/i);

    if (lrMatch) {
      frontLR = lrMatch[1];
      console.log('[PARSER V3] Extracted front L/R:', frontLR);
    }
    if (tbMatch) {
      frontTB = tbMatch[1];
      console.log('[PARSER V3] Extracted front T/B:', frontTB);
    }
  }

  if (backSection) {
    const backText = backSection[0];
    // Look for explicit "Left/Right: XX/XX" or "Horizontal: XX/XX" format
    // Handle optional bullets, bold (**), and asterisks
    const lrMatch = backText.match(/[-*\s]*\*?\*?(?:Left\/Right|Horizontal|L\/R)\*?\*?:?\*?\*?\s*(\d+\/\d+)/i);
    const tbMatch = backText.match(/[-*\s]*\*?\*?(?:Top\/Bottom|Vertical|T\/B)\*?\*?:?\*?\*?\s*(\d+\/\d+)/i);

    if (lrMatch) {
      backLR = lrMatch[1];
      console.log('[PARSER V3] Extracted back L/R:', backLR);
    }
    if (tbMatch) {
      backTB = tbMatch[1];
      console.log('[PARSER V3] Extracted back T/B:', backTB);
    }
  }

  console.log('[PARSER V3] Final centering ratios:', { front_lr: frontLR, front_tb: frontTB, back_lr: backLR, back_tb: backTB });

  return {
    front_lr: frontLR,
    front_tb: frontTB,
    back_lr: backLR,
    back_tb: backTB
  };
}

/**
 * Extract slab detection information
 */
function extractSlabDetection(markdown: string): ConversationalGradingDataV3['slab_detection'] {
  // Look for slab detection in STEP 1
  const slabDetectedMatch = markdown.match(/SLAB DETECTED:\s*(Yes|No)/i);
  const slabDetected = slabDetectedMatch?.[1]?.toLowerCase() === 'yes';

  if (!slabDetected) {
    return {
      slab_detected: false,
      company: null,
      grade: null,
      cert_number: null,
      serial_number: null,
      label_type: null,
      subgrades: null
    };
  }

  // Extract slab information
  const companyMatch = markdown.match(/Company:\s*([^\n]+)/i);
  const gradeMatch = markdown.match(/Grade:\s*([^\n]+)/i);
  const certMatch = markdown.match(/Cert(?:ification)? Number:\s*([^\n]+)/i);
  const serialMatch = markdown.match(/Serial:\s*([^\n]+)/i);
  const labelTypeMatch = markdown.match(/Label Type:\s*([^\n]+)/i);

  // Extract subgrades if present
  let subgrades: { centering?: number; corners?: number; edges?: number; surface?: number } | null = null;
  const subgradesMatch = markdown.match(/Subgrades:\s*([^\n]+)/i);
  if (subgradesMatch) {
    const subgradeText = subgradesMatch[1];
    const centeringMatch = subgradeText.match(/Centering[:\s]+(\d+(?:\.\d+)?)/i);
    const cornersMatch = subgradeText.match(/Corners[:\s]+(\d+(?:\.\d+)?)/i);
    const edgesMatch = subgradeText.match(/Edges[:\s]+(\d+(?:\.\d+)?)/i);
    const surfaceMatch = subgradeText.match(/Surface[:\s]+(\d+(?:\.\d+)?)/i);

    if (centeringMatch || cornersMatch || edgesMatch || surfaceMatch) {
      subgrades = {
        centering: centeringMatch ? parseFloat(centeringMatch[1]) : undefined,
        corners: cornersMatch ? parseFloat(cornersMatch[1]) : undefined,
        edges: edgesMatch ? parseFloat(edgesMatch[1]) : undefined,
        surface: surfaceMatch ? parseFloat(surfaceMatch[1]) : undefined
      };
    }
  }

  // Strip markdown from extracted values
  const company = stripMarkdown(companyMatch?.[1]?.trim() || null);
  const grade = stripMarkdown(gradeMatch?.[1]?.trim() || null);
  const certNumber = stripMarkdown(certMatch?.[1]?.trim() || null);
  const serialNumber = stripMarkdown(serialMatch?.[1]?.trim() || null);
  const labelType = stripMarkdown(labelTypeMatch?.[1]?.trim() || null);

  console.log('[PARSER V3] Slab detected:', {
    company,
    grade,
    cert: certNumber
  });

  return {
    slab_detected: true,
    company,
    grade,
    cert_number: certNumber,
    serial_number: serialNumber,
    label_type: labelType,
    subgrades
  };
}

/**
 * Validate v3.2 parsed data
 */
export function validateConversationalGradingDataV3(data: ConversationalGradingDataV3): boolean {
  // Check for N/A grade
  if (data.decimal_grade === null && data.whole_grade === null) {
    if (data.grade_uncertainty === 'N/A') {
      console.log('[PARSER V3] ✅ Validation passed: N/A grade (card not gradable)');
      return true;
    }
  }

  // Check main grade for numeric grades
  if (!data.decimal_grade || data.decimal_grade === 0) {
    console.warn('[PARSER V3] Validation failed: No decimal grade');
    return false;
  }

  if (data.decimal_grade < 1.0 || data.decimal_grade > 10.0) {
    console.warn(`[PARSER V3] Validation failed: Decimal grade out of range (${data.decimal_grade})`);
    return false;
  }

  console.log('[PARSER V3] Validation passed');
  return true;
}
