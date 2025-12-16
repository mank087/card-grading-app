'use client'

import { useState } from 'react'
import { useGradingQueue, GradingStage } from '@/contexts/GradingQueueContext'
import { useRouter } from 'next/navigation'

// Stage labels with DCM Optic™ branding
const STAGE_CONFIG: Record<GradingStage, { label: string; shortLabel: string; color: string }> = {
  uploading: { label: 'Uploading', shortLabel: 'Upload', color: 'bg-blue-400' },
  queued: { label: 'Queued', shortLabel: 'Queue', color: 'bg-yellow-400' },
  identifying: { label: 'Identifying', shortLabel: 'ID', color: 'bg-orange-400' },
  grading: { label: 'DCM Optic™ Analyzing', shortLabel: 'DCM Optic™', color: 'bg-purple-400' },
  calculating: { label: 'Calculating Grade', shortLabel: 'Calculate', color: 'bg-indigo-400' },
  saving: { label: 'Saving Results', shortLabel: 'Save', color: 'bg-cyan-400' },
  completed: { label: 'Complete', shortLabel: 'Done', color: 'bg-green-400' },
  error: { label: 'Error', shortLabel: 'Error', color: 'bg-red-400' },
}

// Get stage-specific status message
function getStageMessage(stage: GradingStage, cardName?: string): string {
  switch (stage) {
    case 'uploading':
      return 'Uploading images...'
    case 'queued':
      return 'In queue, starting soon...'
    case 'identifying':
      return cardName ? `Identifying: ${cardName}` : 'Identifying card...'
    case 'grading':
      return 'DCM Optic™ analyzing condition...'
    case 'calculating':
      return 'Computing final grade...'
    case 'saving':
      return 'Saving results...'
    case 'completed':
      return 'Grading complete!'
    case 'error':
      return 'Card may need extra time. Check My Collection or contact admin@dcmgrading.com'
    default:
      return STAGE_CONFIG[stage]?.label || 'Processing...'
  }
}

// Note: Polling has been consolidated into useBackgroundGrading hook
// This component now reads directly from the GradingQueueContext
// which is updated by the background hook with stage, progress, and estimatedTimeRemaining

export default function PersistentStatusBar() {
  const { queue, removeFromQueue, clearCompleted } = useGradingQueue()
  const [isExpanded, setIsExpanded] = useState(false)
  const router = useRouter()

  // Note: Status updates now come from useBackgroundGrading hook in ClientLayout
  // No polling needed here - we just read from the queue context

  // Filter out completed cards older than 5 minutes
  const activeQueue = queue.filter(card => {
    if (card.status === 'completed' && card.completedAt) {
      return Date.now() - card.completedAt < 5 * 60 * 1000 // 5 minutes
    }
    return true
  })

  // Get the first processing card for the collapsed view
  const firstProcessingCard = activeQueue.find(c => c.status === 'processing' || c.status === 'uploading')
  const isAnyProcessing = !!firstProcessingCard

  // Use the API-polled progress value (unified source of truth)
  const displayProgress = firstProcessingCard?.progress ?? 0

  if (activeQueue.length === 0) return null

  const processingCount = activeQueue.filter(c => c.status === 'processing' || c.status === 'uploading').length
  const completedCount = activeQueue.filter(c => c.status === 'completed').length
  const errorCount = activeQueue.filter(c => c.status === 'error').length

  return (
    <div className="sticky top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
      {/* Collapsed View */}
      <div
        className="cursor-pointer hover:bg-black/10 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Progress bar for collapsed view - uses API-polled progress */}
        {isAnyProcessing && (
          <div className="h-1 bg-black/20">
            <div
              className="h-full bg-green-400 transition-all duration-700 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        )}

        <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {processingCount > 0 && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                firstProcessingCard?.stage
                  ? STAGE_CONFIG[firstProcessingCard.stage].color
                  : 'bg-green-400'
              }`} />
              <span className="text-sm font-medium">
                {processingCount === 1 && firstProcessingCard?.stage
                  ? `${STAGE_CONFIG[firstProcessingCard.stage].label}... ${Math.round(displayProgress)}%`
                  : `${processingCount} card${processingCount > 1 ? 's' : ''} grading... ${Math.round(displayProgress)}%`
                }
              </span>
            </div>
          )}

          {completedCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-sm font-medium">
                {completedCount} ready
              </span>
            </div>
          )}

          {errorCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <span className="text-sm font-medium">
                {errorCount} failed
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearCompleted()
              }}
              className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
            >
              Clear {completedCount}
            </button>
          )}
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-white/20 bg-black/10 max-h-96 overflow-y-auto">
          {activeQueue.map(card => (
            <div
              key={card.id}
              className="px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Card thumbnail */}
                <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {card.frontImageUrl && !card.frontImageUrl.startsWith('blob:') ? (
                    <img
                      src={card.frontImageUrl}
                      alt="Card"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Hide broken image, show fallback
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="text-white/40 text-xs text-center">
                      <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold truncate">
                      {card.cardName || card.categoryLabel}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      card.stage === 'error' ? 'bg-red-400/20 text-red-200' :
                      card.stage === 'completed' ? 'bg-green-400/20 text-green-200' :
                      `${STAGE_CONFIG[card.stage || 'uploading'].color}/20 text-white`
                    }`}>
                      {STAGE_CONFIG[card.stage || 'uploading'].shortLabel}
                    </span>
                  </div>

                  {/* Progress bar for processing cards */}
                  {(card.status === 'uploading' || card.status === 'processing') && (
                    <div className="w-full bg-white/20 rounded-full h-1.5 mb-1">
                      <div
                        className="bg-green-400 h-1.5 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${card.progress}%` }}
                      />
                    </div>
                  )}

                  <p className="text-xs text-white/70">
                    {card.status === 'error'
                      ? (card.errorMessage || 'Card may need extra time. Check My Collection or contact admin@dcmgrading.com')
                      : getStageMessage(card.stage || 'uploading', card.cardName)}
                    {card.estimatedTimeRemaining && card.status !== 'completed' && card.status !== 'error' && (
                      <span className="ml-2 text-white/50">~{card.estimatedTimeRemaining}s remaining</span>
                    )}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {card.status === 'completed' && card.resultUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation() // Prevent triggering expand/collapse
                        console.log('[StatusBar] Navigating to:', card.resultUrl)
                        router.push(card.resultUrl!)
                      }}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded font-medium transition-colors"
                    >
                      View
                    </button>
                  )}

                  {(card.status === 'completed' || card.status === 'error') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation() // Prevent triggering expand/collapse
                        removeFromQueue(card.id)
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
