/**
 * Grading "run" lock + saved notes profiles (volume-dealer speed-up, Sept 28 2026).
 *
 * Mirrors the web's src/lib/gradingRun.ts: a run pins the card type (and
 * optionally a notes profile) so each following card goes straight to
 * capture with its notes pre-filled, until unlocked or "Finished grading".
 * The lock lives in AsyncStorage keyed by user id (device-local). Notes
 * profiles are server-side (/api/user/notes-profiles), shared with the web.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

export interface RunCategoryLock {
  /** Card category as the grade flow uses it ('Sports', 'Other', ...). */
  category: string
  subCategory: string
}

export interface RunNotesLock {
  profileId: string | null
  name: string
  text: string
}

export interface GradingRunLock {
  category: RunCategoryLock | null
  notes: RunNotesLock | null
}

export const EMPTY_RUN_LOCK: GradingRunLock = { category: null, notes: null }

const key = (userId: string) => `dcm_grading_run:v1:${userId}`

export function isRunActive(lock: GradingRunLock | null | undefined): boolean {
  return !!(lock && (lock.category || lock.notes))
}

export function parseRunLock(raw: string | null | undefined): GradingRunLock {
  if (!raw) return EMPTY_RUN_LOCK
  let v: any
  try { v = JSON.parse(raw) } catch { return EMPTY_RUN_LOCK }
  if (!v || typeof v !== 'object') return EMPTY_RUN_LOCK

  let category: RunCategoryLock | null = null
  const c = v.category
  if (c && typeof c === 'object' && typeof c.category === 'string' && c.category) {
    const subCategory = typeof c.subCategory === 'string' ? c.subCategory : ''
    if (c.category !== 'Other' || subCategory) category = { category: c.category, subCategory }
  }

  let notes: RunNotesLock | null = null
  const n = v.notes
  if (n && typeof n === 'object' && typeof n.text === 'string' && n.text.trim()) {
    notes = {
      profileId: typeof n.profileId === 'string' ? n.profileId : null,
      name: typeof n.name === 'string' && n.name.trim() ? n.name.trim() : 'Saved notes',
      text: n.text.slice(0, 500),
    }
  }

  return { category, notes }
}

export async function readRunLock(userId: string | null | undefined): Promise<GradingRunLock> {
  if (!userId) return EMPTY_RUN_LOCK
  try {
    return parseRunLock(await AsyncStorage.getItem(key(userId)))
  } catch {
    return EMPTY_RUN_LOCK
  }
}

export async function writeRunLock(userId: string | null | undefined, lock: GradingRunLock): Promise<void> {
  if (!userId) return
  try {
    if (isRunActive(lock)) await AsyncStorage.setItem(key(userId), JSON.stringify(lock))
    else await AsyncStorage.removeItem(key(userId))
  } catch { /* storage failure: the lock just doesn't persist */ }
}

/** "Sports", "Other — Star Wars", "Naruto (Kayou)". */
export function runCategoryLabel(lock: RunCategoryLock): string {
  if (lock.category === 'Other' && lock.subCategory === 'Naruto / Kayou') return 'Naruto (Kayou)'
  return lock.category === 'Other' && lock.subCategory ? `Other — ${lock.subCategory}` : lock.category
}

// ---------------------------------------------------------------------------
// Saved notes profiles (server-side)
// ---------------------------------------------------------------------------

export interface NotesProfile {
  id: string
  name: string
  text: string
}

export async function fetchNotesProfiles(token: string | undefined): Promise<{ profiles: NotesProfile[]; available: boolean }> {
  if (!token) return { profiles: [], available: false }
  try {
    const res = await fetch(`${API_BASE}/api/user/notes-profiles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { profiles: [], available: false }
    const data = await res.json()
    return {
      profiles: Array.isArray(data?.profiles) ? data.profiles : [],
      available: data?.available !== false,
    }
  } catch {
    return { profiles: [], available: false }
  }
}

export async function saveNotesProfile(
  token: string | undefined,
  profile: { id?: string; name: string; text: string }
): Promise<{ profiles?: NotesProfile[]; saved?: NotesProfile; error?: string }> {
  if (!token) return { error: 'Sign in again to save notes profiles.' }
  try {
    const res = await fetch(`${API_BASE}/api/user/notes-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'save', profile }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) return { error: data?.error || 'Could not save the profile.' }
    return { profiles: data.profiles, saved: data.saved }
  } catch {
    return { error: 'Could not save the profile. Check your connection.' }
  }
}

export async function deleteNotesProfile(
  token: string | undefined,
  id: string
): Promise<{ profiles?: NotesProfile[]; error?: string }> {
  if (!token) return { error: 'Sign in again to manage notes profiles.' }
  try {
    const res = await fetch(`${API_BASE}/api/user/notes-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'delete', id }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) return { error: data?.error || 'Could not delete the profile.' }
    return { profiles: data.profiles }
  } catch {
    return { error: 'Could not delete the profile. Check your connection.' }
  }
}
