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
    description: 'This is your card\'s overall grade on a 1-10 scale. The confidence indicator (A, B, or C) shows how certain our AI is about the grade based on image quality and card clarity.',
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
    description: 'Download your official DCM grading report as a PDF, or get printable labels for your card holders. You can also list directly to eBay from here!',
    position: 'top',
  },
  {
    id: 'card-info',
    targetId: 'tour-card-info',
    title: 'Card Information',
    description: 'Our AI has identified your card\'s details including the player/character, set name, card number, and more. This information is used for market pricing and eBay listings.',
    position: 'top',
  },
  {
    id: 'edit-details',
    targetId: 'tour-edit-details',
    title: 'Edit Card Details',
    description: 'Sometimes our AI makes mistakes! Use this button to correct any card information. Your edits help improve future grading accuracy.',
    position: 'bottom',
  },
  {
    id: 'centering',
    targetId: 'tour-centering',
    title: 'Centering Analysis',
    description: 'Precise measurements of your card\'s centering ratios for both front and back. Perfect centering (50/50) scores highest, with detailed analysis of any misalignment.',
    position: 'top',
  },
  {
    id: 'subgrades',
    targetId: 'tour-subgrades',
    title: 'Corners, Edges & Surface',
    description: 'Individual grades for each condition category. Our AI examines corner sharpness, edge wear, and surface imperfections to provide detailed sub-grades.',
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
    description: 'See estimated grades from major grading companies like PSA, BGS, and CGC. These help you understand how your card might score with traditional graders.',
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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [arrowPosition, setArrowPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top')
  const [isVisible, setIsVisible] = useState(false)
  const [showFinalModal, setShowFinalModal] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Get current step config
  const step = TOUR_STEPS[currentStep]

  // Calculate tooltip position relative to target element
  const updatePosition = useCallback(() => {
    if (!step) return

    const targetEl = document.getElementById(step.targetId)
    if (!targetEl) {
      // Element not found, try next step
      console.log(`[Tour] Element not found: ${step.targetId}, skipping...`)
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1)
      }
      return
    }

    const rect = targetEl.getBoundingClientRect()
    const tooltipWidth = 320
    const tooltipHeight = 180
    const padding = 16
    const arrowSize = 12

    let top = 0
    let left = 0
    let arrow: 'top' | 'bottom' | 'left' | 'right' = 'top'

    // Calculate position based on step config
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
    if (top < padding) {
      top = rect.bottom + arrowSize + padding
      arrow = 'top'
    }
    if (top + tooltipHeight > viewportHeight - padding) {
      top = rect.top - tooltipHeight - arrowSize - padding
      arrow = 'bottom'
    }

    // Add scroll offset for fixed positioning
    top += window.scrollY

    setTooltipPosition({ top, left })
    setArrowPosition(arrow)
  }, [step, currentStep])

  // Scroll to element and update position
  const scrollToElement = useCallback(() => {
    if (!step) return

    const targetEl = document.getElementById(step.targetId)
    if (!targetEl) return

    // Scroll element into view with some padding
    const rect = targetEl.getBoundingClientRect()
    const scrollTop = window.scrollY + rect.top - window.innerHeight / 3

    window.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    })

    // Update position after scroll
    setTimeout(updatePosition, 500)
  }, [step, updatePosition])

  // Initialize tour
  useEffect(() => {
    if (isActive && !showFinalModal) {
      localStorage.setItem(TOUR_STARTED_KEY, 'true')
      // Small delay to let the page render
      const timer = setTimeout(() => {
        setIsVisible(true)
        scrollToElement()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isActive, showFinalModal, scrollToElement])

  // Update position on step change
  useEffect(() => {
    if (isVisible && !showFinalModal) {
      scrollToElement()
    }
  }, [currentStep, isVisible, showFinalModal, scrollToElement])

  // Update position on resize
  useEffect(() => {
    if (!isVisible || showFinalModal) return

    const handleResize = () => updatePosition()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isVisible, showFinalModal, updatePosition])

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      // Tour complete, show final modal
      setShowFinalModal(true)
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[55]" onClick={handleSkip} />

      {/* Highlight the target element */}
      <style jsx global>{`
        #${step?.targetId} {
          position: relative;
          z-index: 56;
          box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.5), 0 0 20px rgba(124, 58, 237, 0.3);
          border-radius: 8px;
        }
      `}</style>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[57] w-80 bg-white rounded-xl shadow-2xl animate-fadeIn"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Arrow */}
        <div
          className={`absolute w-4 h-4 bg-white transform rotate-45 ${
            arrowPosition === 'top' ? '-top-2 left-1/2 -translate-x-1/2' :
            arrowPosition === 'bottom' ? '-bottom-2 left-1/2 -translate-x-1/2' :
            arrowPosition === 'left' ? '-left-2 top-1/2 -translate-y-1/2' :
            '-right-2 top-1/2 -translate-y-1/2'
          }`}
        />

        {/* Content */}
        <div className="p-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-purple-600 font-medium">
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
          <div className="h-1 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-800 mb-2">{step?.title}</h3>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{step?.description}</p>

          {/* Navigation */}
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 flex items-center gap-2"
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
