/**
 * Characterisation tests for the parsers lifted out of the legacy card detail
 * page. They pin CURRENT behaviour, quirks included — a failure here means V2
 * and the legacy page would disagree, not that the parser got better or worse.
 */
import { describe, it, expect } from 'vitest';
import {
  renderValue,
  formatGrade,
  getUncertaintyFromConfidence,
  shouldRecommendNewPhotos,
  convertRangeToPlusMinus,
  formatGradedDate,
  extractDCMOpticVersion,
  getDCMOpticVersion,
  parseConversationalDefects,
  extractConditionSummary,
  extractCenteringAnalysis,
  safeToFixed,
  stripMarkdown,
  extractEnglishForSearch,
} from './parsers';

const REPORT = `
## [STEP 3] FRONT ANALYSIS
CORNERS (Front)
- Top Left: **Top Left**: Minor whitening on the tip
- Top Right: Clean
- Bottom Left: Moderate fraying
- Bottom Right: Microscopic touch
EDGES (Front)
- Top: Clean
- Bottom: Minor chipping along the bottom edge
- Left: Clean
- Right: Heavy wear
SURFACE (Front)
- Light surface scratch across the holo
FRONT SUMMARY
## [STEP 4] BACK ANALYSIS
CORNERS (Back)
- Top Left: Clean
- Top Right: Clean
- Bottom Left: Clean
- Bottom Right: Clean
EDGES (Back)
- Top: Clean
- Bottom: Clean
- Left: Clean
- Right: Clean
SURFACE (Back)
- Back is clean with no visible defects
BACK SUMMARY
## [STEP 5] SOMETHING ELSE
`;

describe('renderValue', () => {
  it.each([null, undefined, '', 'N/A'])('returns N/A for %p', value => {
    expect(renderValue(value)).toBe('N/A');
  });

  it('joins arrays and collapses empty ones', () => {
    expect(renderValue(['RC', 'Auto'])).toBe('RC, Auto');
    expect(renderValue([])).toBe('N/A');
  });

  it('refuses to render a plain object', () => {
    expect(renderValue({ a: 1 })).toBe('N/A');
  });

  it('passes scalars through, including 0 and false', () => {
    expect(renderValue(0)).toBe(0);
    expect(renderValue(false)).toBe(false);
    expect(renderValue('Charizard')).toBe('Charizard');
  });
});

describe('formatGrade', () => {
  it.each([null, undefined, 0])('treats %p as N/A', grade => {
    expect(formatGrade(grade as number | null)).toBe('N/A');
  });

  it('rounds to a whole number', () => {
    expect(formatGrade(9.4)).toBe('9');
    expect(formatGrade(9.5)).toBe('10');
    expect(formatGrade(10)).toBe('10');
  });
});

describe('getUncertaintyFromConfidence', () => {
  it.each([
    ['A', '±0'],
    ['b', '±1'],
    [' C ', '±2'],
    ['D', '±3'],
    ['Z', '±1'],
  ])('maps %s to %s', (letter, expected) => {
    expect(getUncertaintyFromConfidence(letter)).toBe(expected);
  });

  it('defaults to ±1 when absent', () => {
    expect(getUncertaintyFromConfidence(null)).toBe('±1');
    expect(getUncertaintyFromConfidence(undefined)).toBe('±1');
    expect(getUncertaintyFromConfidence('')).toBe('±1');
  });

  // v9.26: a 10 never displays ±2.
  it('narrows a C-confidence 10 to ±1', () => {
    expect(getUncertaintyFromConfidence('C', 10)).toBe('±1');
    expect(getUncertaintyFromConfidence('C', 9.6)).toBe('±1');
    expect(getUncertaintyFromConfidence('C', 9)).toBe('±2');
  });
});

describe('shouldRecommendNewPhotos', () => {
  it('asks for new photos on C and D only', () => {
    expect(shouldRecommendNewPhotos('C')).toBe(true);
    expect(shouldRecommendNewPhotos('d')).toBe(true);
    expect(shouldRecommendNewPhotos('B')).toBe(false);
    expect(shouldRecommendNewPhotos(null)).toBe(false);
  });
});

