'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

interface LowCreditsBottomBannerProps {
  /** Credit balance. Undefined or null means "not known yet". */
  balance: number | null | undefined
  isFirstPurchase?: boolean
  /** True while the balance is still being fetched. Suppresses the banner. */
  loading?: boolean
  /**
   * Owner of the card being viewed. When provided, the banner only shows to
   * that person. A visitor looking at someone else's public card is not the
   * one who is out of credits.
   */
  ownerId?: string | null
}

const BANNER_DISMISSED_KEY = 'dcm_low_credits_banner_dismissed'
const BANNER_DISMISS_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export function LowCreditsBottomBanner({
  balance,
  isFirstPurchase = false,
  loading = false,
  ownerId,
}: LowCreditsBottomBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden to prevent flash
  // Signed-out visitors were being told they had 0 credits, because the
  // context reports 0 for everyone who is not signed in. Resolved on the
  // client so server rendering never assumes a session.
  const [isEligible, setIsEligible] = useState(false)
  const paywallFiredRef = useRef(false)

  useEffect(() => {
    const session = getStoredSession()
    const userId = session?.user?.id
    if (!userId) {
      setIsEligible(false)
      return
    }
    // When the caller knows whose card this is, only the owner sees it.
    setIsEligible(!ownerId || ownerId === userId)
  }, [ownerId])

  // A loaded balance is an actual number. Undefined, null or NaN means the
  // fetch has not landed yet and we must not claim the balance is zero.
  const balanceLoaded = !loading && typeof balance === 'number' && Number.isFinite(balance)
  const isOutOfCredits = balanceLoaded && balance === 0
  const shouldShow = isEligible && isOutOfCredits

  useEffect(() => {
    if (!shouldShow) return
    // Check if banner was dismissed recently
    const dismissedAt = localStorage.getItem(BANNER_DISMISSED_KEY)
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10)
      const now = Date.now()
      // If dismissed less than 24 hours ago, keep it hidden
      if (now - dismissedTime < BANNER_DISMISS_DURATION) {
        setIsDismissed(true)
        return
      }
    }
    setIsDismissed(false)
  }, [shouldShow])

  // Fire paywall_seen once per page lifetime when the banner actually renders.
  // Tracked here (not just upload page) so we capture all 0-credit views across the app.
  useEffect(() => {
    if (isDismissed || !shouldShow) return
    if (paywallFiredRef.current) return
    paywallFiredRef.current = true
    if (typeof window !== 'undefined') {
      if ((window as any).gtag) {
        (window as any).gtag('event', 'paywall_seen', {
          event_category: 'conversion',
          paywall_type: 'low_credits_banner',
          is_first_purchase: isFirstPurchase,
        })
      }
      if ((window as any).fbq) {
        (window as any).fbq('trackCustom', 'PaywallSeen', {
          paywall_type: 'low_credits_banner',
        })
      }
      console.log('[LowCreditsBottomBanner] paywall_seen event tracked')
    }
  }, [isDismissed, shouldShow, isFirstPurchase])

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, Date.now().toString())
    setIsDismissed(true)
  }

  // Don't show if dismissed, signed out, not the owner, still loading, or in credit
  if (isDismissed || !shouldShow) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slideUpBanner">
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-lg shadow-purple-900/20">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Left side - Message */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="flex-shrink-0 bg-white/20 rounded-full p-1.5">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm sm:text-base truncate">
                  You have <span className="font-bold">0 credits</span> &mdash; save 10% with code{' '}
                  <span className="font-mono font-bold bg-white/20 px-1.5 py-0.5 rounded">Grade10</span>
                </p>
                {isFirstPurchase && (
                  <p className="text-purple-100 text-xs sm:text-sm hidden sm:block">
                    First-time graders also get bonus credits on their first purchase!
                  </p>
                )}
              </div>
            </div>

            {/* Right side - CTA and dismiss */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/credits"
                className="inline-flex items-center px-4 py-2 bg-white text-purple-700 font-semibold text-sm rounded-lg hover:bg-purple-50 transition-colors shadow-sm"
              >
                Buy Credits
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                onClick={handleDismiss}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Dismiss banner"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { BANNER_DISMISSED_KEY }
