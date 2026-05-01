import { useEffect, useRef } from 'react'
import { useGradingQueue, calculateStage } from '@/contexts/GradingQueueContext'
import { supabase } from '@/lib/supabase'

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
      const inFlight = queueRef.current.filter(c => c.status === 'processing' || c.status === 'uploading')
      if (inFlight.length === 0) return

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

    // Run once immediately and then on an interval. The interval persists
    // even when the queue is empty (cheap idle), and tick() bails out fast.
    tick()
    timer = setInterval(tick, POLL_INTERVAL_MS)
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [updateCardStatus])
}
