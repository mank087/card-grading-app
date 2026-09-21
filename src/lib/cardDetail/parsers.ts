/**
 * Pure parsing/formatting helpers for the card detail page (V2).
 *
 * EXTRACTED VERBATIM FROM `src/app/pokemon/[id]/CardDetailClient.tsx`.
 * The eight legacy CardDetailClient.tsx files are frozen for the whole
 * redesign (docs/PLAN_CARD_DETAIL_REDESIGN_2026-09-21.md §4), so V2 needs its
 * own copy rather than an import. If a fix lands on the legacy page during the
 * project, mirror it here. Line ranges are from the pokemon client as of
 * 2026-09-21:
 *
 *   renderValue                     677-690
 *   formatGrade                     692-699
 *   getUncertaintyFromConfidence    702-715
 *   shouldRecommendNewPhotos        718-722
 *   convertRangeToPlusMinus         725-752
 *   formatGradedDate                763-778
 *   extractDCMOpticVersion          782-792
 *   getDCMOpticVersion              795-812
 *   parseConversationalDefects      2243-2384   (sports 1627-1768, identical)
 *   extractConditionSummary         2389-2413   (sports 2396-2420, identical)
 *   extractCenteringAnalysis        2417-2458   (sports 2424-2465, identical)
 *   safeToFixed                     2529-2534   (sports 2536-2541, identical)
 *   stripMarkdown                   2538-2547   (sports 2548-2556, see note)
 *   extractEnglishForSearch         2550-2562   (pokemon only)
 *
 * Two functions closed over component state in legacy and take it as an
 * argument here; both are called out below. Nothing else was changed, and in
 * particular no "improvements" were made to the regexes.
 */

/** Legacy display coercion: objects/arrays/empty all collapse to "N/A". */
export function renderValue(value: any) {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return "N/A";
  }
  // Handle objects by converting to string or returning "N/A"
  if (typeof value === 'object' && value !== null) {
    // If it's an array, join with commas
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : "N/A";
    }
    // For other objects, return "N/A" to avoid rendering errors
    return "N/A";
  }
  return value;
}

export function formatGrade(grade: number | null | undefined): string {
  // 🔧 FIX: Treat 0, null, and undefined as N/A (0 is not a valid grade)
  if (grade === null || grade === undefined || grade === 0) {
    return "N/A";
  }
  // v6.0: Always return whole number (no decimals)
  return Math.round(grade).toString();
}

/** Map confidence letter to uncertainty (v7.4 whole-number system). */
export function getUncertaintyFromConfidence(
  confidence: string | null | undefined,
  grade?: number | string | null
): string {
  if (!confidence) return '±1'; // Default to B confidence

  const conf = confidence.toUpperCase().trim();
  // v9.26: a 10 is never shown with +/-2. A C-letter card only reaches 10 when every magnified region was inspected.
  if (conf === 'C' && Math.round(Number(grade)) === 10) return '±1';
  switch (conf) {
    case 'A': return '±0';
    case 'B': return '±1';
    case 'C': return '±2';
    case 'D': return '±3';
    default: return '±1'; // Default to B confidence
  }
}

export function shouldRecommendNewPhotos(confidence: string | null | undefined): boolean {
  if (!confidence) return false;
  const conf = confidence.toUpperCase().trim();
  return conf === 'C' || conf === 'D';
}

/** Convert a "9-10" style range to "±1" (v7.4 whole-number system). */
export function convertRangeToPlusMinus(uncertainty: string | null | undefined): string {
  if (!uncertainty) return '±1';

  const uncertaintyStr = uncertainty.toString().trim();

  // If already in ± format, return as-is
  if (uncertaintyStr.includes('±')) {
    const match = uncertaintyStr.match(/±\s*[\d.]+/);
    return match ? match[0] : '±1';
  }

  // If in range format (e.g., "9-10"), convert to ±
  const rangeMatch = uncertaintyStr.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    const lower = parseFloat(rangeMatch[1]);
    const upper = parseFloat(rangeMatch[2]);
    const plusMinus = Math.round((upper - lower) / 2);
    return `±${plusMinus}`;
  }

  // If just a number (e.g., "1"), assume it's the ± value
  if (/^[\d.]+$/.test(uncertaintyStr)) {
    return `±${Math.round(parseFloat(uncertaintyStr))}`;
  }

  // Default fallback
  return '±1';
}

export function formatGradedDate(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  } catch {
    return 'N/A';
  }
}

