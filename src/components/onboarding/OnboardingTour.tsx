'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// Tour step configuration
interface TourStep {
  id: string
  targetId: string // ID of the element to highlight
  title: string
  description: string
}

// Define tour steps — order matches visual page layout (hero zone first, then accordion sections)
const TOUR_STEPS: TourStep[] = [
  {
    id: 'card-images',
    targetId: 'tour-card-images',
    title: 'Your Graded Card Images',
    description: 'Your card has been professionally analyzed! The front and back images now include DCM identification labels and grade information, making it easy to share and verify your card\'s authenticity.',
  },
  {
    id: 'visibility-toggle',
    targetId: 'tour-visibility-toggle',
    title: 'Privacy & Label Style',
    description: 'Control who can see your card with the Public/Private toggle. You can also switch between Modern and Traditional label styles to match your preference.',
  },
  {
    id: 'grade-score',
    targetId: 'tour-grade-score',
    title: 'Your DCM Grade',
    description: 'This is your card\'s overall grade on a 1-10 scale. The confidence indicator (A, B, C, or D) shows how certain DCM Optic\u2122 is about the grade based on image quality and card clarity.',
  },
  {
    id: 'subgrades',
    targetId: 'tour-subgrades',
    title: 'Sub-Grade Scores',
    description: 'Individual grades for Centering, Corners, Edges, and Surface. These four categories combine to determine your overall grade.',
  },
  {
    id: 'condition-summary',
    targetId: 'tour-condition-summary',
    title: 'Condition Summary',
    description: 'A detailed written analysis of your card\'s overall condition, highlighting key observations about centering, corners, edges, and surface quality.',
  },
  {
    id: 'download-buttons',
    targetId: 'tour-download-buttons',
    title: 'Download Reports & Labels',
    description: 'Download your official DCM grading report as a PDF, or get printable labels for your card holders. You can also download images of your cards with their graded labels included!',
  },
  {
    id: 'card-info',
    targetId: 'tour-card-info',
    title: 'Card Information',
    description: 'Your card\'s identified details including player/character, set name, card number, and more. You can edit any details that need correcting to improve market pricing accuracy.',
  },
  {
    id: 'centering',
    targetId: 'tour-centering',
    title: 'Centering Analysis',
    description: 'Precise measurements of your card\'s centering ratios for both front and back. Perfect centering (50/50) scores highest, with detailed analysis of any misalignment.',
  },
  {
    id: 'optic-score',
    targetId: 'tour-optic-score',
    title: 'DCM Optic\u2122 Confidence',
    description: 'This score reflects the quality of your uploaded images. Higher quality photos allow for more accurate grading. Tips: use good lighting, avoid glare, and capture the full card.',
  },
  {
    id: 'market-value',
    targetId: 'tour-market-value',
    title: 'Market Value',
    description: 'Your estimated card value based on real market data, plus quick links to search eBay, TCGplayer, and other marketplaces. Pricing updates weekly to track market changes.',
  },
  {
    id: 'pro-estimates',
    targetId: 'tour-pro-estimates',
    title: 'Estimated Mail-Away Grade Scores',
    description: 'See estimated grades from mail-away companies like PSA, BGS, and CGC (calculated using their published grading rubrics). These scores help you understand how your card might score if sent out.',
  },
  {
    id: 'insta-list',
    targetId: 'tour-insta-list',
    title: 'Insta-List on eBay',
    description: 'List your card directly to eBay with one click! We automatically include your graded images, DCM report, and pre-fill all the item details for you.',
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
  const [isVisible, setIsVisible] = useState(false)
  const [showFinalModal, setShowFinalModal] = useState(false)
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const retryCountRef = useRef(0)
  const expandedSectionRef = useRef<HTMLElement | null>(null)
  const lastToggledStepRef = useRef<number>(-1)

  // Get current step config
  const step = TOUR_STEPS[currentStep]

  // Expand or collapse a CollapsibleSection by clicking its button
  const setCollapsibleOpen = useCallback((el: HTMLElement, open: boolean) => {
    const button = el.querySelector(':scope > button') as HTMLButtonElement
    if (!button) return
    const contentDiv = button.nextElementSibling as HTMLElement
    if (!contentDiv) return
    const isCurrentlyOpen = !contentDiv.classList.contains('hidden')
    if (open !== isCurrentlyOpen) {
      button.click()
    }
  }, [])

  // Collapse any section the tour previously expanded
  const collapseExpandedSection = useCallback(() => {
    if (expandedSectionRef.current) {
      setCollapsibleOpen(expandedSectionRef.current, false)
      expandedSectionRef.current = null
    }
  }, [setCollapsibleOpen])

  // Update highlight ring position (called on scroll/resize)
  const updateHighlight = useCallback(() => {
    if (!step) return
    const targetEl = document.getElementById(step.targetId)
    if (targetEl) {
      setHighlightRect(targetEl.getBoundingClientRect())
    }
  }, [step])

  // Scroll to the target element, positioning it below the fixed tour card
  const scrollToTarget = useCallback(() => {
    if (!step) return

    const targetEl = document.getElementById(step.targetId)
    if (!targetEl) {
      // Retry — element might be loading
      if (retryCountRef.current < 6) {
        retryCountRef.current++
        setTimeout(scrollToTarget, 800)
        return
      }
      // Skip step if element truly doesn't exist
      retryCountRef.current = 0
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1)
      }
      return
    }

    retryCountRef.current = 0

    // Only toggle CollapsibleSections once per step
    let didExpand = false
    if (lastToggledStepRef.current !== currentStep) {
      lastToggledStepRef.current = currentStep
      collapseExpandedSection()

      if (targetEl.hasAttribute('data-tour')) {
        setCollapsibleOpen(targetEl, true)
        expandedSectionRef.current = targetEl
        didExpand = true
      }
    }

    // After any expand, wait for DOM to settle before scrolling
    const doScroll = () => {
      const rect = targetEl.getBoundingClientRect()
      const elementTop = window.scrollY + rect.top
      const gap = 16

      const cardHeight = cardRef.current?.getBoundingClientRect().height ?? 160
      window.scrollTo({
        top: Math.max(0, elementTop - cardHeight - gap),
        behavior: 'smooth',
      })

      // Update highlight after scroll settles
      setTimeout(updateHighlight, 400)
    }

    if (didExpand) {
      setTimeout(doScroll, 150)
    } else {
      doScroll()
    }
  }, [step, currentStep, collapseExpandedSection, setCollapsibleOpen, updateHighlight])

  // Reset tour state when re-activated
  useEffect(() => {
    if (isActive) {
      setCurrentStep(0)
      setShowFinalModal(false)
      setIsVisible(false)
      setHighlightRect(null)
      retryCountRef.current = 0
      lastToggledStepRef.current = -1
    }
  }, [isActive])

  // Initialize tour
  useEffect(() => {
    if (isActive && !showFinalModal) {
      localStorage.setItem(TOUR_STARTED_KEY, 'true')
      const timer = setTimeout(() => {
        setIsVisible(true)
        scrollToTarget()
      }, 500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, showFinalModal])

  // Navigate on step change
  useEffect(() => {
    if (isVisible && !showFinalModal) {
      scrollToTarget()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  // Update highlight on scroll and resize
  useEffect(() => {
    if (!isVisible || showFinalModal) return

    let rafId: number
    const handleUpdate = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateHighlight)
    }

    window.addEventListener('scroll', handleUpdate, { passive: true })
    window.addEventListener('resize', handleUpdate)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', handleUpdate)
      window.removeEventListener('resize', handleUpdate)
    }
  }, [isVisible, showFinalModal, updateHighlight])

  const handleNext = () => {
    retryCountRef.current = 0
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      collapseExpandedSection()
      setShowFinalModal(true)
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
    collapseExpandedSection()
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true')
    setIsVisible(false)
    onComplete()
  }

  const handleFinalClose = () => {
    collapseExpandedSection()
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

  // Tour UI — fixed card at top + highlight ring on target
  return (
    <>
      {/* Dark overlay with cutout for highlighted element */}
      {highlightRect && highlightRect.height > 0 ? (
        <div
          className="fixed inset-0 z-[54] pointer-events-auto"
          style={{
            background: 'transparent',
            boxShadow: `
              0 0 0 4px rgba(124, 58, 237, 0.7),
              0 0 0 9999px rgba(0, 0, 0, 0.55)
            `,
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            borderRadius: '12px',
            position: 'fixed',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="fixed inset-0 bg-black/55 z-[54]"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Fixed tour card at top of screen */}
      <div
        ref={cardRef}
        className="fixed top-0 left-0 right-0 z-[57] animate-fadeIn"
      >
        <div className="mx-auto max-w-lg w-full p-3">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-purple-100">
            {/* Gradient header strip */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 flex items-center justify-between">
              <span className="text-white text-xs font-semibold">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-white/70 hover:text-white text-xs transition-colors"
              >
                Skip tour
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-100">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
              />
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="text-base font-bold text-gray-800 mb-1">{step?.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{step?.description}</p>

              {/* Navigation */}
              <div className="flex justify-between items-center">
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
                <button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg text-sm"
                >
                  {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Down arrow indicator */}
            <div className="flex justify-center -mb-2 pb-1">
              <svg className="w-5 h-5 text-purple-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Export keys for external use
export { TOUR_STARTED_KEY, TOUR_COMPLETED_KEY }
