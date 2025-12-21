'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface HeroGradingAnimationProps {
  rawCardImage: string
  cardName?: string
  cardDetails?: string
  cardNumber?: string
  grade?: number
}

export default function HeroGradingAnimation({
  rawCardImage,
  cardName = "Mega Charizard X EX",
  cardDetails = "Phantasmal Flames • #125/94 • 2025",
  cardNumber = "899391",
  grade = 10
}: HeroGradingAnimationProps) {
  const [phase, setPhase] = useState<'analyzing' | 'transitioning' | 'complete'>('analyzing')
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    'Detecting card boundaries',
    'Measuring centering ratios',
    'Evaluating corners & edges',
    'Assessing surface condition',
    'Generating final grade'
  ]

  const getGradeLabel = (g: number) => {
    if (g === 10) return 'GEM MINT'
    if (g === 9) return 'MINT'
    if (g === 8) return 'NM-MT'
    if (g === 7) return 'NM'
    return 'EX'
  }

  // Animation cycle
  useEffect(() => {
    const runCycle = () => {
      // Reset to analyzing phase
      setPhase('analyzing')
      setCurrentStep(0)

      // Progress through steps
      const stepInterval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= steps.length - 1) {
            clearInterval(stepInterval)
            // Transition to complete after last step
            setTimeout(() => {
              setPhase('transitioning')
              setTimeout(() => {
                setPhase('complete')
              }, 400)
            }, 600)
            return prev
          }
          return prev + 1
        })
      }, 1000) // 1 second per step

      return stepInterval
    }

    let stepInterval = runCycle()

    // Restart cycle every 12 seconds
    const cycleInterval = setInterval(() => {
      clearInterval(stepInterval)
      stepInterval = runCycle()
    }, 12000)

    return () => {
      clearInterval(stepInterval)
      clearInterval(cycleInterval)
    }
  }, [])

  return (
    <div className="relative min-h-[520px]">
      {/* Analyzing Phase */}
      <div
        className={`transition-all duration-500 ${
          phase === 'analyzing' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0'
        }`}
      >
        {/* Animated Card Container */}
        <div className="relative w-56 h-72 sm:w-64 sm:h-80 mx-auto overflow-hidden rounded-xl shadow-2xl">
          {/* Card Border with Glow */}
          <div
            className="absolute inset-0 rounded-xl animate-pulse z-10 pointer-events-none"
            style={{
              border: '3px solid #a855f7',
              boxShadow: '0 0 30px rgba(168,85,247,0.6), inset 0 0 30px rgba(168,85,247,0.15)'
            }}
          />

          {/* Card Image */}
          <Image
            src={rawCardImage}
            alt="Card being analyzed"
            fill
            className="object-cover rounded-xl"
          />

          {/* Radar Sweep Effect */}
          <div
            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] rounded-full pointer-events-none z-20"
            style={{
              background: 'conic-gradient(rgba(168,85,247,0.4) 0deg, rgba(168,85,247,0) 60deg, rgba(168,85,247,0) 360deg)',
              animation: 'heroSpin 3s linear infinite'
            }}
          />

          {/* X-ray Scanning Bar */}
          <div
            className="absolute left-0 w-full h-1/3 pointer-events-none z-20"
            style={{
              background: 'linear-gradient(rgba(249, 115, 22, 0.1), rgba(249, 115, 22, 0.5), rgba(249, 115, 22, 0.1))',
              animation: 'heroScan 2.5s linear infinite'
            }}
          />

          {/* Corner Detection Points */}
          <div className="absolute top-3 left-3 w-3 h-3 bg-orange-500 rounded-full animate-ping z-30" />
          <div className="absolute top-3 right-3 w-3 h-3 bg-orange-500 rounded-full animate-ping z-30" style={{ animationDelay: '0.3s' }} />
          <div className="absolute bottom-3 left-3 w-3 h-3 bg-orange-500 rounded-full animate-ping z-30" style={{ animationDelay: '0.6s' }} />
          <div className="absolute bottom-3 right-3 w-3 h-3 bg-orange-500 rounded-full animate-ping z-30" style={{ animationDelay: '0.9s' }} />

          {/* Center Crosshair */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-8 h-8 border-2 border-yellow-400 rounded-full animate-pulse" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 rounded-full" />
          </div>
        </div>

        {/* Analysis Steps */}
        <div className="mt-6 space-y-2 max-w-xs mx-auto">
          {steps.map((step, index) => {
            const isComplete = index < currentStep
            const isCurrent = index === currentStep
            const isPending = index > currentStep

            return (
              <div
                key={index}
                className={`flex items-center justify-between text-xs transition-all duration-300 px-3 py-1.5 rounded-lg ${
                  isCurrent ? 'bg-purple-500/20' : ''
                } ${isPending ? 'opacity-40' : 'opacity-100'}`}
              >
                <span className="flex items-center text-white">
                  <div className={`w-2 h-2 rounded-full mr-3 ${
                    isComplete ? 'bg-purple-500' :
                    isCurrent ? 'bg-yellow-400 animate-pulse' :
                    'bg-gray-600'
                  }`} />
                  {step}
                </span>
                <span className={`text-xs ${
                  isComplete ? 'text-purple-400' :
                  isCurrent ? 'text-yellow-400' :
                  'text-gray-500'
                }`}>
                  {isComplete ? '✓' : isCurrent ? '...' : ''}
                </span>
              </div>
            )
          })}
        </div>

        {/* DCM Optic Badge */}
        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-2 bg-purple-900/40 border border-purple-500/30 px-3 py-1.5 rounded-full text-xs text-purple-300">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
            DCM Optic™ Analysis
          </span>
        </div>
      </div>

      {/* Complete Phase - Graded Card with Label */}
      <div
        className={`transition-all duration-700 ${
          phase === 'complete' ? 'opacity-100 scale-100' : 'opacity-0 scale-105 absolute inset-0 pointer-events-none'
        }`}
      >
        <div className="relative mx-auto" style={{ maxWidth: '280px' }}>
          {/* Celebration glow */}
          <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/30 via-indigo-500/30 to-purple-500/30 rounded-3xl blur-xl animate-pulse" />

          {/* Purple metallic slab border */}
          <div
            className="relative rounded-xl p-1 shadow-xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #9333ea 0%, #6b21a8 25%, #a855f7 50%, #7c3aed 75%, #581c87 100%)',
              boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)',
            }}
          >
            {/* Inner white container */}
            <div className="bg-white rounded-lg overflow-hidden">
              {/* DCM Label - Above card */}
              <div className="p-3">
                <div className="flex items-start gap-3">
                  {/* DCM Logo */}
                  <div className="flex-shrink-0 w-12 h-12">
                    <Image
                      src="/DCM-logo.png"
                      alt="DCM"
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Card Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-bold text-[10px] leading-tight">{cardName}</h3>
                    <p className="text-gray-600 text-[10px] leading-tight mt-0.5 line-clamp-2">{cardDetails}</p>
                    <p className="text-gray-400 text-[9px] mt-0.5">{cardNumber}</p>
                  </div>

                  {/* Grade */}
                  <div className="flex-shrink-0 text-center">
                    <div className="text-3xl font-bold text-purple-600 leading-none">{grade}</div>
                    <div className="text-[10px] font-semibold text-purple-600 uppercase">{getGradeLabel(grade)}</div>
                  </div>
                </div>
              </div>

              {/* Purple Separator - mimics slab divider */}
              <div
                className="h-1"
                style={{
                  background: 'linear-gradient(90deg, #9333ea 0%, #a855f7 50%, #9333ea 100%)',
                }}
              />

              {/* Card Image */}
              <div className="relative" style={{ aspectRatio: '2.5/3.5' }}>
                <Image
                  src={rawCardImage}
                  alt="Graded card"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Success message */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/40 px-4 py-2 rounded-full">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-purple-300 font-semibold text-sm">Grade Complete!</span>
          </div>
          <p className="mt-2 text-gray-400 text-xs">{getGradeLabel(grade)} {grade} • Ready to download</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes heroScan {
          0% { top: -33%; }
          100% { top: 100%; }
        }
        @keyframes heroSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