/** "Conversational_Grading_v5.5_THREE_PASS" -> "V5.5" */
export function extractDCMOpticVersion(promptVersion: string | undefined | null): string | null {
  if (!promptVersion) return null;

  // Match version pattern like v5.0, v5.5, v4.2, etc.
  const versionMatch = promptVersion.match(/v(\d+\.?\d*)/i);
  if (versionMatch) {
    return `V${versionMatch[1]}`;
  }
  return null;
}

/**
 * Legacy took the whole card; it only ever reads conversational_grading, so
 * this takes the string directly.
 */
export function getDCMOpticVersion(conversationalGrading: string | null | undefined): string | null {
  if (!conversationalGrading) return null;

  try {
    const parsed = JSON.parse(conversationalGrading);
    // Check multiple possible locations for version info
    // Priority: prompt_version > rubric_version > model_version
    const versionSource = parsed.prompt_version ||
                          parsed.metadata?.prompt_version ||
                          parsed.meta?.prompt_version ||
                          parsed.metadata?.rubric_version ||
                          parsed.meta?.version ||
                          parsed.metadata?.model_version;
    return extractDCMOpticVersion(versionSource);
  } catch {
    return null;
  }
}

/**
 * Regex fallback for defect data when the backend did not store the structured
 * conversational_defects_front / _back columns. Returns null when neither the
 * STEP 3 nor the STEP 4 section can be found.
 */
