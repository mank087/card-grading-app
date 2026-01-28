'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCredits } from '@/contexts/CreditsContext'
import Link from 'next/link'

// Declare rdt, gtag, and fbq for TypeScript
declare global {
  interface Window {
    rdt: (...args: any[]) => void
    gtag: (...args: any[]) => void
    fbq: (...args: any[]) => void
  }
}

function PurchaseSuccessContent() {
  const searchParams = useSearchParams()
  const { balance, refreshCredits } = useCredits()
  const [isLoading, setIsLoading] = useState(true)
  const hasTrackedPurchase = useRef(false)

  const sessionId = searchParams.get('session_id')
  const tier = searchParams.get('tier')
  const value = parseFloat(searchParams.get('value') || '0')
  const credits = parseInt(searchParams.get('credits') || '0')

  useEffect(() => {
    // Track purchase conversions (only once)
    if (!hasTrackedPurchase.current && typeof window !== 'undefined' && sessionId) {
      // Track Reddit Purchase conversion
      if (window.rdt) {
        window.rdt('track', 'Purchase', {
          conversionId: sessionId // Stripe session ID for deduplication
        })
        console.log('[Reddit Pixel] Purchase event tracked with conversionId:', sessionId)
      }

      // Track Google Ads Purchase conversion
      if (window.gtag) {
        window.gtag('event', 'ads_conversion_PURCHASE_1', {
          transaction_id: sessionId, // Stripe session ID for deduplication
          value: value,
          currency: 'USD'
        })
        console.log('[Google Ads] Purchase conversion tracked with transaction_id:', sessionId)
      }

      // Track GA4 purchase event with ecommerce data
      if (window.gtag && value > 0) {
        window.gtag('event', 'purchase', {
          transaction_id: sessionId,
          value: value,
          currency: 'USD',
          items: [{
            item_id: tier || 'credits',
            item_name: `${credits} Credits`,
            price: value,
            quantity: 1
          }]
        })
        console.log('[GA4] purchase event tracked:', { tier, value, credits })
      }

      // Track Meta/Facebook Purchase conversion
      if (window.fbq && value > 0) {
        window.fbq('track', 'Purchase', {
          value: value,
          currency: 'USD',
          content_type: 'product',
          content_ids: [tier || 'credits'],
          num_items: credits
        })
        console.log('[Meta Pixel] Purchase event tracked:', { tier, value, credits })
      }

      hasTrackedPurchase.current = true
    }

    // Refresh credits after successful purchase
    const loadCredits = async () => {
      try {
        await refreshCredits()
      } catch (error) {
        console.error('Failed to refresh credits:', error)
        // Still show the page even if refresh fails - user can manually refresh
      } finally {
        setIsLoading(false)
      }
    }

    // Small delay to ensure webhook has processed
    const timer = setTimeout(loadCredits, 2000)
    return () => clearTimeout(timer)
  }, [refreshCredits])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-600">
            Your credits have been added to your account.
          </p>
        </div>

        {/* Credits Display */}
        <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl p-6 mb-8">
          <p className="text-gray-600 mb-2">Your new balance</p>
          {isLoading ? (
            <div className="animate-pulse bg-gray-200 rounded h-12 w-24 mx-auto"></div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="text-5xl font-bold text-purple-600">{balance}</span>
              <span className="text-xl text-gray-600">credits</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Link
            href="/upload"
            className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Start Grading Cards
          </Link>
          <Link
            href="/collection"
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-xl transition-all duration-200"
          >
            View My Collection
          </Link>
        </div>

        {/* Receipt Info */}
        <p className="mt-8 text-sm text-gray-500">
          A receipt has been sent to your email.
          {sessionId && (
            <span className="block mt-1 text-xs text-gray-400">
              Session: {sessionId.slice(0, 20)}...
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    }>
      <PurchaseSuccessContent />
    </Suspense>
  )
}
