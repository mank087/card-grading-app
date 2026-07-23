import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useGradingQueue, calculateStage } from '@/contexts/GradingQueueContext'
import { supabase, hasActiveSession } from '@/lib/supabase'
import { isUuid } from '@/lib/uuid'

const POLL_INTERVAL_MS = 4_000

/**
 * Polls Supabase for any in-progress grading jobs in the queue. Updates each
 * card's stage / progress based on elapsed time and switches to "completed"
 * once `conversational_whole_grade` is set on the card row.
 *
 * Mirrors the spirit of the web's useBackgroundGrading hook but reads
 * directly from Supabase (RLS lets users read their own card row) instead of
 * hitting category-specific API routes.
 */
export function useGradingPoller() {
  const { queue, updateCardStatus } = useGradingQueue()
  const queueRef = useRef(queue)
  queueRef.current = queue

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const tick = async () => {
      const allInFlight = queueRef.current.filter(c => c.status === 'processing' || c.status === 'uploading')
      if (allInFlight.length === 0) return

      // Entries with a missing/corrupt cardId can never resolve — fail them
      // instead of poisoning the .in() filter with "null" (Postgres 22P02).
      const inFlight = allInFlight.filter(c => isUuid(c.cardId))
      for (const bad of allInFlight) {
        if (!isUuid(bad.cardId)) {
          updateCardStatus(bad.id, {
            status: 'error',
            stage: 'error',
            errorMessage: 'This upload is corrupted. Please re-upload the card.',
          })
        }
      }
      if (inFlight.length === 0) return

      // `cards` denies anon (RLS, no anon grant). Skip this tick if no
      // signed-in session is attached yet — querying would 42501.
      if (!(await hasActiveSession())) return

      const ids = inFlight.map(c => c.cardId)
      try {
        const { data } = await supabase
          .from('cards')
          .select('id, conversational_whole_grade, conversational_condition_label, category')
          .in('id', ids)
        const byId = new Map<string, any>()
        ;(data || []).forEach(r => byId.set(r.id, r))

        const now = Date.now()
        for (const card of inFlight) {
          if (cancelled) return
          const row = byId.get(card.cardId)
          const elapsed = now - card.uploadedAt

          if (row?.conversational_whole_grade != null) {
            updateCardStatus(card.id, {
              status: 'completed',
              stage: 'completed',
              progress: 100,
              completedAt: now,
              resultPath: `/card/${card.cardId}`,
              cardName: card.cardName || row.category,
            })
            continue
          }

          // No grade yet — derive stage/progress from elapsed time
          const { stage, progress, estimatedTimeRemaining } = calculateStage(elapsed)
          if (stage === 'error') {
            updateCardStatus(card.id, {
              status: 'error',
              stage: 'error',
              errorMessage: 'Grading is taking unusually long. Check My Collection in a few minutes.',
            })
          } else {
            updateCardStatus(card.id, {
              status: 'processing',
              stage,
              progress: Math.round(progress),
              estimatedTimeRemaining,
            })
          }
        }
      } catch (err) {
        console.warn('[useGradingPoller] poll error:', err)
      }
    }

    // Pause polling when the app is backgrounded. Apple App Review rejects
    // apps that perform unnecessary network activity in the background, and
    // it drains battery on Android too. Resume immediately on foreground.
    const startPolling = () => {
      if (timer) return
      tick()
      timer = setInterval(tick, POLL_INTERVAL_MS)
    }
    const stopPolling = () => {
      if (timer) { clearInterval(timer); timer = null }
    }

    // Initial state — only poll if app is active.
    if (AppState.currentState === 'active') startPolling()

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') startPolling()
      else stopPolling() // 'background' or 'inactive'
    })

    return () => { cancelled = true; stopPolling(); sub.remove() }
  }, [updateCardStatus])
}
