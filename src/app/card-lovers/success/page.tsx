'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession } from '@/lib/directAuth'

// Declare tracking pixels for TypeScript
declare global {
  interface Window {
    rdt: (...args: unknown[]) => void
    gtag: (...args: unknown[]) => void
    fbq: (...args: unknown[]) => void
  }
}

interface SubscriptionStatus {
  isActive: boolean
  plan: 'monthly' | 'annual' | null
  monthsActive: number
  currentPeriodEnd: string | null
}

function CardLoversSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { balance, refreshCredits } = useCredits()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [tracked, setTracked] = useState(false)

  useEffect(() => {
    async function fetchSubscriptionStatus() {
      try {
        const session = getStoredSession()
        if (!session?.access_token) {
          setLoading(false)
          return
        }

        const response = await fetch('/api/subscription/status', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          setSubscriptionStatus(data)
        }

        // Refresh credits to get updated balance
        await refreshCredits()
      } catch (error) {
        console.error('Error fetching subscription status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSubscriptionStatus()
  }, [refreshCredits])

  // Track purchase event once
  useEffect(() => {
    if (tracked || !subscriptionStatus?.isActive) return

    const value = subscriptionStatus.plan === 'monthly' ? 49.99 : 449
    const credits = subscriptionStatus.plan === 'monthly' ? 70 : 900

    if (typeof window !== 'undefined') {
      // Facebook Pixel
      if (window.fbq) {
        window.fbq('track', 'Subscribe', {
          value,
          currency: 'USD',
          content_type: 'product',
          content_ids: [`card_lovers_${subscriptionStatus.plan}`],
          num_items: credits
        })
        console.log('[Meta Pixel] Card Lovers Subscribe event tracked')
      }

      // Google Ads Purchase conversion
      if (window.gtag) {
        window.gtag('event', 'ads_conversion_PURCHASE_1', {
          transaction_id: `card_lovers_${sessionId}`,
          value,
          currency: 'USD'
        })
        console.log('[Google Ads] Card Lovers Purchase conversion tracked')
      }

      // GA4 purchase event
      if (window.gtag) {
        window.gtag('event', 'purchase', {
          transaction_id: sessionId,
          value,
          currency: 'USD',
          items: [{
            item_id: `card_lovers_${subscriptionStatus.plan}`,
            item_name: `Card Lovers ${subscriptionStatus.plan}`,
            price: value,
            quantity: 1
          }]
        })
        console.log('[GA4] Card Lovers purchase event tracked')
      }

      // Reddit Pixel
      if (window.rdt) {
        window.rdt('track', 'Purchase', {
          value,
          currency: 'USD',
          itemCount: credits,
          transactionId: sessionId
        })
        console.log('[Reddit Pixel] Card Lovers Purchase event tracked')
      }
    }

    setTracked(true)
  }, [subscriptionStatus, sessionId, tracked])

  const creditsReceived = subscriptionStatus?.plan === 'monthly' ? 70 : 900

  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Success Animation */}
      <div className="mb-8 relative">
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-rose-500 rounded-full flex items-center justify-center animate-bounce">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        </div>
        {/* Confetti effect placeholder */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-1/4 w-3 h-3 bg-purple-400 rounded-full animate-ping" />
          <div className="absolute top-8 right-1/4 w-2 h-2 bg-rose-400 rounded-full animate-ping delay-75" />
          <div className="absolute top-2 right-1/3 w-2 h-2 bg-pink-400 rounded-full animate-ping delay-150" />
        </div>
      </div>

      {/* Welcome Message */}
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
        Welcome to the <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-rose-600">Card Lovers</span> Family!
      </h1>

      <p className="text-xl text-gray-600 mb-8">
        Your subscription is now active. Let&apos;s start grading!
      </p>

      {/* Subscription Details Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border-2 border-purple-100">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-4" />
            <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-rose-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-sm text-gray-500">Your Plan</div>
                <div className="text-xl font-bold text-gray-900">
                  Card Lovers {subscriptionStatus?.plan === 'monthly' ? 'Monthly' : 'Annual'}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                <div className="text-3xl font-bold text-purple-600">{creditsReceived}</div>
                <div className="text-gray-600">Credits Added</div>
              </div>
              <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4">
                <div className="text-3xl font-bold text-rose-600">{balance ?? '...'}</div>
                <div className="text-gray-600">Total Balance</div>
              </div>
            </div>

            {subscriptionStatus?.plan === 'monthly' && (
              <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-700">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-semibold">Loyalty Bonus Coming!</span>
                </div>
                <p className="text-sm text-yellow-600 mt-1">
                  Earn +5 bonus credits at month 3. Keep subscribing to unlock more bonuses!
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Benefits Reminder */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 text-left">
        <h3 className="font-bold text-gray-900 mb-4 text-center">Your Card Lovers Perks</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-gray-700">Exclusive Card Lovers emblem on your labels</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-gray-700">Card Lovers badge on your collection page</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-gray-700">20% discount on additional credit purchases</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-gray-700">Credits roll over indefinitely — they&apos;re yours forever</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/grade"
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start Grading
        </Link>
        <Link
          href="/collection"
          className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-md hover:shadow-lg border border-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          View Collection
        </Link>
      </div>

      <p className="mt-8 text-gray-500 text-sm">
        Manage your subscription anytime in{' '}
        <Link href="/account" className="text-purple-600 hover:underline">
          Account Settings
        </Link>
      </p>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto bg-gray-200 rounded-full animate-pulse" />
      </div>
      <div className="h-12 bg-gray-200 rounded w-3/4 mx-auto mb-4 animate-pulse" />
      <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto animate-pulse" />
    </div>
  )
}

export default function CardLoversSuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-rose-50 to-pink-50 py-16">
      <div className="container mx-auto px-4">
        <Suspense fallback={<LoadingFallback />}>
          <CardLoversSuccessContent />
        </Suspense>
      </div>
    </main>
  )
}
