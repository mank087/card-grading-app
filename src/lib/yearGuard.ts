/**
 * yearGuard.ts — server-side enforcement of the "never guess the year" rule.
 *
 * Customer-reported problem (Jul 2026): sports cards were coming back with
 * confidently wrong years on the card details and the printed slab label. The
 * prompt already said "return null if you can't read it", but a prompt is a
 * request, not a guarantee — the model would happily infer a year from the
 * player's era, the design, or the stat table on the back.
 *
 * The fix is the same pattern the Pokemon card_number extraction uses: force
 * the model to show its work, then VERIFY that work in code.
 *
 *   card_info.year_text_seen  — verbatim year characters read off the card
 *   card_info.year_source     — where those characters were read from
 *
 * A year that is not backed by a legible, self-consistent source is discarded
 * here, server-side, before it reaches the label, the DB columns, the eBay
 * title, or the card detail page. A blank year is a correct answer; a wrong
 * year is a refund.
 */

/** Sources that count as actually reading the year off the card. */
const TRUSTED_YEAR_SOURCES = new Set([
  'back_copyright',
  'printed_date',
  'set_logo',
  'season_indicator',
]);

/** Explicit "I could not read it" marker. */
const NOT_VISIBLE = 'not_visible';

/** Oldest plausible trading-card year (Allen & Ginter / Old Judge era). */
const MIN_PLAUSIBLE_YEAR = 1860;

export type YearGuardOutcome =
  | 'kept'              // evidence present and consistent
  | 'kept_unverified'   // model omitted the evidence fields entirely (logged, not dropped)
  | 'already_null'      // model returned no year
  | 'dropped_not_visible'
  | 'dropped_no_evidence'
  | 'dropped_mismatch'
  | 'dropped_implausible'
  | 'corrected_stat_mismatch'  // © digits contradicted the stat table; year replaced
  | 'dropped_stat_mismatch';   // © digits contradicted the stat table beyond repair

/**
 * Stat-table cross-check result (v9.16). Vintage sports backs print the ©
 * year in ~6pt type that the model misreads with confidence ("© 1986" on a
 * card that says "© 1988" — customer report, Aug 2026), while the year-by-year
 * stat table beside it is printed far larger. A card cannot be printed BEFORE
 * its own final stat season, so:
 *
 *   year >= last_stat_year      → consistent (retro/archive sets legitimately
 *                                 show stats that end long before the © year,
 *                                 and update sets show the partial current
 *                                 season, so no upper-bound check)
 *   year <  last_stat_year      → impossible; a small gap is a digit misread
 *                                 (8→6, 2→0) and is corrected to
 *                                 last_stat_year + 1; a large gap means
 *                                 something is badly misread and blank is the
 *                                 only honest answer.
 */
export interface StatCrossCheck {
  lastStatYear: number;
  /** Flagship-set expectation: printed the year after the final stat season. */
  expectedYear: number;
  relation: 'match' | 'later_than_stats' | 'corrected' | 'dropped';
}

/** Largest impossible-gap (expected − reported) we repair instead of blank. */
const STAT_CORRECTION_MAX_GAP = 4;

export interface YearGuardResult {
  outcome: YearGuardOutcome;
  /** The year after enforcement (null when dropped, replaced when corrected). */
  year: string | null;
  /** The year the model originally proposed, for audit/telemetry. */
  originalYear: string | null;
  source: string | null;
  textSeen: string | null;
  reason: string | null;
  /** Present when a last_stat_year was available to cross-check against. */
  statCheck?: StatCrossCheck;
}

/**
 * When true, a year with NO evidence fields at all is also dropped. Left off by
 * default so a model that silently stops emitting the new fields degrades to
 * today's behaviour instead of blanking every year on the site. Flip
 * YEAR_EVIDENCE_REQUIRED=1 once the logs show the fields arriving reliably.
 */
function strictMode(): boolean {
  return process.env.YEAR_EVIDENCE_REQUIRED === '1';
}

