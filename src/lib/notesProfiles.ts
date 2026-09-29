/**
 * Saved card-notes profiles ("Topps Chrome Refractor" -> note text).
 *
 * Stored server-side in user_credits.grading_notes_profiles (jsonb array,
 * migration 20260928_grading_notes_profiles.sql), read and written only via
 * /api/user/notes-profiles with the caller's JWT. The mobile app keeps a copy
 * of these rules in dcm-mobile/lib/gradingRun.ts.
 */

export const MAX_NOTES_PROFILES = 25;
export const NOTES_PROFILE_NAME_MAX = 60;
export const NOTES_PROFILE_TEXT_MAX = 500;

export interface NotesProfile {
  id: string;
  name: string;
  text: string;
  updated_at?: string;
}

/** Drop anything malformed that may be sitting in the column. */
export function normalizeNotesProfiles(raw: unknown): NotesProfile[] {
  if (!Array.isArray(raw)) return [];
  const out: NotesProfile[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : '';
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    const text = typeof e.text === 'string' ? e.text : '';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: name.slice(0, NOTES_PROFILE_NAME_MAX),
      text: text.slice(0, NOTES_PROFILE_TEXT_MAX),
      ...(typeof e.updated_at === 'string' ? { updated_at: e.updated_at } : {}),
    });
    if (out.length >= MAX_NOTES_PROFILES) break;
  }
  return out;
}

export type UpsertResult =
  | { ok: true; profiles: NotesProfile[]; saved: NotesProfile }
  | { ok: false; error: string };

/**
 * Insert or update one profile. A save with no id but the same name as an
 * existing profile (case-insensitive) overwrites that profile's text, so
 * "save as Topps Chrome" twice never makes two identically named entries.
 */
export function upsertNotesProfile(
  current: NotesProfile[],
  input: { id?: unknown; name?: unknown; text?: unknown },
  newId: () => string,
  now: string = new Date().toISOString()
): UpsertResult {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!name) return { ok: false, error: 'Give the profile a name.' };
  if (name.length > NOTES_PROFILE_NAME_MAX) {
    return { ok: false, error: `Profile names are ${NOTES_PROFILE_NAME_MAX} characters at most.` };
  }
  if (!text) return { ok: false, error: 'A notes profile needs some note text.' };
  if (text.length > NOTES_PROFILE_TEXT_MAX) {
    return { ok: false, error: `Notes are ${NOTES_PROFILE_TEXT_MAX} characters at most.` };
  }

  const id = typeof input.id === 'string' && input.id ? input.id : '';
  let idx = id ? current.findIndex(p => p.id === id) : -1;
  if (idx < 0) idx = current.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

  if (idx >= 0) {
    const saved: NotesProfile = { ...current[idx], name, text, updated_at: now };
    const profiles = current.slice();
    profiles[idx] = saved;
    return { ok: true, profiles, saved };
  }

  if (current.length >= MAX_NOTES_PROFILES) {
    return { ok: false, error: `You can save up to ${MAX_NOTES_PROFILES} notes profiles. Delete one first.` };
  }
  const saved: NotesProfile = { id: newId(), name, text, updated_at: now };
  return { ok: true, profiles: [...current, saved], saved };
}

export function deleteNotesProfile(current: NotesProfile[], id: unknown): NotesProfile[] {
  return typeof id === 'string' ? current.filter(p => p.id !== id) : current;
}
