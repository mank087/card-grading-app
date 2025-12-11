'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useGradingQueue, GradingStage } from '@/contexts/GradingQueueContext'

const CARD_TYPES_CONFIG = {
  Sports: { apiEndpoint: '/api/sports', route: '/sports' },
  Pokemon: { apiEndpoint: '/api/pokemon', route: '/pokemon' },
  MTG: { apiEndpoint: '/api/mtg', route: '/mtg' },
  Lorcana: { apiEndpoint: '/api/lorcana', route: '/lorcana' },
  Other: { apiEndpoint: '/api/other', route: '/other' }
}

// Progressive backoff: faster polling early, slower as time passes
// This reduces server load while maintaining responsiveness for quick gradings
function getPollingInterval(oldestCardElapsed: number): number {
  if (oldestCardElapsed < 30000) return 3000      // 0-30s: poll every 3s (responsive)
  if (oldestCardElapsed < 60000) return 5000      // 30-60s: poll every 5s
  if (oldestCardElapsed < 120000) return 10000    // 60-120s: poll every 10s
  if (oldestCardElapsed < 300000) return 15000    // 120-300s: poll every 15s
  return 30000                                     // 300s+: poll every 30s (error threshold)
}

// Calculate grading stage based on elapsed time and progress
// This matches the stage timing from the unified status endpoint
function calculateStage(elapsed: number, progress: number): { stage: GradingStage; estimatedTimeRemaining: number | null } {
  // Stage timing (approximate):
  // 0-5s: uploading (0-15%)
  // 5-10s: queued (15-20%)
  // 10-20s: identifying (20-35%)
  // 20-50s: grading (35-80%)
  // 50-55s: calculating (80-95%)
  // 55-90s: saving (95-99%)
  // 90s+: grading (stuck)

  if (progress >= 100) {
    return { stage: 'completed', estimatedTimeRemaining: null }
  }

  if (elapsed < 5000) {
    return { stage: 'uploading', estimatedTimeRemaining: 85 }
  } else if (elapsed < 10000) {
    return { stage: 'queued', estimatedTimeRemaining: 80 }
  } else if (elapsed < 20000) {
    return { stage: 'identifying', estimatedTimeRemaining: 70 }
  } else if (elapsed < 50000) {
    return { stage: 'grading', estimatedTimeRemaining: Math.max(10, Math.ceil((90000 - elapsed) / 1000)) }
  } else if (elapsed < 55000) {
    return { stage: 'calculating', estimatedTimeRemaining: Math.max(5, Math.ceil((90000 - elapsed) / 1000)) }
  } else if (elapsed < 90000) {
    return { stage: 'saving', estimatedTimeRemaining: Math.max(1, Math.ceil((90000 - elapsed) / 1000)) }
  } else {
    // Very long processing - likely stuck but still trying
    return { stage: 'grading', estimatedTimeRemaining: null }
  }
}