describe('convertRangeToPlusMinus', () => {
  it('passes an existing ± through', () => {
    expect(convertRangeToPlusMinus('±2')).toBe('±2');
    expect(convertRangeToPlusMinus('grade ± 3 points')).toBe('± 3');
  });

  it('halves a range', () => {
    expect(convertRangeToPlusMinus('9-10')).toBe('±1');
    expect(convertRangeToPlusMinus('6 - 10')).toBe('±2');
  });

  it('reads a bare number as the ± value', () => {
    expect(convertRangeToPlusMinus('2')).toBe('±2');
    expect(convertRangeToPlusMinus('1.4')).toBe('±1');
  });

  it('falls back to ±1 on junk or absence', () => {
    expect(convertRangeToPlusMinus(null)).toBe('±1');
    expect(convertRangeToPlusMinus('')).toBe('±1');
    expect(convertRangeToPlusMinus('unknown')).toBe('±1');
  });
});

describe('formatGradedDate', () => {
  it('formats an ISO date in en-US long form', () => {
    expect(formatGradedDate('2026-09-21T12:00:00.000Z')).toMatch(/September\s+2\d,\s+2026/);
  });

  it('returns N/A for an absent date', () => {
    expect(formatGradedDate(undefined)).toBe('N/A');
    expect(formatGradedDate(null)).toBe('N/A');
    expect(formatGradedDate('')).toBe('N/A');
  });

  // Quirk pinned deliberately: new Date('nope') does not throw, so the catch
  // never fires and the legacy page prints "Invalid Date".
  it('prints Invalid Date rather than N/A for unparseable input', () => {
    expect(formatGradedDate('not-a-date')).toBe('Invalid Date');
  });
});

describe('DCM Optic version', () => {
  it('extracts a version from a prompt string', () => {
    expect(extractDCMOpticVersion('Conversational_Grading_v5.5_THREE_PASS')).toBe('V5.5');
    expect(extractDCMOpticVersion('v9')).toBe('V9');
    expect(extractDCMOpticVersion('no version here')).toBeNull();
    expect(extractDCMOpticVersion(null)).toBeNull();
  });

  it('reads the version out of the grading JSON, in priority order', () => {
    expect(getDCMOpticVersion(JSON.stringify({ prompt_version: 'v9.25' }))).toBe('V9.25');
    expect(getDCMOpticVersion(JSON.stringify({ metadata: { model_version: 'v4.2' } }))).toBe('V4.2');
    expect(getDCMOpticVersion(JSON.stringify({
      prompt_version: 'v9.25',
      metadata: { prompt_version: 'v1.0' },
    }))).toBe('V9.25');
  });

  it('returns null for markdown reports and empty input', () => {
    expect(getDCMOpticVersion('## [STEP 1] not json')).toBeNull();
    expect(getDCMOpticVersion(null)).toBeNull();
    expect(getDCMOpticVersion('')).toBeNull();
  });
});

