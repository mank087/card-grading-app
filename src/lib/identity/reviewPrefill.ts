/**
 * Phase 2B — what the confirmation dialog shows, and whether it shows at all.
 *
 * Everything here is pure: no database, no fetch, no React. The dialog, the
 * banner, the GET endpoint and the on-demand first-look endpoint all build their
 * answer from these functions so the owner sees the same values whichever path
 * produced them.
 *
 * THE RULE THIS FILE ENCODES. First look (src/lib/identification/firstLook.ts)
 * is a proposal, not an answer. Measured Sept 17 2026: its own confidence label
 * is uninformative, a "recognized" set name is wrong on look-alike products (it
 * called a 1977 Wonder Bread card "Topps"), and true parallels are named
 * correctly only ~40-45% of the time whatever the prompt says. So:
 *
 *   - a value first look READ off the card ("printed") is allowed to win, and is
 *     labelled as read from the card;
 *   - a value it RECOGNIZED or INFERRED may only fill a blank, and is marked
 *     "please check";
 *   - when the card already has a value and first look disagrees, the stored
 *     value stays and first look's becomes a one-tap suggestion;
 *   - nothing is ever invented. A field with no evidence stays empty.
 */

import { currentIdentityValue } from './saveCardIdentity';
import { isBlankIdentityText } from '../pricing/valueGuard';
import { isRecordLocked } from '../cards/ownership';
import type { FieldSource, FirstLook } from '../identification/firstLook';
import {
  NO_CANDIDATE,
  sameIdentityValue as sameValue,
  type ReviewAlternative,
  type ReviewCandidate,
  type ReviewField,
} from './reviewClient';

// The client-side types and helpers live in ./reviewClient (copied verbatim to
// the mobile app). Re-exported here so every existing import keeps working.
export {
  changedFieldPayload,
  NO_CANDIDATE,
  type ReviewAlternative,
  type ReviewCandidate,
  type ReviewField,
  type ReviewFieldOrigin,
  type ReviewFieldSource,
  type ReviewSuggestion,
} from './reviewClient';

export interface ReviewPrefill {
  fields: ReviewField[];
  /** First look's "could also be" list, verbatim. */
  alternatives: ReviewAlternative[];
  firstLookPresent: boolean;
  category: string | null;
  isSports: boolean;
}

/** Same list the identity service uses to decide the sports field set. */
const SPORTS_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

export function isSportsCategory(category?: string | null): boolean {
  return SPORTS_CATEGORIES.includes(category || '');
}

/** The fields the owner is asked about, in the order they are shown. */
const REVIEW_FIELDS: Array<{ key: string; label: string; sportsOnly?: boolean }> = [
  { key: 'card_name', label: 'Card title' },
  { key: 'featured', label: 'Player or character' },
  { key: 'card_set', label: 'Set' },
  { key: 'release_date', label: 'Year' },
  { key: 'card_number', label: 'Card number' },
  { key: 'manufacturer_name', label: 'Manufacturer' },
  { key: 'subset_variant', label: 'Insert or subset' },
  { key: 'parallel_type', label: 'Parallel or variation', sportsOnly: true },
  { key: 'serial_numbering', label: 'Serial numbering' },
];

export function reviewFieldKeys(category?: string | null): string[] {
  const sports = isSportsCategory(category);
  return REVIEW_FIELDS.filter(f => !f.sportsOnly || sports).map(f => f.key);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : '';
  return String(value).trim();
}

/** '' for anything that carries no information, including "unknown" and "n/a". */
function meaningful(value: unknown): string {
  const t = text(value);
  return isBlankIdentityText(t) ? '' : t;
}

/**
 * The year column only accepts four digits (see the details route's validator),
 * but basketball and hockey products are catalogued by season. Store the first
 * year, show the season.
 */
export function seasonToYear(value: string): { year: string; season?: string } {
  const trimmed = value.trim();
  const season = /^((?:19|20)\d{2})-(\d{2})$/.exec(trimmed);
  if (season) return { year: season[1], season: trimmed };
  return { year: trimmed };
}

