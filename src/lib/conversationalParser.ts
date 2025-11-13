/**
 * Conversational Grading Parser
 *
 * Extracts structured data from conversational AI markdown reports
 * Used to make conversational AI grading the primary grading source
 */

/**
 * Round grade to nearest valid DCM grade using custom range mapping
 * Valid grades: 10, 9.5, 9, 8, 7, 6, 5, 4, 3, 2, 1
 *
 * Custom Range Mapping (per user specification):
 * 10.0 = 9.6–10.0
 * 9.5  = 9.3–9.5
 * 9.0  = 8.8–9.2
 * 8.0  = 8.0–8.7
 * 7.0  = 7.0–7.9
 * 6.0  = 6.0–6.9
 * 5.0  = 5.0–5.9
 * 4.0  = 4.0–4.9
 * 3.0  = 3.0–3.9
 * 2.0  = 2.0–2.9
 * 1.0  = 1.0–1.9
 *
 * Note: 8.5 grade is NOT used in this mapping (8.0-8.7 all map to 8.0)
 */
export function roundToValidGrade(grade: number): number {
  // Handle edge cases
  if (grade >= 10) return 10;
  if (grade <= 1) return 1;

  // Custom range mapping per user specification
  if (grade >= 9.6) return 10.0;
  if (grade >= 9.3) return 9.5;
  if (grade >= 8.8) return 9.0;
  if (grade >= 8.0) return 8.0;  // 8.0-8.7 ALL map to 8.0 (no 8.5 grade)

  // Below 8.0: whole number grades (7, 6, 5, 4, 3, 2, 1)
  if (grade >= 7.0) return 7.0;
  if (grade >= 6.0) return 6.0;
  if (grade >= 5.0) return 5.0;
  if (grade >= 4.0) return 4.0;
  if (grade >= 3.0) return 3.0;
  if (grade >= 2.0) return 2.0;

  return 1.0;
}

export interface ConversationalGradingData {
  // Main grade (null for N/A grades - unverified autographs, alterations)
  decimal_grade: number | null;
  whole_grade: number | null;
  grade_uncertainty: string;

  // Sub-scores
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

  // Centering ratios
  centering_ratios: {
    front_lr: string | null;  // e.g., "55/45"
    front_tb: string | null;  // e.g., "50/50"
    back_lr: string | null;
    back_tb: string | null;
  };

  // Raw markdown (for display)
  raw_markdown: string;
}

/**
 * Parse conversational AI markdown report into structured data
 *
 * @param markdown - The markdown report from conversational AI
 * @returns Structured grading data
 */
export function parseConversationalGrading(markdown: string): ConversationalGradingData {
  console.log('[PARSER] Starting parse of conversational grading markdown...');

  // Check for N/A grade FIRST (unverified autograph, alteration, etc.)
  const naGradeMatch = markdown.match(/\*\*Decimal Grade:\*\*\s*N\/A/i);

  if (naGradeMatch) {
    console.log('[PARSER] ⚠️ N/A grade detected (unverified autograph or alteration)');

    // Extract reason if provided
    const reasonMatch = markdown.match(/\*\*Reason:\*\*\s*(.+?)(?=\n|$)/i);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Card is not gradable';

    console.log(`[PARSER] N/A Reason: ${reason}`);

    // Return N/A grade structure
    return {
      decimal_grade: null,
      whole_grade: null,
      grade_uncertainty: 'N/A',
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
      card_info: extractCardInfo(markdown),
      centering_ratios: extractCenteringRatios(markdown),
      raw_markdown: markdown
    };
  }

  // Extract decimal grade (numeric grades only)
  const decimalMatch = markdown.match(/\*\*Decimal Grade:\*\*\s*(\d+\.?\d*)/i);
  const wholeMatch = markdown.match(/\*\*Whole Grade Equivalent:\*\*\s*(\d+)/i);
  const uncertaintyMatch = markdown.match(/\*\*Grade Uncertainty:\*\*\s*(±\d+\.?\d*|N\/A)/i);

  const rawGrade = decimalMatch ? parseFloat(decimalMatch[1]) : 0;
  const decimalGrade = rawGrade ? roundToValidGrade(rawGrade) : 0;
  const wholeGrade = wholeMatch ? parseInt(wholeMatch[1]) : (decimalGrade ? Math.round(decimalGrade) : 0);
  const uncertainty = uncertaintyMatch ? uncertaintyMatch[1] : '±0.5';

  console.log(`[PARSER] Extracted main grade: ${rawGrade} → rounded to ${decimalGrade} (whole: ${wholeGrade}, uncertainty: ${uncertainty})`);

  // Extract sub-scores table
  const subScores = extractSubScoresTable(markdown);
  console.log('[PARSER] Extracted sub-scores:', subScores);

  // Extract weighted summary
  const weightedSummary = extractWeightedSummary(markdown);
  console.log('[PARSER] Extracted weighted summary:', weightedSummary);

  // Extract card information
  const cardInfo = extractCardInfo(markdown);
  console.log('[PARSER] Extracted card info:', cardInfo);

  // Extract centering ratios
  const centeringRatios = extractCenteringRatios(markdown);
  console.log('[PARSER] Extracted centering ratios:', centeringRatios);

  return {
    decimal_grade: decimalGrade,
    whole_grade: wholeGrade,
    grade_uncertainty: uncertainty,
    sub_scores: subScores,
    weighted_summary: weightedSummary,
    card_info: cardInfo,
    centering_ratios: centeringRatios,
    raw_markdown: markdown
  };
}

