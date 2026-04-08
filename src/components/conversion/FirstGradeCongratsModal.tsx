'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface FirstGradeCongratsModalProps {
  isFirstPurchase: boolean
  onDismiss: () => void
  onStartTour?: () => void // New prop to trigger the guided tour
  variant?: 'signup' | 'first-grade' // Controls header copy and dismiss key
}

const PROMO_CODE = 'Grade10'
const SIGNUP_DISMISSED_KEY = 'dcm_welcome_promo_signup_dismissed'
const FIRST_GRADE_DISMISSED_KEY = 'dcm_welcome_promo_first_grade_dismissed'
// Legacy key kept for backward compat — if user already dismissed the old modal,
// we won't pester them again with the first-grade variant.
const LEGACY_DISMISSED_KEY = 'dcm_first_grade_modal_dismissed'

export function FirstGradeCongratsModal({
  isFirstPurchase,
  onDismiss,
  onStartTour,
  variant = 'first-grade'
}: FirstGradeCongratsModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const dismissKey = variant === 'signup' ? SIGNUP_DISMISSED_KEY : FIRST_GRADE_DISMISSED_KEY

  useEffect(() => {
    // Check if this variant of the modal was already dismissed
    const wasDismissed = localStorage.getItem(dismissKey)
    const wasLegacyDismissed = variant === 'first-grade' && localStorage.getItem(LEGACY_DISMISSED_KEY)
    if (!wasDismissed && !wasLegacyDismissed) {
      // Small delay for better UX - let the page load first
      const timer = setTimeout(() => setIsVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [dismissKey, variant])

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true')
    setIsVisible(false)
    onDismiss()
  }

  const handleStartTour = () => {
    localStorage.setItem(dismissKey, 'true')
    setIsVisible(false)
    if (onStartTour) {
      onStartTour()
    } else {
      onDismiss()
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy promo code:', err)
    }
  }

  if (!isVisible) return null

  const headerTitle = variant === 'signup' ? 'Welcome to DCM!' : 'Nice First Grade!'
  const headerSubtitle = variant === 'signup'
    ? 'Here\u2019s a special offer to get you started'
    : 'Here\u2019s a thank-you gift for grading your first card'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto animate-fadeIn">
      <div className="flex items-center justify-center min-h-full p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
          {/* Celebration Header */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-center relative overflow-hidden">
            {/* Confetti decoration */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 left-4 w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="absolute top-6 right-8 w-3 h-3 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              <div className="absolute bottom-4 left-12 w-2 h-2 bg-green-300 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
              <div className="absolute top-8 left-1/3 w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="absolute bottom-6 right-12 w-3 h-3 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>

            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-1">{headerTitle}</h2>
            <p className="text-purple-100 text-sm">{headerSubtitle}</p>
          </div>

          {/* Promo Body */}
          <div className="p-6">
            <div className="text-center mb-5">
              <p className="text-gray-700 text-base mb-1">
                Get <span className="font-bold text-purple-700">10% off</span> your first credit purchase
              </p>
              <p className="text-gray-500 text-xs">
                Works on all credit packs and Card Lovers subscriptions
              </p>
            </div>

            {/* Promo Code Box */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-dashed border-purple-300 rounded-xl p-5 mb-5">
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider text-center mb-2">Your Promo Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-extrabold text-purple-800 tracking-widest font-mono">
                  {PROMO_CODE}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  title="Copy promo code"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                Apply this code at checkout to save 10%
              </p>
            </div>

            {/* First-time grader bonus credits note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">🎁</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-bold">Plus, first-time graders get bonus credits!</span> Stack
                  up to <span className="font-bold">5 free credits</span> on top of your 10% discount when
                  you make your first purchase.
                </p>
              </div>
            </div>

            {/* Quick value props */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span className="text-green-500 flex-shrink-0">✓</span>
                <span>Detailed grade reports with sub-grades</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span className="text-green-500 flex-shrink-0">✓</span>
                <span>Real-time market pricing</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span className="text-green-500 flex-shrink-0">✓</span>
                <span>Custom slab labels &amp; eBay InstaList</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <Link
                href="/credits"
                onClick={handleDismiss}
                className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 text-center shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300"
              >
                Redeem 10% Off Now
              </Link>
              <button
                onClick={handleStartTour}
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-3 px-6 rounded-xl transition-all duration-200 text-center"
              >
                {variant === 'signup' ? 'Maybe Later' : 'Take a Quick Tour'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export keys so other components can check/reset them
export {
  SIGNUP_DISMISSED_KEY,
  FIRST_GRADE_DISMISSED_KEY,
  LEGACY_DISMISSED_KEY as MODAL_DISMISSED_KEY,
  PROMO_CODE
}
