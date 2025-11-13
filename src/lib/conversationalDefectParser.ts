/**
 * Conversational Defect Parser
 * Extracts structured defect data from v3.3 and v3.5 markdown reports
 * Used ONCE on backend after AI grading completes
 * Supports both v3.3 and v3.5 PATCHED v2 formats
 */

import {
  CardDefects,
  SideDefects,
  DefectDetail,
  CenteringMeasurements,
  GradingMetadata,
  DEFAULT_SIDE_DEFECTS,
  DEFAULT_CARD_DEFECTS,
  DefectSeverity
} from '@/types/card';

/**
 * Main parsing function - extracts all defects from markdown
 */
export function parseConversationalDefects(markdown: string | null | undefined): CardDefects | null {
  if (!markdown) return null;

  try {
    // Extract STEP 3 (Front) and STEP 4 (Back)
    // v3.3: [STEP 3] FRONT ANALYSIS, [STEP 4] BACK ANALYSIS
    // v3.5: [STEP 3] FRONT EVALUATION, [STEP 4] BACK EVALUATION
    const frontMatch = markdown.match(/\[STEP 3\] FRONT (?:ANALYSIS|EVALUATION)[\s\S]*?(?=\[STEP 4\]|$)/i);
    const backMatch = markdown.match(/\[STEP 4\] BACK (?:ANALYSIS|EVALUATION)[\s\S]*?(?=\[STEP 5\]|$)/i);

    const frontDefects = frontMatch ? extractSideDefects(frontMatch[0]) : DEFAULT_SIDE_DEFECTS;
    const backDefects = backMatch ? extractSideDefects(backMatch[0]) : DEFAULT_SIDE_DEFECTS;

    return {
      front: frontDefects,
      back: backDefects
    };
  } catch (error) {
    console.error('[Backend Parser] Failed to parse conversational defects:', error);
    return null;
  }
}

/**
 * Extract defects for one side (front or back)
 */
