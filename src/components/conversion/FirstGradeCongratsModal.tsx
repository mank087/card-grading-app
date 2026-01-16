'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface FirstGradeCongratsModalProps {
  isFirstPurchase: boolean
  onDismiss: () => void
  onStartTour?: () => void // New prop to trigger the guided tour
}

const MODAL_DISMISSED_KEY = 'dcm_first_grade_modal_dismissed'

export function FirstGradeCongratsModal({
  isFirstPurchase,
  onDismiss,
  onStartTour
}: FirstGradeCongratsModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if modal was already dismissed
    const wasDismissed = localStorage.getItem(MODAL_DISMISSED_KEY)
    if (!wasDismissed) {
      // Small delay for better UX - let the page load first
      const timer = setTimeout(() => setIsVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(MODAL_DISMISSED_KEY, 'true')
    setIsVisible(false)
    onDismiss()
  }

  const handleStartTour = () => {
    localStorage.setItem(MODAL_DISMISSED_KEY, 'true')
    setIsVisible(false)
    // Trigger the guided tour
    if (onStartTour) {
      onStartTour()
    } else {
      onDismiss()
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto animate-fadeIn">
      {/* Flex container for centering - min-h-full ensures it can scroll if needed */}
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
          <h2 className="text-2xl font-bold text-white mb-1">Congratulations!</h2>
          <p className="text-purple-100 text-sm">Your first card has been graded</p>
        </div>

        {/* Features Section */}
        <div className="p-6">
          <p className="text-gray-700 text-center mb-4">
            You now have access to everything DCM Grading offers:
          </p>

          {/* Feature List */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">Detailed condition analysis with sub-grades</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">Market pricing from eBay & TCGPlayer</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">Downloadable reports & professional labels</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">Build your graded collection</span>
            </div>
          </div>

          {/* First Purchase Bonus Highlight */}
          {isFirstPurchase && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="font-bold text-amber-800">First Purchase Bonus!</p>
                  <p className="text-sm text-amber-700">
                    Buy any credit pack and get up to <span className="font-bold">5 bonus credits FREE</span>
                  </p>
                  <ul className="text-xs text-amber-600 mt-2 space-y-1">
                    <li>• Basic: 1 credit + 1 FREE = 2 total</li>
                    <li>• Pro: 5 credits + 3 FREE = 8 total</li>
                    <li>• Elite: 20 credits + 5 FREE = 25 total</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link
              href="/credits"
              className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 text-center shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300"
            >
              Grade More Cards
            </Link>
            <button
              onClick={handleStartTour}
              className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-3 px-6 rounded-xl transition-all duration-200 text-center"
            >
              Take a Quick Tour
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

// Export the key so other components can check/reset it
export { MODAL_DISMISSED_KEY }
