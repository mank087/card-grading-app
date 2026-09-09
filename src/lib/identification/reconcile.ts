/**
 * reconcile.ts — arbitrate between the grading call's `card_info` and the
 * independent identification pass (identifyCard.ts).
 *
 * The rule the whole file encodes: WHAT IS PRINTED WINS. The grading call is
 * good at condition and bad at identity under load (it produced "Cal Ripken
 * Jr." for a card with "AL PILARCIK" printed across it in inch-high type). The
 * independent pass looks at nothing but the card and quotes the characters it
 * read, so when the two disagree AND the independent pass can show its work
 * (`printed_name_seen` / `card_number_text_seen`), the independent read is
 * taken and confidence drops to 'low' so downstream lookups and the human
 * reviewer both know this card was contested.
 *
 * What this file must NEVER do:
 *   - touch `year`. The independent pass's year was measured WRONG in most
 *     runs (a 1958-1961 spread on a 1960 Mantle). Its `year_hint` is recorded
 *     under identification_check for diagnostics and nothing reads it as truth;
 *     the year is settled by yearGuard + the checklist lookup.
 *   - throw. It runs inside a paid grade.
 *   - raise confidence on the strength of a missing opinion — a null
 *     independent result caps confidence at 'medium', it does not confirm.
 */

import type { IdentificationResult } from './identifyCard';

export type IdentificationConfidence = 'high' | 'medium' | 'low';

export interface ReconcileOutcome {
  cardInfo: Record<string, unknown>;
  changed: boolean;
  /** Which fields the two sources disagreed on: 'name' and/or 'number'. */
  conflicts: string[];
  confidence: IdentificationConfidence;
}

const CONFIDENCE_RANK: Record<IdentificationConfidence, number> = { low: 0, medium: 1, high: 2 };

function asConfidence(v: unknown): IdentificationConfidence | null {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'high' || s === 'medium' || s === 'low' ? s : null;
}

/** Never let a value exceed `cap`. */
function capConfidence(v: IdentificationConfidence, cap: IdentificationConfidence): IdentificationConfidence {
  return CONFIDENCE_RANK[v] <= CONFIDENCE_RANK[cap] ? v : cap;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

// ── name comparison ────────────────────────────────────────────────────────

/** lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeName(input: unknown): string {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Generational suffixes are not part of the identity for matching purposes:
 *  "Ken Griffey Jr." and "Ken Griffey" are the same read, one just fuller. */
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

function nameTokens(input: unknown): string[] {
  return normalizeName(input).split(' ').filter((t) => t && !SUFFIXES.has(t));
}

/** Last name = last non-suffix token. */
function lastName(input: unknown): string | null {
  const t = nameTokens(input);
  return t.length ? t[t.length - 1] : null;
}

/** "j" matches "jose"; a full token only matches itself. */
function tokenCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1) return b.startsWith(a);
  if (b.length === 1) return a.startsWith(b);
  return false;
}

/**
 * Do these two strings name the same person/character?
 *
 * Agreement is deliberately generous — the expensive mistake is OVERWRITING a
 * correct fuller name ("Mickey Mantle" vs "Mantle") on a bogus disagreement,
 * not letting a genuinely different name through, because a real disagreement
 * on the printed name is loud (Ripken vs Pilarcik share no token at all).
 */
export function namesAgree(a: unknown, b: unknown): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return true; // nothing to disagree about
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return true;
  if (ta.join(' ') === tb.join(' ')) return true;

  // Last names must match at minimum.
  const la = lastName(a);
  const lb = lastName(b);
  if (!la || !lb || !tokenCompatible(la, lb)) return false;

  // Same last name: accept when every shorter-side given name is compatible
  // with its counterpart (handles "M. Mantle" vs "Mickey Mantle").
  const ga = ta.slice(0, -1);
  const gb = tb.slice(0, -1);
  if (ga.length === 0 || gb.length === 0) return true;
  const len = Math.min(ga.length, gb.length);
  for (let i = 0; i < len; i++) {
    if (!tokenCompatible(ga[i], gb[i])) return false;
  }
  return true;
}

// ── number comparison ──────────────────────────────────────────────────────