function extractSideDefects(sectionText: string): SideDefects {
  // Extract corners section
  // v3.3: CORNERS (Front), v3.5: B. Corners or ### B. Corners
  const cornersSection = sectionText.match(/(?:^|\n)(?:#{1,3}\s*)?[A-Z]?\.\s*CORNERS.*?[\s\S]*?(?=(?:^|\n)(?:#{1,3}\s*)?[A-Z]?\.\s*EDGES|EDGES.*?\((?:Front|Back)\)|$)/i)?.[0] ||
                          sectionText.match(/CORNERS.*?\((?:Front|Back)\)[\s\S]*?(?=EDGES|$)/i)?.[0] || '';

  // Extract edges section
  // v3.3: EDGES (Front), v3.5: C. Edges or ### C. Edges
  const edgesSection = sectionText.match(/(?:^|\n)(?:#{1,3}\s*)?[A-Z]?\.\s*EDGES.*?[\s\S]*?(?=(?:^|\n)(?:#{1,3}\s*)?[A-Z]?\.\s*SURFACE|SURFACE.*?\((?:Front|Back)\)|$)/i)?.[0] ||
                       sectionText.match(/EDGES.*?\((?:Front|Back)\)[\s\S]*?(?=SURFACE|$)/i)?.[0] || '';

  // Extract surface section
  // v3.3: SURFACE (Front), v3.5: D. Surface or ### D. Surface
  const surfaceSection = sectionText.match(/(?:^|\n)(?:#{1,3}\s*)?[A-Z]?\.\s*SURFACE.*?[\s\S]*?(?=(?:^|\n)(?:#{1,3}\s*)?[A-Z]?\.\s*(?:COLOR|FEATURE)|FRONT SUMMARY|BACK SUMMARY|$)/i)?.[0] ||
                         sectionText.match(/SURFACE.*?\((?:Front|Back)\)[\s\S]*?(?=COLOR|FEATURE|FRONT SUMMARY|BACK SUMMARY|$)/i)?.[0] || '';

  return {
    corners: {
      // v3.3: "- Top Left: ...", v3.5: "- **Top Left**: ..."
      top_left: parseCorner(cornersSection.match(/-?\s*\*?\*?Top Left\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean'),
      top_right: parseCorner(cornersSection.match(/-?\s*\*?\*?Top Right\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean'),
      bottom_left: parseCorner(cornersSection.match(/-?\s*\*?\*?Bottom Left\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean'),
      bottom_right: parseCorner(cornersSection.match(/-?\s*\*?\*?Bottom Right\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean')
    },
    edges: {
      // v3.3: "- Top: ...", v3.5: "- **Top Edge**: ..." or "- **Top**: ..."
      top: parseEdge(edgesSection.match(/-?\s*\*?\*?Top(?:\s+Edge)?\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean'),
      bottom: parseEdge(edgesSection.match(/-?\s*\*?\*?Bottom(?:\s+Edge)?\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean'),
      left: parseEdge(edgesSection.match(/-?\s*\*?\*?Left(?:\s+Edge)?\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean'),
      right: parseEdge(edgesSection.match(/-?\s*\*?\*?Right(?:\s+Edge)?\*?\*?:\s*([^\n]+)/i)?.[1] || 'Clean')
    },
    surface: parseSurface(surfaceSection)
  };
}

/**
 * Parse corner description
 */
function parseCorner(text: string): DefectDetail {
  const severityMatch = text.match(/(Microscopic|Minor|Moderate|Heavy)/i)?.[1];
  const severity: DefectSeverity = severityMatch ? severityMatch.toLowerCase() as DefectSeverity : 'none';
  const description = text.replace(/^-?\s*\*\*[^*]+\*\*:\s*/i, '').trim();

  return {
    severity,
    description: description || 'Clean'
  };
}

/**
 * Parse edge description
 */
function parseEdge(text: string): DefectDetail {
  const severityMatch = text.match(/(Microscopic|Minor|Moderate|Heavy|Clean)/i)?.[1];
  let severity: DefectSeverity;

  if (severityMatch?.toLowerCase() === 'clean') {
    severity = 'none';
  } else if (severityMatch) {
    severity = severityMatch.toLowerCase() as DefectSeverity;
  } else {
    severity = 'none';
  }

  const description = text.replace(/^-?\s*\*\*[^*]+\*\*:\s*/i, '').trim();

  return {
    severity,
    description: description || 'Clean'
  };
}

/**
 * Parse surface defects
 */
function parseSurface(section: string): SideDefects['surface'] {
  const defects = {
    scratches: { severity: 'none' as DefectSeverity, description: 'No scratches detected' },
    creases: { severity: 'none' as DefectSeverity, description: 'No creases detected' },
    print_defects: { severity: 'none' as DefectSeverity, description: 'No print defects detected' },
    stains: { severity: 'none' as DefectSeverity, description: 'No stains detected' },
    other: { severity: 'none' as DefectSeverity, description: 'No other issues detected' }
  };

  // Look for scratches
  if (section.match(/scratch/i)) {
    const match = section.match(/([Mm]inor|[Mm]oderate|[Hh]eavy)?\s*(?:surface\s*)?scratch/i);
    const severity: DefectSeverity = (match?.[1]?.toLowerCase() as DefectSeverity) || 'minor';
    defects.scratches = {
      severity,
      description: section.match(/- ([^\n]*scratch[^\n]*)/i)?.[1]?.trim() || 'Surface scratch detected'
    };
  }

  // Look for creases
  if (section.match(/crease/i)) {
    const match = section.match(/([Mm]inor|[Mm]oderate|[Hh]eavy)?\s*crease/i);
    const severity: DefectSeverity = (match?.[1]?.toLowerCase() as DefectSeverity) || 'minor';
    defects.creases = {
      severity,
      description: section.match(/- ([^\n]*crease[^\n]*)/i)?.[1]?.trim() || 'Crease detected'
    };
  }

  // Look for print defects
  if (section.match(/print/i)) {
    defects.print_defects = {
      severity: 'minor',
      description: section.match(/- ([^\n]*print[^\n]*)/i)?.[1]?.trim() || 'Print defect detected'
    };
  }

  // Look for stains
  if (section.match(/stain|discolor/i)) {
    defects.stains = {
      severity: 'minor',
      description: section.match(/- ([^\n]*(?:stain|discolor)[^\n]*)/i)?.[1]?.trim() || 'Staining detected'
    };
  }

  // Check for "clean" statements
  if (section.match(/clean|no visible|no major/i) && !section.match(/scratch|crease|print|stain/i)) {
    defects.other = { severity: 'none', description: 'Surface appears clean' };
  }

  return defects;
}

/**
 * Extract centering measurements from markdown
 * v3.3: [STEP 2] CENTERING with Front L/R, Front T/B, etc.
 * v3.5: [STEP 2] IMAGE QUALITY & CONFIDENCE ASSESSMENT (centering in STEP 3/4 subsections)
 */
export function parseCenteringMeasurements(markdown: string | null | undefined): CenteringMeasurements | null {
  if (!markdown) return null;

  try {
    // Try v3.3 format first (standalone STEP 2 CENTERING)
    const centeringMatchV3_3 = markdown.match(/\[STEP 2\] CENTERING[\s\S]*?(?=\[STEP 3\]|$)/i);
    if (centeringMatchV3_3) {
      const section = centeringMatchV3_3[0];
      return {
        front_left_right: section.match(/Front L\/R:\s*([^\n]+)/i)?.[1]?.trim() || 'N/A',
        front_top_bottom: section.match(/Front T\/B:\s*([^\n]+)/i)?.[1]?.trim() || 'N/A',
        back_left_right: section.match(/Back L\/R:\s*([^\n]+)/i)?.[1]?.trim() || 'N/A',
        back_top_bottom: section.match(/Back T\/B:\s*([^\n]+)/i)?.[1]?.trim() || 'N/A',
        centering_score: parseFloat(section.match(/Centering Score:\s*([0-9.]+)/i)?.[1] || '0')
      };
    }

    // Try v3.5 format (centering in STEP 3 and STEP 4 subsections)
    const frontEvalMatch = markdown.match(/\[STEP 3\] FRONT EVALUATION[\s\S]*?(?=\[STEP 4\]|$)/i);
    const backEvalMatch = markdown.match(/\[STEP 4\] BACK EVALUATION[\s\S]*?(?=\[STEP 5\]|$)/i);

    if (frontEvalMatch || backEvalMatch) {
      const frontSection = frontEvalMatch?.[0] || '';
      const backSection = backEvalMatch?.[0] || '';

      // Extract centering ratios from v3.5 format
      // Format: "Left/Right: 55/45" or "L/R: 55/45"
      const frontLR = frontSection.match(/Left\/Right:\s*(\d+\/\d+)/i)?.[1]?.trim() ||
                      frontSection.match(/L\/R:\s*(\d+\/\d+)/i)?.[1]?.trim() || 'N/A';
      const frontTB = frontSection.match(/Top\/Bottom:\s*(\d+\/\d+)/i)?.[1]?.trim() ||
                      frontSection.match(/T\/B:\s*(\d+\/\d+)/i)?.[1]?.trim() || 'N/A';
      const backLR = backSection.match(/Left\/Right:\s*(\d+\/\d+)/i)?.[1]?.trim() ||
                     backSection.match(/L\/R:\s*(\d+\/\d+)/i)?.[1]?.trim() || 'N/A';
      const backTB = backSection.match(/Top\/Bottom:\s*(\d+\/\d+)/i)?.[1]?.trim() ||
                     backSection.match(/T\/B:\s*(\d+\/\d+)/i)?.[1]?.trim() || 'N/A';

      return {
        front_left_right: frontLR,
        front_top_bottom: frontTB,
        back_left_right: backLR,
        back_top_bottom: backTB,
        centering_score: 0 // v3.5 doesn't have a single centering score
      };
    }

    return null;
  } catch (error) {
    console.error('[Backend Parser] Failed to parse centering:', error);
    return null;
  }
}

/**
 * Extract metadata from markdown
 */
export function parseGradingMetadata(markdown: string | null | undefined): GradingMetadata | null {
  if (!markdown) return null;

  try {
    return {
      cross_side_verification: markdown.match(/Cross-Side Verification:\s*([^\n]+)/i)?.[1]?.trim() || null,
      microscopic_inspection_count: parseInt(markdown.match(/Microscopic inspections:\s*(\d+)/i)?.[1] || '0'),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Backend Parser] Failed to parse metadata:', error);
    return null;
  }
}