describe('parseConversationalDefects', () => {
  it('returns null without input', () => {
    expect(parseConversationalDefects(null)).toBeNull();
    expect(parseConversationalDefects(undefined)).toBeNull();
    expect(parseConversationalDefects('')).toBeNull();
  });

  it('returns null when neither STEP 3 nor STEP 4 is present', () => {
    expect(parseConversationalDefects('## [STEP 1] IDENTIFICATION\nnothing useful')).toBeNull();
  });

  it('parses corners, edges and surface from a full report', () => {
    const parsed = parseConversationalDefects(REPORT);
    expect(parsed).not.toBeNull();

    expect(parsed!.front.corners.top_left.severity).toBe('minor');
    // The "**Top Left**: " prefix is stripped from the description.
    expect(parsed!.front.corners.top_left.description).toBe('Minor whitening on the tip');
    expect(parsed!.front.corners.bottom_left.severity).toBe('moderate');
    expect(parsed!.front.corners.bottom_right.severity).toBe('microscopic');
    // "Clean" is not a corner severity word, so a clean corner reads as 'none'.
    expect(parsed!.front.corners.top_right.severity).toBe('none');

    expect(parsed!.front.edges.top.severity).toBe('none');
    expect(parsed!.front.edges.bottom.severity).toBe('minor');
    expect(parsed!.front.edges.right.severity).toBe('heavy');

    expect(parsed!.front.surface.scratches.severity).toBe('minor');
    expect(parsed!.front.surface.scratches.description).toContain('scratch');
    expect(parsed!.back.surface.other.description).toBe('Surface appears clean');
  });

  it('fills the missing side with a "No data" skeleton', () => {
    const frontOnly = parseConversationalDefects(REPORT.split('[STEP 4]')[0]);
    expect(frontOnly).not.toBeNull();
    expect(frontOnly!.back.corners.top_left.description).toBe('No data');
    expect(frontOnly!.back.surface.stains.severity).toBe('none');
  });

  it('survives a section with no corner/edge/surface lines at all', () => {
    const parsed = parseConversationalDefects('[STEP 3] FRONT ANALYSIS\n(no findings)\n[STEP 4] BACK ANALYSIS\n(no findings)');
    expect(parsed).not.toBeNull();
    expect(parsed!.front.corners.top_left.severity).toBe('none');
    expect(parsed!.front.corners.top_left.description).toBe('Clean');
    expect(parsed!.front.surface.creases.severity).toBe('none');
  });
});

describe('extractConditionSummary', () => {
  it('returns null without input', () => {
    expect(extractConditionSummary(null)).toBeNull();
    expect(extractConditionSummary(undefined)).toBeNull();
    expect(extractConditionSummary('')).toBeNull();
  });

  it('joins the STEP 6 bullets with periods', () => {
    const md = `[STEP 6] VISUAL CONDITION FRAMEWORK
- Sharp corners throughout
- Light edge wear on the reverse
[STEP 7] NEXT`;
    expect(extractConditionSummary(md)).toBe('Sharp corners throughout. Light edge wear on the reverse');
  });

  it('falls back to the STEP 10 condition label', () => {
    const md = `[STEP 10] FINAL GRADE CALCULATION
Condition Label: Near Mint`;
    expect(extractConditionSummary(md)).toBe('Card condition: Near Mint');
  });

  it('returns null when the report has neither section', () => {
    expect(extractConditionSummary('## [STEP 2] nothing relevant')).toBeNull();
  });

  it('falls through to STEP 10 when STEP 6 exists but is bullet-free', () => {
    const md = `[STEP 6] VISUAL CONDITION FRAMEWORK
prose with no bullets
[STEP 7] X
[STEP 10] FINAL
Condition Label: Excellent`;
    expect(extractConditionSummary(md)).toBe('Card condition: Excellent');
  });
});

describe('extractCenteringAnalysis', () => {
  it('prefers the pre-parsed v3.5 columns', () => {
    expect(extractCenteringAnalysis('ignored', {
      conversational_front_summary: 'Front is 55/45',
      conversational_back_summary: 'Back is 60/40',
    })).toEqual({ front: 'Front is 55/45', back: 'Back is 60/40' });
  });

  // Pinned quirk: one column present short-circuits the markdown fallback
  // entirely, so the other side comes back null even if the report has it.
  it('short-circuits on a single column, leaving the other side null', () => {
    const md = `## [STEP 4] BACK EVALUATION
- **Back Centering Analysis**: Back reads 60/40`;
    expect(extractCenteringAnalysis(md, { conversational_front_summary: 'Front is 55/45' }))
      .toEqual({ front: 'Front is 55/45', back: null });
  });

  it('parses both sides out of the markdown when no columns are set', () => {
    const md = `## [STEP 3] FRONT EVALUATION
- **Centering Analysis**: Front measures 55/45 left-right
## [STEP 4] BACK EVALUATION
- **Back Centering Analysis**: Back measures 60/40 top-bottom
## [STEP 5] DONE`;
    expect(extractCenteringAnalysis(md)).toEqual({
      front: 'Front measures 55/45 left-right',
      back: 'Back measures 60/40 top-bottom',
    });
  });

  it('returns nulls for absent, empty and unrecognised input', () => {
    expect(extractCenteringAnalysis(null)).toEqual({ front: null, back: null });
    expect(extractCenteringAnalysis(undefined, {})).toEqual({ front: null, back: null });
    expect(extractCenteringAnalysis('')).toEqual({ front: null, back: null });
    expect(extractCenteringAnalysis('{"centering":{}}')).toEqual({ front: null, back: null });
  });

  it('ignores empty-string columns and falls through to the markdown', () => {
    const md = `## [STEP 3] FRONT EVALUATION
- **Centering Analysis**: Front measures 50/50`;
    expect(extractCenteringAnalysis(md, {
      conversational_front_summary: '',
      conversational_back_summary: null,
    })).toEqual({ front: 'Front measures 50/50', back: null });
  });
});