/** Same shape cardNumberGuard uses: strip separators and case. */
export function normalizeNumber(input: unknown): string {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Numerator of "8 OF 12" / "8/12", else null. */
function numerator(input: unknown): string | null {
  const m = String(input ?? '').match(/^\s*([A-Za-z0-9-]+)\s*(?:\/|\bof\b)\s*\d+\s*$/i);
  return m ? normalizeNumber(m[1]) : null;
}

export function numbersAgree(a: unknown, b: unknown): boolean {
  const na = normalizeNumber(a);
  const nb = normalizeNumber(b);
  if (!na || !nb) return true; // nothing to disagree about
  if (na === nb) return true;
  const fa = numerator(a) ?? na;
  const fb = numerator(b) ?? nb;
  return !!fa && fa === fb;
}

// ── reconciliation ─────────────────────────────────────────────────────────

/** The independent result minus token accounting — what we persist. */
function auditShape(independent: IdentificationResult): Record<string, unknown> {
  const { tokens: _tokens, ...rest } = independent;
  return rest as Record<string, unknown>;
}

export function reconcileIdentity(
  gradingCardInfo: Record<string, unknown>,
  independent: IdentificationResult | null,
  category?: string | null
): ReconcileOutcome {
  const cardInfo: Record<string, unknown> = { ...(gradingCardInfo || {}) };
  const conflicts: string[] = [];
  const applied: string[] = [];

  const gradingConfidence = asConfidence(cardInfo.identification_confidence);

  // No opinion, or an opinion the pass itself does not stand behind. The
  // grading identity is untouched, but it is no longer allowed to call itself
  // 'high' — nothing corroborated it.
  if (!independent || independent.confidence === 'low') {
    const confidence = capConfidence(gradingConfidence ?? 'medium', 'medium');
    cardInfo.identification_confidence = confidence;
    cardInfo.identification_check = {
      independent: independent ? auditShape(independent) : null,
      agreement: { name: null, number: null },
      applied: [],
      category: category ?? null,
    };
    return { cardInfo, changed: false, conflicts, confidence };
  }

  const gradingName = str(cardInfo.card_name);
  const gradingPlayer = str(cardInfo.player_or_character);
  const gradingNumber = str(cardInfo.card_number);

  // Compare against the fuller of the grading call's two name fields; either
  // one naming the same person is agreement.
  const independentName = independent.printed_name_seen || independent.player_or_character || independent.card_name;
  const nameAgrees =
    !independentName ||
    (!gradingName && !gradingPlayer) ||
    namesAgree(gradingName ?? gradingPlayer, independentName) ||
    namesAgree(gradingPlayer ?? gradingName, independentName);

  const independentNumber = independent.card_number || independent.card_number_text_seen;
  const numberAgrees = !independentNumber || !gradingNumber || numbersAgree(gradingNumber, independentNumber);

  let changed = false;

  // NAME: the independent read wins only when it can quote the characters it
  // saw. Without printed_name_seen it is an inference, and an inference does
  // not get to overwrite another inference.
  if (!nameAgrees && independent.printed_name_seen) {
    conflicts.push('name');
    const newName = independent.card_name || independent.printed_name_seen;
    cardInfo.card_name = newName;
    applied.push('card_name');
    // player_or_character is only replaced when it was empty or was merely a
    // copy of the old card_name — a genuinely separate value (a character on a
    // named subset card) is left for a human to look at.
    if (!gradingPlayer || (gradingName && normalizeName(gradingPlayer) === normalizeName(gradingName))) {
      cardInfo.player_or_character = independent.player_or_character || independent.printed_name_seen;
      applied.push('player_or_character');
    }
    cardInfo.identification_name_source = 'independent_read';
    cardInfo.printed_name_seen = independent.printed_name_seen;
    changed = true;
  }

  // NUMBER: a disagreement FLAGS the card but never overwrites the grading
  // number. Names are where the independent read earns its keep (famous-name
  // priors override printed text in the grading call; the short read got 8/8).
  // Numbers are the opposite: the low-detail read mistook a Lorcana set number
  // for the card number ("3/P3 · EN · 9" -> "9/204") and would have replaced a
  // correct value. The grading number keeps its full-resolution read plus the
  // downstream DB matchers / sports checklist; the conflict is recorded so the
  // card is marked low confidence and the owner is prompted to fix details.
  if (!numberAgrees && independent.card_number_text_seen) {
    conflicts.push('number');
    cardInfo.card_number_independent_read = independent.card_number || independent.card_number_text_seen;
    changed = true;
  }

  // A contested card is a low-confidence card regardless of how sure either
  // side sounded. Agreement can hold the grading call's own confidence, or
  // promote an unstated one to 'high' — two independent reads matched.
  const confidence: IdentificationConfidence = conflicts.length > 0 ? 'low' : (gradingConfidence ?? 'high');
  cardInfo.identification_confidence = confidence;

  cardInfo.identification_check = {
    independent: auditShape(independent),
    agreement: { name: nameAgrees, number: numberAgrees },
    applied,
    category: category ?? null,
  };

  return { cardInfo, changed, conflicts, confidence };
}
