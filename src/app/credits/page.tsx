'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession } from '@/lib/directAuth'
import { loadStripe } from '@stripe/stripe-js'
import FloatingCardsBackground from '../ui/FloatingCardsBackground'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PricingTier {
  id: 'basic' | 'pro' | 'elite'
  name: string
  price: number
  credits: number
  description: string
  popular?: boolean
}

const pricingTiers: PricingTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 2.99,
    credits: 1,
    description: 'Perfect for trying out DCM Grading',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    credits: 5,
    description: 'Best value for casual collectors',
    popular: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 19.99,
    credits: 20,
    description: 'For serious collectors and dealers',
  },
]

function CreditsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { balance, isLoading, isFirstPurchase, refreshCredits } = useCredits()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)

  // Check for canceled payment and welcome parameter
  const canceled = searchParams.get('canceled')
  const welcome = searchParams.get('welcome')

  useEffect(() => {
    const session = getStoredSession()
    // Set authentication state but don't redirect - page works for everyone
    setIsAuthenticated(!!session?.access_token)
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

  const handlePurchase = async (tier: PricingTier) => {
    // If not authenticated, redirect to signup
    if (!isAuthenticated) {
      router.push('/login?mode=signup&redirect=/credits')
      return
    }

    setError(null)
    setPurchaseLoading(tier.id)

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
                    AI-Powered Card Grading
                  </h2>
                  <p className="text-lg text-white/90 mb-6 max-w-2xl mx-auto">
                    Get professional-quality grades for your trading cards in seconds.
                    Our DCM Optic technology analyzes centering, corners, edges, and surface quality.
                  </p>

                  {/* How It Works Steps */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-6">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">1</div>
                      <p className="font-semibold">Sign Up Free</p>
                      <p className="text-sm text-white/70">Create your account</p>
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
                    <span>First-time buyers get +1 FREE bonus credit!</span>
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
                    Our AI-powered grading system analyzes centering, corners, edges, and surface quality.
                  </p>

                  {/* How It Works Steps */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-6">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-3xl mb-2">1</div>
                      <p className="font-semibold">Purchase Credits</p>
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
                    <span>First-time buyers get +1 FREE bonus credit!</span>
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
              Get professional AI-powered card grading in seconds
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

            {/* First Purchase Bonus Banner - Only for logged-in first-time buyers */}
            {isAuthenticated && isFirstPurchase && (
              <div className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full px-6 py-2 shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                <span className="font-semibold">First Purchase Bonus: +1 FREE Credit!</span>
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
        <div className="grid md:grid-cols-3 gap-8">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-105 ${
                tier.popular ? 'ring-4 ring-purple-500 ring-opacity-50' : ''
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  MOST POPULAR
                </div>
              )}

              <div className="p-8">
                {/* Tier Name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                <p className="text-gray-500 mb-6">{tier.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">${tier.price}</span>
                </div>

                {/* Credits */}
                <div className="mb-6 p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-purple-600">{tier.credits}</span>
                    <span className="text-gray-600">credit{tier.credits !== 1 ? 's' : ''}</span>
                  </div>
                  {(isAuthenticated ? isFirstPurchase : true) && (
                    <div className="mt-2 text-sm text-green-600 font-semibold">
                      + 1 bonus = {tier.credits + 1} total
                    </div>
                  )}
                </div>

                {/* Per Credit Cost */}
                <p className="text-sm text-gray-500 mb-6 text-center">
                  ${(tier.price / tier.credits).toFixed(2)} per grade
                </p>

                {/* Purchase Button - Different for logged in vs logged out */}
                {isAuthenticated ? (
                  <button
                    onClick={() => handlePurchase(tier)}
                    disabled={purchaseLoading !== null}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
                      tier.popular
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                    className={`block w-full py-4 px-6 rounded-xl font-bold text-lg text-center transition-all duration-200 ${
                      tier.popular
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
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
              { icon: '🎯', title: 'AI Grading', desc: 'Professional-grade analysis' },
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
              <p className="text-gray-600">One credit = one card grade. Re-grading a card also costs 1 credit.</p>
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
