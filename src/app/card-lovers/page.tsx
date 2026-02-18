'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession } from '@/lib/directAuth'

// Global types for tracking pixels are declared elsewhere

interface SubscriptionStatus {
  isActive: boolean
  plan: 'monthly' | 'annual' | null
  monthsActive: number
  currentPeriodEnd: string | null
  nextLoyaltyBonus: {
    atMonth: number
    credits: number
    monthsUntil: number
  } | null
}

export default function CardLoversPage() {
  const router = useRouter()
  const { refreshCredits } = useCredits()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Reset loading state when page is restored from bfcache (e.g. returning from Stripe)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setPurchasing(false)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // Check authentication and subscription status
  useEffect(() => {
    const session = getStoredSession()
    const authenticated = !!session?.access_token
    setIsAuthenticated(authenticated)

    async function checkSubscriptionStatus() {
      if (!authenticated) {
        setCheckingStatus(false)
        return
      }

      try {
        const session = getStoredSession()
        const response = await fetch('/api/subscription/status', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setSubscriptionStatus(data)
        }
      } catch (error) {
        console.error('Error checking subscription status:', error)
      } finally {
        setCheckingStatus(false)
      }
    }

    checkSubscriptionStatus()
  }, [])

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    if (!isAuthenticated) {
      router.push('/login?mode=signup&redirect=/card-lovers')
      return
    }

    if (subscriptionStatus?.isActive) {
      return
    }

    setPurchasing(true)

    try {
      const session = getStoredSession()
      const refCode = typeof window !== 'undefined' ? localStorage.getItem('dcm_ref_code') : null
      const response = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan, ref_code: refCode || undefined }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      // Track InitiateCheckout event
      if (typeof window !== 'undefined') {
        const value = plan === 'monthly' ? 49.99 : 449
        if (window.fbq) {
          window.fbq('track', 'InitiateCheckout', {
            value,
            currency: 'USD',
            content_type: 'product',
            content_ids: [`card_lovers_${plan}`],
            num_items: plan === 'monthly' ? 70 : 900
          })
        }
        if (window.gtag) {
          window.gtag('event', 'begin_checkout', {
            value,
            currency: 'USD',
            items: [{ item_id: `card_lovers_${plan}`, item_name: `Card Lovers ${plan}`, price: value }]
          })
        }
      }

      window.location.href = url
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout. Please try again.')
      setPurchasing(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-rose-50 to-pink-50">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-[10%] w-20 h-20 bg-purple-400 rounded-full blur-3xl" />
          <div className="absolute top-40 right-[15%] w-32 h-32 bg-rose-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-[30%] w-24 h-24 bg-pink-400 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-rose-500 text-white px-4 py-2 rounded-full text-sm font-semibold mb-6 shadow-lg">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              Monthly Subscription
            </div>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image src="/DCM-logo.png" alt="DCM" width={80} height={80} className="rounded-xl shadow-lg" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              Become a <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-rose-600">Card Lover</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Get 70 credits every month, exclusive perks, and the best value for collectors who grade regularly.
            </p>

            {subscriptionStatus?.isActive && (
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                You&apos;re a Card Lover!
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Card - Single box with toggle */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto">
            <div className={`relative rounded-3xl shadow-2xl overflow-hidden ${
              subscriptionStatus?.isActive
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300'
                : 'bg-white ring-4 ring-rose-300'
            }`}>
              {/* Header with Toggle */}
              <div className="bg-gradient-to-r from-purple-600 to-rose-500 px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">♥</span>
                    <h3 className="text-2xl font-bold text-white">Card Lovers</h3>
                  </div>
                  {subscriptionStatus?.isActive && (
                    <div className="bg-green-400 text-green-900 text-xs font-bold px-3 py-1 rounded-full">
                      ACTIVE
                    </div>
                  )}
                </div>

                {/* Plan Toggle - Only show if not subscribed */}
                {!subscriptionStatus?.isActive && (
                  <div className="flex items-center justify-center gap-2 bg-white/20 rounded-full p-1">
                    <button
                      onClick={() => setSelectedPlan('annual')}
                      className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                        selectedPlan === 'annual'
                          ? 'bg-white text-purple-700'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      Annual (Save $150)
                    </button>
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                        selectedPlan === 'monthly'
                          ? 'bg-white text-purple-700'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                )}

                {/* Show current plan info if subscribed */}
                {subscriptionStatus?.isActive && (
                  <div className="text-white/90 text-sm">
                    Current plan: <strong>{subscriptionStatus.plan === 'annual' ? 'Annual' : 'Monthly'}</strong>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-6">
                {/* Price Section */}
                <div className="text-center mb-5">
                  {subscriptionStatus?.isActive ? (
                    // Show current subscription info
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-4xl font-bold text-gray-900">
                          {subscriptionStatus.plan === 'annual' ? '$37.42' : '$49.99'}
                        </span>
                        <span className="text-gray-500 text-lg">/month</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">
                        {subscriptionStatus.plan === 'annual'
                          ? 'Billed annually at $449/year'
                          : 'Billed monthly'}
                      </p>
                    </>
                  ) : selectedPlan === 'annual' ? (
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-4xl font-bold text-gray-900">$37.42</span>
                        <span className="text-gray-500 text-lg">/month</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">Billed annually at $449/year</p>
                      <div className="inline-block mt-2 bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">
                        Save $150/year vs monthly
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-4xl font-bold text-gray-900">$49.99</span>
                        <span className="text-gray-500 text-lg">/month</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">Billed monthly, cancel anytime</p>
                    </>
                  )}
                </div>

                {/* Credits Display */}
                <div className="mb-5 p-4 bg-gradient-to-r from-purple-50 to-rose-50 rounded-xl text-center">
                  <span className="text-3xl font-bold text-purple-600">
                    {subscriptionStatus?.isActive
                      ? (subscriptionStatus.plan === 'annual' ? '900' : '70')
                      : (selectedPlan === 'annual' ? '900' : '70')
                    }
                  </span>
                  <span className="text-gray-600 ml-2 text-lg">
                    {subscriptionStatus?.isActive
                      ? (subscriptionStatus.plan === 'annual' ? 'credits upfront' : 'credits/month')
                      : (selectedPlan === 'annual' ? 'credits upfront' : 'credits/month')
                    }
                  </span>
                  {((subscriptionStatus?.isActive && subscriptionStatus.plan === 'annual') ||
                    (!subscriptionStatus?.isActive && selectedPlan === 'annual')) && (
                    <p className="text-sm text-purple-600 mt-1">Includes 60 bonus credits!</p>
                  )}
                </div>

                {/* Benefits */}
                <div className="mb-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700"><strong>20% off</strong> all future additional credit purchases</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700"><strong>Card Lover</strong> heart emblem on labels</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700"><strong>Credits roll over</strong> forever</span>
                  </div>
                  {((subscriptionStatus?.isActive && subscriptionStatus.plan === 'monthly') ||
                    (!subscriptionStatus?.isActive && selectedPlan === 'monthly')) && (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-gray-700"><strong>Loyalty bonuses</strong> at milestones</span>
                    </div>
                  )}
                </div>

                {/* Cost per grade info */}
                <div className="text-center text-sm text-gray-500 mb-5">
                  {subscriptionStatus?.isActive
                    ? (subscriptionStatus.plan === 'annual'
                        ? 'Only $0.50 per grade — Our lowest price!'
                        : '$0.71 per grade • Loyalty bonuses every 3 months')
                    : (selectedPlan === 'annual'
                        ? 'Only $0.50 per grade — Our lowest price!'
                        : '$0.71 per grade • Loyalty bonuses every 3 months')
                  }
                </div>

                {/* CTA Button */}
                {checkingStatus ? (
                  <div className="w-full bg-gray-200 text-gray-500 font-bold py-4 px-6 rounded-xl text-center">
                    Checking status...
                  </div>
                ) : subscriptionStatus?.isActive ? (
                  <div className="space-y-3">
                    <div className="w-full bg-green-500 text-white font-bold py-4 px-6 rounded-xl text-center">
                      You&apos;re a Card Lover!
                    </div>
                    {subscriptionStatus.plan === 'monthly' && (
                      <Link
                        href="/account"
                        className="w-full block bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-bold py-3 px-6 rounded-xl text-center transition-all shadow-md hover:shadow-lg text-sm"
                      >
                        Upgrade to Annual & Save $150/year
                      </Link>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(selectedPlan)}
                    disabled={purchasing}
                    className="w-full bg-gradient-to-r from-purple-600 to-rose-500 hover:from-purple-700 hover:to-rose-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasing ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : isAuthenticated ? (
                      `Subscribe ${selectedPlan === 'annual' ? 'Annually' : 'Monthly'}`
                    ) : (
                      'Sign Up & Subscribe'
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Discount stacking note */}
            <p className="text-gray-500 text-xs mt-4 text-center italic">
              Note: Founder and Card Lover discounts do not stack. If you have both statuses, you&apos;ll receive one 20% discount on credit purchases.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Card Lovers Benefits</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xl">70</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Monthly Credits</h3>
                    <p className="text-gray-600 text-sm">
                      Get 70 grading credits every month. Credits roll over indefinitely — they never expire.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md border border-rose-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Exclusive Card Lovers Emblem</h3>
                    <p className="text-gray-600 text-sm">
                      A special heart emblem appears on all your card labels. Show off your Card Lover status!
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Image
                    src="/Card-Lovers-Label-Emblem-DCM.png"
                    alt="Card Lovers emblem on card label"
                    width={300}
                    height={200}
                    className="rounded-lg shadow-md mx-auto"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">20%</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Discount on Extra Credits</h3>
                    <p className="text-gray-600 text-sm">
                      Need more credits? Get 20% off all credit package purchases while subscribed.
                    </p>
                    <p className="text-gray-500 text-xs mt-2 italic">
                      Note: Founder and Card Lover discounts do not stack. If you have both statuses, you&apos;ll receive one 20% discount on credit purchases.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md border border-rose-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Loyalty Bonuses</h3>
                    <p className="text-gray-600 text-sm">
                      Monthly subscribers earn bonus credits at milestones: +5 at month 3, +10 at month 6, +15 at month 9, +20 at month 12.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Comparison */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Compare the Value</h2>

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-gray-600 font-semibold">Package</th>
                    <th className="px-6 py-4 text-center text-gray-600 font-semibold">Credits</th>
                    <th className="px-6 py-4 text-center text-gray-600 font-semibold">Price</th>
                    <th className="px-6 py-4 text-center text-gray-600 font-semibold">Per Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-6 py-4 text-gray-700">Basic</td>
                    <td className="px-6 py-4 text-center text-gray-700">1</td>
                    <td className="px-6 py-4 text-center text-gray-700">$2.99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$2.99</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-700">Elite</td>
                    <td className="px-6 py-4 text-center text-gray-700">20</td>
                    <td className="px-6 py-4 text-center text-gray-700">$19.99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$1.00</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-700">VIP</td>
                    <td className="px-6 py-4 text-center text-gray-700">150</td>
                    <td className="px-6 py-4 text-center text-gray-700">$99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$0.66</td>
                  </tr>
                  <tr className="bg-gradient-to-r from-purple-50 to-rose-50">
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                        Card Lovers Annual
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-900">900</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-900">$449/yr</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">$0.50</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-gray-500 text-sm">
              Card Lovers Annual offers our absolute lowest price per grade!
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Frequently Asked Questions
            </h2>

            <div className="space-y-4">
              {[
                {
                  q: "Do my credits roll over?",
                  a: "Yes! Unused credits roll over indefinitely. They're yours to keep and use whenever you want, even if you cancel your subscription."
                },
                {
                  q: "What happens if I cancel?",
                  a: "You keep all accumulated credits forever — they're paid for and owned by you. You'll lose access to the 20% discount, badge, and label emblem, but your credits remain in your account."
                },
                {
                  q: "Can I be both a Founder and a Card Lover?",
                  a: "Absolutely! You can have both status badges. In your account settings, you can choose which emblem appears on your labels or show both badges on your collection page."
                },
                {
                  q: "What are the loyalty bonuses?",
                  a: "Monthly subscribers earn bonus credits at milestones: +5 credits at month 3, +10 at month 6, +15 at month 9, and +20 at month 12. That's up to 50 extra credits in your first year!"
                },
                {
                  q: "Can I upgrade from monthly to annual?",
                  a: "Yes! You can upgrade anytime from your account settings. We'll prorate the cost and add the remaining annual credits to your balance."
                }
              ].map((faq, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                  <p className="text-gray-600 text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-900 to-rose-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Become a Card Lover?
          </h2>
          <p className="text-purple-200 mb-8 max-w-xl mx-auto">
            Join our community of passionate collectors and get the best value for your grading needs.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleSubscribe('monthly')}
              disabled={purchasing || checkingStatus || subscriptionStatus?.isActive}
              className="inline-block bg-white text-purple-900 font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {subscriptionStatus?.isActive ? 'Already Subscribed' : 'Subscribe Monthly — $49.99/mo'}
            </button>
            <button
              onClick={() => handleSubscribe('annual')}
              disabled={purchasing || checkingStatus || subscriptionStatus?.isActive}
              className="inline-block bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {subscriptionStatus?.isActive ? 'Already Subscribed' : 'Subscribe Annually — $449/yr'}
            </button>
          </div>

          <p className="mt-6 text-purple-300 text-sm">
            Questions? <Link href="/contact" className="text-white hover:underline">Contact us</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
