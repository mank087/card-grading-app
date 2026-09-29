'use client'

import { useCallback, useEffect, useState } from 'react'
import { getStoredSession } from '@/lib/directAuth'
import {
  EMPTY_RUN_LOCK,
  isRunActive,
  readRunLock,
  writeRunLock,
  type GradingRunLock,
  type RunNotesLock,
} from '@/lib/gradingRun'

/**
 * The signed-in user's grading-run lock (card type + notes profile), shared by
 * /upload and /submissions/new. `loaded` is false until localStorage has been
 * read on the client, so pages can wait before applying it.
 */
export function useGradingRun() {
  const [userId, setUserId] = useState<string | null>(null)
  const [lock, setLock] = useState<GradingRunLock>(EMPTY_RUN_LOCK)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const id = getStoredSession()?.user?.id ?? null
    setUserId(id)
    setLock(readRunLock(id))
    setLoaded(true)
  }, [])

  const update = useCallback((next: GradingRunLock) => {
    setLock(next)
    writeRunLock(userId, next)
  }, [userId])

  const lockCategory = useCallback((type: string, subCategory: string) => {
    update({ ...lock, category: { type, subCategory } })
  }, [lock, update])

  const unlockCategory = useCallback(() => {
    update({ ...lock, category: null })
  }, [lock, update])

  const lockNotes = useCallback((notes: RunNotesLock) => {
    update({ ...lock, notes })
  }, [lock, update])

  const unlockNotes = useCallback(() => {
    update({ ...lock, notes: null })
  }, [lock, update])

  const endRun = useCallback(() => {
    update(EMPTY_RUN_LOCK)
  }, [update])

  return {
    loaded,
    lock,
    active: isRunActive(lock),
    lockCategory,
    unlockCategory,
    lockNotes,
    unlockNotes,
    endRun,
  }
}
