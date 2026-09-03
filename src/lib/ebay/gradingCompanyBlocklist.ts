/**
 * Rival grading companies — never named in a DCM listing.
 *
 * eBay's keyword-spamming policy forbids brand names that are not the item's
 * own, and a graded-card listing that mentions PSA/BGS/CGC while carrying a
 * 2750 "Other" grader descriptor reads as a grade-equivalence claim. Both get
 * listings pulled, so this is enforced in code rather than by convention.
 *
 * Applied in FOUR places (all of them, or a store template reintroduces a name
 * we stripped everywhere else):
 *   1. titleBuilder      — a matching token is dropped from the title
 *   2. listingDescription — stripped from rendered template output
 *   3. sanitizeListingHtml — stripped from preview/stored HTML
 *   4. listing-defaults   — title_grade_label is rejected outright
 *
 * TWIN FILE: dcm-mobile/lib/ebayGradingCompanyBlocklist.ts. Keep the two
 * BLOCKED_GRADERS tables identical (npm run check:twin-drift enforces it).
 *
 * Matching is WHOLE-WORD, except that a run of digits or periods glued to the
 * name still matches: "PSA10", "BGS9.5" and "P.S.A. 10" are exactly how a
 * seller writes the comparison we are trying to keep out of the listing, and
 * `\b…\b` missed every one of them. Two tiers, because several grader acronyms
 * are also ordinary card vocabulary:
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
];

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
];

/** Every blocked name, for display in validation errors and docs. */
export const BLOCKED_GRADERS: string[] = [
  ...BLOCKED_GRADERS_UNAMBIGUOUS,
  ...BLOCKED_GRADERS_CAPS_ONLY,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The body of one name's pattern.
 *
 * - Interior spaces become `\s+`, so "Arena  Club" across a line break still
 *   matches without the callers having to normalize the haystack first.
 * - A short single-word acronym also matches dotted ("P.S.A."), which is the
 *   spelling sellers reach for when they know the plain one is disallowed.
 */
function nameBody(name: string, allowDots: boolean): string {
  if (name.includes(' ')) {
    return name.split(/\s+/).map(escapeRegExp).join('\\s+');
  }
  if (allowDots && name.length <= 4 && /^[a-z]+$/i.test(name)) {
    return name.split('').map(escapeRegExp).join('\\.?') + '\\.?';
  }
  return escapeRegExp(name);
}

/**
 * Boundary rule. The leading edge is a capture group rather than a lookbehind
 * (the mobile twin runs on Hermes, and this file is meant to stay a literal
 * copy of it); the trailing edge only forbids a LETTER, so "PSA10" and
 * "BGS9.5" match while "psalm" and "Marcus" do not.
 */
function boundedPattern(name: string, flags: string, allowDots: boolean): RegExp {
  return new RegExp(`(?:^|[^A-Za-z])(${nameBody(name, allowDots)})(?![A-Za-z])`, flags);
}

const BLOCKED_PATTERNS: RegExp[] = [
  ...BLOCKED_GRADERS_UNAMBIGUOUS.map(n => boundedPattern(n, 'gi', true)),
  ...BLOCKED_GRADERS_CAPS_ONLY.map(n => boundedPattern(n, 'g', false)),
];

/** The first blocked grader name found in `text`, or null. */
export function findBlockedGrader(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const pattern of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0;
    const m = pattern.exec(text);
    if (m) return m[1];
  }
  return null;
}

/** Does `text` name a rival grading company? */
export function containsBlockedGrader(text: string | null | undefined): boolean {
  return findBlockedGrader(text) !== null;
}

/**
 * Remove every blocked grader name from `text`, collapsing the whitespace and
 * stray punctuation the removal leaves behind.
 *
 * Word-level removal leaves stubs: "PSA would call this a 9 too" becomes
 * "would call this a 9 too", which still reads as a comparison. Prefer
 * stripBlockedGraderSentences for prose; this stays for single-value fields
 * (a set name, a detail-table cell) where there is no sentence to drop.
 */