function firstFourDigitYear(text: string): string | null {
  const m = String(text).match(/\b((?:1[89]|20)\d{2})\b/);
  return m ? m[1] : null;
}

/** Parse card_info.last_stat_year into a plausible 4-digit year, else null. */
function statTableYear(cardInfo: any): number | null {
  const raw = cardInfo?.last_stat_year;
  if (raw == null || raw === '') return null;
  const parsed = firstFourDigitYear(String(raw));
  if (!parsed) return null;
  const n = Number(parsed);
  const maxPlausible = new Date().getUTCFullYear() + 1;
  return n >= MIN_PLAUSIBLE_YEAR && n <= maxPlausible ? n : null;
}

/**
 * Cross-check a kept year against the stat table (see StatCrossCheck docs).
 * Returns the (possibly rewritten) result; a no-op when no stat year exists.
 */
function applyStatCrossCheck(result: YearGuardResult, cardInfo: any): YearGuardResult {
  if (!result.year) return result;
  const lastStatYear = statTableYear(cardInfo);
  if (lastStatYear === null) return result;

  const reported = Number(firstFourDigitYear(result.year));
  if (!Number.isFinite(reported)) return result;
  const expectedYear = lastStatYear + 1;
  const maxPlausible = new Date().getUTCFullYear() + 1;

  if (reported >= lastStatYear) {
    return {
      ...result,
      statCheck: {
        lastStatYear,
        expectedYear,
        relation: reported <= expectedYear ? 'match' : 'later_than_stats',
      },
    };
  }

  // Reported year predates the card's own final stat season — impossible.
  const gap = expectedYear - reported;
  if (gap <= STAT_CORRECTION_MAX_GAP && expectedYear <= maxPlausible) {
    return {
      ...result,
      outcome: 'corrected_stat_mismatch',
      year: String(expectedYear),
      reason:
        `year "${reported}" predates the stat table ending ${lastStatYear}; ` +
        `corrected to ${expectedYear} (stats print through the season before issue)`,
      statCheck: { lastStatYear, expectedYear, relation: 'corrected' },
    };
  }
  return {
    ...result,
    outcome: 'dropped_stat_mismatch',
    year: null,
    reason:
      `year "${reported}" predates the stat table ending ${lastStatYear} by too much ` +
      `to repair — © line or stat table badly misread`,
    statCheck: { lastStatYear, expectedYear, relation: 'dropped' },
  };
}

/**
 * Validate a card_info year against its declared evidence.
 * Pure — does not mutate. See applyYearGuard for the mutating wrapper.
 */
