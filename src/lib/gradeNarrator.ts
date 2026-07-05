/**
 * Grade Narrator — narrate-after-consensus (v9.1)
 *
 * Builds the final written summary DETERMINISTICALLY from the post-consensus,
 * post-cap numbers and the structured findings — after every server-side
 * mutation (ensemble median, zoom caps, structural caps, weakest-link MIN)
 * has finished. This replaces patching the base completion's prose, which was
 * authored against its own pre-mutation numbers and routinely contradicted
 * the displayed grade ("surfaces are clean" next to a capped 6).
 *
 * The model's original prose is preserved separately (final_grade.model_summary)
 * for reference/debugging; it is no longer what users see.
 */

type Category = 'centering' | 'corners' | 'edges' | 'surface';
const CATEGORIES: Category[] = ['centering', 'corners', 'edges', 'surface'];

const CATEGORY_LABELS: Record<Category, string> = {
  centering: 'centering',
  corners: 'corners',
  edges: 'edges',
  surface: 'surface',
};

export interface NarratorInput {
  finalGrade: number;
  conditionLabel: string;
  uncertainty: string; // "±1"
  subgrades: Record<Category, number>; // post-cap consensus values
  structuralDetected: boolean;
  structuralFindings: Array<{ type?: string; location?: string; description?: string }>;
  /** Human-readable zoom cap notes, e.g. "corners 8→6: moderate whitening (front top-left)" */
  zoomAdjustments: string[];
  /** Server-side grade cap explanation (e.g. uncertainty gate held a 10 at 9) */
  gradeCapNote?: string | null;
  /** Full parsed grading JSON — used to pull the worst defect per category */
  jsonData: any;
}

const SEVERITY_ORDER: Record<string, number> = {
  severe: 4, heavy: 4, major: 4,
  significant: 3, moderate: 3,
  light: 2, minor: 2, slight: 2,
  minimal: 1, negligible: 1,
};

function severityRank(severity: unknown): number {
  if (typeof severity !== 'string') return 2;
  return SEVERITY_ORDER[severity.toLowerCase()] ?? 2;
}

// Legacy region codes → user-facing language. Newly graded cards get friendly
// locations at the source (visionGrader humanizes zoom pushes), but stored
// defects and model-authored strings can still carry codes like "SUR-Q1".
const CODE_LOCATIONS: Record<string, string> = {
  'COR-TL': 'top-left corner', 'COR-TR': 'top-right corner',
  'COR-BL': 'bottom-left corner', 'COR-BR': 'bottom-right corner',
  'EDG-T': 'top edge', 'EDG-B': 'bottom edge', 'EDG-L': 'left edge', 'EDG-R': 'right edge',
  'SUR-Q1': 'upper-left area of the surface', 'SUR-Q2': 'upper-right area of the surface',
  'SUR-Q3': 'lower-left area of the surface', 'SUR-Q4': 'lower-right area of the surface',
};

function humanizeLocationText(location: string): string {
  return location.replace(
    /\b(COR-(?:TL|TR|BL|BR)|EDG-(?:T|B|L|R)|SUR-Q[1-4])\b/gi,
    m => CODE_LOCATIONS[m.toUpperCase()] || m
  );
}

function defectPhrase(defect: any, face: string): string | null {
  if (!defect) return null;
  if (typeof defect === 'string') {
    const text = humanizeLocationText(defect.trim());
    return text ? `${text} (${face})` : null;
  }
  const type = typeof defect.type === 'string' ? defect.type : null;
  if (!type) return null;
  const severity = typeof defect.severity === 'string' ? `${defect.severity} ` : '';
  const location = typeof defect.location === 'string' && defect.location
    ? ` at the ${humanizeLocationText(defect.location.replace(/^(front|back)\s*/i, ''))}`
    : '';
  return `${severity}${type}${location} (${face})`.replace(/\s+/g, ' ').trim();
}

/**
 * Worst structured defect for one category, from the section defects arrays
 * (model findings + zoom-inspection findings share this shape after v9.0).
 */
