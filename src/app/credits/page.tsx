'use client'

import { useState, useEffect, Suspense } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'
import PricingExperience from '@/components/marketing/PricingExperience'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession, getValidSession } from '@/lib/directAuth'
import { CARD_LOVERS_PLANS, VIP_PACKAGE, type PricingTier } from '@/lib/creditPackages'
import {
  clearPurchaseIntent,
  purchaseIntentReturnUrl,
  readPromoFromUrl,
  readPurchaseIntent,
  savePurchaseIntent,
  type PurchaseIntent,
} from '@/lib/purchaseIntent'


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
  const [cardLoversSelectedPlan, setCardLoversSelectedPlan] = useState<'monthly' | 'annual'>('monthly')
  const [isCardLover, setIsCardLover] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [highlightPack, setHighlightPack] = useState<'basic' | 'pro' | 'elite' | 'vip' | null>(null)
  const [promoCode, setPromoCode] = useState<'GRADE10' | 'GRADE20' | null>(null)

  // Check for canceled payment and welcome parameter
  const canceled = searchParams.get('canceled')
  const welcome = searchParams.get('welcome')
  const resume = searchParams.get('resume')

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

  // Promo codes only ever arrive from the post-grade email series, and only
  // GRADE10/GRADE20 are real. Anything else reads as null.
  useEffect(() => {
    setPromoCode(readPromoFromUrl(window.location.search))
  }, [])

  // Coming back from signup with a saved choice. Preselect it and scroll to it.
  // We never start checkout on the user's behalf — they press the button.
  useEffect(() => {
    if (resume !== '1' || isAuthenticated !== true) return
    const intent = readPurchaseIntent()
    if (!intent) return

    if (intent.product === 'card_lovers' && intent.plan) {
      setCardLoversSelectedPlan(intent.plan)
    } else if (intent.product === 'pack' && intent.pack) {
      setHighlightPack(intent.pack)
    }
    setResumed(true)
    clearPurchaseIntent()

    const targetId = intent.product === 'card_lovers' ? 'plan-card-lovers' : `plan-${intent.pack || 'pro'}`
    // One frame so the preselected card is rendered before we scroll to it.
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [resume, isAuthenticated])

  // A signed-out visitor who picked something has already made the decision.
  // Park it, then send them to signup and bring them back to the same choice.
  const sendToSignup = (intent: PurchaseIntent) => {
    const refCode = typeof window !== 'undefined' ? localStorage.getItem('dcm_ref_code') : null
    savePurchaseIntent({ ...intent, ...(refCode ? { ref: refCode } : {}), at: Date.now() })
    const returnUrl = purchaseIntentReturnUrl(intent)
    try {
      localStorage.setItem('auth_redirect', returnUrl)
    } catch {
      // Storage is unavailable. The redirect param below still works.
    }
    router.push(`/login?mode=signup&redirect=${encodeURIComponent(returnUrl)}`)
  }


  const handlePurchase = async (tier: PricingTier) => {
    // If not authenticated, save the choice and redirect to signup
    if (!isAuthenticated) {
      sendToSignup({ product: 'pack', pack: tier.id, returnTo: '/credits', at: Date.now() })
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
    // If not authenticated, save the choice and redirect to signup
    if (!isAuthenticated) {
      sendToSignup({ product: 'pack', pack: 'vip', returnTo: '/credits', at: Date.now() })
      return
    }

    setError(null)
    setPurchaseLoading('vip')

    // Track begin_checkout event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: VIP_PACKAGE.price,
        items: [{
          item_id: 'vip',
          item_name: 'VIP Package',
          price: VIP_PACKAGE.price,
          quantity: 1
        }]
      })
    }

    // Track Meta/Facebook InitiateCheckout event
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        value: VIP_PACKAGE.price,
        currency: 'USD',
        content_type: 'product',
        content_ids: ['vip'],
        num_items: VIP_PACKAGE.credits
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
        // ref_code was missing here, so VIP, the largest one-time ticket,
        // never paid affiliate commission.
        body: JSON.stringify({ tier: 'vip', ref_code: (typeof window !== 'undefined' && localStorage.getItem('dcm_ref_code')) || undefined }),
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
      sendToSignup({ product: 'card_lovers', plan: cardLoversSelectedPlan, returnTo: '/credits', at: Date.now() })
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
          value: CARD_LOVERS_PLANS[cardLoversSelectedPlan].price,
          currency: 'USD',
        })
      }

      // /card-lovers has always forwarded the referral code here; /credits did
      // not, so an affiliate lost the commission when the same person subscribed
      // from the pricing page.
      const refCode = typeof window !== 'undefined' ? localStorage.getItem('dcm_ref_code') : null

      const response = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: cardLoversSelectedPlan, ref_code: refCode || undefined }),
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
    resumed={resumed} highlightPack={highlightPack} promoCode={promoCode}
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