export function checkYearEvidence(cardInfo: any): YearGuardResult {
  const rawYear = cardInfo?.year ?? null;
  const originalYear = rawYear == null || rawYear === '' ? null : String(rawYear).trim();

  const rawSource = cardInfo?.year_source;
  const source = typeof rawSource === 'string' && rawSource.trim()
    ? rawSource.trim().toLowerCase()
    : null;

  const rawTextSeen = cardInfo?.year_text_seen;
  const textSeen = typeof rawTextSeen === 'string' && rawTextSeen.trim()
    ? rawTextSeen.trim()
    : null;

  const base = { originalYear, source, textSeen };

  // Nothing to police.
  if (!originalYear) {
    return { ...base, outcome: 'already_null', year: null, reason: null };
  }

  // Plausibility: a "year" that isn't a year is always wrong.
  const parsed = firstFourDigitYear(originalYear);
  const maxPlausible = new Date().getUTCFullYear() + 1;
  if (!parsed || Number(parsed) < MIN_PLAUSIBLE_YEAR || Number(parsed) > maxPlausible) {
    return {
      ...base,
      outcome: 'dropped_implausible',
      year: null,
      reason: `"${originalYear}" is not a plausible print year (${MIN_PLAUSIBLE_YEAR}-${maxPlausible})`,
    };
  }

  // The model told us it couldn't read one — believe it over its own guess.
  if (source === NOT_VISIBLE) {
    return {
      ...base,
      outcome: 'dropped_not_visible',
      year: null,
      reason: 'year_source=not_visible but a year was still proposed',
    };
  }

  // No evidence fields at all: model non-compliance, not a detected guess.
  if (!source && !textSeen) {
    if (strictMode()) {
      return {
        ...base,
        outcome: 'dropped_no_evidence',
        year: null,
        reason: 'no year_source/year_text_seen supplied (YEAR_EVIDENCE_REQUIRED=1)',
      };
    }
    return applyStatCrossCheck(
      { ...base, outcome: 'kept_unverified', year: originalYear, reason: null },
      cardInfo,
    );
  }

  // A source we don't recognise is not a source.
  if (source && !TRUSTED_YEAR_SOURCES.has(source)) {
    return {
      ...base,
      outcome: 'dropped_no_evidence',
      year: null,
      reason: `year_source="${source}" is not a legible-text source`,
    };
  }

  // Claimed a real source but transcribed nothing → it wasn't read, it was recalled.
  if (!textSeen) {
    return {
      ...base,
      outcome: 'dropped_no_evidence',
      year: null,
      reason: `year_source="${source}" but no year_text_seen transcription`,
    };
  }

  // The transcription must actually contain the year that was reported.
  // "2023-24" -> reporting "2023" is correct by the season convention, so a
  // digit-run match anywhere in the transcription is what we require.
  if (!textSeen.includes(parsed)) {
    return {
      ...base,
      outcome: 'dropped_mismatch',
      year: null,
      reason: `year "${parsed}" does not appear in year_text_seen "${textSeen}"`,
    };
  }

  return applyStatCrossCheck(
    { ...base, outcome: 'kept', year: originalYear, reason: null },
    cardInfo,
  );
}

/**
 * Enforce the year evidence rule in place on a card_info object.
 *
 * Mutates cardInfo.year to null when the year is unsupported, and records the
 * decision under cardInfo._year_guard so the outcome is visible in the stored
 * grading JSON (and in the admin card view) without a separate column.
 *
 * @param label short context string for the log line, e.g. "sports/abc123"
 */
export function applyYearGuard(cardInfo: any, label = 'card'): YearGuardResult {
  if (!cardInfo || typeof cardInfo !== 'object') {
    return {
      outcome: 'already_null',
      year: null,
      originalYear: null,
      source: null,
      textSeen: null,
      reason: null,
    };
  }

  const result = checkYearEvidence(cardInfo);

  if (result.outcome.startsWith('dropped_')) {
    console.warn(
      `[YearGuard] ${label}: DROPPED year "${result.originalYear}" — ${result.reason} ` +
      `(source=${result.source ?? 'none'}, seen=${JSON.stringify(result.textSeen)})`
    );
    cardInfo.year = null;
  } else if (result.outcome === 'corrected_stat_mismatch') {
    console.warn(
      `[YearGuard] ${label}: CORRECTED year "${result.originalYear}" -> "${result.year}" — ${result.reason} ` +
      `(source=${result.source ?? 'none'}, seen=${JSON.stringify(result.textSeen)})`
    );
    cardInfo.year = result.year;
  } else if (result.outcome === 'kept_unverified') {
    console.warn(
      `[YearGuard] ${label}: year "${result.originalYear}" kept UNVERIFIED — model did not ` +
      `emit year_source/year_text_seen. Set YEAR_EVIDENCE_REQUIRED=1 to drop these.`
    );
  } else if (result.outcome === 'kept') {
    console.log(
      `[YearGuard] ${label}: year "${result.year}" verified via ${result.source} ` +
      `(${JSON.stringify(result.textSeen)})`
    );
  }

  cardInfo._year_guard = {
    outcome: result.outcome,
    original_year: result.originalYear,
    source: result.source,
    text_seen: result.textSeen,
    reason: result.reason,
    ...(result.statCheck
      ? {
          last_stat_year: result.statCheck.lastStatYear,
          expected_from_stats: result.statCheck.expectedYear,
          stat_cross_check: result.statCheck.relation,
        }
      : {}),
  };

  return result;
}
