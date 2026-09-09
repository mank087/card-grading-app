import { useEffect, useRef } from 'react'
import { useGradingQueue, calculateStage } from '@/contexts/GradingQueueContext'
import { isUuid } from '@/lib/uuid'
import {
  watchGradingJob,
  deriveJobState,
  GradingObservation,
} from '@/lib/gradingJob'

/**
 * Keeps the global grading queue (and therefore the top status bar) in sync
 * with the backend.
 *
 * Polling itself now lives in `lib/gradingJob.ts`: one shared interval and one
 * batched Supabase query serve this hook AND the full-screen processing view,
 * so the two can never disagree about whether a job failed and we never run
 * two timers against the same rows. The shared registry also pauses while the
 * app is backgrounded and re-polls once on foreground.
 */
export function useGradingPoller() {
  const { queue, updateCardStatus } = useGradingQueue()

  // Keep the callback stable for the subscription effect below.
  const updateRef = useRef(updateCardStatus)
  updateRef.current = updateCardStatus

  // Map cardId -> queue entry, so an observation can be routed back.
  const entriesRef = useRef(new Map<string, { entryId: string; uploadedAt: number; cardName?: string }>())
  entriesRef.current = new Map(
    queue
      .filter(c => c.status === 'processing' || c.status === 'uploading')
      .map(c => [c.cardId, { entryId: c.id, uploadedAt: c.uploadedAt, cardName: c.cardName }]),
  )

  // Entries with a missing/corrupt cardId can never resolve — fail them
  // instead of poisoning the .in() filter with "null" (Postgres 22P02).
  useEffect(() => {
    for (const card of queue) {
      if ((card.status === 'processing' || card.status === 'uploading') && !isUuid(card.cardId)) {
        updateRef.current(card.id, {
          status: 'error',
          stage: 'error',
          errorMessage: 'This upload is corrupted. Please re-upload the card.',
        })
      }
    }
  }, [queue])

  // Subscribe to the shared poller for every in-flight card.
  const watchKey = queue
    .filter(c => (c.status === 'processing' || c.status === 'uploading') && isUuid(c.cardId))
    .map(c => c.cardId)
    .sort()
    .join(',')

  useEffect(() => {
    if (!watchKey) return
    const cardIds = watchKey.split(',')

    const onObservation = (obs: GradingObservation) => {
      const entry = entriesRef.current.get(obs.cardId)
      if (!entry) return
      const state = deriveJobState({ uploadedAt: entry.uploadedAt, observation: obs })

      if (state === 'completed') {
        updateRef.current(entry.entryId, {
          status: 'completed',
          stage: 'completed',
          progress: 100,
          completedAt: Date.now(),
          resultPath: `/card/${obs.cardId}`,
          cardName: entry.cardName || obs.category || undefined,
        })
        return
      }

      if (state === 'failed') {
        updateRef.current(entry.entryId, {
          status: 'error',
          stage: 'error',
          errorMessage: obs.backendFailed
            ? 'Grading failed. Your credit is refunded if it was charged — try again.'
            : 'Grading is taking unusually long. Check My Collection in a few minutes.',
        })
        return
      }

      // Still running: keep the illustrative stage/progress ladder for the
      // status bar, but it is time-derived, never a confirmed backend step.
      const { stage, progress, estimatedTimeRemaining } = calculateStage(Date.now() - entry.uploadedAt)
      updateRef.current(entry.entryId, {
        status: 'processing',
        stage: state === 'delayed' ? 'slow' : stage,
        progress: Math.round(progress),
        estimatedTimeRemaining,
      })
    }

    const unsubs = cardIds.map(id => watchGradingJob(id, onObservation))
    return () => unsubs.forEach(fn => fn())
  }, [watchKey])
}
