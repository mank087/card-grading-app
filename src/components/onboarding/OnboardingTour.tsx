'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// Tour step configuration
interface TourStep {
  id: string
  targetId: string // ID of the element to highlight
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

// Define tour steps
const TOUR_STEPS: TourStep[] = [
  {
    id: 'card-images',
    targetId: 'tour-card-images',
    title: 'Your Graded Card Images',
    description: 'Your card has been professionally analyzed! The front and back images now include DCM identification labels and grade information, making it easy to share and verify your card\'s authenticity.',
    position: 'bottom',
  },
  {
    id: 'visibility-toggle',
    targetId: 'tour-visibility-toggle',
    title: 'Privacy & Label Style',
    description: 'Control who can see your card with the Public/Private toggle. You can also switch between Modern and Traditional label styles to match your preference.',
    position: 'bottom',
  },
  {
    id: 'grade-score',
    targetId: 'tour-grade-score',
    title: 'Your DCM Grade',
    description: 'This is your card\'s overall grade on a 1-10 scale. The confidence indicator (A, B, C, or D) shows how certain DCM Optic™ is about the grade based on image quality and card clarity.',
    position: 'bottom',
  },
  {
    id: 'condition-summary',
    targetId: 'tour-condition-summary',
    title: 'Condition Summary',
    description: 'A detailed written analysis of your card\'s overall condition, highlighting key observations about centering, corners, edges, and surface quality.',
    position: 'top',
  },
  {
    id: 'download-buttons',
    targetId: 'tour-download-buttons',
    title: 'Download Reports & Labels',
    description: 'Download your official DCM grading report as a PDF, or get printable labels for your card holders. You can also download images of your cards with their graded labels included!',
    position: 'top',
  },
  {
    id: 'card-info',
    targetId: 'tour-card-info',
    title: 'Card Information',
    description: 'DCM Optic™ has identified your card\'s details including the player/character, set name, card number, and more. This information is used for market pricing and eBay listings.',
    position: 'top',
  },
  {
    id: 'edit-details',
    targetId: 'tour-edit-details',
    title: 'Edit Card Details',
    description: 'Sometimes our system can misidentify cards. Use this button to correct any card information.',
    position: 'bottom',
  },
  {
    id: 'subgrades',
    targetId: 'tour-subgrades',
    title: 'Sub-Grade Scores',
    description: 'Individual grades for Centering, Corners, Edges, and Surface. These four categories combine to determine your overall grade.',
    position: 'top',
  },
  {
    id: 'centering',
    targetId: 'tour-centering',
    title: 'Centering Analysis',
    description: 'Precise measurements of your card\'s centering ratios for both front and back. Perfect centering (50/50) scores highest, with detailed analysis of any misalignment.',
    position: 'top',
  },
  {
    id: 'optic-score',
    targetId: 'tour-optic-score',
    title: 'DCM Optic Confidence',
    description: 'This score reflects the quality of your uploaded images. Higher quality photos allow for more accurate grading. Tips: use good lighting, avoid glare, and capture the full card.',
    position: 'top',
  },
  {
    id: 'pro-estimates',
    targetId: 'tour-pro-estimates',
    title: 'Professional Grading Estimates',
    description: 'See estimated grades from mail away companies like PSA, BGS and CGC (calculated using their published grading rubrics). These scores help you understand how your card might score if sent out.',
    position: 'top',
  },
  {
    id: 'market-pricing',
    targetId: 'tour-market-pricing',
    title: 'Market & Pricing',
    description: 'Quick links to search eBay and other marketplaces for similar cards. Research current market prices and recent sales to understand your card\'s value.',
    position: 'top',
  },
  {
    id: 'live-market-pricing',
    targetId: 'tour-live-market-pricing',
    title: 'Live Market Pricing',
    description: 'Live pricing from active online listings help provide a sense for card value. Historical pricing is updated weekly to provide a sense of on-going card fluctuations.',
    position: 'top',
  },
  {
    id: 'insta-list',
    targetId: 'tour-insta-list',
    title: 'Insta-List on eBay',
    description: 'List your card directly to eBay with one click! We automatically include your graded images, DCM report, and pre-fill all the item details for you.',
    position: 'top',
  },
]

const TOUR_STARTED_KEY = 'dcm_onboarding_tour_started'
const TOUR_COMPLETED_KEY = 'dcm_onboarding_tour_completed'

interface OnboardingTourProps {
  isActive: boolean
  onComplete: () => void
}

export function OnboardingTour({ isActive, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [arrowPosition, setArrowPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top')
  const [isVisible, setIsVisible] = useState(false)
  const [showFinalModal, setShowFinalModal] = useState(false)
  const [elementFound, setElementFound] = useState(true)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const retryCountRef = useRef(0)

  // Get current step config
  const step = TOUR_STEPS[currentStep]

  // Calculate tooltip position relative to target element
  const updatePosition = useCallback(() => {
    if (!step) return

    const targetEl = document.getElementById(step.targetId)
    if (!targetEl) {
      console.log(`[Tour] Element not found: ${step.targetId}`)
      setElementFound(false)

      // Retry more times (element might be loading or needs scrolling into view)
      if (retryCountRef.current < 6) {
        retryCountRef.current++
        setTimeout(updatePosition, 800)
        return
      }

      // Skip to next step if element truly doesn't exist
      retryCountRef.current = 0
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1)
      }
      return
    }

    setElementFound(true)
    retryCountRef.current = 0

    const rect = targetEl.getBoundingClientRect()
    const tooltipWidth = 340
    const tooltipHeight = 200
    const padding = 16
    const arrowSize = 12

    let top = 0
    let left = 0
    let arrow: 'top' | 'bottom' | 'left' | 'right' = 'top'

    // Calculate position based on step config (using viewport coordinates for fixed positioning)
    switch (step.position) {
      case 'bottom':
        top = rect.bottom + arrowSize + padding
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        arrow = 'top'
        break
      case 'top':
        top = rect.top - tooltipHeight - arrowSize - padding
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        arrow = 'bottom'
        break
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2
        left = rect.left - tooltipWidth - arrowSize - padding
        arrow = 'right'
        break
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2
        left = rect.right + arrowSize + padding
        arrow = 'left'
        break
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left < padding) left = padding
    if (left + tooltipWidth > viewportWidth - padding) left = viewportWidth - tooltipWidth - padding

    // If tooltip would be above viewport, flip to bottom
    if (top < padding) {
      top = rect.bottom + arrowSize + padding
      arrow = 'top'
    }

    // If tooltip would be below viewport, flip to top
    if (top + tooltipHeight > viewportHeight - padding) {
      top = rect.top - tooltipHeight - arrowSize - padding
      arrow = 'bottom'

      // If still off screen, just position at bottom of viewport
      if (top < padding) {
        top = viewportHeight - tooltipHeight - padding
      }
    }

    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 57,
    })
    setArrowPosition(arrow)
  }, [step, currentStep])

  // Scroll to element and update position
  const scrollToElement = useCallback(() => {
    if (!step) return

    const targetEl = document.getElementById(step.targetId)
    if (!targetEl) {
      // Will be handled by updatePosition retry logic
      updatePosition()
      return
    }

    // For the first step, scroll to the very top to ensure tooltip is visible on mobile
    if (currentStep === 0) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
      setTimeout(updatePosition, 1000)
      return
    }

    // Scroll element into view with some padding
    const rect = targetEl.getBoundingClientRect()
    const elementTop = window.scrollY + rect.top
    const viewportHeight = window.innerHeight

    // Calculate scroll position to put element in upper third of viewport
    const scrollTo = elementTop - (viewportHeight / 4)

    window.scrollTo({
      top: Math.max(0, scrollTo),
      behavior: 'smooth'
    })

    // Update position after scroll completes (increased delay for reliability)
    setTimeout(updatePosition, 1000)
  }, [step, currentStep, updatePosition])

  // Initialize tour
  useEffect(() => {
    if (isActive && !showFinalModal) {
      localStorage.setItem(TOUR_STARTED_KEY, 'true')
      // Small delay to let the page render
      const timer = setTimeout(() => {
        setIsVisible(true)
        scrollToElement()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isActive, showFinalModal, scrollToElement])

  // Update position on step change
  useEffect(() => {
    if (isVisible && !showFinalModal) {
      scrollToElement()
    }
  }, [currentStep, isVisible, showFinalModal, scrollToElement])

  // Update position on scroll and resize
  useEffect(() => {
    if (!isVisible || showFinalModal) return

    const handleUpdate = () => {
      // Debounce updates
      setTimeout(updatePosition, 100)
    }

    window.addEventListener('scroll', handleUpdate)
    window.addEventListener('resize', handleUpdate)

    return () => {
      window.removeEventListener('scroll', handleUpdate)
      window.removeEventListener('resize', handleUpdate)
    }
  }, [isVisible, showFinalModal, updatePosition])

  const handleNext = () => {
    retryCountRef.current = 0
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      // Tour complete, show final modal
      setShowFinalModal(true)
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    retryCountRef.current = 0
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true')
    setIsVisible(false)
    onComplete()
  }

  const handleFinalClose = () => {
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true')
    setShowFinalModal(false)
    setIsVisible(false)
    onComplete()
  }

  if (!isActive || !isVisible) return null

  // Final welcome modal
  if (showFinalModal) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUp overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-center relative overflow-hidden">
            {/* Confetti decoration */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 left-4 w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="absolute top-6 right-8 w-3 h-3 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              <div className="absolute bottom-4 left-12 w-2 h-2 bg-green-300 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
              <div className="absolute top-8 left-1/3 w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="absolute bottom-6 right-12 w-3 h-3 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
            <div className="text-4xl mb-2">🎊</div>
            <h2 className="text-2xl font-bold text-white mb-1">Welcome to the DCM Family!</h2>
            <p className="text-purple-100 text-sm">You're all set to grade like a pro</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-700 text-center mb-6">
              You've completed the tour! Now you know everything about your graded card. Ready to grow your collection?
            </p>

            {/* Stats/Achievement */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 mb-6 border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-purple-800">First Card Graded!</p>
                  <p className="text-sm text-purple-600">Achievement unlocked</p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <Link
                href="/credits"
                className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 text-center shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300"
                onClick={handleFinalClose}
              >
                Grade Another Card
              </Link>
              <button
                onClick={handleFinalClose}
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-3 px-6 rounded-xl transition-all duration-200 text-center"
              >
                Return to Card Details
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Tour tooltip
  return (
    <>
      {/* Overlay - clicking skips the tour */}
      <div
        className="fixed inset-0 bg-black/50 z-[54]"
        onClick={(e) => {
          e.stopPropagation()
          // Don't skip on overlay click, just prevent interaction
        }}
      />

      {/* Highlight ring around target element */}
      {elementFound && step && (() => {
        const targetEl = document.getElementById(step.targetId)
        if (!targetEl) return null

        const rect = targetEl.getBoundingClientRect()
        return (
          <div
            className="fixed pointer-events-none z-[55] rounded-lg"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
              boxShadow: '0 0 0 4px rgba(124, 58, 237, 0.6), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
              background: 'transparent',
            }}
          />
        )
      })()}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="bg-white rounded-xl shadow-2xl animate-fadeIn"
        style={tooltipStyle}
      >
        {/* Arrow */}
        <div
          className={`absolute w-4 h-4 bg-white transform rotate-45 ${
            arrowPosition === 'top' ? '-top-2 left-1/2 -translate-x-1/2 shadow-[-2px_-2px_4px_rgba(0,0,0,0.1)]' :
            arrowPosition === 'bottom' ? '-bottom-2 left-1/2 -translate-x-1/2 shadow-[2px_2px_4px_rgba(0,0,0,0.1)]' :
            arrowPosition === 'left' ? '-left-2 top-1/2 -translate-y-1/2 shadow-[-2px_2px_4px_rgba(0,0,0,0.1)]' :
            '-right-2 top-1/2 -translate-y-1/2 shadow-[2px_-2px_4px_rgba(0,0,0,0.1)]'
          }`}
        />

        {/* Content */}
        <div className="p-5">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-purple-600 font-semibold">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip tour
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-800 mb-2">{step?.title}</h3>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed mb-5">{step?.description}</p>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {currentStep > 0 ? (
                <button
                  onClick={handleBack}
                  className="text-sm text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              ) : (
                <button
                  onClick={handleSkip}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Exit tour
                </button>
              )}
            </div>
            <button
              onClick={handleNext}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// Export keys for external use
export { TOUR_STARTED_KEY, TOUR_COMPLETED_KEY }
