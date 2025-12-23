'use client'

import { useState, useEffect, Suspense } from 'react'

// Declare gtag and fbq for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    fbq: (...args: any[]) => void
  }
}
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession } from '@/lib/directAuth'
import { loadStripe } from '@stripe/stripe-js'
import Image from 'next/image'
import FloatingCardsBackground from '../ui/FloatingCardsBackground'

// Founder discount constant
const FOUNDER_DISCOUNT = 0.2 // 20% off

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PricingTier {
  id: 'basic' | 'pro' | 'elite'
  name: string
  price: number
  credits: number
  bonusCredits: number
  description: string
  popular?: boolean
  icon: string
  color: string
  bgGradient: string
  savingsPercent?: number
  perGradeCost: number
}

// Base price per credit (Basic tier: $2.99/credit)
const BASE_PRICE_PER_CREDIT = 2.99

const pricingTiers: PricingTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 2.99,
    credits: 1,
    bonusCredits: 1,
    description: 'Perfect for trying out DCM Grading',
    icon: '⭐',
    color: 'blue',
    bgGradient: 'from-blue-500 to-blue-600',
    perGradeCost: 2.99,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    credits: 5,
    bonusCredits: 3,
    description: 'Best value for casual collectors',
    popular: true,
    icon: '🚀',
    color: 'purple',
    bgGradient: 'from-purple-600 to-indigo-600',
    savingsPercent: 33,
    perGradeCost: 2.00,
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 19.99,
    credits: 20,
    bonusCredits: 5,
    description: 'For serious collectors and dealers',
    icon: '👑',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-600',
    savingsPercent: 67,
    perGradeCost: 1.00,
  },
]

// Countdown end date: January 1, 2026 at 12:00 AM EST (midnight)
const COUNTDOWN_END = new Date('2026-01-01T00:00:00-05:00').getTime()

function CreditsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { balance, isLoading, isFirstPurchase, refreshCredits } = useCredits()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isFounder, setIsFounder] = useState(false)
  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number; secs: number } | null>(null)

  // Check for canceled payment and welcome parameter
  const canceled = searchParams.get('canceled')
  const welcome = searchParams.get('welcome')

  useEffect(() => {
    const session = getStoredSession()
    // Set authentication state but don't redirect - page works for everyone
    setIsAuthenticated(!!session?.access_token)

    // Check founder status if authenticated
    if (session?.access_token) {
      fetch('/api/founders/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.isFounder) {
            setIsFounder(true)
          }
        })
        .catch(err => console.error('Error checking founder status:', err))
    }
  }, [])

  useEffect(() => {
    if (canceled) {
      setError('Payment was canceled. No charges were made.')
      // Clear the query param
      router.replace('/credits')
    }
  }, [canceled, router])

  // Show welcome message for new users
  useEffect(() => {
    if (welcome === 'true') {
      setShowWelcome(true)
      // Clear the query param without losing state
      router.replace('/credits')
    }
  }, [welcome, router])

  // Countdown timer for Founders offer
  useEffect(() => {
    const calculateCountdown = () => {
      const now = Date.now()
      const difference = COUNTDOWN_END - now

      if (difference <= 0) {
        return { days: 0, hours: 0, mins: 0, secs: 0 }
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((difference % (1000 * 60)) / 1000),
      }
    }

    // Set initial value
    setCountdown(calculateCountdown())

    const timer = setInterval(() => {
      setCountdown(calculateCountdown())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const handlePurchase = async (tier: PricingTier) => {
    // If not authenticated, redirect to signup
    if (!isAuthenticated) {
      router.push('/login?mode=signup&redirect=/credits')
      return
    }

    setError(null)
    setPurchaseLoading(tier.id)

    // Track begin_checkout event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: tier.price,
        items: [{
          item_id: tier.id,
          item_name: `${tier.credits} Credits`,
          price: tier.price,
          quantity: 1
        }]
      })
      console.log('[GA4] begin_checkout event tracked:', tier.id, tier.price)
    }

    // Track Meta/Facebook InitiateCheckout event
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        value: tier.price,
        currency: 'USD',
        content_type: 'product',
        content_ids: [tier.id],
        num_items: tier.credits
      })
      console.log('[Meta Pixel] InitiateCheckout event tracked:', tier.id, tier.price)
    }

    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        router.push('/login?redirect=/credits')
        return
      }

      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier: tier.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Purchase error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setPurchaseLoading(null)
    }
  }

  const handleFoundersPurchase = async () => {
    // If not authenticated, redirect to signup
    if (!isAuthenticated) {
      router.push('/login?mode=signup&redirect=/credits')
      return
    }

    setError(null)
    setPurchaseLoading('founders')

    // Track begin_checkout event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: 99,
        items: [{
          item_id: 'founders',
          item_name: 'Founders Package',
          price: 99,
          quantity: 1
        }]
      })
    }

    // Track Meta/Facebook InitiateCheckout event
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        value: 99,
        currency: 'USD',
        content_type: 'product',
        content_ids: ['founders'],
        num_items: 150
      })
    }

    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        router.push('/login?redirect=/credits')
        return
      }

      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier: 'founders' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Founders purchase error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setPurchaseLoading(null)
    }
  }

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 relative">
      <FloatingCardsBackground />
      <div className="py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Hero Banner for Logged-Out Users */}
          {!isAuthenticated && (
            <div className="mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl overflow-hidden">
              <div className="relative px-6 py-8 sm:px-10 sm:py-10">
                <div className="text-center text-white">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                    DCM Optic™ Card Grading
                  </h2>
                  <p className="text-lg text-white/90 mb-6 max-w-2xl mx-auto">
                    Get professional-quality grades for your trading cards in seconds.
                    Our DCM Optic™ technology analyzes centering, corners, edges, and surface quality.
                  </p>

                  {/* How It Works Steps */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-6">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">1</div>
                      <p className="font-semibold">Create Your Account</p>
                      <p className="text-sm text-white/70">Sign up free</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">2</div>
                      <p className="font-semibold">Fund Your Account</p>
                      <p className="text-sm text-white/70">Purchase credits</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">3</div>
                      <p className="font-semibold">Get Your Grade</p>
                      <p className="text-sm text-white/70">Results in seconds</p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm font-medium">
                    <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                    <span>DCM Launch Special - New Users get FREE bonus Credits!</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Welcome Banner for New Logged-In Users */}
          {isAuthenticated && showWelcome && (
            <div className="mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl overflow-hidden">
              <div className="relative px-6 py-8 sm:px-10 sm:py-10">
                {/* Close button */}
                <button
                  onClick={() => setShowWelcome(false)}
                  className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                  aria-label="Dismiss welcome message"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="text-center text-white">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                    Welcome to DCM Grading!
                  </h2>
                  <p className="text-lg text-white/90 mb-6 max-w-2xl mx-auto">
                    Your account is ready! Get started by purchasing credits to grade your first card.
                    Our DCM Optic™ grading system analyzes centering, corners, edges, and surface quality.
                  </p>

                  {/* How It Works Steps */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-6">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">1</div>
                      <p className="font-semibold">Fund Your Account</p>
                      <p className="text-sm text-white/70">Choose a package below</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">2</div>
                      <p className="font-semibold">Upload Card Photos</p>
                      <p className="text-sm text-white/70">Front and back images</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">3</div>
                      <p className="font-semibold">Get Your Grade</p>
                      <p className="text-sm text-white/70">Results in seconds</p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm font-medium">
                    <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                    <span>DCM Launch Special - New Users get FREE bonus Credits!</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {!isAuthenticated ? 'Pricing' : (showWelcome ? 'Choose Your Credit Package' : 'Purchase Grading Credits')}
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Get professional DCM Optic™ card grading in seconds
            </p>

            {/* Current Balance - Only for logged-in users */}
            {isAuthenticated && (
              <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 shadow-md border border-purple-200">
                <span className="text-gray-600">Your Balance:</span>
                {isLoading ? (
                  <span className="animate-pulse bg-gray-200 rounded w-8 h-6"></span>
                ) : (
                  <span className="text-2xl font-bold text-purple-600">{balance}</span>
                )}
                <span className="text-gray-600">credit{balance !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Founder Discount Banner */}
            {isAuthenticated && isFounder && (
              <div className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 rounded-full px-6 py-2 shadow-lg">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-semibold">Founder Discount: 20% off all credit packages!</span>
              </div>
            )}

            {/* First Purchase Bonus Banner - Only for logged-in first-time buyers (not founders) */}
            {isAuthenticated && isFirstPurchase && !isFounder && (
              <div className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full px-6 py-2 shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                <span className="font-semibold">DCM Launch Special - New Users get FREE bonus Credits!</span>
              </div>
            )}
          </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className={`grid md:grid-cols-2 ${isFounder ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
          {/* Founders Package - Special Limited-Time Offer */}
          {!isFounder && (
            <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ring-4 ring-yellow-400 flex flex-col">
              {/* Colored Header Bar - Fixed Height */}
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-4 h-[88px] relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    <h3 className="text-xl font-bold text-gray-900">Founders</h3>
                  </div>
                  <div className="text-right">
                    <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      LIMITED TIME
                    </div>
                    {countdown && (
                      <div className="bg-gray-900/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded mt-1">
                        {countdown.days}d {countdown.hours.toString().padStart(2, '0')}:{countdown.mins.toString().padStart(2, '0')}:{countdown.secs.toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 inline-block bg-white/30 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  🚀 BEST VALUE
                </div>
              </div>

              {/* Card Body - Flex grow to fill space */}
              <div className="p-5 flex flex-col flex-grow">
                {/* Price Section - Fixed Height */}
                <div className="text-center mb-3 h-[60px] flex flex-col justify-center">
                  <div>
                    <span className="text-3xl font-bold text-gray-900">$99</span>
                    <span className="text-gray-500 text-sm ml-1">one-time</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Lifetime benefits for early supporters</p>
                </div>

                {/* Credits Display - Fixed Height */}
                <div className="mb-3 p-3 bg-gray-50 rounded-xl text-center h-[52px] flex items-center justify-center">
                  <span className="text-2xl font-bold text-yellow-600">150</span>
                  <span className="text-gray-600 ml-2">credits</span>
                </div>

                {/* Per Grade Cost - Fixed Height */}
                <div className="mb-3 p-2.5 rounded-lg bg-yellow-50 border border-yellow-300 h-[56px] flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs font-medium">Cost per grade:</span>
                    <span className="text-lg font-bold text-yellow-600">$0.66</span>
                  </div>
                  <div className="text-yellow-700 text-[10px] font-semibold">Save 78% vs Basic!</div>
                </div>

                {/* Benefits Section - Flex grow to push button down */}
                <div className="flex-grow mb-3 p-2.5 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
                  <div className="text-yellow-800 font-bold text-xs mb-1.5">Lifetime Benefits:</div>
                  <ul className="text-yellow-700 text-xs space-y-1">
                    <li className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      20% off future purchases
                    </li>
                    <li className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Exclusive Founder badge
                    </li>
                    <li className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Founder emblem on labels
                    </li>
                  </ul>
                </div>

                {/* CTA Button - Always at bottom */}
                {isAuthenticated ? (
                  <button
                    onClick={handleFoundersPurchase}
                    disabled={purchaseLoading !== null}
                    className="w-full py-3 px-4 rounded-xl font-bold text-base transition-all duration-200 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchaseLoading === 'founders' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Become a Founder'
                    )}
                  </button>
                ) : (
                  <Link
                    href="/login?mode=signup&redirect=/credits"
                    className="block w-full py-3 px-4 rounded-xl font-bold text-base text-center transition-all duration-200 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 shadow-lg hover:shadow-xl"
                  >
                    Sign Up to Purchase
                  </Link>
                )}
              </div>
            </div>
          )}

          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] flex flex-col ${
                tier.popular
                  ? 'ring-4 ring-purple-500 shadow-2xl'
                  : 'hover:shadow-2xl'
              }`}
            >
              {/* Colored Header Bar - Fixed Height */}
              <div className={`bg-gradient-to-r ${tier.bgGradient} px-5 py-4 h-[88px]`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{tier.icon}</span>
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                  </div>
                  {tier.savingsPercent ? (
                    <div className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <span className="text-white font-bold text-xs">Save {tier.savingsPercent}%</span>
                    </div>
                  ) : <div className="w-16"></div>}
                </div>
                {tier.popular ? (
                  <div className="mt-1.5 inline-block bg-white text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ⭐ MOST POPULAR
                  </div>
                ) : (
                  <div className="mt-1.5 h-[18px]"></div>
                )}
              </div>

              {/* Card Body - Flex grow to fill space */}
              <div className="p-5 flex flex-col flex-grow">
                {/* Price Section - Fixed Height */}
                <div className="text-center mb-3 h-[60px] flex flex-col justify-center">
                  {isFounder ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl text-gray-400 line-through">${tier.price.toFixed(2)}</span>
                      <span className="text-3xl font-bold text-gray-900">
                        ${(tier.price * (1 - FOUNDER_DISCOUNT)).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-3xl font-bold text-gray-900">${tier.price}</span>
                  )}
                  <p className="text-gray-500 text-xs mt-1">{tier.description}</p>
                </div>

                {/* Credits Display - Fixed Height */}
                <div className="mb-3 p-3 bg-gray-50 rounded-xl text-center h-[52px] flex items-center justify-center">
                  <span className={`text-2xl font-bold ${
                    tier.color === 'blue' ? 'text-blue-600' :
                    tier.color === 'purple' ? 'text-purple-600' :
                    'text-amber-600'
                  }`}>{tier.credits}</span>
                  <span className="text-gray-600 ml-2">credit{tier.credits !== 1 ? 's' : ''}</span>
                </div>

                {/* Per Grade Cost - Fixed Height */}
                <div className={`mb-3 p-2.5 rounded-lg h-[56px] flex flex-col justify-center ${
                  isFounder ? 'bg-yellow-50 border border-yellow-300' :
                  tier.color === 'blue' ? 'bg-blue-50 border border-blue-200' :
                  tier.color === 'purple' ? 'bg-purple-50 border border-purple-200' :
                  'bg-amber-50 border border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs font-medium">Cost per grade:</span>
                    <span className={`text-lg font-bold ${
                      isFounder ? 'text-yellow-600' :
                      tier.color === 'blue' ? 'text-blue-600' :
                      tier.color === 'purple' ? 'text-purple-600' :
                      'text-amber-600'
                    }`}>
                      ${isFounder
                        ? (tier.perGradeCost * (1 - FOUNDER_DISCOUNT)).toFixed(2)
                        : tier.perGradeCost.toFixed(2)}
                    </span>
                  </div>
                  {isFounder ? (
                    <div className="text-yellow-700 text-[10px] font-semibold flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Founder discount applied!
                    </div>
                  ) : tier.savingsPercent ? (
                    <div className="text-green-600 text-[10px] font-semibold">
                      Save ${((BASE_PRICE_PER_CREDIT - tier.perGradeCost) * tier.credits).toFixed(2)} vs Basic
                    </div>
                  ) : (
                    <div className="text-gray-400 text-[10px]">Standard rate</div>
                  )}
                </div>

                {/* Bonus/Features Section - Flex grow to push button down */}
                <div className="flex-grow mb-3">
                  {(isAuthenticated ? isFirstPurchase : true) && (
                    <div className="p-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl h-full flex items-center justify-center">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 text-lg">🎁</span>
                        <div className="text-center">
                          <div className="text-green-700 font-bold text-xs">First Purchase Bonus!</div>
                          <div className="text-green-600 text-sm font-bold">
                            +{tier.bonusCredits} FREE = {tier.credits + tier.bonusCredits} total
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Purchase Button - Always at bottom */}
                {isAuthenticated ? (
                  <button
                    onClick={() => handlePurchase(tier)}
                    disabled={purchaseLoading !== null}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-base transition-all duration-200 bg-gradient-to-r ${tier.bgGradient} hover:opacity-90 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {purchaseLoading === tier.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      `Buy ${tier.credits} Credit${tier.credits !== 1 ? 's' : ''}`
                    )}
                  </button>
                ) : (
                  <Link
                    href="/login?mode=signup&redirect=/credits"
                    className={`block w-full py-3 px-4 rounded-xl font-bold text-base text-center transition-all duration-200 bg-gradient-to-r ${tier.bgGradient} hover:opacity-90 text-white shadow-lg hover:shadow-xl`}
                  >
                    Sign Up to Purchase
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">What You Get</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: '🎯', title: 'DCM Optic™ Grading', desc: 'Professional-grade analysis' },
              { icon: '⚡', title: 'Instant Results', desc: 'Grade cards in seconds' },
              { icon: '📊', title: 'Detailed Reports', desc: 'Comprehensive breakdown' },
              { icon: '🔒', title: 'Secure', desc: 'Your data is protected' },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-md">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-gray-900">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Graded Cards Showcase */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Recently Graded Cards</h2>
          <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            See examples of cards graded by our DCM Optic™ system. Every card receives detailed analysis of centering, corners, edges, and surface quality.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { src: '/DCM-Card-Shohei-Ohtani-496896-front.jpg', name: 'Shohei Ohtani', type: 'Sports' },
              { src: '/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg', name: 'Umbreon ex', type: 'Pokémon' },
              { src: '/Sports/DCM-Card-LeBron-James-547249-front.jpg', name: 'LeBron James', type: 'Sports' },
              { src: '/DCM-Card-Lugia-217275-front.jpg', name: 'Lugia', type: 'Pokémon' },
            ].map((card, i) => (
              <div key={i} className="group">
                <div className="relative aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
                  <Image
                    src={card.src}
                    alt={`${card.name} graded card`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="font-bold text-sm">{card.name}</p>
                    <p className="text-xs text-white/80">{card.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-gray-900 mb-2">Do credits expire?</h3>
              <p className="text-gray-600">No, your credits never expire. Use them whenever you&apos;re ready!</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-gray-900 mb-2">What counts as 1 credit?</h3>
              <p className="text-gray-600">One credit = one card grade.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-gray-900 mb-2">Is my payment secure?</h3>
              <p className="text-gray-600">Yes! All payments are processed securely through Stripe, the industry leader in payment security.</p>
            </div>
          </div>
        </div>

        {/* Sign Up CTA for logged-out users */}
        {!isAuthenticated && (
          <div className="mt-16 text-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
              <p className="text-gray-600 mb-6">
                Create your free account and start grading your cards today.
              </p>
              <Link
                href="/login?mode=signup&redirect=/credits"
                className="inline-block bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Sign Up Free
              </Link>
              <p className="mt-4 text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login?mode=login&redirect=/credits" className="text-purple-600 hover:text-purple-700 font-medium">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    }>
      <CreditsPageContent />
    </Suspense>
  )
}
