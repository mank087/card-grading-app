'use client'

import { useState } from 'react'
import { useGradingQueue } from '@/contexts/GradingQueueContext'
import { useRouter } from 'next/navigation'

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

  if (activeQueue.length === 0) return null

  const processingCount = activeQueue.filter(c => c.status === 'processing' || c.status === 'uploading').length
  const completedCount = activeQueue.filter(c => c.status === 'completed').length
  const errorCount = activeQueue.filter(c => c.status === 'error').length

  return (
    <div className="sticky top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
      {/* Collapsed View */}
      <div
        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-black/10 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {processingCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                {processingCount} card{processingCount > 1 ? 's' : ''} grading...
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
                <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={card.frontImageUrl}
                    alt="Card"
                    className="w-full h-full object-cover"
                  />
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
                    <div className="w-full bg-white/20 rounded-full h-1.5 mb-1">
                      <div
                        className="bg-white h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${card.progress}%` }}
                      />
                    </div>
                  )}

                  <p className="text-xs text-white/70">
                    {card.status === 'uploading' && 'Uploading images...'}
                    {card.status === 'processing' && 'Analyzing card...'}
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
