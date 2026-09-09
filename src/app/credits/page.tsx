'use client'

import { useState, useEffect, Suspense } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'
import PricingExperience from '@/components/marketing/PricingExperience'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession, getValidSession } from '@/lib/directAuth'
import { type PricingTier } from '@/lib/creditPackages'


// Pack pricing lives in @/lib/creditPackages so marketing surfaces (blog
// embeds, landing pages) render the same numbers checkout charges.

function CreditsLoadingShell() {
  return <div className="dcm-brand dcm-container dcm-section" role="status" aria-live="polite">Loading card grading pricing…</div>
}

function CreditsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { balance, isLoading, isFirstPurchase } = useCredits()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isFounder, setIsFounder] = useState(false)
  const [cardLoversSelectedPlan, setCardLoversSelectedPlan] = useState<'monthly' | 'annual'>('annual')
  const [isCardLover, setIsCardLover] = useState(false)

  // Check for canceled payment and welcome parameter
  const canceled = searchParams.get('canceled')
  const welcome = searchParams.get('welcome')

  // Reset loading state when page is restored from bfcache (e.g. returning from Stripe)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setPurchaseLoading(null)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // Fire credits_pricing_viewed once per page load. Lets us measure how often
  // users reach the pricing surface vs. actually convert (handlePurchase fires
  // begin_checkout below).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'credits_pricing_viewed', {
          event_category: 'conversion',
        })
      }
      if (window.fbq) {
        window.fbq('track', 'ViewContent', {
          content_type: 'pricing_page',
          content_name: 'Credits Pricing',
        })
      }
      console.log('[Credits] credits_pricing_viewed event tracked')
    }
  }, [])

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

      // Check Card Lover subscription status
      fetch('/api/subscription/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.isActive) {
            setIsCardLover(true)
          }
        })
        .catch(err => console.error('Error checking subscription status:', err))
    }
  }, [])

  useEffect(() => {
    if (canceled) {
      setPurchaseLoading(null)
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
      const session = await getValidSession()
      if (!session?.access_token) {
        router.push('/login?redirect=/credits')
        return
      }

      // Get referral code from localStorage if present
      const refCode = typeof window !== 'undefined' ? localStorage.getItem('dcm_ref_code') : null

      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier: tier.id, ref_code: refCode || undefined }),
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

  const handleVipPurchase = async () => {
    // If not authenticated, redirect to signup
    if (!isAuthenticated) {
      router.push('/login?mode=signup&redirect=/credits')
      return
    }

    setError(null)
    setPurchaseLoading('vip')

    // Track begin_checkout event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: 99,
        items: [{
          item_id: 'vip',
          item_name: 'VIP Package',
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
        content_ids: ['vip'],
        num_items: 150
      })
    }

    try {
      const session = await getValidSession()
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
        body: JSON.stringify({ tier: 'vip' }),
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
      console.error('VIP purchase error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setPurchaseLoading(null)
    }
  }

  // Handle Card Lovers subscription
  const handleCardLoversSubscribe = async () => {
    if (!isAuthenticated) {
      router.push('/login?mode=signup&redirect=/credits')
      return
    }

    if (isCardLover) {
      return
    }

    setPurchaseLoading('card_lovers')
    setError(null)

    try {
      const session = await getValidSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Track subscription attempt
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
          content_type: 'subscription',
          content_ids: [`card_lovers_${cardLoversSelectedPlan}`],
          value: cardLoversSelectedPlan === 'monthly' ? 49.99 : 449,
          currency: 'USD',
        })
      }

      const response = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: cardLoversSelectedPlan }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Card Lovers subscription error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setPurchaseLoading(null)
    }
  }

  return <PricingExperience
    authenticated={isAuthenticated} balance={balance} balanceLoading={isLoading}
    firstPurchase={isFirstPurchase} founder={isFounder} cardLover={isCardLover}
    welcome={showWelcome} error={error} purchaseLoading={purchaseLoading}
    selectedPlan={cardLoversSelectedPlan} onPlanChange={setCardLoversSelectedPlan}
    onPurchase={handlePurchase} onVipPurchase={handleVipPurchase}
    onSubscribe={handleCardLoversSubscribe} onDismissWelcome={() => setShowWelcome(false)}
  />
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<CreditsLoadingShell />}>
      <CreditsPageContent />
    </Suspense>
  )
}
