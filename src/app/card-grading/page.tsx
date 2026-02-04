'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession, signInWithOAuth, signUp } from '@/lib/directAuth'
import FeaturedCardsShowcase from './LatestCardsShowcase'

// Declare tracking pixels for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    rdt: (...args: any[]) => void
    fbq: (...args: any[]) => void
  }
}

// Track conversion events
const trackSignupClick = (location: string) => {
  if (typeof window !== 'undefined') {
    // Send event to Google Analytics
    if (window.gtag) {
      window.gtag('event', 'signup_click', {
        event_category: 'conversion',
        event_label: location,
        page: 'card-grading-landing'
      })

      // Also send as a conversion event (for Google Ads if connected)
      window.gtag('event', 'conversion', {
        send_to: 'G-YLC2FKKBGC',
        event_category: 'signup',
        event_label: `card_landing_${location}`
      })
    }

    // Track Reddit Lead conversion
    if (window.rdt) {
      const leadId = `lead_card_${Date.now()}_${location}`
      window.rdt('track', 'Lead', {
        conversionId: leadId
      })
      console.log('[Reddit Pixel] Lead event tracked with conversionId:', leadId)
    }

    // Track Meta/Facebook - Use InitiateCheckout for signup clicks (better for optimization)
    // Lead event fires on actual form submission, InitiateCheckout fires on button click
    if (window.fbq) {
      // InitiateCheckout signals intent to convert
      window.fbq('track', 'InitiateCheckout', {
        content_name: 'card_grading_signup_click',
        content_category: 'all_cards',
        content_ids: [location],
        num_items: 1
      })
      // Also fire Lead for broader optimization
      window.fbq('track', 'Lead', {
        content_name: 'card_grading_signup',
        content_category: 'all_cards',
        value: 0,
        currency: 'USD'
      })
      console.log('[Meta Pixel] InitiateCheckout + Lead tracked:', location)
    }

    console.log(`[Analytics] Signup click tracked: ${location}`)
  }
}

