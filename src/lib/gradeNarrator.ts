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

/** Plain-language opener for each grade tier — collector language, no mechanics. */
function tierOpener(finalGrade: number): string {
  if (finalGrade >= 10) return 'A virtually flawless card in these photos - sharp corners, clean edges, and a pristine surface throughout.';
  if (finalGrade >= 9) return 'An outstanding card, just shy of perfect.';
  if (finalGrade >= 8) return 'A strong, well-kept card with only light signs of handling.';
  if (finalGrade >= 7) return 'A solid card showing light wear.';
  if (finalGrade >= 5) return 'A moderately worn card with visible handling.';
  if (finalGrade >= 3) return 'A heavily worn card with significant condition issues.';
  return 'A damaged card with major condition issues.';
}

/** Strip severity jargon down to friendly wording and drop trailing "(front)" markers
 *  into prose ("on the front"). Input phrases come from defectPhrase(). */
function friendlyDefect(phrase: string): string {
  return phrase
    .replace(/\s*\((front|back)\)\s*$/i, (_, f) => ` on the ${f.toLowerCase()}`)
    .replace(/\bminor\b/gi, 'light')
    .replace(/\bmoderate\b/gi, 'noticeable')
    .replace(/\bheavy\b/gi, 'heavy');
}

// Keep the generated text ASCII-friendly: the mini-report JPG renderer strips
// non-ASCII characters, which used to cut em-dashes and "±" out mid-sentence.

/**
 * Build the authoritative final summary from post-cap numbers + findings.
 * Every number in this text is, by construction, the number the page displays.
 *
 * v9.5 rewrite — human-readable and short. Design constraints:
 *  - The tightest display surfaces (foldable PDF + mini-report JPG) truncate at
 *    ~8 wrapped lines ≈ 450-480 chars; target <= ~420 chars so nothing clips.
 *  - Subgrade NUMBERS are rendered as tiles/boxes right next to this text on
 *    every surface — do not repeat them here.
 *  - No internal mechanics language ("consensus", "weakest-link", "regioned
 *    zoom") — zoom-found defects already live in the section defect arrays and
 *    surface through the limiting-factor sentence.
 *  - The canonical tail "Final grade: N (Label)." is load-bearing for parsers
 *    and display checks — keep its exact form.
 */
export function buildFinalSummary(input: NarratorInput): string {
  const { finalGrade, conditionLabel, subgrades, jsonData } = input;
  const parts: string[] = [];

  if (input.structuralDetected) {
    // Structural damage dominates everything (v9.0 behavior)
    const findings = input.structuralFindings.length > 0
      ? input.structuralFindings
      : [{ type: 'structural damage', location: '', description: '' }];
    const listed = findings.slice(0, 2)
      .map(f => `a ${f.type || 'structural issue'}${f.location ? ` (${humanizeLocationText(f.location)})` : ''}`)
      .join(' and ');
    parts.push(
      `This card has structural damage - ${listed} - which caps the grade no matter how well the rest of the card presents.`
    );
  } else {
    parts.push(tierOpener(finalGrade));

    // What holds the grade back, in plain words. Only called out when a category
    // sits at 8 or below — a 9 is not a flaw worth narrating (the tier opener and
    // any cap note already tell that story).
    const weakest = Math.min(...CATEGORIES.map(c => subgrades[c]));
    if (weakest <= 8) {
      const limiting = CATEGORIES.filter(c => subgrades[c] === weakest);
      const highlight = worstDefectForCategory(jsonData, limiting[0]);
      if (highlight) {
        parts.push(`The grade comes down to the ${joinList(limiting.map(c => CATEGORY_LABELS[c]))}: ${friendlyDefect(highlight)}.`);
      } else if (limiting.includes('centering')) {
        // v9.5: quote the measured ratio when centering was measured, not eyeballed.
        const mf = jsonData?.centering?.front;
        const mb = jsonData?.centering?.back;
        const measured = (mf?.measured && mf.left_right) ? mf : (mb?.measured && mb.left_right) ? mb : null;
        parts.push(measured
          ? `The grade comes down to centering - the borders measure ${measured.left_right} left/right and ${measured.top_bottom} top/bottom.`
          : `The grade comes down to centering - the borders are visibly uneven.`);
      } else {
        parts.push(`The grade comes down to the ${joinList(limiting.map(c => CATEGORY_LABELS[c]))}.`);
      }

      // What's still good about the card
      const strong = CATEGORIES.filter(c => subgrades[c] >= 9);
      if (strong.length > 0 && weakest < 9) {
        parts.push(`The ${joinList(strong.map(c => CATEGORY_LABELS[c]))} ${strong.length === 1 ? 'is' : 'are'} otherwise excellent.`);
      }
    }

    // Server-side grade cap (already written in customer language, e.g. the
    // rigid-holder note or the Gem-Mint unanimity note)
    if (input.gradeCapNote) {
      parts.push(input.gradeCapNote);
    }
  }

  // Confidence caveat for wide uncertainty (ASCII-safe: no "±")
  const uncertaintyN = parseInt(input.uncertainty.replace(/[^\d]/g, ''), 10) || 0;
  if (uncertaintyN >= 2) {
    parts.push(`Photo quality limits how confidently this card can be assessed.`);
  }

  // Canonical tail — display surfaces and legacy parsers rely on this exact form
  const tail = `Final grade: ${finalGrade} (${conditionLabel}).`;

  // Length budget: drop the least essential sentences until the text fits the
  // tightest surface (~420 chars including the tail), rather than letting the
  // PDF/JPG renderers clip mid-sentence.
  const BUDGET = 420;
  let body = parts.join(' ');
  const optionalDropOrder = [
    /\s*The (?:centering|corners|edges|surface)(?:, | and |[a-z ,]*)* (?:is|are) otherwise excellent\./, // strengths first
    /\s*Photo quality limits how confidently this card can be assessed\./,
  ];
  for (const rx of optionalDropOrder) {
    if (body.length + 1 + tail.length <= BUDGET) break;
    body = body.replace(rx, '');
  }
  if (body.length + 1 + tail.length > BUDGET) {
    // Last resort: hard-trim at a sentence boundary
    const cut = body.slice(0, BUDGET - tail.length - 1);
    body = cut.slice(0, Math.max(cut.lastIndexOf('. ') + 1, 80)).trim();
  }

  return `${body} ${tail}`.replace(/\s+/g, ' ').trim();
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
