/**
 * cardNumberGuard.ts — server-side enforcement of the "never guess the card
 * number" rule. Sibling of yearGuard.ts; same problem, same shape of fix.
 *
 * Customer-reported problem (Aug 28 2026): a Fleer Ultra "Scoring Kings"
 * insert printed "8 OF 12" was stored — and printed on the slab label — as
 * card number 101. Across 18 repeat runs the same card also produced 11, 180,
 * 13, 10, NNO and SK11. Several came back with identification_confidence
 * "high". None of those characters appear anywhere on the card.
 *
 * Two things were going wrong, and v9.20 prompt work fixed most of it:
 *   - the back was photographed sideways, and sideways text is not read as
 *     "unreadable" but as CONFIDENTLY WRONG ("18 OF 20" for "8 OF 12")
 *   - nothing in the prompt described "N OF M" insert numbering at all
 * That took the card from ~never correct to 5 of 6. The residual is the point
 * of this file: a prompt is a request, not a guarantee.
 *
 * So the model must show its work, and the work is verified here in code:
 *
 *   card_info.card_number_text_seen  — verbatim characters read off the card
 *   card_info.card_number_source     — where those characters were read from
 *
 * A number whose digits do not actually appear in the quoted text is
 * discarded before it reaches the label, the DB columns, the eBay title or the
 * card detail page. A blank number is a correct and common answer — many
 * inserts carry none. A wrong one is printed on a slab, looks authoritative,
 * and the customer has no reason to doubt it.
 */

/** Sources that count as actually reading the number off the card. */
const TRUSTED_NUMBER_SOURCES = new Set([
  'front_number',      // printed on the card face
  'back_number',       // printed on the back, incl. the "N OF M" line
  'insert_numbering',  // explicit "8 OF 12" / "8/12" style marking
]);

/** Explicit "I could not read it" marker. */
const NOT_VISIBLE = 'not_visible';

export type CardNumberGuardOutcome =
  | 'kept'                 // evidence present and the number appears in it
  | 'kept_unverified'      // model omitted the evidence fields (logged, not dropped)
  | 'already_null'         // model returned no number
  | 'dropped_not_visible'
  | 'dropped_no_evidence'
  | 'dropped_mismatch'     // quoted text does not contain the number
  | 'dropped_serial';      // the "number" is actually a print run (45/299)

export interface CardNumberGuardResult {
  outcome: CardNumberGuardOutcome;
  /** The number after enforcement (null when dropped). */
  cardNumber: string | null;
  /** What the model originally proposed, for audit/telemetry. */
  originalCardNumber: string | null;
  source: string | null;
  textSeen: string | null;
  reason: string | null;
}

/**
 * When true, a number with NO evidence fields at all is also dropped. Off by
 * default so a model that silently stops emitting the new fields degrades to
 * today's behaviour instead of blanking every card number on the site. Flip
 * CARD_NUMBER_EVIDENCE_REQUIRED=1 once logs show the fields arriving reliably.
 *
 * Same staged rollout yearGuard used — see YEAR_EVIDENCE_REQUIRED.
 */
function strictMode(): boolean {
  return process.env.CARD_NUMBER_EVIDENCE_REQUIRED === '1';
}