/** A card number is kept exactly as printed, minus a leading '#'. */
export function cleanPrintedCardNumber(value: string): string {
  return value.trim().replace(/^#\s*/, '');
}

interface Candidate {
  value: string;
  source: FieldSource;
  displayValue?: string;
}

const PARALLEL_SOURCE: Record<string, FieldSource> = {
  printed_on_card: 'printed',
  serial_stamp: 'printed',
  observed_color_or_pattern: 'recognized',
  recognized_design: 'recognized',
  cannot_tell: 'unknown',
};

/**
 * First look's proposal for one review field, or null when it has nothing.
 *
 * Two deliberate readings of the contract:
 *   - `card_name` falls back to `subject` because `card_title` is null exactly
 *     when the card's title IS the subject's name. That is the contract's own
 *     definition, not an invention.
 *   - `card_number` and `serial_numbering` are taken from the verbatim
 *     transcription rather than the normalized identity block, so "116/086" and
 *     "23/99" survive. A leading '#' is the only thing removed.
 */
export function firstLookCandidate(look: FirstLook | null | undefined, key: string): Candidate | null {
  if (!look) return null;
  const identity = look.identity;
  const field = (f: { value: string | null; source: FieldSource } | undefined): Candidate | null => {
    const value = meaningful(f?.value);
    if (!value || !f) return null;
    return { value, source: f.source };
  };

  switch (key) {
    case 'card_name': {
      const titled = field(identity?.card_title);
      return titled || field(identity?.subject);
    }
    case 'featured':
      return field(identity?.subject);
    case 'card_set':
      return field(identity?.set_name);
    case 'manufacturer_name':
      return field(identity?.manufacturer);
    case 'subset_variant':
      return field(identity?.insert_or_subset);
    case 'release_date': {
      const raw = field(identity?.year);
      if (!raw) return null;
      const { year, season } = seasonToYear(raw.value);
      if (!/^\d{4}$/.test(year)) return null;
      return { value: year, source: raw.source, displayValue: season };
    }
    case 'card_number': {
      const printed = cleanPrintedCardNumber(meaningful(look.printed_text?.card_number_as_printed));
      if (printed) return { value: printed, source: 'printed' };
      return field(identity?.card_number);
    }
    case 'serial_numbering': {
      const stamp = meaningful(look.printed_text?.serial_stamp);
      return stamp ? { value: stamp, source: 'printed' } : null;
    }
    case 'parallel_type': {
      const name = meaningful(look.parallel?.parallel_name);
      if (!name) return null;
      return { value: name, source: PARALLEL_SOURCE[look.parallel?.decided_by || ''] || 'recognized' };
    }
    default:
      return null;
  }
}

/**
 * Build the dialog's form state for one card.
 *
 * `card` is a cards row (or the client's copy of one). `firstLook` is the
 * `result` of a FirstLookRecord, or null when the card has none — most existing
 * cards do not, because it is only filled at grading time when first look is on.
 */
export function buildReviewPrefill(
  card: Record<string, any> | null | undefined,
  firstLook: FirstLook | null | undefined,
): ReviewPrefill {
  const row = card || {};
  const category: string | null = row.category ?? null;
  const sports = isSportsCategory(category);
  const info = row.conversational_card_info && typeof row.conversational_card_info === 'object'
    ? row.conversational_card_info as Record<string, any>
    : {};

  const fields: ReviewField[] = REVIEW_FIELDS
    .filter(definition => !definition.sportsOnly || sports)
    .map(definition => {
      const { key, label } = definition;
      let stored = meaningful(currentIdentityValue(row, key));
      // The editor writes `rarity_or_variant`; the detail pages read `subset`.
      // Either one counts as a stored insert name.
      if (!stored && key === 'subset_variant') stored = meaningful(info.subset);
      // Older MTG rows (and some other TCGs) never had the column written; the
      // number the grader read still sits in the card_info JSON.
      if (!stored && key === 'card_number') {
        stored = meaningful(info.card_number) || meaningful(info.collector_number) || meaningful(info.card_id);
      }

      const proposal = firstLookCandidate(firstLook, key);
      const base: ReviewField = {
        key,
        label,
        value: stored,
        storedValue: stored,
        origin: stored ? 'from_grading' : 'empty',
        needsCheck: false,
        differsFromStored: false,
      };

      if (!proposal) return base;

      // 1. A value first look READ off the card fills a blank as "Read from card".
      //    It never replaces a value already on file: owner test, Sept 18 2026 —
      //    a serial stamp stored correctly as 047/249 was transcribed as 041/249.
      //    A disagreement falls through to rule 3 and is offered as a suggestion.
      if (proposal.source === 'printed' && (!stored || sameValue(proposal.value, stored))) {
        return {
          ...base,
          value: proposal.value,
          origin: 'read_from_card',
          needsCheck: false,
          differsFromStored: !sameValue(proposal.value, stored),
          ...(proposal.displayValue ? { displayValue: proposal.displayValue } : {}),
        };
      }

      // 2. A recognized or inferred value may only fill a blank, and must be checked.
      if (!stored) {
        return {
          ...base,
          value: proposal.value,
          origin: 'suggested',
          needsCheck: true,
          differsFromStored: !sameValue(proposal.value, stored),
          ...(proposal.displayValue ? { displayValue: proposal.displayValue } : {}),
        };
      }

      // 3. The card already says something else. Keep it; offer the alternative.
      if (sameValue(proposal.value, stored)) return base;
      return {
        ...base,
        // Two independent reads of the printed text disagree: flag the field so
        // the owner actually looks (Gengar: grading "086", the card "066/196").
        needsCheck: proposal.source === 'printed',
        suggestion: {
          value: proposal.value,
          origin: 'suggested',
          source: proposal.source,
          ...(proposal.displayValue ? { displayValue: proposal.displayValue } : {}),
        },
      };
    });

  return {
    fields,
    alternatives: Array.isArray(firstLook?.alternatives) ? firstLook!.alternatives.slice(0, 3) : [],
    firstLookPresent: !!firstLook,
    category,
    isSports: sports,
  };
}

/** The `result` inside cards.first_look, whatever shape the column happens to hold. */
export function firstLookResultOf(stored: unknown): FirstLook | null {
  if (!stored || typeof stored !== 'object') return null;
  const record = stored as Record<string, any>;
  const result = record.result && typeof record.result === 'object' ? record.result : null;
  if (!result || !result.identity) return null;
  return result as FirstLook;
}

/* ------------------------------------------------------------------ *
 * Eligibility
 * ------------------------------------------------------------------ */

export type ReviewMode = 'popup' | 'banner' | 'none';

export type ReviewReason =
  | 'eligible'
  | 'dismissed'
  | 'no_rollout_date'
  | 'graded_before_rollout'
  | 'no_grade_date'
  | 'not_owner'
  | 'deleted'
  | 'sold_locked'
  | 'grade_failed'
  | 'grade_processing'
  | 'not_graded'
  | 'already_confirmed';

export interface ReviewEligibility {
  mode: ReviewMode;
  reason: ReviewReason;
}

export interface ReviewEligibilityOptions {
  /** NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE. Unset means never pop up. */
  confirmSince?: string | null;
  now?: Date;
}

function parsedTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Decide whether this viewer gets the popup, the banner, or nothing.
 *
 * A dismissal is not a confirmation: a dismissed card keeps its banner forever
 * and never pops up again. A confirmation at an OLD identity_revision does not
 * count either, because the card has changed since the owner looked at it.
 */
export function reviewEligibility(
  card: Record<string, any> | null | undefined,
  viewerId: string | null | undefined,
  opts: ReviewEligibilityOptions = {},
): ReviewEligibility {
  const row = card || {};
  if (!viewerId || !row.user_id || row.user_id !== viewerId) return { mode: 'none', reason: 'not_owner' };
  if (row.deleted_at) return { mode: 'none', reason: 'deleted' };
  if (isRecordLocked(row)) return { mode: 'none', reason: 'sold_locked' };

  const status = typeof row.grade_status === 'string' ? row.grade_status : null;
  if (status === 'failed') return { mode: 'none', reason: 'grade_failed' };
  if (status && status.startsWith('processing')) return { mode: 'none', reason: 'grade_processing' };

  // Older rows predate grade_status, so the grade itself is the signal.
  const grade = Number(row.conversational_whole_grade ?? row.grade ?? 0);
  if (!(grade > 0)) return { mode: 'none', reason: 'not_graded' };

  const confirmedRevision = row.identity_confirmed_revision;
  if (confirmedRevision !== null && confirmedRevision !== undefined
    && Number(confirmedRevision) >= Number(row.identity_revision ?? 0)) {
    return { mode: 'none', reason: 'already_confirmed' };
  }

  if (row.identity_review_dismissed_at) return { mode: 'banner', reason: 'dismissed' };

  // Owner decision (Sept 17 2026): the popup appears the FIRST time the owner
  // opens a card's page, for every unconfirmed card. Closing it in any way is
  // recorded as a dismissal by the mount component, so it is first time only and
  // the banner takes over. confirmSince is an optional brake for a staged
  // rollout: when set, cards graded before it get the banner instead.
  const since = parsedTime(opts.confirmSince);
  if (since !== null) {
    const gradedAt = parsedTime(row.graded_at) ?? parsedTime(row.created_at);
    if (gradedAt === null) return { mode: 'banner', reason: 'no_grade_date' };
    if (gradedAt < since) return { mode: 'banner', reason: 'graded_before_rollout' };
  }

  return { mode: 'popup', reason: 'eligible' };
}

/* ------------------------------------------------------------------ *
 * Catalog candidates (sports)
 * ------------------------------------------------------------------ */

const CANDIDATE_STOPWORDS = new Set(['the', 'and', 'card', 'base', 'rc', 'sp']);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 1 && !CANDIDATE_STOPWORDS.has(t));
}

