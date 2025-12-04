'use client'

import { useEffect, useRef } from 'react'
import { useGradingQueue } from '@/contexts/GradingQueueContext'

const CARD_TYPES_CONFIG = {
  Sports: { apiEndpoint: '/api/sports', route: '/sports' },
  Pokemon: { apiEndpoint: '/api/pokemon', route: '/pokemon' },
  MTG: { apiEndpoint: '/api/mtg', route: '/mtg' },
  Lorcana: { apiEndpoint: '/api/lorcana', route: '/lorcana' },
  Other: { apiEndpoint: '/api/other', route: '/other' }
}

export function useBackgroundGrading() {
  const { queue, updateCardStatus } = useGradingQueue()
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const notifiedCardsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Clean up notified cards that are no longer in the queue
    const currentCardIds = new Set(queue.map(c => c.cardId))
    notifiedCardsRef.current.forEach(cardId => {
      if (!currentCardIds.has(cardId)) {
        notifiedCardsRef.current.delete(cardId)
      }
    })

    // Only poll if there are cards being processed
    const processingCards = queue.filter(c => c.status === 'processing' || c.status === 'uploading')

    if (processingCards.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    // Poll every 5 seconds for updates (reduced from 2s to minimize API load)
    const checkCardStatus = async () => {
      for (const card of processingCards) {
        try {
          const config = CARD_TYPES_CONFIG[card.category as keyof typeof CARD_TYPES_CONFIG]
          if (!config) continue

          // Check if card has been processing too long (3 minutes = 180 seconds)
          const elapsed = Date.now() - card.uploadedAt
          const maxProcessingTime = 180000 // 3 minutes

          if (elapsed > maxProcessingTime) {
            console.log(`[BackgroundGrading] ⚠️ Card ${card.cardId} has been processing for ${Math.floor(elapsed/1000)}s (max: 180s) - still checking...`)
          }

          console.log(`[BackgroundGrading] Checking status for card ${card.cardId} (elapsed: ${Math.floor(elapsed/1000)}s)`)
          const response = await fetch(`${config.apiEndpoint}/${card.cardId}`)

          // Handle error responses (500, 404, etc.)
          if (!response.ok) {
            console.log(`[BackgroundGrading] ❌ Card ${card.cardId} fetch returned ${response.status}`)

            // If card has been erroring for too long (5 minutes), mark as error
            if (elapsed > 300000) { // 5 minutes
              try {
                const errorData = await response.json()
                console.error(`[BackgroundGrading] ⚠️ Card ${card.cardId} failed after ${Math.floor(elapsed/1000)}s:`, errorData.error)
                updateCardStatus(card.id, {
                  status: 'error',
                  errorMessage: `Grading failed: ${errorData.error || 'Unknown error'}. The card may have complex alterations or damage that require manual review.`
                })
              } catch (e) {
                updateCardStatus(card.id, {
                  status: 'error',
                  errorMessage: 'Grading failed after multiple attempts. Please try re-uploading the card.'
                })
              }
            }
            continue // Skip to next card
          }

          if (response.ok) {
            const data = await response.json()

            console.log(`[BackgroundGrading] Card ${card.cardId} raw data:`, {
              has_ai_grading: !!data.ai_grading,
              ai_grading_keys: data.ai_grading ? Object.keys(data.ai_grading) : [],
              raw_decimal_grade: data.raw_decimal_grade,
              raw_decimal_grade_type: typeof data.raw_decimal_grade,
              dcm_grade_whole: data.dcm_grade_whole,
              dcm_grade_whole_type: typeof data.dcm_grade_whole,
              grading_status: data.grading_status
            })

            // Check if grading is 100% complete and ready to view
            // Requirements: Either has numeric grades OR has N/A grade with conversational report
            const hasValidNumericGrade = (
              (typeof data.raw_decimal_grade === 'number' && !isNaN(data.raw_decimal_grade)) ||
              (typeof data.dcm_grade_whole === 'number' && !isNaN(data.dcm_grade_whole)) ||
              (typeof data.conversational_decimal_grade === 'number' && !isNaN(data.conversational_decimal_grade)) ||
              (typeof data.conversational_whole_grade === 'number' && !isNaN(data.conversational_whole_grade))
            )

            // Check if card was graded as N/A (alterations, etc.) but has a complete conversational report
            const hasNAGradeWithReport = (
              data.conversational_grading &&
              typeof data.conversational_grading === 'string' &&
              data.conversational_grading.length > 100 // Must have substantial content
            )

            // Card is complete if it has valid numeric grade OR N/A with report
            if (hasValidNumericGrade || hasNAGradeWithReport) {
              // Grading is 100% complete!
              const gradeType = hasValidNumericGrade ? 'with numeric grade' : 'with N/A grade (alteration/damage)'
              console.log(`[BackgroundGrading] ✅ Card ${card.cardId} is 100% COMPLETE and ready to view! (${gradeType})`)

              updateCardStatus(card.id, {
                status: 'completed',
                progress: 100,
                completedAt: Date.now(),
                resultUrl: `${config.route}/${card.cardId}`
              })

              // Show notification only ONCE per card (never notify about the same card twice)
              if (!notifiedCardsRef.current.has(card.cardId) && 'Notification' in window && Notification.permission === 'granted') {
                notifiedCardsRef.current.add(card.cardId)
                new Notification('Card Grading Complete!', {
                  body: `Your ${card.categoryLabel} has been graded and is ready to view.`,
                  icon: card.frontImageUrl
                })
              }
            } else {
              // Still processing, update progress
              const elapsed = Date.now() - card.uploadedAt
              const estimatedTotal = 90000 // 90 seconds base estimate

              // For cards taking longer than expected, show extended progress
              let progress: number
              if (elapsed < estimatedTotal) {
                // Normal progress: 0-95% over first 90 seconds
                progress = Math.min(Math.floor((elapsed / estimatedTotal) * 100), 95)
              } else {
                // Extended processing: stay at 95-98% to show it's still working
                const extraTime = elapsed - estimatedTotal
                const extraProgress = Math.min(Math.floor(extraTime / 30000), 3) // +1% every 30 seconds, max +3%
                progress = 95 + extraProgress
              }

              console.log(`[BackgroundGrading] ⏳ Card ${card.cardId} still processing... (${Math.floor(elapsed/1000)}s, progress: ${progress}%, hasValidNumericGrade: ${hasValidNumericGrade}, hasNAGradeWithReport: ${hasNAGradeWithReport})`)

              updateCardStatus(card.id, {
                progress,
                status: 'processing'
              })
            }
          } else {
            console.log(`[BackgroundGrading] ❌ Card ${card.cardId} fetch returned ${response.status}`)
          }
        } catch (error) {
          console.error('[BackgroundGrading] Error checking card status:', error)
          // Don't mark as error immediately, could be temporary network issue
        }
      }
    }

    // Start polling every 3 seconds (balance between responsiveness and API load)
    pollingIntervalRef.current = setInterval(checkCardStatus, 3000)

    // Check immediately
    checkCardStatus()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [queue, updateCardStatus])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])
}
