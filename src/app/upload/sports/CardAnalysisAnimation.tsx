'use client'

import { useEffect, useState } from 'react'

interface CardAnalysisAnimationProps {
  frontImageUrl: string
  cardName?: string
}

export default function CardAnalysisAnimation({ frontImageUrl, cardName }: CardAnalysisAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0)

  // Progress through steps over time
  useEffect(() => {
    const stepDuration = 15000 // 15 seconds per step
    const interval = setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, 4)) // Max 5 steps (0-4)
    }, stepDuration)

    return () => clearInterval(interval)
  }, [])
  return (
    <div className="flex justify-center items-center min-h-screen bg-black">
      <div className="text-center max-w-md mx-auto p-6">
        {/* Animated Card Container */}
        <div className="relative w-72 h-96 mx-auto mb-8 overflow-hidden rounded-lg shadow-2xl">
          {/* Card Border with Glow */}
          <div
            className="absolute inset-0 rounded-lg animate-pulse"
            style={{
              border: '3px solid #00ff00',
              boxShadow: '0 0 20px rgba(0,255,0,0.5), inset 0 0 20px rgba(0,255,0,0.1)'
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
              background: 'conic-gradient(rgba(0,255,0,0.3) 0deg, rgba(0,255,0,0) 60deg, rgba(0,255,0,0) 360deg)',
              animation: 'spin 4s linear infinite'
            }}
          />

          {/* X-ray Scanning Bar */}
          <div
            className="absolute left-0 w-full h-1/2 pointer-events-none"
            style={{
              background: 'linear-gradient(rgba(0, 255, 255, 0.2), rgba(0, 255, 255, 0.6), rgba(0, 255, 255, 0.2))',
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
          <h2 className="text-2xl font-bold mb-2 text-green-400">
            🔍 Analyzing {cardName || 'Sports Card'}
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
                      isComplete ? 'bg-green-500' :
                      isCurrent ? 'bg-yellow-500 animate-pulse' :
                      'bg-gray-500'
                    }`} />
                    {step}
                  </span>
                  <span className={
                    isComplete ? 'text-green-400' :
                    isCurrent ? 'text-yellow-400' :
                    'text-gray-400'
                  }>
                    {isComplete ? '✓' : isCurrent ? '⟳' : '⏳'}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-300">
              🤖 <strong>AI Vision Analysis</strong>
              <br />
              Advanced algorithms examining every detail of your card
            </p>
          </div>

          <p className="text-xs text-gray-400">
            Professional grading in progress • Usually takes 1-2 minutes
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