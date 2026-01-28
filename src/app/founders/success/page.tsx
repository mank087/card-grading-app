'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCredits } from '@/contexts/CreditsContext'
import Link from 'next/link'
import Image from 'next/image'

// Declare tracking pixels for TypeScript
declare global {
  interface Window {
    rdt: (...args: unknown[]) => void
    gtag: (...args: unknown[]) => void
    fbq: (...args: unknown[]) => void
  }
}

function FounderSuccessContent() {
  const searchParams = useSearchParams()
  const { balance, refreshCredits } = useCredits()
  const [isLoading, setIsLoading] = useState(true)
  const hasTrackedPurchase = useRef(false)

  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    // Track purchase conversions (only once)
    if (!hasTrackedPurchase.current && typeof window !== 'undefined' && sessionId) {
      // Track Reddit Purchase conversion
      if (window.rdt) {
        window.rdt('track', 'Purchase', {
          conversionId: `founders_${sessionId}`
        })
        console.log('[Reddit Pixel] Founders Purchase event tracked')
      }

      // Track Google Ads Purchase conversion
      if (window.gtag) {
        window.gtag('event', 'ads_conversion_PURCHASE_1', {
          transaction_id: `founders_${sessionId}`,
          value: 99,
          currency: 'USD'
        })
        console.log('[Google Ads] Founders Purchase conversion tracked')
      }

      // Track GA4 purchase event with ecommerce data
      if (window.gtag) {
        window.gtag('event', 'purchase', {
          transaction_id: sessionId,
          value: 99,
          currency: 'USD',
          items: [{
            item_id: 'founders',
            item_name: 'Founders Package',
            price: 99,
            quantity: 1
          }]
        })
        console.log('[GA4] Founders purchase event tracked')
      }

      // Track Meta/Facebook Purchase conversion
      if (window.fbq) {
        window.fbq('track', 'Purchase', {
          value: 99,
          currency: 'USD',
          content_type: 'product',
          content_ids: ['founders'],
          num_items: 150
        })
        console.log('[Meta Pixel] Founders Purchase event tracked')
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
  }, [refreshCredits, sessionId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
        {/* Success Icon with Star */}
        <div className="mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, Founder!
          </h1>
          <p className="text-gray-600">
            You&apos;re now part of an exclusive group of DCM early supporters.
          </p>
        </div>

        {/* Benefits Recap */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 mb-6 text-white text-left">
          <div className="flex items-center gap-2 mb-4">
            <Image src="/DCM-logo.png" alt="DCM" width={32} height={32} className="rounded" />
            <span className="font-semibold">Your Founder Benefits</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span><strong>150 credits</strong> added to your account</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span><strong>20% off</strong> all future purchases (forever)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span><strong>Founder badge</strong> on your collection & labels</span>
            </div>
          </div>
        </div>

        {/* Credits Display */}
        <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl p-6 mb-8">
          <p className="text-gray-600 mb-2">Your credit balance</p>
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
          <Link
            href="/account"
            className="block w-full text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors text-sm"
          >
            Manage Founder Badge Settings
          </Link>
        </div>

        {/* Receipt Info */}
        <p className="mt-8 text-sm text-gray-500">
          A receipt has been sent to your email.
        </p>
      </div>
    </div>
  )
}

export default function FounderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    }>
      <FounderSuccessContent />
    </Suspense>
  )
}