/**
 * Extract sub-scores from markdown table
 * Looks for pattern: | Centering | 9.5 | 9.3 | 9.4 |
 */
function extractSubScoresTable(markdown: string): ConversationalGradingData['sub_scores'] {
  const defaultScores = {
    centering: { front: 0, back: 0, weighted: 0 },
    corners: { front: 0, back: 0, weighted: 0 },
    edges: { front: 0, back: 0, weighted: 0 },
    surface: { front: 0, back: 0, weighted: 0 }
  };

  // Find the sub-scores table section - match multiple possible headers
  const tableMatch = markdown.match(/### Sub[-\s]Score[s]?.*?\n([\s\S]*?)(?=\n###|\n---|\n$)/i);
  if (!tableMatch) {
    console.log('[PARSER] No sub-scores table found');
    return defaultScores;
  }

  const tableContent = tableMatch[1];
  console.log('[PARSER] Found sub-scores table section');

  // Parse each category row
  const categories = ['centering', 'corners', 'edges', 'surface'];
  const result: any = {};

  for (const category of categories) {
    // Try multiple patterns to catch variations
    const patterns = [
      // Standard pattern: | Centering | 9.5 | 9.3 | 9.4 |
      new RegExp(`\\|\\s*${category}\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|`, 'i'),
      // Without pipes at start/end: Centering | 9.5 | 9.3 | 9.4
      new RegExp(`${category}\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)`, 'i')
    ];

    let match = null;
    for (const pattern of patterns) {
      match = tableContent.match(pattern);
      if (match) break;
    }

    if (match) {
      result[category] = {
        front: roundToValidGrade(parseFloat(match[1])),
        back: roundToValidGrade(parseFloat(match[2])),
        weighted: roundToValidGrade(parseFloat(match[3]))
      };
      console.log(`[PARSER] Parsed ${category}:`, result[category]);
    } else {
      result[category] = { front: 0, back: 0, weighted: 0 };
      console.log(`[PARSER] Could not parse ${category}, using defaults`);
    }
  }

  return result;
}

/**
 * Extract weighted summary data
 */
function extractWeightedSummary(markdown: string): ConversationalGradingData['weighted_summary'] {
  // Look for weighted summary section
  const frontWeightMatch = markdown.match(/Front Weight[^:]*:\s*([\\d.]+)/i);
  const backWeightMatch = markdown.match(/Back Weight[^:]*:\s*([\\d.]+)/i);
  const weightedTotalMatch = markdown.match(/Weighted Total[^:]*:\s*([\\d.]+)/i);
  const gradeCapMatch = markdown.match(/Grade Cap Reason[^:]*:\s*(.+?)(?=\n|$)/i);

  const summary = {
    front_weight: frontWeightMatch ? parseFloat(frontWeightMatch[1]) : 0.55,
    back_weight: backWeightMatch ? parseFloat(backWeightMatch[1]) : 0.45,
    weighted_total: weightedTotalMatch ? parseFloat(weightedTotalMatch[1]) : 0,
    grade_cap_reason: gradeCapMatch && gradeCapMatch[1].trim().toLowerCase() !== 'none' ? gradeCapMatch[1].trim() : null
  };

  console.log('[PARSER] Parsed weighted summary:', summary);
  return summary;
}

/**
 * Extract card information from markdown
 */
function extractCardInfo(markdown: string): ConversationalGradingData['card_info'] {
  // Find the Card Information section
  const cardInfoMatch = markdown.match(/### Card Information[\s\S]*?(?=\n###|\n---|\n$)/i);

  const defaultCardInfo = {
    card_name: null,
    player_or_character: null,
    set_name: null,
    year: null,
    manufacturer: null,
    card_number: null,
    sport_category: null,
    subset: null,
    serial_number: null,
    rookie_card: false,
    autographed: false,
    memorabilia: false,
    rarity_tier: null
  };

  if (!cardInfoMatch) {
    console.log('[PARSER] No card information section found');
    return defaultCardInfo;
  }

  const cardInfoSection = cardInfoMatch[0];

  // Helper function to extract value from patterns like "- Label: value"
  const extractField = (label: string): string | null => {
    // Try multiple patterns
    const patterns = [
      new RegExp(`-\\s*\\*\\*${label}[^:]*:\\*\\*\\s*(.+?)(?=\\n|$)`, 'i'),  // - **Label:** value
      new RegExp(`-\\s*${label}[^:]*:\\s*(.+?)(?=\\n|$)`, 'i'),              // - Label: value
    ];

    for (const pattern of patterns) {
      const match = cardInfoSection.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        // Return null if value is N/A, Unknown, or empty
        if (value && value !== 'N/A' && value !== 'Unknown' && value !== '-') {
          return value;
        }
      }
    }
    return null;
  };

  // Helper to check yes/no fields
  const isYes = (label: string): boolean => {
    const value = extractField(label);
    return value ? value.toLowerCase().includes('yes') : false;
  };

  return {
    card_name: extractField('Card Name'),
    player_or_character: extractField('Player') || extractField('Character'),
    set_name: extractField('Set'),
    year: extractField('Year'),
    manufacturer: extractField('Manufacturer'),
    card_number: extractField('Card Number'),
    sport_category: extractField('Sport') || extractField('Category'),
    subset: extractField('Subset') || extractField('Insert'),
    serial_number: extractField('Serial Number'),
    rookie_card: isYes('Rookie Card'),
    autographed: isYes('Autographed'),
    memorabilia: isYes('Memorabilia'),
    rarity_tier: extractField('Rarity Tier')
  };
}

/**
 * Extract centering ratios from markdown
 */
function extractCenteringRatios(markdown: string): ConversationalGradingData['centering_ratios'] {
  const defaultRatios = {
    front_lr: null,
    front_tb: null,
    back_lr: null,
    back_tb: null
  };

  // Split markdown into Front and Back sections
  const frontSection = markdown.match(/### Front Image Analysis[\s\S]*?(?=### Back Image Analysis|$)/i);
  const backSection = markdown.match(/### Back Image Analysis[\s\S]*?(?=###|$)/i);

  let frontLR = null, frontTB = null, backLR = null, backTB = null;

  if (frontSection) {
    const frontText = frontSection[0];
    // Look for patterns like: - **Left/Right:** 55/45 or **Left/Right:** 55/45
    const lrMatch = frontText.match(/(?:\*\*)?Left\/Right(?:\*\*)?:\s*(\d+\/\d+)/i);
    const tbMatch = frontText.match(/(?:\*\*)?Top\/Bottom(?:\*\*)?:\s*(\d+\/\d+)/i);
    frontLR = lrMatch ? lrMatch[1] : null;
    frontTB = tbMatch ? tbMatch[1] : null;
  }

  if (backSection) {
    const backText = backSection[0];
    // Look for patterns like: - **Left/Right:** 55/45 or **Left/Right:** 55/45
    const lrMatch = backText.match(/(?:\*\*)?Left\/Right(?:\*\*)?:\s*(\d+\/\d+)/i);
    const tbMatch = backText.match(/(?:\*\*)?Top\/Bottom(?:\*\*)?:\s*(\d+\/\d+)/i);
    backLR = lrMatch ? lrMatch[1] : null;
    backTB = tbMatch ? tbMatch[1] : null;
  }

  return {
    front_lr: frontLR,
    front_tb: frontTB,
    back_lr: backLR,
    back_tb: backTB
  };
}

/**
 * Validate parsed data - check if all required fields are present
 *
 * @param data - Parsed conversational grading data
 * @returns true if data is valid, false otherwise
 */
export function validateConversationalGradingData(data: ConversationalGradingData): boolean {
  // Check for N/A grade (valid for unverified autographs, alterations)
  if (data.decimal_grade === null && data.whole_grade === null) {
    if (data.grade_uncertainty === 'N/A') {
      console.log('[PARSER] ✅ Validation passed: N/A grade (card not gradable)');
      return true;
    } else {
      console.warn('[PARSER] Validation failed: Null grade without N/A uncertainty');
      return false;
    }
  }

  // Check main grade for numeric grades
  if (!data.decimal_grade || data.decimal_grade === 0) {
    console.warn('[PARSER] Validation failed: No decimal grade');
    return false;
  }

  // Check if decimal grade is in valid range (1.0 - 10.0)
  if (data.decimal_grade < 1.0 || data.decimal_grade > 10.0) {
    console.warn(`[PARSER] Validation failed: Decimal grade out of range (${data.decimal_grade})`);
    return false;
  }

  // Check if sub-scores are present and non-zero (OPTIONAL - warn but don't fail)
  const hasSubScores = Object.values(data.sub_scores).some(
    category => category.front > 0 || category.back > 0 || category.weighted > 0
  );

  if (!hasSubScores) {
    console.warn('[PARSER] ⚠️ Warning: No sub-scores found in response (using defaults)');
  }

  console.log('[PARSER] Validation passed');
  return true;
}