export default function CardGradingLanding() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const session = getStoredSession()
    setUser(session?.user || null)
    setIsLoading(false)

    // Track landing page view - Google Analytics
    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'page_view', {
          page_title: 'Card Grading Landing',
          page_location: window.location.href,
          page_path: '/card-grading',
          traffic_source: 'retargeting'
        })
      }

      // Track Meta/Facebook PageView (in addition to the automatic one)
      // This ensures the retargeting page is tracked with custom parameters
      if (window.fbq) {
        window.fbq('track', 'ViewContent', {
          content_name: 'Card Grading Landing Page',
          content_category: 'retargeting',
          content_type: 'landing_page'
        })
        console.log('[Meta Pixel] ViewContent tracked for card-grading landing')
      }

      // Track Reddit page view
      if (window.rdt) {
        window.rdt('track', 'ViewContent')
      }
    }
  }, [])

  const handleOAuthSignup = async (provider: 'google' | 'facebook') => {
    setIsSigningUp(true)
    setOauthProvider(provider)
    setError('')
    trackSignupClick(`${provider}_signup`)

    // Store redirect destination for after signup
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_redirect', '/credits')
      localStorage.setItem('signup_source', 'card_landing')
    }

    try {
      await signInWithOAuth(provider)
    } catch (error: any) {
      console.error('Signup error:', error)
      setError(error.message || 'An error occurred')
      setIsSigningUp(false)
      setOauthProvider(null)
    }
  }

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailLoading(true)
    setError('')
    setSuccessMessage('')
    trackSignupClick('email_signup')

    try {
      const result = await signUp(email, password)
      if (result.error) {
        setError(result.error)
      } else {
        // Track signup conversion
        if (typeof window !== 'undefined') {
          if (window.rdt) {
            window.rdt('track', 'SignUp', { conversionId: `signup_card_${Date.now()}` })
          }
          if (window.gtag) {
            window.gtag('event', 'sign_up', { method: 'email' })
          }
          if (window.fbq) {
            window.fbq('track', 'CompleteRegistration', { content_name: 'Card Landing Email Signup' })
          }
        }
        setSuccessMessage('Account created! Check your email for the confirmation link.')
        setEmail('')
        setPassword('')
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient - Universal DCM theme */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900" />

        {/* Animated cards background - mix of all card types, hidden on mobile */}
        {/* All background images use loading="lazy" since they're decorative */}
        <div className="absolute inset-0 opacity-15 hidden md:block">
          {/* Left side cards - Pokemon */}
          <div className="absolute top-16 left-[3%] w-28 h-40 animate-float-slow">
            <Image src="/promo-charizard.png" alt="" fill className="object-contain rotate-[-12deg]" loading="lazy" sizes="112px" />
          </div>
          <div className="absolute bottom-24 left-[8%] w-24 h-34 animate-float-medium">
            <Image src="/Sports/DCM-Card-LeBron-James-547249-front.jpg" alt="" fill className="object-contain rotate-[8deg]" loading="lazy" sizes="96px" />
          </div>

          {/* Center-left cards */}
          <div className="absolute top-8 left-[22%] w-24 h-34 animate-float-fast">
            <Image src="/promo-umbreon.png" alt="" fill className="object-contain rotate-[6deg]" loading="lazy" sizes="96px" />
          </div>
          <div className="absolute bottom-16 left-[28%] w-26 h-36 animate-float-slow">
            <Image src="/Sports/DCM-Card-Shohei-Ohtani-192904-front.jpg" alt="" fill className="object-contain rotate-[-8deg]" loading="lazy" sizes="104px" />
          </div>

          {/* Center cards - only visible on large screens */}
          <div className="absolute top-32 left-[42%] w-24 h-34 animate-float-medium hidden lg:block">
            <Image src="/homepage-cards/Black Lotus MTG.png" alt="" fill className="object-contain rotate-[10deg]" loading="lazy" sizes="96px" />
          </div>
          <div className="absolute bottom-8 left-[38%] w-22 h-32 animate-float-fast hidden lg:block">
            <Image src="/DCM-Card-Mega-Charizard-X-EX-261763-front.jpg" alt="" fill className="object-contain rotate-[-5deg]" loading="lazy" sizes="88px" />
          </div>

          {/* Extra cards for very wide screens */}
          <div className="absolute top-20 left-[15%] w-20 h-28 animate-float-slow hidden xl:block">
            <Image src="/homepage-cards/Mickey Mouse Brave Little Prince.png" alt="" fill className="object-contain rotate-[15deg]" loading="lazy" sizes="80px" />
          </div>
        </div>

        {/* Simplified mobile background - 2 cards in top hero area only */}
        <div className="absolute inset-0 opacity-10 md:hidden">
          <div className="absolute top-16 left-[5%] w-20 h-28 animate-float-slow">
            <Image src="/promo-charizard.png" alt="" fill className="object-contain rotate-[-10deg]" loading="lazy" sizes="80px" />
          </div>
          <div className="absolute top-24 right-[8%] w-18 h-26 animate-float-medium">
            <Image src="/Sports/DCM-Card-LeBron-James-547249-front.jpg" alt="" fill className="object-contain rotate-[8deg]" loading="lazy" sizes="72px" />
          </div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8 md:py-24">
          {/* Mobile: Animation First */}
          <div className="xl:hidden mb-8">
            <div className="flex items-center justify-center mb-4">
              <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            </div>

            {/* Headline right below logo */}
            <div className="text-center mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight">
                Grade Any Card Instantly
              </h1>
              <p className="text-base text-gray-300">
                No shipping. No waiting. Results in 60 seconds.
              </p>
            </div>

            {/* Bonus Credits Banner - Above the fold */}
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50 rounded-full px-4 py-2">
                <span className="text-green-400 text-lg">🎁</span>
                <span className="text-green-300 text-sm font-semibold">Bonus credits on your first purchase!</span>
              </div>
            </div>

            {/* Latest Cards Showcase - Mobile */}
            <div className="flex justify-center mb-6">
              <FeaturedCardsShowcase />
            </div>

            {/* Signup CTA for mobile */}
            <div className="max-w-sm mx-auto">
              {isLoading ? (
                <div className="w-full bg-gray-700 text-gray-400 font-bold text-lg px-8 py-4 rounded-xl text-center">
                  Loading...
                </div>
              ) : user ? (
                <Link
                  href="/credits"
                  onClick={() => trackSignupClick('hero_mobile_logged_in')}
                  className="block w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg px-8 py-4 rounded-xl hover:from-purple-400 hover:to-pink-400 transition-all text-center shadow-lg shadow-purple-500/30"
                >
                  Get Credits & Start Grading
                </Link>
              ) : (
                <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white text-center">Start Grading Today</h2>
                    <p className="text-purple-200 text-sm text-center">Create your account</p>
                  </div>

                  <div className="p-6">
                    {/* What you get */}
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>AI-powered 30-point inspection</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Centering, corners, edges & surface</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>PSA, BGS, CGC grade estimates</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Downloadable grade report & label</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Results in under 60 seconds</span>
                      </div>
                    </div>

                    {/* Free credit highlight */}
                    <div className="relative mb-5">
                      <div className="absolute -inset-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl blur opacity-40 animate-pulse"></div>
                      <div className="relative bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-400/50 rounded-xl p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl">🎁</span>
                          <span className="text-white font-bold text-xl">Grade Your First Card Free</span>
                        </div>
                        <p className="text-green-300 text-xs mt-1">1 free credit on signup</p>
                      </div>
                    </div>

                    {/* OAuth Buttons */}
                    <div className="space-y-3 mb-4">
                      <button
                        onClick={() => handleOAuthSignup('google')}
                        disabled={isSigningUp || emailLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSigningUp && oauthProvider === 'google' ? (
                          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        )}
                        Continue with Google
                      </button>

                      <button
                        onClick={() => handleOAuthSignup('facebook')}
                        disabled={isSigningUp || emailLoading}
                        className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSigningUp && oauthProvider === 'facebook' ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                        Continue with Facebook
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-3 bg-gray-800 text-gray-400">Or with email</span>
                      </div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSignup} className="space-y-3">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        required
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (min 6 characters)"
                        required
                        minLength={6}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {error && (
                        <p className="text-red-400 text-sm text-center">{error}</p>
                      )}
                      {successMessage && (
                        <p className="text-green-400 text-sm text-center">{successMessage}</p>
                      )}
                      <button
                        type="submit"
                        disabled={emailLoading || isSigningUp}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {emailLoading ? 'Creating Account...' : 'Create Account'}
                      </button>
                    </form>

                    <p className="text-center text-gray-500 text-xs mt-4">
                      By continuing, you agree to our{' '}
                      <Link href="/terms" className="text-purple-400 hover:text-purple-300">Terms of Service</Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-purple-400 hover:text-purple-300">Privacy Policy</Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop: 3-column layout */}
          <div className="hidden xl:flex flex-row items-center gap-6">
            {/* Left: Latest Cards Showcase */}
            <div className="flex-shrink-0 w-[340px]">
              <FeaturedCardsShowcase />
            </div>

            {/* Center: Hero Content */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/DCM Logo white.png" alt="DCM" width={50} height={50} />
              </div>

              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                Grade Any Card Instantly
              </h1>

              <p className="text-xl text-gray-300 mb-4 max-w-xl">
                No shipping. No waiting. Get professional-grade analysis in under 60 seconds.
              </p>

              {/* Bonus Credits Banner - Above the fold */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50 rounded-full px-5 py-2.5 mb-6">
                <span className="text-green-400 text-xl">🎁</span>
                <span className="text-green-300 font-semibold">Bonus credits on your first purchase!</span>
              </div>

              {/* Feature bullets - desktop only */}
              <div className="grid grid-cols-2 gap-4 mb-8 max-w-xl">
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-semibold">Identify Your Card</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed pl-11">Card name, set, number, rarity, player/character, and more</p>
                </div>
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-semibold">Evaluate Condition</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed pl-11">Analysis of centering, corners, edges and surface for front and back</p>
                </div>
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-semibold">Grade Estimates</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed pl-11">PSA, BGS, CGC, SGC grade equivalents & links to marketplace listings</p>
                </div>
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-semibold">Reports & Labels</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed pl-11">Downloadable graded card images, reports and labels</p>
                </div>
              </div>
            </div>

            {/* Right: Signup Card - Desktop */}
            <div className="w-full max-w-md">
              <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white text-center">Start Grading Today</h2>
                  <p className="text-purple-200 text-sm text-center">Create your account</p>
                </div>

                <div className="p-6">
                  {/* What you get */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>AI-powered 30-point inspection</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Centering, corners, edges & surface</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>PSA, BGS, CGC grade estimates</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Downloadable grade report & label</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Results in under 60 seconds</span>
                    </div>
                  </div>

                  {/* Free credit highlight */}
                  <div className="relative mb-6">
                    <div className="absolute -inset-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl blur opacity-40 animate-pulse"></div>
                    <div className="relative bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-400/50 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl">🎁</span>
                        <span className="text-white font-bold text-xl">Grade Your First Card Free</span>
                      </div>
                      <p className="text-green-300 text-xs mt-1">1 free credit on signup</p>
                    </div>
                  </div>

                  {/* Signup Form */}
                  {isLoading ? (
                    <div className="w-full bg-gray-700 text-gray-400 font-bold text-lg px-6 py-4 rounded-xl text-center">
                      Loading...
                    </div>
                  ) : user ? (
                    <Link
                      href="/credits"
                      onClick={() => trackSignupClick('signup_card_logged_in')}
                      className="block w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg px-6 py-4 rounded-xl hover:from-purple-400 hover:to-pink-400 transition-all text-center shadow-lg shadow-purple-500/30"
                    >
                      Get Credits & Start Grading
                    </Link>
                  ) : (
                    <>
                      {/* OAuth Buttons */}
                      <div className="space-y-3 mb-4">
                        <button
                          onClick={() => handleOAuthSignup('google')}
                          disabled={isSigningUp || emailLoading}
                          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSigningUp && oauthProvider === 'google' ? (
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                          )}
                          Continue with Google
                        </button>

                        <button
                          onClick={() => handleOAuthSignup('facebook')}
                          disabled={isSigningUp || emailLoading}
                          className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSigningUp && oauthProvider === 'facebook' ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                          )}
                          Continue with Facebook
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-600"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-3 bg-gray-800 text-gray-400">Or with email</span>
                        </div>
                      </div>

                      {/* Email Form */}
                      <form onSubmit={handleEmailSignup} className="space-y-3">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          required
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password (min 6 characters)"
                          required
                          minLength={6}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        />
                        {error && (
                          <p className="text-red-400 text-sm text-center">{error}</p>
                        )}
                        {successMessage && (
                          <p className="text-green-400 text-sm text-center">{successMessage}</p>
                        )}
                        <button
                          type="submit"
                          disabled={emailLoading || isSigningUp}
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {emailLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                      </form>
                    </>
                  )}

                  <p className="text-center text-gray-500 text-xs mt-4">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="text-purple-400 hover:text-purple-300">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-purple-400 hover:text-purple-300">Privacy Policy</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Card Types Supported */}
      <section className="py-16 bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Grade Any Trading Card
          </h2>

          {/* Card Type Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto mb-12">
            <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-xl p-4 border border-yellow-700/30 text-center hover:border-yellow-500/50 transition-colors">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-white font-semibold">Pokemon</div>
              <div className="text-gray-400 text-xs mt-1">TCG & Japanese</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl p-4 border border-emerald-700/30 text-center hover:border-emerald-500/50 transition-colors">
              <div className="text-3xl mb-2">🏈</div>
              <div className="text-white font-semibold">Sports</div>
              <div className="text-gray-400 text-xs mt-1">NFL, NBA, MLB, NHL</div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-4 border border-blue-700/30 text-center hover:border-blue-500/50 transition-colors">
              <div className="text-3xl mb-2">🧙</div>
              <div className="text-white font-semibold">MTG</div>
              <div className="text-gray-400 text-xs mt-1">Magic: The Gathering</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-4 border border-purple-700/30 text-center hover:border-purple-500/50 transition-colors">
              <div className="text-3xl mb-2">✨</div>
              <div className="text-white font-semibold">Lorcana</div>
              <div className="text-gray-400 text-xs mt-1">Disney Lorcana</div>
            </div>
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 rounded-xl p-4 border border-gray-600/30 text-center hover:border-gray-500/50 transition-colors col-span-2 md:col-span-1">
              <div className="text-3xl mb-2">🎴</div>
              <div className="text-white font-semibold">Other</div>
              <div className="text-gray-400 text-xs mt-1">GPK, Wrestling, etc.</div>
            </div>
          </div>

          {/* DCM Stats - 3 column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-2xl p-6 border border-purple-700/30 text-center">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-white mb-1">50,000+</div>
              <div className="text-purple-400 font-semibold mb-2">Cards Graded</div>
              <p className="text-gray-400 text-sm">Trusted by collectors worldwide for accurate, reliable grading</p>
            </div>

            <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-2xl p-6 border border-purple-700/30 text-center">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-white mb-1">60 sec</div>
              <div className="text-purple-400 font-semibold mb-2">Instant Results</div>
              <p className="text-gray-400 text-sm">Get your grade in under 60 seconds - no waiting weeks for a slab</p>
            </div>

            <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-2xl p-6 border border-purple-700/30 text-center">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-white mb-1">Detailed</div>
              <div className="text-purple-400 font-semibold mb-2">Downloadable Reports</div>
              <p className="text-gray-400 text-sm">Professional PDF reports with grades, defect analysis, and printable labels</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Grade Cards in 3 Simple Steps
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-purple-400 font-bold text-sm mb-2">STEP 1</div>
              <h3 className="text-xl font-bold text-white mb-2">Upload Photos</h3>
              <p className="text-gray-400">Take clear photos of your card's front and back with your phone or camera</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-purple-400 font-bold text-sm mb-2">STEP 2</div>
              <h3 className="text-xl font-bold text-white mb-2">AI Analysis</h3>
              <p className="text-gray-400">Our DCM Optic AI examines 30+ condition factors in under 60 seconds</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="text-purple-400 font-bold text-sm mb-2">STEP 3</div>
              <h3 className="text-xl font-bold text-white mb-2">Get Your Grade</h3>
              <p className="text-gray-400">Receive detailed scores, PSA/BGS/CGC estimates, and downloadable reports</p>
            </div>
          </div>
        </div>
      </section>

      {/* Example Report Section */}
      <section className="py-16 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="container mx-auto px-4">
          {/* Mobile: Stack vertically, Desktop: 3 columns */}
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-6">
            {/* Card Image - Left */}
            <div className="flex-shrink-0 flex justify-center lg:flex-1">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl blur-xl opacity-30" />
                <Image
                  src="/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg"
                  alt="Umbreon ex Pokemon Card"
                  width={240}
                  height={336}
                  className="relative rounded-xl shadow-2xl border border-gray-700"
                />
              </div>
            </div>

            {/* Description - Center */}
            <div className="flex-1 lg:flex-[1.5]">
              <h2 className="text-3xl font-bold text-white mb-6 text-center lg:text-left">
                Detailed Analysis You Can Trust
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Centering Ratios</h3>
                    <p className="text-gray-400 text-sm">Precise left/right and top/bottom measurements for both front and back</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Corner & Edge Inspection</h3>
                    <p className="text-gray-400 text-sm">All four corners and edges analyzed for whitening, chips, and wear</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Surface Analysis</h3>
                    <p className="text-gray-400 text-sm">Scratches, print lines, holo damage, and other surface defects identified</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Pro Grade Estimates</h3>
                    <p className="text-gray-400 text-sm">See estimated PSA, BGS, CGC, and SGC grades before you submit</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Image - Right */}
            <div className="flex-shrink-0 flex justify-center lg:flex-1">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl blur-xl opacity-30" />
                <Image
                  src="/Pokemon/DCM-MiniReport-Umbreon-ex-887696.jpg"
                  alt="DCM Grading Report Example"
                  width={280}
                  height={400}
                  className="relative rounded-xl shadow-2xl border border-gray-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-16 bg-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Why Collectors Choose DCM
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl font-bold text-purple-400 mb-2">60 sec</div>
              <div className="text-gray-300">Average grading time</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl font-bold text-purple-400 mb-2">$0.66</div>
              <div className="text-gray-300">Per card (best value)</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl font-bold text-purple-400 mb-2">30+</div>
              <div className="text-gray-300">Inspection points</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl font-bold text-purple-400 mb-2">24/7</div>
              <div className="text-gray-300">Instant availability</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Choose the package that fits your collection. All plans include our full DCM Optic analysis.
            </p>
            {/* Free Credit + Bonus Banner */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full px-5 py-2 shadow-lg">
                <span className="text-lg">🎁</span>
                <span className="font-semibold">1 Free Credit at Signup</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full px-5 py-2 shadow-lg">
                <span className="text-lg">🎉</span>
                <span className="font-semibold">Bonus Credits on First Purchase</span>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Founders Package */}
            <div className="relative bg-gray-800 rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ring-4 ring-yellow-400 flex flex-col">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-4 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    <h3 className="text-xl font-bold text-gray-900">Founders</h3>
                  </div>
                  <div className="bg-yellow-900/80 text-yellow-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    EXCLUSIVE
                  </div>
                </div>
                <div className="mt-1.5 inline-block bg-white/30 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  🚀 BEST VALUE
                </div>
              </div>

              <div className="p-5 flex flex-col flex-grow">
                <div className="text-center mb-3">
                  <div>
                    <span className="text-3xl font-bold text-white">$99</span>
                    <span className="text-gray-400 text-sm ml-1">one-time</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Lifetime benefits for early supporters</p>
                </div>

                <div className="mb-3 p-3 bg-gray-700/50 rounded-xl text-center">
                  <span className="text-2xl font-bold text-yellow-400">150</span>
                  <span className="text-gray-300 ml-2">credits</span>
                </div>

                <div className="mb-3 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium">Cost per grade:</span>
                    <span className="text-lg font-bold text-yellow-400">$0.66</span>
                  </div>
                  <div className="text-yellow-500 text-[10px] font-semibold">Save 78% vs Basic!</div>
                </div>

                <div className="flex-grow mb-3 p-2.5 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl">
                  <div className="text-yellow-400 font-bold text-xs mb-1.5">Lifetime Benefits:</div>
                  <ul className="text-yellow-300/80 text-xs space-y-1">
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

                <Link
                  href="/login?mode=signup&redirect=/credits"
                  onClick={() => trackSignupClick('pricing_founders')}
                  className="block w-full py-3 px-4 rounded-xl font-bold text-base text-center transition-all duration-200 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 shadow-lg hover:shadow-xl cursor-pointer"
                >
                  Sign Up to Purchase
                </Link>
              </div>
            </div>

            {/* Basic Package */}
            <div className="relative bg-gray-800 rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl flex flex-col">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    <h3 className="text-xl font-bold text-white">Basic</h3>
                  </div>
                  <div className="w-16"></div>
                </div>
                <div className="mt-1.5 h-[18px]"></div>
              </div>

              <div className="p-5 flex flex-col flex-grow">
                <div className="text-center mb-3">
                  <span className="text-3xl font-bold text-white">$2.99</span>
                  <p className="text-gray-500 text-xs mt-1">Perfect for trying out DCM Grading</p>
                </div>

                <div className="mb-3 p-3 bg-gray-700/50 rounded-xl text-center">
                  <span className="text-2xl font-bold text-blue-400">1</span>
                  <span className="text-gray-300 ml-2">credit</span>
                </div>

                <div className="mb-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium">Cost per grade:</span>
                    <span className="text-lg font-bold text-blue-400">$2.99</span>
                  </div>
                  <div className="text-gray-500 text-[10px]">Standard rate</div>
                </div>

                <div className="flex-grow mb-3 p-2.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-lg">🎁</span>
                    <div className="text-center">
                      <div className="text-green-400 font-bold text-xs">First Purchase Bonus!</div>
                      <div className="text-green-300 text-sm font-bold">+1 FREE = 2 total</div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/login?mode=signup&redirect=/credits"
                  onClick={() => trackSignupClick('pricing_basic')}
                  className="block w-full py-3 px-4 rounded-xl font-bold text-base text-center transition-all duration-200 bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 text-white shadow-lg hover:shadow-xl cursor-pointer"
                >
                  Sign Up to Purchase
                </Link>
              </div>
            </div>

            {/* Pro Package */}
            <div className="relative bg-gray-800 rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ring-4 ring-purple-500 flex flex-col">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🚀</span>
                    <h3 className="text-xl font-bold text-white">Pro</h3>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <span className="text-white font-bold text-xs">Save 33%</span>
                  </div>
                </div>
                <div className="mt-1.5 inline-block bg-white text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ⭐ MOST POPULAR
                </div>
              </div>

              <div className="p-5 flex flex-col flex-grow">
                <div className="text-center mb-3">
                  <span className="text-3xl font-bold text-white">$9.99</span>
                  <p className="text-gray-500 text-xs mt-1">Best value for casual collectors</p>
                </div>

                <div className="mb-3 p-3 bg-gray-700/50 rounded-xl text-center">
                  <span className="text-2xl font-bold text-purple-400">5</span>
                  <span className="text-gray-300 ml-2">credits</span>
                </div>

                <div className="mb-3 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium">Cost per grade:</span>
                    <span className="text-lg font-bold text-purple-400">$2.00</span>
                  </div>
                  <div className="text-green-400 text-[10px] font-semibold">Save $4.96 vs Basic</div>
                </div>

                <div className="flex-grow mb-3 p-2.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-lg">🎁</span>
                    <div className="text-center">
                      <div className="text-green-400 font-bold text-xs">First Purchase Bonus!</div>
                      <div className="text-green-300 text-sm font-bold">+3 FREE = 8 total</div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/login?mode=signup&redirect=/credits"
                  onClick={() => trackSignupClick('pricing_pro')}
                  className="block w-full py-3 px-4 rounded-xl font-bold text-base text-center transition-all duration-200 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white shadow-lg hover:shadow-xl cursor-pointer"
                >
                  Sign Up to Purchase
                </Link>
              </div>
            </div>

            {/* Elite Package */}
            <div className="relative bg-gray-800 rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl flex flex-col">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👑</span>
                    <h3 className="text-xl font-bold text-white">Elite</h3>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <span className="text-white font-bold text-xs">Save 67%</span>
                  </div>
                </div>
                <div className="mt-1.5 h-[18px]"></div>
              </div>

              <div className="p-5 flex flex-col flex-grow">
                <div className="text-center mb-3">
                  <span className="text-3xl font-bold text-white">$19.99</span>
                  <p className="text-gray-500 text-xs mt-1">For serious collectors and dealers</p>
                </div>

                <div className="mb-3 p-3 bg-gray-700/50 rounded-xl text-center">
                  <span className="text-2xl font-bold text-amber-400">20</span>
                  <span className="text-gray-300 ml-2">credits</span>
                </div>

                <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium">Cost per grade:</span>
                    <span className="text-lg font-bold text-amber-400">$1.00</span>
                  </div>
                  <div className="text-green-400 text-[10px] font-semibold">Save $39.81 vs Basic</div>
                </div>

                <div className="flex-grow mb-3 p-2.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-lg">🎁</span>
                    <div className="text-center">
                      <div className="text-green-400 font-bold text-xs">First Purchase Bonus!</div>
                      <div className="text-green-300 text-sm font-bold">+5 FREE = 25 total</div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/login?mode=signup&redirect=/credits"
                  onClick={() => trackSignupClick('pricing_elite')}
                  className="block w-full py-3 px-4 rounded-xl font-bold text-base text-center transition-all duration-200 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white shadow-lg hover:shadow-xl cursor-pointer"
                >
                  Sign Up to Purchase
                </Link>
              </div>
            </div>
          </div>

          {/* What's Included */}
          <div className="mt-12 text-center">
            <h3 className="text-xl font-bold text-white mb-6">Every Package Includes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-2">🎯</div>
                <div className="text-white font-medium text-sm">DCM Optic Grading</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-white font-medium text-sm">Instant Results</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-2">📊</div>
                <div className="text-white font-medium text-sm">Detailed Reports</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-2">♾️</div>
                <div className="text-white font-medium text-sm">Credits Never Expire</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-900 to-indigo-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Grade Your Collection?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Stop wondering what your cards are worth. Get instant AI grades and know exactly which cards are worth submitting to PSA.
          </p>
          {user ? (
            <Link
              href="/credits"
              onClick={() => trackSignupClick('footer_cta')}
              className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg px-10 py-4 rounded-xl hover:from-purple-400 hover:to-pink-400 transition-all shadow-lg shadow-purple-500/30"
            >
              Get Credits & Start Grading
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => handleOAuthSignup('google')}
                disabled={isSigningUp || emailLoading}
                className="inline-flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningUp && oauthProvider === 'google' ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Google
              </button>
              <button
                onClick={() => handleOAuthSignup('facebook')}
                disabled={isSigningUp || emailLoading}
                className="inline-flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningUp && oauthProvider === 'facebook' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                Facebook
              </button>
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </Link>
            </div>
          )}
          <p className="text-gray-400 text-sm mt-4">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-purple-300 hover:text-purple-200">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-purple-300 hover:text-purple-200">Privacy Policy</Link>
          </p>
        </div>
      </section>

      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(-15deg); }
          50% { transform: translateY(-20px) rotate(-12deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0) rotate(10deg); }
          50% { transform: translateY(-15px) rotate(13deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0) rotate(5deg); }
          50% { transform: translateY(-10px) rotate(8deg); }
        }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 5s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
      `}</style>
    </main>
  )
}
