/**
 * Save-time clean-up of a sports card's SET NAME and YEAR. Pure: no I/O.
 *
 * WHY (measured Oct 12 2026 from card_identity_history, Sept 18 - Oct 12):
 *
 * SET NAME. The grading call writes sports sets in several shapes for one
 * product — "2025 Panini Phoenix Football", "Phoenix Football", "Panini
 * Phoenix" — and the DB validation step adopts SportsCardsPro's display form,
 * which leads with the year ("2025 Panini Prizm"). The label already prints the
 * year in its own slot (Set • Subset • #Number • Year), so a leading year shows
 * twice. Of the sports cards whose set an owner corrected, 27 started with a
 * leading year and 32 with a trailing sport word; after the owner's edit, 7 and
 * 2 did. That part of the convention is shared by every owner who edits sets.
 *
 * The BRAND is not: 17 of the 22 edits that dropped a brand word ("Panini
 * Prizm" → "Prizm", "Topps Chrome" → "Chrome") came from one account, while the
 * other owners kept or added it (85 corrected sets end as "Topps …"). The brand
 * also scores in the catalog matcher (sportsCardMatcher setNameTokens) whereas
 * year and sport words are stop-words there, so stripping those two changes
 * nothing about matching or pricing. So: strip the year and the sport word,
 * keep the brand.
 *
 * Conservative on purpose:
 *   - the leading year is only removed when the card's own year field says the
 *     same year (a season counts if either end matches). When they disagree the
 *     number may be part of the product name ("2025 All Topps Team" in a 2026
 *     product) or the only evidence of the right year, and it stays.
 *   - with a blank year field the set keeps its year: it is then the only place
 *     the year appears on the label.
 *   - a sport word that is part of a name ("USA Basketball", "Major League
 *     Baseball", "Pro Football") stays.
 *
 * YEAR. A sports card whose grading call left the year blank (or whose year the
 * year guard dropped) takes the year first look worked out, when first look
 * says it READ or INFERRED it from printed facts. On owner-reviewed sports cards
 * with a blank grading year, that value was what the owner kept on 51 of 53
 * (printed 16/16, inferred 35/37); a merely "recognized" year was right on
 * 100 of 111 and is NOT used — a blank year on a slab is better than a wrong
 * one (see yearGuard.ts). A season ("1992-93") fills as its first year, which
 * is how owners entered it every time they typed one in.
 *
 * Deliberately NOT done (measured, would have been net harmful):
 *   - shifting a season card's year to the season's first year when the grader
 *     gave the second (1995 → for a 1994-95 card): owners actively made that
 *     change on ~12 cards but confirmed the grader's later year on 71 others.
 *   - replacing the grader's year with first look's when the two disagree by
 *     one (copyright/stat-year vs release-year): owners kept the grader's year
 *     61 times and took first look's 17 times.
 */

const SPORT_WORDS = 'football|baseball|basketball|hockey|soccer';

/** Leading year or season: "2025 ", "1994-95 ", "1985 - 86 ", "2023-2024 ". */
const LEADING_YEAR = /^\s*((?:19|20)\d{2})(?:\s*[-–/]\s*((?:19|20)?\d{2}))?\s+(?=\S)/;

const TRAILING_SPORT = new RegExp(`\\s+(${SPORT_WORDS})\\s*$`, 'i');

/** A word before the sport word that makes the pair a name, not a label. */
const SPORT_NAME_PARTNERS = new Set([
  'usa', 'us', 'league', 'pro', 'college', 'collegiate', 'fantasy', 'olympic', 'olympics',
  'national', 'american', 'world', 'international', 'junior', 'youth', 'women\'s', 'womens',
  'arena', 'flag', 'little', 'high', 'school', 'ncaa', 'team',
]);

export interface SetNameNormalization {
  value: string | null;
  changed: boolean;
  /** What was removed, for the audit log. */
  removed: string[];
}

function seasonYears(start: string, end: string | undefined): string[] {
  if (!end) return [start];
  const full = end.length === 2 ? `${start.slice(0, 2)}${end}` : end;
  // "1999-00" → 2000
  const endYear = end.length === 2 && Number(full) < Number(start) ? String(Number(full) + 100) : full;
  return [start, endYear];
}

function yearOf(value: unknown): string | null {
  const m = String(value ?? '').match(/\b((?:19|20)\d{2})\b/);
  return m ? m[1] : null;
}

/**
 * The stored form of a sports set name: no leading year (when the year field
 * carries it) and no trailing sport word. Brand words are kept.
 */
export function normalizeSportsSetName(setName: string | null | undefined, year: unknown): SetNameNormalization {
  if (setName == null) return { value: setName ?? null, changed: false, removed: [] };
  const original = String(setName);
  let value = original.replace(/\s+/g, ' ').trim();
  const removed: string[] = [];

  const lead = LEADING_YEAR.exec(value);
  const cardYear = yearOf(year);
  if (lead && cardYear && seasonYears(lead[1], lead[2]).includes(cardYear)) {
    const rest = value.slice(lead[0].length).trim();
    if (/[a-z]/i.test(rest)) {
      removed.push(lead[0].trim());
      value = rest;
    }
  }

  const tail = TRAILING_SPORT.exec(value);
  if (tail) {
    const rest = value.slice(0, tail.index).trim();
    const partner = (rest.split(' ').pop() || '').toLowerCase();
    if (/[a-z]/i.test(rest) && !SPORT_NAME_PARTNERS.has(partner)) {
      removed.push(tail[1]);
      value = rest;
    }
  }

  // Whitespace-only differences are not a change worth recording.
  const changed = removed.length > 0;
  return { value: changed ? value : original, changed, removed };
}

/** First look's year, as stored on card_info by visionGrader (evidence only). */
export interface FirstLookYearEvidence {
  value: string | null;
  source: string | null;
}

const FILL_SOURCES = new Set(['printed', 'inferred', 'recognized']);
const BLANK_YEAR = /^(unknown|n\/?a|none|null|undefined|not visible|unreadable)?$/i;

/** First year of "1992-93" / "1992", or null when it is not a plausible year. */
export function firstYearOf(value: unknown): string | null {
  const m = String(value ?? '').trim().match(/^((?:18|19|20)\d{2})(?:\s*[-–/]\s*\d{2,4})?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const maxPlausible = new Date().getUTCFullYear() + 1;
  return n >= 1860 && n <= maxPlausible ? m[1] : null;
}

/** On unless SPORTS_YEAR_FILL=0, so it can be switched off in Vercel without a deploy. */
export function sportsYearFillEnabled(): boolean {
  return process.env.SPORTS_YEAR_FILL !== '0';
}

export interface YearFill {
  filled: boolean;
  value?: string;
}

/**
 * Fill a blank sports year from first look's read. Mutates cardInfo. Runs AFTER
 * the year guard: the guard has already had its say on the grading call's own
 * year, and a blank it left is what this fills. Never replaces a year.
 */
export function fillBlankSportsYearFromFirstLook(cardInfo: Record<string, any> | null | undefined): YearFill {
  if (!cardInfo || typeof cardInfo !== 'object') return { filled: false };
  if (!BLANK_YEAR.test(String(cardInfo.year ?? '').trim())) return { filled: false };
  const evidence = cardInfo.first_look_year as FirstLookYearEvidence | undefined;
  if (!evidence || !FILL_SOURCES.has(String(evidence.source))) return { filled: false };
  const year = firstYearOf(evidence.value);
  if (!year) return { filled: false };
  cardInfo.year = year;
  cardInfo.year_source = 'first_look';
  cardInfo.year_text_seen = null;
  return { filled: true, value: year };
}