/**
 * Mark the plainest member of a catalog family as the base card.
 *
 * "Plainest" is the fewest name tokens, and only when that minimum belongs to
 * exactly one product — a family with two equally short names has no obvious
 * base, and guessing one would pre-select the wrong parallel.
 */
export function markBaseCandidate(candidates: ReviewCandidate[]): ReviewCandidate[] {
  if (candidates.length < 2) return candidates.map(c => ({ ...c }));
  const counts = candidates.map(c => tokens(c.name).length);
  const fewest = Math.min(...counts);
  const unique = counts.filter(n => n === fewest).length === 1;
  return candidates.map((c, i) => ({ ...c, isBase: unique && counts[i] === fewest }));
}

/**
 * Pre-select the candidate whose name overlaps the prefilled parallel and
 * serial numbering most. Returns NO_CANDIDATE when nothing looks like a match,
 * because the owner's true product is only in this list ~70-80% of the time and
 * a confident wrong pre-selection is worse than none.
 */
export function pickBestCandidate(
  candidates: ReviewCandidate[],
  hints: { parallel?: string | null; serial?: string | null; subset?: string | null } = {},
): string {
  if (!candidates.length) return NO_CANDIDATE;

  const hintTokens = [
    ...tokens(hints.parallel || ''),
    ...tokens(hints.subset || ''),
  ];
  const denominator = /\/\s*(\d{1,5})\b/.exec(hints.serial || '')?.[1] || null;

  let best: { id: string; score: number; hasPrice: boolean; length: number } | null = null;
  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase();
    const candidateTokens = new Set(tokens(candidate.name));
    let score = hintTokens.filter(t => candidateTokens.has(t)).length;
    if (denominator && (name.includes(`/${denominator}`) || candidateTokens.has(denominator))) score += 2;
    if (score === 0) continue;
    const length = candidate.name.length;
    const better = !best
      || score > best.score
      || (score === best.score && candidate.hasPrice && !best.hasPrice)
      || (score === best.score && candidate.hasPrice === best.hasPrice && length < best.length);
    if (better) best = { id: candidate.id, score, hasPrice: candidate.hasPrice, length };
  }
  if (best) return best.id;

  // Nothing to go on. A card with no parallel on file is usually the base card.
  if (!hintTokens.length && !denominator) {
    const base = candidates.filter(c => c.isBase);
    if (base.length === 1) return base[0].id;
  }
  return NO_CANDIDATE;
}
