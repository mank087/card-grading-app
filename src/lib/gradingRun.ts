/**
 * Grading "run" lock (volume-dealer speed-up, Sept 28 2026).
 *
 * A run pins the card type (and optionally a card-notes profile) so every
 * following card skips category selection and pre-fills its notes, until the
 * owner unlocks it or taps "Finished grading". Kept in localStorage, keyed by
 * user id, so it survives a reload but never leaks between accounts on a
 * shared browser. The mobile app keeps its own copy in AsyncStorage
 * (dcm-mobile/lib/gradingRun.ts).
 */

import { CARD_TYPES } from '@/lib/cardTypeConfig';
import { NOTES_PROFILE_TEXT_MAX } from '@/lib/notesProfiles';

export interface RunCategoryLock {
  /** CARD_TYPES key (e.g. 'Sports', 'Naruto'), not the DB category. */
  type: string;
  subCategory: string;
}

export interface RunNotesLock {
  profileId: string | null;
  name: string;
  /** Snapshot of the profile text at lock time — pre-fills each card. */
  text: string;
}

export interface GradingRunLock {
  category: RunCategoryLock | null;
  notes: RunNotesLock | null;
}

export const EMPTY_RUN_LOCK: GradingRunLock = { category: null, notes: null };

export function runStorageKey(userId: string): string {
  return `dcm_grading_run:v1:${userId}`;
}

export function isRunActive(lock: GradingRunLock | null | undefined): boolean {
  return !!(lock && (lock.category || lock.notes));
}

/** Validate whatever is in storage; anything unexpected reads as "no lock". */
/**
 * A lock left over from an earlier session must not silently override a later
 * visit (e.g. a ?category= link a week later): locks expire 12 hours after set.
 */
export const RUN_LOCK_TTL_MS = 12 * 60 * 60 * 1000;

export function parseRunLock(raw: string | null | undefined, now: number = Date.now()): GradingRunLock {
  if (!raw) return EMPTY_RUN_LOCK;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, validated field by field below
  let v: any;
  try {
    v = JSON.parse(raw);
  } catch {
    return EMPTY_RUN_LOCK;
  }
  if (!v || typeof v !== 'object') return EMPTY_RUN_LOCK;
  if (typeof v.savedAt === 'number' && now - v.savedAt > RUN_LOCK_TTL_MS) return EMPTY_RUN_LOCK;

  let category: RunCategoryLock | null = null;
  const c = v.category;
  if (c && typeof c === 'object' && typeof c.type === 'string' && c.type in CARD_TYPES) {
    const subCategory = typeof c.subCategory === 'string' ? c.subCategory : '';
    // An "Other" lock without its required sub-category is not a usable lock.
    if (c.type !== 'Other' || subCategory) category = { type: c.type, subCategory };
  }

  let notes: RunNotesLock | null = null;
  const n = v.notes;
  if (n && typeof n === 'object' && typeof n.text === 'string' && n.text.trim()) {
    notes = {
      profileId: typeof n.profileId === 'string' ? n.profileId : null,
      name: typeof n.name === 'string' && n.name.trim() ? n.name.trim() : 'Saved notes',
      text: n.text.slice(0, NOTES_PROFILE_TEXT_MAX),
    };
  }

  return { category, notes };
}

export function readRunLock(userId: string | null | undefined): GradingRunLock {
  if (!userId || typeof window === 'undefined') return EMPTY_RUN_LOCK;
  try {
    return parseRunLock(window.localStorage.getItem(runStorageKey(userId)));
  } catch {
    return EMPTY_RUN_LOCK;
  }
}

export function writeRunLock(userId: string | null | undefined, lock: GradingRunLock): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    if (isRunActive(lock)) {
      window.localStorage.setItem(runStorageKey(userId), JSON.stringify({ ...lock, savedAt: Date.now() }));
    } else {
      window.localStorage.removeItem(runStorageKey(userId));
    }
  } catch {
    /* storage blocked (private mode) — the lock just lasts for this page */
  }
}
