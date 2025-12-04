'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGradingQueue } from '@/contexts/GradingQueueContext'

const CARD_TYPES_CONFIG = {
  Sports: { route: '/sports' },
  Pokemon: { route: '/pokemon' },
  MTG: { route: '/mtg' },
  Lorcana: { route: '/lorcana' },
  Other: { route: '/other' }
}

interface CardAnalysisAnimationProps {
  frontImageUrl: string
  cardName?: string
  cardId?: string
  category?: string
  allowNavigation?: boolean
  onGradeAnother?: () => void
}

export default function PokemonCardAnalysisAnimation({ frontImageUrl, cardName, cardId, category, allowNavigation = true, onGradeAnother }: CardAnalysisAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()
  const { queue } = useGradingQueue()

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  // Progress through steps over time
  useEffect(() => {
    const stepDuration = 15000 // 15 seconds per step
    const interval = setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, 4)) // Max 5 steps (0-4)
    }, stepDuration)

    return () => clearInterval(interval)
  }, [])

  // Auto-redirect when the uploaded card completes grading
  useEffect(() => {
    if (!cardId || !category) return

    // Find the card in the queue
    const queueCard = queue.find(c => c.cardId === cardId)

    if (queueCard && queueCard.status === 'completed' && queueCard.resultUrl) {
      console.log('[PokemonCardAnalysisAnimation] Card grading completed! Auto-redirecting to:', queueCard.resultUrl)

      // Redirect immediately for faster UX
      router.push(queueCard.resultUrl!)
    }
  }, [queue, cardId, category, router])

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-red-900 via-yellow-900 to-blue-900">
      <div className="text-center max-w-md mx-auto p-6">
        {/* Navigation Message and Buttons - TOP */}
        {allowNavigation && (
          <div className="mb-6">
            <p className="text-sm text-gray-300 mb-4">
              Card grading in process, this may take 1-2 minutes. You may grade another card or view your collection while the card processes.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  console.log('[PokemonCardAnalysisAnimation] Grade Another clicked')
                  if (onGradeAnother) {
                    onGradeAnother()
                  } else {
                    router.push('/upload')
                  }
                }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg flex items-center justify-center gap-1.5 text-sm cursor-pointer"
              >
                <span className="text-lg">📸</span>
                <span>Grade Another</span>
              </button>

              <button
                onClick={() => {
                  console.log('[PokemonCardAnalysisAnimation] My Collection clicked')
                  router.push('/collection')
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 text-sm cursor-pointer"
              >
                <span className="text-lg">📚</span>
                <span>My Collection</span>
              </button>
            </div>
          </div>
        )}

        {/* Animated Card Container */}
        <div className="relative w-72 h-96 mx-auto mb-8 overflow-hidden rounded-lg shadow-2xl">
          {/* Card Border with Glow */}
          <div
            className="absolute inset-0 rounded-lg animate-pulse"
            style={{
              border: '3px solid #ffcc00',
              boxShadow: '0 0 20px rgba(255,204,0,0.5), inset 0 0 20px rgba(255,204,0,0.1)'
            }}
          />

          {/* Card Image */}
          <img
            src={frontImageUrl}
            alt="Card being analyzed"
            className="w-full h-full object-cover rounded-lg"
          />

          {/* Radar Sweep Effect */}
          <div
            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] rounded-full pointer-events-none"
            style={{
              background: 'conic-gradient(rgba(255,204,0,0.3) 0deg, rgba(255,204,0,0) 60deg, rgba(255,204,0,0) 360deg)',
              animation: 'spin 4s linear infinite'
            }}
          />

          {/* X-ray Scanning Bar */}
          <div
            className="absolute left-0 w-full h-1/2 pointer-events-none"
            style={{
              background: 'linear-gradient(rgba(255, 50, 50, 0.2), rgba(255, 50, 50, 0.6), rgba(255, 50, 50, 0.2))',
              animation: 'scan 3s linear infinite'
            }}
          />

          {/* Corner Detection Points */}
          <div className="absolute top-2 left-2 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-2 left-2 w-3 h-3 bg-red-500 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-ping" style={{ animationDelay: '1.5s' }} />

          {/* Center Point */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full animate-bounce" />
        </div>

        {/* Analysis Status */}
        <div className="text-white">
          <h2 className="text-2xl font-bold mb-2 text-yellow-400">
            ⚡ Analyzing {cardName || 'Pokemon Card'}
          </h2>

          {/* Progress Steps */}
          <div className="space-y-3 mb-6">
            {[
              'Detecting card boundaries',
              'Measuring centering ratios',
              'Evaluating corners & edges',
              'Assessing surface condition',
              'Generating final grade'
            ].map((step, index) => {
              const isComplete = index < currentStep
              const isCurrent = index === currentStep
              const isPending = index > currentStep

              return (
                <div key={index} className={`flex items-center justify-between text-sm transition-opacity duration-500 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                  <span className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      isComplete ? 'bg-yellow-500' :
                      isCurrent ? 'bg-red-500 animate-pulse' :
                      'bg-gray-500'
                    }`} />
                    {step}
                  </span>
                  <span className={
                    isComplete ? 'text-yellow-400' :
                    isCurrent ? 'text-red-400' :
                    'text-gray-400'
                  }>
                    {isComplete ? '✓' : isCurrent ? '⟳' : '⏳'}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-300">
              <strong>DCM Optic™ Analysis</strong>
              <br />
              Advanced algorithms examining every detail of your Pokemon card
            </p>
          </div>

          <p className="text-xs text-gray-400">
            Professional grading in progress
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { top: -100%; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  )
}
