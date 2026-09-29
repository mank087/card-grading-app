import { describe, expect, it } from 'vitest'
import { EMPTY_RUN_LOCK, isRunActive, parseRunLock } from './gradingRun'
import {
  MAX_NOTES_PROFILES,
  deleteNotesProfile,
  normalizeNotesProfiles,
  upsertNotesProfile,
  type NotesProfile,
} from './notesProfiles'

describe('parseRunLock', () => {
  it('reads a valid category + notes lock', () => {
    const lock = parseRunLock(JSON.stringify({
      category: { type: 'Sports', subCategory: '' },
      notes: { profileId: 'p1', name: 'Topps Chrome Refractor', text: 'Refractor finish' },
    }))
    expect(lock.category).toEqual({ type: 'Sports', subCategory: '' })
    expect(lock.notes?.name).toBe('Topps Chrome Refractor')
    expect(isRunActive(lock)).toBe(true)
  })

  it('treats junk, unknown types and a sub-category-less Other as no lock', () => {
    expect(parseRunLock('not json')).toEqual(EMPTY_RUN_LOCK)
    expect(parseRunLock(JSON.stringify({ category: { type: 'Beanies' } })).category).toBeNull()
    expect(parseRunLock(JSON.stringify({ category: { type: 'Other', subCategory: '' } })).category).toBeNull()
    expect(parseRunLock(JSON.stringify({ category: { type: 'Other', subCategory: 'Star Wars' } })).category)
      .toEqual({ type: 'Other', subCategory: 'Star Wars' })
    expect(parseRunLock(JSON.stringify({ notes: { text: '   ' } })).notes).toBeNull()
    expect(isRunActive(EMPTY_RUN_LOCK)).toBe(false)
  })
})

describe('notes profiles', () => {
  let n = 0
  const newId = () => `id-${++n}`

  it('saves, renames by id, and overwrites by same name', () => {
    let r = upsertNotesProfile([], { name: 'Topps Chrome', text: 'Refractor' }, newId)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const first = r.saved
    r = upsertNotesProfile(r.profiles, { name: 'topps chrome', text: 'Refractor, /99' }, newId)
    expect(r.ok && r.profiles).toHaveLength(1)
    expect(r.ok && r.saved.id).toBe(first.id)
    r = upsertNotesProfile(r.ok ? r.profiles : [], { id: first.id, name: 'Chrome Refractor', text: 'x' }, newId)
    expect(r.ok && r.profiles[0].name).toBe('Chrome Refractor')
  })

  it('rejects empty names/text and enforces the cap', () => {
    expect(upsertNotesProfile([], { name: '', text: 'x' }, newId).ok).toBe(false)
    expect(upsertNotesProfile([], { name: 'a', text: '  ' }, newId).ok).toBe(false)
    const full: NotesProfile[] = Array.from({ length: MAX_NOTES_PROFILES }, (_, i) => ({ id: `p${i}`, name: `P${i}`, text: 't' }))
    expect(upsertNotesProfile(full, { name: 'new', text: 't' }, newId).ok).toBe(false)
  })

  it('normalizes stored data and deletes by id', () => {
    const stored = [{ id: 'a', name: 'A', text: 't' }, { id: 'a', name: 'dup', text: 't' }, { name: 'no id' }, 7]
    const profiles = normalizeNotesProfiles(stored)
    expect(profiles.map(p => p.id)).toEqual(['a'])
    expect(deleteNotesProfile(profiles, 'a')).toEqual([])
    expect(normalizeNotesProfiles(null)).toEqual([])
  })
})

describe('run lock expiry', () => {
  const raw = (savedAt: number) => JSON.stringify({ category: { type: 'Sports', subCategory: '' }, notes: null, savedAt });
  it('keeps a lock set within 12 hours and drops an older one', () => {
    const now = Date.UTC(2026, 8, 28, 20);
    expect(parseRunLock(raw(now - 11 * 3600_000), now).category?.type).toBe('Sports');
    expect(parseRunLock(raw(now - 13 * 3600_000), now)).toEqual(EMPTY_RUN_LOCK);
  });
});