export function parseConversationalDefects(markdown: string | null | undefined) {
  if (!markdown) return null;

  const parseCorner = (text: string) => {
    const severity = text.match(/(Microscopic|Minor|Moderate|Heavy)/i)?.[1] || 'none';
    const description = text.replace(/^-?\s*\*\*[^*]+\*\*:\s*/i, '').trim();
    return { severity: severity.toLowerCase(), description };
  };

  const parseEdge = (text: string) => {
    const severity = text.match(/(Microscopic|Minor|Moderate|Heavy|Clean)/i)?.[1] || 'none';
    const description = text.replace(/^-?\s*\*\*[^*]+\*\*:\s*/i, '').trim();
    return { severity: severity === 'Clean' ? 'none' : severity.toLowerCase(), description };
  };

  const parseSurface = (section: string) => {
    const defects = {
      scratches: { severity: 'none', description: 'No scratches detected' },
      creases: { severity: 'none', description: 'No creases detected' },
      print_defects: { severity: 'none', description: 'No print defects detected' },
      stains: { severity: 'none', description: 'No stains detected' },
      other: { severity: 'none', description: 'No other issues detected' }
    };

    // Look for surface mentions
    if (section.match(/scratch/i)) {
      const match = section.match(/([Mm]inor|[Mm]oderate|[Hh]eavy)?\s*(?:surface\s*)?scratch/i);
      const severity = match?.[1]?.toLowerCase() || 'minor';
      defects.scratches = {
        severity,
        description: section.match(/- ([^\n]*scratch[^\n]*)/i)?.[1]?.trim() || 'Surface scratch detected'
      };
    }

    if (section.match(/crease/i)) {
      defects.creases = {
        severity: 'moderate',
        description: section.match(/- ([^\n]*crease[^\n]*)/i)?.[1]?.trim() || 'Crease detected'
      };
    }

    if (section.match(/print/i)) {
      defects.print_defects = {
        severity: 'minor',
        description: section.match(/- ([^\n]*print[^\n]*)/i)?.[1]?.trim() || 'Print defect detected'
      };
    }

    if (section.match(/stain|discolor/i)) {
      defects.stains = {
        severity: 'minor',
        description: section.match(/- ([^\n]*(?:stain|discolor)[^\n]*)/i)?.[1]?.trim() || 'Staining detected'
      };
    }

    // If no defects found, check for "clean" or "no visible" statements
    if (section.match(/clean|no visible|no major/i) && !section.match(/scratch|crease|print|stain/i)) {
      defects.other = { severity: 'none', description: 'Surface appears clean' };
    }

    return defects;
  };

  // Extract STEP 3 (Front) and STEP 4 (Back)
  const frontMatch = markdown.match(/\[STEP 3\] FRONT ANALYSIS[\s\S]*?(?=\[STEP 4\]|$)/i);
  const backMatch = markdown.match(/\[STEP 4\] BACK ANALYSIS[\s\S]*?(?=\[STEP 5\]|$)/i);

  const extractDefects = (sectionText: string) => {
    // Extract corners
    const cornersSection = sectionText.match(/CORNERS.*?\((?:Front|Back)\)[\s\S]*?(?=EDGES|$)/i)?.[0] || '';
    const corners = {
      top_left: parseCorner(cornersSection.match(/-?\s*Top Left:\s*([^\n]+)/i)?.[1] || 'Clean'),
      top_right: parseCorner(cornersSection.match(/-?\s*Top Right:\s*([^\n]+)/i)?.[1] || 'Clean'),
      bottom_left: parseCorner(cornersSection.match(/-?\s*Bottom Left:\s*([^\n]+)/i)?.[1] || 'Clean'),
      bottom_right: parseCorner(cornersSection.match(/-?\s*Bottom Right:\s*([^\n]+)/i)?.[1] || 'Clean')
    };

    // Extract edges
    const edgesSection = sectionText.match(/EDGES.*?\((?:Front|Back)\)[\s\S]*?(?=SURFACE|$)/i)?.[0] || '';
    const edges = {
      top: parseEdge(edgesSection.match(/-?\s*Top:\s*([^\n]+)/i)?.[1] || 'Clean'),
      bottom: parseEdge(edgesSection.match(/-?\s*Bottom:\s*([^\n]+)/i)?.[1] || 'Clean'),
      left: parseEdge(edgesSection.match(/-?\s*Left:\s*([^\n]+)/i)?.[1] || 'Clean'),
      right: parseEdge(edgesSection.match(/-?\s*Right:\s*([^\n]+)/i)?.[1] || 'Clean')
    };

    // Extract surface
    const surfaceSection = sectionText.match(/SURFACE.*?\((?:Front|Back)\)[\s\S]*?(?=COLOR|FEATURE|FRONT SUMMARY|BACK SUMMARY|$)/i)?.[0] || '';
    const surface = parseSurface(surfaceSection);

    return { corners, edges, surface };
  };

  const frontDefects = frontMatch ? extractDefects(frontMatch[0]) : null;
  const backDefects = backMatch ? extractDefects(backMatch[0]) : null;

  if (!frontDefects && !backDefects) return null;

  return {
    front: frontDefects || {
      corners: {
        top_left: { severity: 'none', description: 'No data' },
        top_right: { severity: 'none', description: 'No data' },
        bottom_left: { severity: 'none', description: 'No data' },
        bottom_right: { severity: 'none', description: 'No data' }
      },
      edges: {
        top: { severity: 'none', description: 'No data' },
        bottom: { severity: 'none', description: 'No data' },
        left: { severity: 'none', description: 'No data' },
        right: { severity: 'none', description: 'No data' }
      },
      surface: {
        scratches: { severity: 'none', description: 'No data' },
        creases: { severity: 'none', description: 'No data' },
        print_defects: { severity: 'none', description: 'No data' },
        stains: { severity: 'none', description: 'No data' },
        other: { severity: 'none', description: 'No data' }
      }
    },
    back: backDefects || {
      corners: {
        top_left: { severity: 'none', description: 'No data' },
        top_right: { severity: 'none', description: 'No data' },
        bottom_left: { severity: 'none', description: 'No data' },
        bottom_right: { severity: 'none', description: 'No data' }
      },
      edges: {
        top: { severity: 'none', description: 'No data' },
        bottom: { severity: 'none', description: 'No data' },
        left: { severity: 'none', description: 'No data' },
        right: { severity: 'none', description: 'No data' }
      },
      surface: {
        scratches: { severity: 'none', description: 'No data' },
        creases: { severity: 'none', description: 'No data' },
        print_defects: { severity: 'none', description: 'No data' },
        stains: { severity: 'none', description: 'No data' },
        other: { severity: 'none', description: 'No data' }
      }
    }
  };
}

/** Condition prose from STEP 6, falling back to the STEP 10 condition label. */
export function extractConditionSummary(markdown: string | null | undefined): string | null {
  if (!markdown) return null;

  // Try to extract from STEP 6 Visual Condition Framework or similar sections
  const summaryMatch = markdown.match(/\[STEP 6\] VISUAL CONDITION FRAMEWORK[\s\S]*?(?=\[STEP 7\]|$)/i);
  if (summaryMatch) {
    const section = summaryMatch[0];
    // Extract bullet points or summary text
    const lines = section.split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .join('. ');

    if (lines) return lines;
  }

  // Fallback: extract from Step 10 Final Grade Calculation
  const finalMatch = markdown.match(/\[STEP 10\][\s\S]*?Condition Label.*?:\s*([^\n]+)/i);
  if (finalMatch) {
    return `Card condition: ${finalMatch[1].trim()}`;
  }

  return null;
}