export function stripBlockedGraders(text: string): string {
  if (!text) return text;
  let out = text;
  for (const pattern of BLOCKED_PATTERNS) {
    // The match carries the character BEFORE the name (the boundary capture);
    // put it back, or "a PSA 9" would lose the space too.
    out = out.replace(pattern, (match, name: string) => match.slice(0, match.length - name.length));
  }
  // Tidy up "Graded by  ·  10" style debris without touching HTML structure.
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1');
}

/**
 * Inline tags that do NOT end a sentence. When a grader name is wrapped in
 * one ("<b>PSA</b> would say 9."), the tag used to split the sentence into
 * three unrelated text runs and the sentence survived with a hole in it.
 */
const INLINE_TAG_NAMES = new Set([
  'a', 'b', 'strong', 'em', 'i', 'u', 's', 'span', 'small', 'sup', 'sub', 'font',
]);

const INLINE_TAG_PATTERN = /<\/?\s*(?:a|b|strong|em|i|u|s|span|small|sup|sub|font)\b[^>]*>/gi;

function isInlineTag(tag: string): boolean {
  const m = /^<\/?\s*([A-Za-z0-9]+)/.exec(tag);
  return !!m && INLINE_TAG_NAMES.has(m[1].toLowerCase());
}

/**
 * Drop every SENTENCE that names a rival grading company, leaving the rest of
 * the prose intact.
 *
 * Safe on HTML as well as plain text. The input is split into segments at
 * BLOCK-level tags (which are sentence boundaries in their own right), so a
 * sentence can never be "dropped" across a `<p>` and take the markup with it.
 * A segment that names no grader is returned byte-for-byte, so an ordinary
 * description keeps all of its markup; only a segment we have to edit loses
 * its inline tags, which is the price of seeing "<b>PSA</b> would say 9." as
 * one sentence.
 *
 * This is what runs on the model's own grade prose (it writes "PSA would call
 * this a 9" often enough) and on the outbound description at publish time.
 */
export function stripBlockedGraderSentences(text: string): string {
  if (!text) return text;

  // A period between two digits is a decimal, not a sentence end. Without
  // this, "BGS called it a 9.5." split into "BGS called it a 9." and "5.",
  // and dropping the first left a bare "5." behind.
  const DECIMAL_POINT = '\u0000';
  const protectDecimals = (s: string) => s.replace(/(\d)\.(?=\d)/g, `$1${DECIMAL_POINT}`);
  const restoreDecimals = (s: string) => s.split(DECIMAL_POINT).join('.');

  const dropFromRun = (run: string): string => {
    const plain = run.replace(INLINE_TAG_PATTERN, '');
    if (!findBlockedGrader(plain)) return run;

    const protectedRun = protectDecimals(plain);
    // No sentence punctuation at all means this is one value, not prose (a set
    // name, a table cell). Dropping it whole would silently lose the field, so
    // remove just the name.
    if (!/[.!?]/.test(protectedRun)) return stripBlockedGraders(plain);

    // Keep each sentence's trailing terminator + whitespace with the sentence.
    const sentences = protectedRun.match(/[^.!?]*(?:[.!?]+\s*|$)/g) || [protectedRun];
    const kept = sentences.filter(s => s.trim() === '' || !findBlockedGrader(restoreDecimals(s)));
    // An emptied sentence is GONE — including its terminator. The old code fell
    // back to name-removal here and left "PSA 9. BGS 9.5." as " 9. 9.5.".
    return restoreDecimals(kept.join(''))
      .replace(/^[\s.,;:!?]+/, '')
      .replace(/\s+([,.;:!?])/g, '$1');
  };

  // Group consecutive text/inline-tag parts into one segment; every other tag
  // closes the segment it is in.
  const parts = text.split(/(<[^>]*>)/);
  const out: string[] = [];
  let segment: string[] = [];
  const flush = () => {
    if (segment.length) {
      out.push(dropFromRun(segment.join('')));
      segment = [];
    }
  };
  for (const part of parts) {
    if (part === '') continue;
    if (part.startsWith('<') && !isInlineTag(part)) {
      flush();
      out.push(part);
    } else {
      segment.push(part);
    }
  }
  flush();

  return out.join('').replace(/[ \t]{2,}/g, ' ');
}