export function useBackgroundGrading() {
  const { queue, updateCardStatus } = useGradingQueue()
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const notifiedCardsRef = useRef<Set<string>>(new Set())
  const isPollingRef = useRef(false) // Prevent overlapping polls
  const queueRef = useRef(queue) // Keep latest queue in ref to avoid stale closures
  const hasStartedPollingRef = useRef(false) // Track if we've started polling for current processing cards

  // Update ref whenever queue changes
  queueRef.current = queue

  // Check status of a single card - memoized to avoid recreating on each render
  const checkSingleCardStatus = useCallback(async (card: any) => {
    const config = CARD_TYPES_CONFIG[card.category as keyof typeof CARD_TYPES_CONFIG]
    if (!config) return

    const elapsed = Date.now() - card.uploadedAt

    try {
      // Use status_only mode to check completion without triggering grading lock
      const response = await fetch(`${config.apiEndpoint}/${card.cardId}?status_only=true`)

      // Handle error responses (500, 404, etc.)
      if (!response.ok) {
        console.log(`[BackgroundGrading] ❌ Card ${card.cardId} fetch returned ${response.status}`)

        // If card has been erroring for too long (5 minutes), mark as error
        if (elapsed > 300000) {
          try {
            const errorData = await response.json()
            console.error(`[BackgroundGrading] ⚠️ Card ${card.cardId} failed after ${Math.floor(elapsed/1000)}s:`, errorData.error)
            updateCardStatus(card.id, {
              status: 'error',
              stage: 'error',
              errorMessage: `Grading failed: ${errorData.error || 'Unknown error'}. The card may have complex alterations or damage that require manual review.`
            })
          } catch (e) {
            updateCardStatus(card.id, {
              status: 'error',
              stage: 'error',
              errorMessage: 'Grading failed after multiple attempts. Please try re-uploading the card.'
            })
          }
        }
        return
      }

      const data = await response.json()

      console.log(`[BackgroundGrading] Card ${card.cardId} status:`, {
        status: data.status,
        has_grading: data.has_grading,
        is_processing: data.is_processing,
        elapsed: `${Math.floor(elapsed/1000)}s`
      })

      // Check if there's a grading error stored in the database
      if (data.grading_error) {
        console.error(`[BackgroundGrading] ⚠️ Card ${card.cardId} has grading error: ${data.grading_error}`)
        updateCardStatus(card.id, {
          status: 'error',
          stage: 'error',
          errorMessage: `Grading failed: ${data.grading_error}`
        })
        return
      }

      // Card is complete when status is 'complete' and has_grading is true
      if (data.status === 'complete' && data.has_grading) {
        console.log(`[BackgroundGrading] ✅ Card ${card.cardId} is 100% COMPLETE and ready to view!`)

        updateCardStatus(card.id, {
          status: 'completed',
          stage: 'completed',
          progress: 100,
          completedAt: Date.now(),
          resultUrl: `${config.route}/${card.cardId}`,
          estimatedTimeRemaining: null
        })

        // Show notification only ONCE per card
        if (!notifiedCardsRef.current.has(card.cardId) && 'Notification' in window && Notification.permission === 'granted') {
          notifiedCardsRef.current.add(card.cardId)
          new Notification('Card Grading Complete!', {
            body: `Your ${card.categoryLabel} has been graded and is ready to view.`,
            icon: card.frontImageUrl
          })
        }
      } else if (data.status === 'pending' && !data.is_processing && elapsed > 120000) {
        // Card is stuck: API says 'pending' but we've been waiting over 2 minutes
        // This means grading never started or the processing lock was lost
        console.error(`[BackgroundGrading] ⚠️ Card ${card.cardId} stuck in pending state after ${Math.floor(elapsed/1000)}s`)
        updateCardStatus(card.id, {
          status: 'error',
          stage: 'error',
          errorMessage: 'Grading failed to start. Please try re-uploading the card.'
        })
      } else {
        // Still processing, update progress based on elapsed time
        const estimatedTotal = 90000 // 90 seconds base estimate

        let progress: number
        if (elapsed < estimatedTotal) {
          progress = Math.min(Math.floor((elapsed / estimatedTotal) * 100), 95)
        } else {
          const extraTime = elapsed - estimatedTotal
          const extraProgress = Math.min(Math.floor(extraTime / 30000), 3)
          progress = 95 + extraProgress
        }

        // Calculate stage based on elapsed time
        const { stage, estimatedTimeRemaining } = calculateStage(elapsed, progress)

        updateCardStatus(card.id, {
          progress,
          stage,
          estimatedTimeRemaining,
          status: 'processing'
        })
      }
    } catch (error) {
      console.error(`[BackgroundGrading] Error checking card ${card.cardId}:`, error)
      // Don't mark as error immediately, could be temporary network issue
    }
  }, [updateCardStatus])

  useEffect(() => {
    // Clean up notified cards that are no longer in the queue
    const currentCardIds = new Set(queue.map(c => c.cardId))
    notifiedCardsRef.current.forEach(cardId => {
      if (!currentCardIds.has(cardId)) {
        notifiedCardsRef.current.delete(cardId)
      }
    })
  }, [queue])

  // Create a stable key that only changes when the SET of processing card IDs changes
  // This prevents re-triggering the polling effect when only progress/stage updates
  const processingCardIdsKey = useMemo(() => {
    return queue
      .filter(c => c.status === 'processing')
      .map(c => c.cardId)
      .sort()
      .join(',')
  }, [queue])

  // Track the previous key to detect when it actually changes
  const previousKeyRef = useRef<string>('')

  // Separate effect for polling - only triggers when processing cards list changes
  // This prevents the infinite loop caused by updateCardStatus triggering re-renders
  useEffect(() => {
    // If no processing cards, stop polling
    if (!processingCardIdsKey) {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      isPollingRef.current = false
      hasStartedPollingRef.current = false
      previousKeyRef.current = ''
      return
    }

    // Check if the key actually changed (new card added or removed)
    const keyChanged = processingCardIdsKey !== previousKeyRef.current

    // If already polling for the EXACT SAME cards, don't restart
    // But if key changed (new card added), we need to restart polling
    if (hasStartedPollingRef.current && pollingTimeoutRef.current && !keyChanged) {
      return
    }

    // Key changed - reset polling state and restart
    if (keyChanged) {
      console.log(`[BackgroundGrading] Processing cards changed: "${previousKeyRef.current}" -> "${processingCardIdsKey}"`)
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      previousKeyRef.current = processingCardIdsKey
    }

    hasStartedPollingRef.current = true

    // Main polling function with parallel status checks
    const pollAllCards = async () => {
      // Prevent overlapping polls
      if (isPollingRef.current) return
      isPollingRef.current = true

      // Get current processing cards from ref (always fresh)
      const currentProcessingCards = queueRef.current.filter(c => c.status === 'processing')

      if (currentProcessingCards.length === 0) {
        console.log('[BackgroundGrading] All cards complete, stopping polling')
        pollingTimeoutRef.current = null
        isPollingRef.current = false
        hasStartedPollingRef.current = false
        return
      }

      try {
        // Check all processing cards in PARALLEL (not sequential)
        await Promise.all(currentProcessingCards.map(card => checkSingleCardStatus(card)))
      } finally {
        isPollingRef.current = false
      }

      // Re-check processing cards using ref to get LATEST queue state
      const stillProcessing = queueRef.current.filter(c => c.status === 'processing')

      if (stillProcessing.length === 0) {
        console.log('[BackgroundGrading] All cards complete, stopping polling')
        pollingTimeoutRef.current = null
        hasStartedPollingRef.current = false
        return
      }

      // Calculate next polling interval based on oldest card's elapsed time
      const oldestCardElapsed = Math.max(...stillProcessing.map(c => Date.now() - c.uploadedAt))
      const nextInterval = getPollingInterval(oldestCardElapsed)

      console.log(`[BackgroundGrading] Next poll in ${nextInterval/1000}s (oldest card: ${Math.floor(oldestCardElapsed/1000)}s, ${stillProcessing.length} cards processing)`)

      // Schedule next poll with dynamic interval
      pollingTimeoutRef.current = setTimeout(pollAllCards, nextInterval)
    }

    // Start polling immediately
    pollAllCards()

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      isPollingRef.current = false
      hasStartedPollingRef.current = false
    }
  }, [processingCardIdsKey, checkSingleCardStatus])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])
}