/** Comparable form: strip separators and case so "RC-25" matches "RC 25". */
function normalize(s: string): string {
  return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Split quoted card text into comparable tokens.
 *
 * Sep 2026: the old check was `normalize(textSeen).includes(normalize(number))`,
 * a SUBSTRING test, and that is how a 1960 Topps Mantle #350 came back as 1957
 * #35 — "35" is a substring of "1957", so the guard waved it through. Likewise
 * card number "1" verified itself against a quote of "101", and "7" against
 * "1957". Substring containment is not evidence; whole-token equality is.
 *
 * Hyphens and slashes stay inside the token so structured codes ("RC-25",
 * "OP01-001") and fraction numbering ("4/102") survive intact; everything else
 * (commas, brackets, quotes, whitespace) is a boundary.
 */
function tokenize(text: string): string[] {
  return String(text)
    .split(/[^A-Za-z0-9#/.°\-]+/)
    .filter(Boolean);
}

/** Drop a leading "#", "No.", "NO", "N°" numbering marker from a token. */
function stripNumberPrefix(token: string): string {
  let t = token.replace(/^#+/, '');
  // Only strip a "No."-style prefix when digits actually follow it, so a word
  // that merely starts with those letters is left alone.
  t = t.replace(/^(?:N[O°]\.?|NUM\.?)(?=\d)/i, '');
  return t;
}

/** Parse "N/M" or "N OF M" into its two numbers, else null. */
function parseFraction(value: string): { n: string; m: string } | null {
  const m = String(value).match(/^\s*(\d+)\s*(?:\/|\bOF\b)\s*(\d+)\s*$/i);
  return m ? { n: m[1], m: m[2] } : null;
}

/**
 * Does the normalized card number appear as a WHOLE token in the quoted text?
 * See tokenize() for why substring containment is not good enough.
 */
function numberAppearsInText(original: string, textSeen: string): boolean {
  const want = normalize(original);
  if (!want) return false;

  const tokens = tokenize(textSeen).map(stripNumberPrefix).filter(Boolean);

  const norms: string[] = [];
  for (const token of tokens) {
    const n = normalize(token);
    if (n) norms.push(n);
    // A slash between two non-numeric codes is a separator, not a fraction:
    // "SV049/SV122" is card SV049 of the SV122-card subset. A numeric "4/102"
    // is left whole so the denominator can never satisfy the number on its own.
    if (token.includes('/') && !parseFraction(token)) {
      for (const part of token.split('/')) {
        const p = normalize(part);
        if (p) norms.push(p);
      }
    }
  }

  // 1. Whole-token equality: "350" in "No. 350", "7" in "#7".
  if (norms.includes(want)) return true;

  // 2. Numerator of a fraction token: "4" in "4/102", "8" in "8 OF 12".
  for (const token of tokens) {
    const frac = parseFraction(token);
    if (frac && normalize(frac.n) === want) return true;
  }

  // 3. "N OF M" written with spaces: tokens ["8", "OF", "12"].
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (/^OF$/i.test(tokens[i + 1]) && /^\d+$/.test(tokens[i]) && /^\d+$/.test(tokens[i + 2])) {
      if (normalize(tokens[i]) === want) return true;
    }
  }

  // 4. The card number is ITSELF a fraction ("8 OF 12", "125/198"): the same
  //    pair must appear in the quote, in either notation.
  const wantFrac = parseFraction(original);
  if (wantFrac) {
    for (const token of tokens) {
      const frac = parseFraction(token);
      if (frac && frac.n === String(Number(wantFrac.n)) && frac.m === String(Number(wantFrac.m))) return true;
      if (frac && frac.n === wantFrac.n && frac.m === wantFrac.m) return true;
    }
    for (let i = 0; i + 2 < tokens.length; i++) {
      if (/^OF$/i.test(tokens[i + 1]) && tokens[i] === wantFrac.n && tokens[i + 2] === wantFrac.m) return true;
    }
  }

  // 5. A structured alphanumeric code the transcription split on whitespace:
  //    "RC-25" quoted as "RC 25". Restricted to codes carrying BOTH letters and
  //    digits so joining tokens can never resurrect the numeric substring bug
  //    ("35" must not match "3" + "5").
  if (/[A-Z]/.test(want) && /[0-9]/.test(want)) {
    for (let i = 0; i + 1 < norms.length; i++) {
      if (norms[i] + norms[i + 1] === want) return true;
      if (i + 2 < norms.length && norms[i] + norms[i + 1] + norms[i + 2] === want) return true;
    }
  }

  return false;
}

/**
 * A denominator this large is a PRINT RUN, not a set size.
 *
 * "8 OF 12" is card 8 of a 12-card insert. "45/299" is copy 45 of 299 printed,
 * which belongs in serial_number. The boundary is fuzzy in principle but not in
 * practice: insert sets run to a few dozen at most, print runs are quoted in
 * the high dozens upward. The sports delta previously taught "45/299" AS a card
 * number, which is where some of this confusion came from.
 *
 * THIS IS A SPORTS-ONLY RULE. On a TCG, "125/198" / "4/102" / "218/197" is set
 * numbering printed on the card face — the denominator is the SET SIZE and is
 * routinely in the hundreds. Applying the print-run heuristic there blanked
 * legitimate Pokemon/Lorcana/One Piece numbers, so the rule is now gated on
 * category (see isSportsCategory).
 */
const SERIAL_DENOMINATOR_MIN = 75;

/**
 * Sports categories, duplicated from isSportsCardCategory() in
 * src/lib/pricing/dcmPriceTracker.ts. That module imports supabaseServer and
 * the whole pricing stack; this guard is a leaf used by route handlers and
 * unit tests, so the seven-string list is copied rather than dragging a
 * server-only dependency graph in behind it. Keep the two in sync.
 */
const SPORTS_CATEGORIES = new Set([
  'football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling', 'sports',
]);

function isSportsCategory(category: string | null | undefined): boolean {
  return typeof category === 'string' && SPORTS_CATEGORIES.has(category.trim().toLowerCase());
}

/** True when the value looks like serial numbering rather than a card number. */
function looksLikeSerial(value: string): boolean {
  const frac = parseFraction(value);
  if (!frac) return false;
  return Number(frac.m) >= SERIAL_DENOMINATOR_MIN;
}

export interface CardNumberGuardOptions {
  /**
   * The card's category, e.g. "Baseball" or "Pokemon". Gates the print-run
   * heuristic: only sports categories treat "45/299" as serial numbering.
   * When omitted the heuristic is NOT applied (safer default — a TCG set
   * number surviving beats a real number being blanked).
   */
  category?: string | null;
}

/**
 * Verify a proposed card number against the evidence the model quoted.
 * Pure — does not mutate. See applyCardNumberGuard for the enforcing wrapper.
 */
export function checkCardNumberEvidence(
  cardInfo: any,
  options: CardNumberGuardOptions = {},
): CardNumberGuardResult {
  const original = cardInfo?.card_number == null || cardInfo.card_number === ''
    ? null
    : String(cardInfo.card_number).trim();

  const rawSource = cardInfo?.card_number_source;
  const source = typeof rawSource === 'string' && rawSource.trim() ? rawSource.trim().toLowerCase() : null;
  const rawSeen = cardInfo?.card_number_text_seen;
  const textSeen = typeof rawSeen === 'string' && rawSeen.trim() ? rawSeen.trim() : null;

  const base = { cardNumber: original, originalCardNumber: original, source, textSeen };

  if (!original) {
    return { ...base, outcome: 'already_null', cardNumber: null, reason: null };
  }

  // The model said outright that no number is visible, then supplied one anyway.
  if (source === NOT_VISIBLE) {
    return { ...base, outcome: 'dropped_not_visible', cardNumber: null,
      reason: 'card_number_source is not_visible' };
  }

  // Serial numbering misfiled as a card number. Sports only — on a TCG the
  // same shape ("125/198") is the printed set number.
  if (isSportsCategory(options.category) && looksLikeSerial(original)) {
    return { ...base, outcome: 'dropped_serial', cardNumber: null,
      reason: `"${original}" is print-run numbering, not a card number` };
  }

  // No evidence fields at all — the model is on an older prompt, or ignored it.
  if (!textSeen && !source) {
    if (strictMode()) {
      return { ...base, outcome: 'dropped_no_evidence', cardNumber: null,
        reason: 'no card_number_text_seen and no card_number_source' };
    }
    return { ...base, outcome: 'kept_unverified',
      reason: 'model did not emit card number evidence fields' };
  }

  if (!textSeen) {
    return { ...base, outcome: 'dropped_no_evidence', cardNumber: null,
      reason: `source "${source}" given but nothing transcribed` };
  }

  if (source && !TRUSTED_NUMBER_SOURCES.has(source)) {
    return { ...base, outcome: 'dropped_no_evidence', cardNumber: null,
      reason: `unrecognised card_number_source "${source}"` };
  }

  // Source and text must agree in SHAPE. Claiming insert_numbering while
  // quoting a bare "10" means one of the two fields is invented; the pairing
  // is the only internal cross-check available here.
  if (source === 'insert_numbering' && !/\d+\s*(?:\/|\bOF\b)\s*\d+/i.test(textSeen)) {
    return { ...base, outcome: 'dropped_mismatch', cardNumber: null,
      reason: `source insert_numbering but transcribed text ${JSON.stringify(textSeen)} has no "N OF M" marking` };
  }

  // THE ACTUAL CHECK: the number must appear as a WHOLE TOKEN in the quoted
  // characters. "101" against a quote of "8 OF 12" fails here, which is the
  // whole point — and so, since Sep 2026, does "35" against "1957".
  if (!numberAppearsInText(original, textSeen)) {
    return { ...base, outcome: 'dropped_mismatch', cardNumber: null,
      reason: `"${original}" does not appear as a whole token in transcribed text ${JSON.stringify(textSeen)}` };
  }

  // KNOWN LIMITATION — read this before trusting the guard too far.
  //
  // Everything above verifies INTERNAL consistency: the number against the
  // model's own quotation. It cannot detect a fabricated quotation that
  // self-consistently supports a fabricated number. Measured on the motivating
  // card, 1 run in 6 returned card_number "10" with card_number_text_seen "10"
  // and source back_number — coherent, and wrong.
  //
  // yearGuard has the same weakness, except where its stat-table cross-check
  // gives it a second, independent signal. There is no equivalent for card
  // numbers: nothing else on the card corroborates one.
  //
  // What this guard does reliably is kill the classes that actually reached
  // production — a number with no evidence at all (the old prompt emitted
  // none, so every one of those failures drops under strict mode), a number
  // contradicting its own citation, and serial numbering misfiled. Closing the
  // rest needs independent evidence, e.g. a second read of a re-oriented crop.
  return { ...base, outcome: 'kept', reason: null };
}

/**
 * Enforce the card number evidence rule in place on a card_info object.
 *
 * Mutates cardInfo.card_number to null when unsupported, and records the
 * decision under cardInfo._card_number_guard so the outcome is visible in the
 * stored grading JSON without a separate column — same convention as
 * _year_guard.
 *
 * @param label short context string for the log line, e.g. "sports/abc123"
 */
export function applyCardNumberGuard(
  cardInfo: any,
  label = 'card',
  options: CardNumberGuardOptions = {},
): CardNumberGuardResult {
  if (!cardInfo || typeof cardInfo !== 'object') {
    return {
      outcome: 'already_null',
      cardNumber: null,
      originalCardNumber: null,
      source: null,
      textSeen: null,
      reason: null,
    };
  }

  const result = checkCardNumberEvidence(cardInfo, options);

  if (result.outcome.startsWith('dropped_')) {
    console.warn(
      `[CardNumberGuard] ${label}: DROPPED card_number "${result.originalCardNumber}" — ${result.reason} ` +
      `(source=${result.source ?? 'none'}, seen=${JSON.stringify(result.textSeen)})`
    );
    cardInfo.card_number = null;
  } else if (result.outcome === 'kept_unverified') {
    console.warn(
      `[CardNumberGuard] ${label}: card_number "${result.originalCardNumber}" kept UNVERIFIED — ` +
      `model did not emit card_number_text_seen/card_number_source`
    );
  }

  cardInfo._card_number_guard = {
    outcome: result.outcome,
    original_card_number: result.originalCardNumber,
    source: result.source,
    text_seen: result.textSeen,
    reason: result.reason,
  };

  return result;
}
