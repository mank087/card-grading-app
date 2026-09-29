'use client'

import { useCallback, useEffect, useState } from 'react'
import { getStoredSession } from '@/lib/directAuth'
import type { NotesProfile } from '@/lib/notesProfiles'

function authHeaders(): Record<string, string> | null {
  const session = getStoredSession()
  if (!session?.access_token) return null
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

/**
 * Saved card-notes profiles for the signed-in user (server-side, via
 * /api/user/notes-profiles). `available` is false when the server has no
 * storage for them yet (migration not applied) — callers hide the save UI.
 */
export function useNotesProfiles() {
  const [profiles, setProfiles] = useState<NotesProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    const headers = authHeaders()
    if (!headers) {
      setLoading(false)
      return
    }
    fetch('/api/user/notes-profiles', { headers })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return
        setProfiles(Array.isArray(data.profiles) ? data.profiles : [])
        setAvailable(data.available !== false)
      })
      .catch(err => console.warn('[notes-profiles] load failed:', err))
      .finally(() => setLoading(false))
  }, [])

  const saveProfile = useCallback(async (
    profile: { id?: string; name: string; text: string }
  ): Promise<{ saved?: NotesProfile; error?: string }> => {
    const headers = authHeaders()
    if (!headers) return { error: 'Sign in again to save notes profiles.' }
    try {
      const res = await fetch('/api/user/notes-profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'save', profile }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) return { error: data?.error || 'Could not save the profile.' }
      setProfiles(data.profiles)
      return { saved: data.saved }
    } catch {
      return { error: 'Could not save the profile. Check your connection.' }
    }
  }, [])

  const deleteProfile = useCallback(async (id: string): Promise<{ error?: string }> => {
    const headers = authHeaders()
    if (!headers) return { error: 'Sign in again to manage notes profiles.' }
    try {
      const res = await fetch('/api/user/notes-profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'delete', id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) return { error: data?.error || 'Could not delete the profile.' }
      setProfiles(data.profiles)
      return {}
    } catch {
      return { error: 'Could not delete the profile. Check your connection.' }
    }
  }, [])

  return { profiles, loading, available, saveProfile, deleteProfile }
}
