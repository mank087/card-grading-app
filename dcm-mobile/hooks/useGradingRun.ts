import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import {
  EMPTY_RUN_LOCK,
  isRunActive,
  readRunLock,
  writeRunLock,
  type GradingRunLock,
  type RunNotesLock,
} from '@/lib/gradingRun'

/**
 * The signed-in user's grading-run lock. Re-read every time the screen gains
 * focus, so a lock set or cleared on one grade screen shows on the next.
 */
export function useGradingRun() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [lock, setLock] = useState<GradingRunLock>(EMPTY_RUN_LOCK)
  const [loaded, setLoaded] = useState(false)

  useFocusEffect(useCallback(() => {
    let cancelled = false
    readRunLock(userId).then(l => {
      if (!cancelled) { setLock(l); setLoaded(true) }
    })
    return () => { cancelled = true }
  }, [userId]))

  const update = useCallback(async (next: GradingRunLock) => {
    setLock(next)
    await writeRunLock(userId, next)
  }, [userId])

  return {
    lock,
    loaded,
    active: isRunActive(lock),
    lockCategory: (category: string, subCategory: string) =>
      update({ ...lock, category: { category, subCategory } }),
    unlockCategory: () => update({ ...lock, category: null }),
    lockNotes: (notes: RunNotesLock) => update({ ...lock, notes }),
    unlockNotes: () => update({ ...lock, notes: null }),
    endRun: () => update(EMPTY_RUN_LOCK),
  }
}
