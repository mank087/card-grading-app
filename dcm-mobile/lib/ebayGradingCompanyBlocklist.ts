/**
 * Rival grading companies — never named in a DCM listing.
 *
 * TWIN FILE of src/lib/ebay/gradingCompanyBlocklist.ts. Metro can't reach
 * across the project boundary into src/lib, so this is a hand-maintained copy;
 * npm run check:twin-drift fails when the two BLOCKED_GRADERS tables diverge.
 *
 * Mobile only builds TITLES, so only the title-side use is live here: a token
 * naming a rival grader is dropped before the title is assembled.
 *
 * Matching is WHOLE-WORD, except that a run of digits or periods glued to the
 * name still matches ("PSA10", "BGS9.5", "P.S.A. 10"). Two tiers, because
 * several grader acronyms are also ordinary card vocabulary:
 *   - UNAMBIGUOUS names match case-insensitively ("psa 10", "Beckett"), and
 *     the short acronyms also match dotted ("P.S.A.").
 *   - AMBIGUOUS acronyms match only in ALL CAPS, so a Pokemon "Ace Spec" card
 *     or a player named Tag keeps its name while "ACE 10" is still caught.
 */

/** Grader names that are never ordinary card vocabulary. Case-insensitive. */
const BLOCKED_GRADERS_UNAMBIGUOUS = [
  'psa',
  'bgs',
  'beckett',
  'cgc',
  'sgc',
  'hga',
  'csg',
  'arena club',
  'rare edition',
  'professional sports authenticator',
  'certified guaranty company',
  'sportscard guaranty',
]

/** Acronyms that double as card vocabulary. ALL-CAPS whole word only. */
const BLOCKED_GRADERS_CAPS_ONLY = [
  'TAG',
  'ACE',
  'ISA',
  'MNT',
  'GMA',
  'KSA',
  'PGI',
  'AGS',
  'RCG',
]

/** Every blocked name, for display in validation errors and docs. */
export const BLOCKED_GRADERS: string[] = [
  ...BLOCKED_GRADERS_UNAMBIGUOUS,
  ...BLOCKED_GRADERS_CAPS_ONLY,
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Interior spaces become `\s+` (so "Arena  Club" still matches); a short
 * single-word acronym also matches dotted ("P.S.A.").
 */
function nameBody(name: string, allowDots: boolean): string {
  if (name.includes(' ')) {
    return name.split(/\s+/).map(escapeRegExp).join('\\s+')
  }
  if (allowDots && name.length <= 4 && /^[a-z]+$/i.test(name)) {
    return name.split('').map(escapeRegExp).join('\\.?') + '\\.?'
  }
  return escapeRegExp(name)
}

/**
 * Boundary rule. The leading edge is a capture group rather than a lookbehind
 * (Hermes); the trailing edge only forbids a LETTER, so "PSA10" and "BGS9.5"
 * match while "psalm" and "Marcus" do not.
 */
function boundedPattern(name: string, flags: string, allowDots: boolean): RegExp {
  return new RegExp(`(?:^|[^A-Za-z])(${nameBody(name, allowDots)})(?![A-Za-z])`, flags)
}

const BLOCKED_PATTERNS: RegExp[] = [
  ...BLOCKED_GRADERS_UNAMBIGUOUS.map(n => boundedPattern(n, 'gi', true)),
  ...BLOCKED_GRADERS_CAPS_ONLY.map(n => boundedPattern(n, 'g', false)),
]

/** The first blocked grader name found in `text`, or null. */
export function findBlockedGrader(text: string | null | undefined): string | null {
  if (!text) return null
  for (const pattern of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0
    const m = pattern.exec(text)
    if (m) return m[1]
  }
  return null
}

/** Does `text` name a rival grading company? */
export function containsBlockedGrader(text: string | null | undefined): boolean {
  return findBlockedGrader(text) !== null
}

/** Remove every blocked grader name from `text`, tidying the debris. */
export function stripBlockedGraders(text: string): string {
  if (!text) return text
  let out = text
  for (const pattern of BLOCKED_PATTERNS) {
    // The match carries the character BEFORE the name (the boundary capture);
    // put it back, or "a PSA 9" would lose the space too.
    out = out.replace(pattern, (match, name: string) => match.slice(0, match.length - name.length))
  }
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1')
}