describe('safeToFixed', () => {
  it('rounds numbers and numeric strings to whole numbers', () => {
    expect(safeToFixed(9.4)).toBe('9');
    expect(safeToFixed(9.5)).toBe('10');
    expect(safeToFixed('8.7')).toBe('9');
  });

  it('returns "0" for anything non-numeric', () => {
    expect(safeToFixed(null)).toBe('0');
    expect(safeToFixed(undefined)).toBe('0');
    expect(safeToFixed('')).toBe('0');
    expect(safeToFixed('abc')).toBe('0');
    expect(safeToFixed({})).toBe('0');
    expect(safeToFixed(NaN)).toBe('0');
  });

  // The decimals argument has never been honoured; V2 must not start honouring it.
  it('ignores the decimals argument', () => {
    expect(safeToFixed(9.44, 2)).toBe('9');
  });
});

describe('stripMarkdown', () => {
  it('removes bold markers and trims', () => {
    expect(stripMarkdown('  **Charizard**  ')).toBe('Charizard');
  });

  it('returns null for null, undefined and empty', () => {
    expect(stripMarkdown(null)).toBeNull();
    expect(stripMarkdown(undefined)).toBeNull();
    expect(stripMarkdown('')).toBeNull();
  });

  it('treats the literal string "null" as null by default (pokemon behaviour)', () => {
    expect(stripMarkdown('null')).toBeNull();
  });

  it('keeps the literal string "null" when asked (sports behaviour)', () => {
    expect(stripMarkdown('null', { treatLiteralNullAsNull: false })).toBe('null');
  });

  it('stringifies non-strings, which is how a 0 becomes "0"', () => {
    expect(stripMarkdown(0 as unknown as string)).toBe('0');
    expect(stripMarkdown(123 as unknown as string)).toBe('123');
  });
});

describe('extractEnglishForSearch', () => {
  it('returns null or the original for empty and English-only input', () => {
    expect(extractEnglishForSearch(null)).toBeNull();
    expect(extractEnglishForSearch('')).toBeNull();
    expect(extractEnglishForSearch('Charizard')).toBe('Charizard');
  });

  it('pulls the English half out of a bilingual name', () => {
    expect(extractEnglishForSearch('リザードン (Charizard)')).toBe('Charizard');
    expect(extractEnglishForSearch('リザードン/Charizard')).toBe('Charizard');
    expect(extractEnglishForSearch('リザードン（Charizard）')).toBe('Charizard');
  });

  it('returns the original when there is no English half to find', () => {
    expect(extractEnglishForSearch('リザードン')).toBe('リザードン');
  });

  // Pinned quirk: the separator class is [/()（）] — the ASCII slash is in it,
  // the fullwidth ／ is not, so a fullwidth-slash name is returned untouched.
  it('does not split on a fullwidth slash', () => {
    expect(extractEnglishForSearch('リザードン／Charizard')).toBe('リザードン／Charizard');
  });
});