export function worstDefectForCategory(jsonData: any, cat: Category): string | null {
  let best: { rank: number; phrase: string } | null = null;
  for (const face of ['front', 'back'] as const) {
    const defects = jsonData?.[cat]?.[face]?.defects;
    if (!Array.isArray(defects)) continue;
    for (const d of defects) {
      const phrase = defectPhrase(d, face);
      if (!phrase) continue;
      const rank = severityRank((d as any)?.severity);
      if (!best || rank > best.rank) best = { rank, phrase };
    }
  }
  return best ? best.phrase : null;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Build the authoritative final summary from post-cap numbers + findings.
 * Every number in this text is, by construction, the number the page displays.
 */
export function buildFinalSummary(input: NarratorInput): string {
  const { finalGrade, conditionLabel, subgrades, jsonData } = input;
  const parts: string[] = [];

  // Structural damage dominates everything (v9.0 behavior, now part of the narrator)
  if (input.structuralDetected) {
    const findings = input.structuralFindings.length > 0
      ? input.structuralFindings
      : [{ type: 'structural damage', location: '', description: '' }];
    const listed = findings.slice(0, 3)
      .map((f, i) => `(${i + 1}) ${f.type || 'structural damage'}${f.location ? ` at the ${f.location}` : ''}`)
      .join('; ');
    const more = findings.length > 3 ? `; plus ${findings.length - 3} additional finding(s)` : '';
    parts.push(
      `Structural damage dominates this card's grade: ${listed}${more}.`,
      `A confirmed crease or bend enforces a hard grade cap regardless of how well the card otherwise presents.`
    );
  } else {
    parts.push(`This card grades ${finalGrade} (${conditionLabel}).`);

    // Consensus subgrades — the authoritative numbers, stated in the text itself
    parts.push(
      `Consensus subgrades — centering ${subgrades.centering}, corners ${subgrades.corners}, edges ${subgrades.edges}, surface ${subgrades.surface}.`
    );

    // Limiting factor(s): every category at the weakest-link value
    const weakest = Math.min(...CATEGORIES.map(c => subgrades[c]));
    if (weakest < 10) {
      const limiting = CATEGORIES.filter(c => subgrades[c] === weakest);
      const highlight = worstDefectForCategory(jsonData, limiting[0]);
      parts.push(
        `The grade is limited by ${joinList(limiting.map(c => CATEGORY_LABELS[c]))} at ${weakest}/10${highlight ? ` — most notable: ${highlight}` : ''}.`
      );
    }

    // Server-side grade cap (e.g. uncertainty gate)
    if (input.gradeCapNote) {
      parts.push(input.gradeCapNote);
    }

    // Zoom inspection contribution (deterministic, from the cap notes)
    if (input.zoomAdjustments.length > 0) {
      parts.push(`Regioned zoom inspection confirmed additional defects (${input.zoomAdjustments.slice(0, 3).join('; ')}).`);
    }

    // Strengths: categories presenting at 9+
    const strong = CATEGORIES.filter(c => subgrades[c] >= 9);
    if (strong.length > 0 && weakest < 9) {
      parts.push(`${joinList(strong.map(c => CATEGORY_LABELS[c].charAt(0).toUpperCase() + CATEGORY_LABELS[c].slice(1)))} otherwise present${strong.length === 1 ? 's' : ''} strongly at ${strong.map(c => subgrades[c]).sort()[0]}+.`);
    }
  }

  // Confidence caveat for wide uncertainty
  const uncertaintyN = parseInt(input.uncertainty.replace(/[^\d]/g, ''), 10) || 0;
  if (uncertaintyN >= 2) {
    parts.push(`Image quality limits confidence in this evaluation (${input.uncertainty}).`);
  }

  // Canonical tail — display surfaces and legacy parsers rely on this exact form
  parts.push(`Final grade: ${finalGrade} (${conditionLabel}).`);

  return parts.join(' ');
}

/**
 * Reconcile a per-face prose summary's score tokens to the FINAL face score.
 * Descriptive wording is left intact (the face prose still comes from the
 * completion that examined that face); only numeric claims are corrected so
 * text like "8/10" can't sit beside a zoom-capped 6.
 */
export function reconcileFaceProse(text: string | undefined | null, faceScore: number | undefined | null): string | undefined {
  if (!text || typeof text !== 'string') return text ?? undefined;
  if (typeof faceScore !== 'number' || !Number.isFinite(faceScore)) return text;
  let result = text;
  result = result.replace(/\b(\d{1,2}(?:\.\d)?)\s*\/\s*10\b/g, `${faceScore}/10`);
  result = result.replace(/\b(scores?|score of|rating of|rated|grades? at|grade of)\s+(\d{1,2}(?:\.\d)?)\b/gi, `$1 ${faceScore}`);
  return result;
}