/** The pre-parsed v3.5 columns legacy prefers over re-parsing the markdown. */
export interface CenteringAnalysisSummaries {
  conversational_front_summary?: string | null;
  conversational_back_summary?: string | null;
}

/**
 * Legacy read `card.conversational_front_summary` / `_back_summary` from the
 * component closure; here they are the second argument. Behaviour is otherwise
 * identical, including the "either column present wins outright" rule — a card
 * with only a front summary gets `back: null` and never reaches the markdown
 * fallback.
 */
export function extractCenteringAnalysis(
  markdown: string | null | undefined,
  summaries: CenteringAnalysisSummaries = {}
): { front: string | null; back: string | null } {
  // 🎯 PRIORITY: Use pre-parsed database fields if available (v3.5 parser)
  if (summaries.conversational_front_summary || summaries.conversational_back_summary) {
    return {
      front: summaries.conversational_front_summary || null,
      back: summaries.conversational_back_summary || null
    };
  }

  // ⚠️ FALLBACK: Parse from markdown for backward compatibility
  if (!markdown) return { front: null, back: null };

  // Extract from Step 3 (Front Evaluation)
  const frontMatch = markdown.match(/##\s*\[STEP 3\]\s*FRONT EVALUATION[\s\S]*?(?=##\s*\[STEP|$)/i);
  let frontAnalysis: string | null = null;
  if (frontMatch) {
    // Look for "- **Centering Analysis**: text"
    const centeringAnalysisMatch = frontMatch[0].match(/-\s*\*\*Centering Analysis\*\*:\s*([^\n]+)/i);
    if (centeringAnalysisMatch) {
      frontAnalysis = centeringAnalysisMatch[1].trim();
    }
  }

  // Extract from Step 4 (Back Evaluation)
  const backMatch = markdown.match(/##\s*\[STEP 4\]\s*BACK EVALUATION[\s\S]*?(?=##\s*\[STEP|$)/i);
  let backAnalysis: string | null = null;
  if (backMatch) {
    // Look for "- **Back Centering Analysis**: text"
    const centeringAnalysisMatch = backMatch[0].match(/-\s*\*\*Back Centering Analysis\*\*:\s*([^\n]+)/i);
    if (centeringAnalysisMatch) {
      backAnalysis = centeringAnalysisMatch[1].trim();
    }
  }

  return { front: frontAnalysis, back: backAnalysis };
}

/**
 * v6.2: rounds to whole numbers to match printed labels/reports. The `decimals`
 * argument is vestigial in legacy — it is accepted and ignored — and is kept so
 * call sites copied from the legacy page behave the same.
 */
export function safeToFixed(value: any, _decimals: number = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num)) return '0';
  // Round to whole number to match PDF labels
  return Math.round(num).toString();
}

export interface StripMarkdownOptions {
  /**
   * Treat the literal string "null" as null. The pokemon client does this, the
   * sports client does not (pokemon 2538-2547 vs sports 2548-2556); it is the
   * only behavioural difference between the two copies of this helper.
   * Defaults to the pokemon behaviour.
   */
  treatLiteralNullAsNull?: boolean;
}

export function stripMarkdown(
  text: string | null | undefined,
  options: StripMarkdownOptions = {}
): string | null {
  const { treatLiteralNullAsNull = true } = options;
  if (text === null || text === undefined) return null;
  const str = typeof text === 'string' ? text : String(text);
  if (!str) return null;
  // Handle "null" string (AI sometimes returns this)
  if (treatLiteralNullAsNull && str === 'null') return null;
  // Remove **bold** formatting
  return str.replace(/\*\*/g, '').trim();
}

/** Pull the English half out of a "日本語 (English)" name for marketplace searches. */
export function extractEnglishForSearch(text: string | null | undefined): string | null {
  if (!text) return null;

  // Check if text contains Japanese characters and bilingual format
  const hasJapanese = /[぀-ゟ゠-ヿ一-龯]/.test(text);
  if (!hasJapanese) return text; // Already English-only

  // Extract English from "Japanese (English)" format
  const parts = text.split(/[/()（）]/);
  const englishPart = parts.find((p: string) => p.trim() && !/[぀-ゟ゠-ヿ一-龯]/.test(p));

  return englishPart ? englishPart.trim() : text;
}
