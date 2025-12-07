'use client'

import { useState, useEffect, useMemo } from 'react'
import { useGradingQueue } from '@/contexts/GradingQueueContext'
import { useRouter } from 'next/navigation'

// Average grading time based on typical processing (45-60 seconds)
const ESTIMATED_GRADING_TIME = 55000 // 55 seconds - cards typically complete around this time

function useAnimatedProgress(uploadedAt: number, isProcessing: boolean, isCompleted: boolean): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isProcessing || isCompleted) {
      if (isCompleted) setProgress(100)
      return
    }

    // Calculate initial progress
    const elapsed = Date.now() - uploadedAt
    const initialProgress = Math.min(Math.floor((elapsed / ESTIMATED_GRADING_TIME) * 95), 95)
    setProgress(initialProgress)

    // Update progress every 500ms for smooth animation
    const interval = setInterval(() => {
      const currentElapsed = Date.now() - uploadedAt
      let newProgress: number

      if (currentElapsed < ESTIMATED_GRADING_TIME) {
        // Normal progress: 0-95% over estimated time
        newProgress = Math.min(Math.floor((currentElapsed / ESTIMATED_GRADING_TIME) * 95), 95)
      } else {
        // Extended processing: slowly inch towards 98%
        const extraTime = currentElapsed - ESTIMATED_GRADING_TIME
        const extraProgress = Math.min(extraTime / 30000, 3) // +1% every 30 seconds, max +3%
        newProgress = Math.min(95 + extraProgress, 98)
      }

      setProgress(newProgress)
    }, 500)

    return () => clearInterval(interval)
  }, [uploadedAt, isProcessing, isCompleted])

  return progress
}

// Separate component for expanded view progress to use the hook properly
function ExpandedCardProgress({ uploadedAt }: { uploadedAt: number }) {
  const progress = useAnimatedProgress(uploadedAt, true, false)
  return (
    <div className="w-full bg-white/20 rounded-full h-1.5 mb-1">
      <div
        className="bg-green-400 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default function PersistentStatusBar() {
  const { queue, removeFromQueue, clearCompleted } = useGradingQueue()
  const [isExpanded, setIsExpanded] = useState(false)
  const router = useRouter()

  // Filter out completed cards older than 5 minutes
  const activeQueue = queue.filter(card => {
    if (card.status === 'completed' && card.completedAt) {
      return Date.now() - card.completedAt < 5 * 60 * 1000 // 5 minutes
    }
    return true
  })

  // Get the first processing card for the collapsed view progress bar
  const firstProcessingCard = activeQueue.find(c => c.status === 'processing' || c.status === 'uploading')
  const isAnyProcessing = !!firstProcessingCard
  const collapsedProgress = useAnimatedProgress(
    firstProcessingCard?.uploadedAt || 0,
    isAnyProcessing,
    false // Never pass completed - we hide the bar instead
  )

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
        {/* Green progress bar for collapsed view - only show when actively processing */}
        {isAnyProcessing && (
          <div className="h-1 bg-black/20">
            <div
              className="h-full bg-green-400 transition-all duration-500 ease-out"
              style={{ width: `${collapsedProgress}%` }}
            />
          </div>
        )}

        <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {processingCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                {processingCount} card{processingCount > 1 ? 's' : ''} grading... {Math.round(collapsedProgress)}%
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
                      {card.categoryLabel}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      card.status === 'uploading' ? 'bg-blue-400/20 text-blue-200' :
                      card.status === 'processing' ? 'bg-yellow-400/20 text-yellow-200' :
                      card.status === 'completed' ? 'bg-green-400/20 text-green-200' :
                      'bg-red-400/20 text-red-200'
                    }`}>
                      {card.status === 'uploading' ? 'Uploading' :
                       card.status === 'processing' ? 'Processing' :
                       card.status === 'completed' ? 'Ready' :
                       'Error'}
                    </span>
                  </div>

                  {/* Progress bar for processing cards */}
                  {(card.status === 'uploading' || card.status === 'processing') && (
                    <ExpandedCardProgress uploadedAt={card.uploadedAt} />
                  )}

                  <p className="text-xs text-white/70">
                    {card.status === 'uploading' && 'Evaluating Card with DCM Optic™'}
                    {card.status === 'processing' && 'Evaluating Card with DCM Optic™'}
                    {card.status === 'completed' && 'Grading complete!'}
                    {card.status === 'error' && (card.errorMessage || 'Failed to process')}
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
