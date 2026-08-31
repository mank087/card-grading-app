'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession, signInWithOAuth, signUp } from '@/lib/directAuth'
import HeroGradingAnimation from './HeroGradingAnimation'
import LatestGradesCarousel from '@/components/marketing/LatestGradesCarousel'
import FloatingCtaBar from '@/components/marketing/FloatingCtaBar'
import EbayListingMonitor from '@/components/EbayListingMonitor'
import { SPORTS_CATEGORIES_PARAM, sumSportsGraded } from '@/lib/sportsCategories'

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
        page: 'sports-grading-landing'
      })

      // Also send as a conversion event (for Google Ads if connected)
      window.gtag('event', 'conversion', {
        send_to: 'G-YLC2FKKBGC',
        event_category: 'signup',
        event_label: `sports_landing_${location}`
      })
    }

    // Track Reddit Lead conversion
    if (window.rdt) {
      const leadId = `lead_sports_${Date.now()}_${location}`
      window.rdt('track', 'Lead', {
        conversionId: leadId
      })
      console.log('[Reddit Pixel] Lead event tracked with conversionId:', leadId)
    }

    // Track Meta/Facebook Lead conversion
    if (window.fbq) {
      window.fbq('track', 'Lead', {
        content_name: 'sports_grading_signup',
        content_category: 'sports',
        currency: 'USD'
      })
      console.log('[Meta Pixel] Lead event tracked:', location)
    }

    console.log(`[Analytics] Signup click tracked: ${location}`)
  }
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-10 sm:mb-14">
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{title}</h2>
      {subtitle && <p className="mt-3 text-base sm:text-lg max-w-2xl mx-auto text-gray-400">{subtitle}</p>}
    </div>
  )
}

export default function SportsGradingLanding() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [cardLoversPlan, setCardLoversPlan] = useState<'monthly' | 'annual'>('annual')
  // Live proof. This page previously advertised a hardcoded "50,000+ Cards
  // Graded" while the real figure was ~16.5k — never hardcode a volume claim
  // on a page you buy traffic for. Falls back to no numeric claim on failure.
  const [sportsGraded, setSportsGraded] = useState<string | null>(null)

  useEffect(() => {
    const session = getStoredSession()
    setUser(session?.user || null)
    setIsLoading(false)

    // Track landing page view
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: 'Sports Card Grading Landing',
        page_location: window.location.href,
        page_path: '/sports-grading',
        traffic_source: 'paid_ad'
      })
    }
  }, [])

  // Live sports graded count, summed across every sports category
  useEffect(() => {
    let cancelled = false
    fetch('/api/pop/categories')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.categories) return
        const total = sumSportsGraded(data.categories)
        if (total > 0) setSportsGraded(total.toLocaleString())
      })
      .catch(() => { /* non-fatal: the tile renders without a number */ })
    return () => { cancelled = true }
  }, [])

  const handleOAuthSignup = async (provider: 'google' | 'facebook' | 'apple') => {
    setIsSigningUp(true)
    setOauthProvider(provider)
    setError('')
    trackSignupClick(`${provider}_signup`)

    // Store redirect destination for after signup
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_redirect', '/credits')
      localStorage.setItem('signup_source', 'sports_landing')
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
            window.rdt('track', 'SignUp', { conversionId: `signup_sports_${Date.now()}` })
          }
          if (window.gtag) {
            window.gtag('event', 'sign_up', { method: 'email' })
          }
          if (window.fbq) {
            window.fbq('track', 'CompleteRegistration', { content_name: 'Sports Landing Email Signup' })
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
        {/* Background gradient - Sports themed green/blue */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-teal-900 to-blue-900" />

        {/* Animated Sports cards background - spread out, hidden on mobile */}
        <div className="absolute inset-0 opacity-15 hidden md:block">
          {/* Left side cards */}
          <div className="absolute top-16 left-[3%] w-28 h-40 animate-float-slow">
            <Image src="/Sports/DCM-Card-LeBron-James-547249-front.jpg" alt="" fill className="object-contain rotate-[-12deg]" />
          </div>
          <div className="absolute bottom-24 left-[8%] w-24 h-34 animate-float-medium">
            <Image src="/Sports/DCM-Card-DeVon-Achane-162769-front.jpg" alt="" fill className="object-contain rotate-[8deg]" />
          </div>

          {/* Center-left cards */}
          <div className="absolute top-8 left-[22%] w-24 h-34 animate-float-fast">
            <Image src="/Sports/DCM-Card-Shohei-Ohtani-192904-front.jpg" alt="" fill className="object-contain rotate-[6deg]" />
          </div>
          <div className="absolute bottom-16 left-[28%] w-26 h-36 animate-float-slow">
            <Image src="/Sports/DCM-Card-Aaron-Judge-355168-front.jpg" alt="" fill className="object-contain rotate-[-8deg]" />
          </div>

          {/* Center cards - only visible on large screens */}
          <div className="absolute top-32 left-[42%] w-24 h-34 animate-float-medium hidden lg:block">
            <Image src="/Sports/DCM-Card-Tyreek-Hill-120583-front.jpg" alt="" fill className="object-contain rotate-[10deg]" />
          </div>
          <div className="absolute bottom-8 left-[38%] w-22 h-32 animate-float-fast hidden lg:block">
            <Image src="/Sports/DCM-Card-Matthew-Stafford-116660-front.jpg" alt="" fill className="object-contain rotate-[-5deg]" />
          </div>

          {/* Extra card for very wide screens */}
          <div className="absolute top-20 left-[15%] w-20 h-28 animate-float-slow hidden xl:block">
            <Image src="/Sports/DCM-Card-Caleb-Williams-Jayden-Daniels-Drake-Maye-884215-front.jpg" alt="" fill className="object-contain rotate-[15deg]" />
          </div>
        </div>

        {/* Simplified mobile background - 2 cards in top hero area only */}
        <div className="absolute inset-0 opacity-10 md:hidden">
          <div className="absolute top-16 left-[5%] w-20 h-28 animate-float-slow">
            <Image src="/Sports/DCM-Card-LeBron-James-547249-front.jpg" alt="" fill className="object-contain rotate-[-10deg]" />
          </div>
          <div className="absolute top-24 right-[8%] w-18 h-26 animate-float-medium">
            <Image src="/Sports/DCM-Card-Shohei-Ohtani-192904-front.jpg" alt="" fill className="object-contain rotate-[8deg]" />
          </div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8 md:py-24">
          {/* Mobile: Animation First */}
          <div className="xl:hidden mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
              <span className="text-white/80 text-xs font-medium tracking-wider uppercase">Sports Card Grading</span>
            </div>

            {/* Headline right below logo */}
            <div className="text-center mb-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
                Grade Your Sports Card
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  Instantly
                </span>
              </h1>
              <p className="text-base text-gray-300">
                <span className="text-white font-semibold">No shipping. No waiting.</span> Results in 60 seconds.
              </p>
              <p className="text-sm text-emerald-300/90 mt-2">
                Set &amp; parallel verified against 2,951 sets, 1901&ndash;2026.
              </p>
            </div>

            {/* Animation centered on mobile */}
            <div className="flex justify-center mb-6">
              <div className="w-full max-w-[300px]">
                <HeroGradingAnimation
                  rawCardImage="/Sports/drake may - daniel- williams f.png"
                />
              </div>
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
                  className="block w-full bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-8 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all text-center shadow-lg shadow-emerald-500/30"
                >
                  Get Credits & Start Grading
                </Link>
              ) : (
                <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white text-center">Start Grading Today</h2>
                    <p className="text-emerald-200 text-sm text-center">Create your account</p>
                  </div>

                  <div className="p-6">
                    {/* What you get */}
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>30-point DCM Optic™ inspection</span>
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
                        <span>PSA, BGS, SGC grade estimates</span>
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
                        <p className="text-green-300 text-xs mt-1">2 free credits on signup</p>
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

                      <button
                        onClick={() => handleOAuthSignup('apple')}
                        disabled={isSigningUp || emailLoading}
                        className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSigningUp && oauthProvider === 'apple' ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                          </svg>
                        )}
                        Continue with Apple
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
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (min 10 characters)"
                        required
                        minLength={10}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {emailLoading ? 'Creating Account...' : 'Create Account'}
                      </button>
                    </form>

                    <p className="text-center text-gray-500 text-xs mt-4">
                      By continuing, you agree to our{' '}
                      <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms of Service</Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">Privacy Policy</Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop: 3-column layout */}
          <div className="hidden xl:flex flex-row items-center gap-6">
            {/* Left: Grading Animation */}
            <div className="flex-shrink-0 w-[340px]">
              <HeroGradingAnimation
                rawCardImage="/Sports/drake may - daniel- williams f.png"
              />
            </div>

            {/* Center: Hero Content */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-3 mb-6">
                <Image src="/DCM Logo white.png" alt="DCM" width={50} height={50} />
                <span className="text-white/80 text-sm font-medium tracking-wider uppercase">Sports Card Grading</span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Grade Your Sports Card
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  Instantly
                </span>
              </h1>

              <p className="text-xl text-gray-300 mb-3 max-w-xl">
                <span className="text-white font-semibold">No shipping. No waiting.</span> Get professional-grade analysis in under 60 seconds.
              </p>

              <p className="text-base text-emerald-300/90 mb-6 max-w-xl">
                Every card is matched against a catalog of{' '}
                <span className="text-white font-semibold">2,951 sets from 1901 to 2026</span> — so the set,
                parallel and serial numbering on your label are verified, not guessed.
              </p>

              {/* Feature bullets - desktop only */}
              <div className="grid grid-cols-2 gap-4 mb-8 max-w-xl">
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-semibold">Identify Your Card</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed pl-11">Player, set name, card number, manufacturer, and more</p>
                </div>
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-semibold">Evaluate Condition</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed pl-11">Analysis of centering, corners, edges and surface for front and back of your card</p>
                </div>
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-semibold">Market Pricing & Grade Estimates</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed pl-11">Estimates of PSA, BGS, SGC and CGC grade equivalents & links to marketplace listings</p>
                </div>
                <div className="bg-white/5 rounded-lg px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white text-center">Start Grading Today</h2>
                  <p className="text-emerald-200 text-sm text-center">Create your account</p>
                </div>

                <div className="p-6">
                  {/* What you get */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>30-point DCM Optic™ inspection</span>
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
                      <span>PSA, BGS, SGC grade estimates</span>
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
                      <p className="text-green-300 text-xs mt-1">2 free credits on signup</p>
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
                      className="block w-full bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-6 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all text-center shadow-lg shadow-emerald-500/30"
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

                        <button
                          onClick={() => handleOAuthSignup('apple')}
                          disabled={isSigningUp || emailLoading}
                          className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSigningUp && oauthProvider === 'apple' ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                            </svg>
                          )}
                          Continue with Apple
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
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                        />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password (min 10 characters)"
                          required
                          minLength={10}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {emailLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                      </form>
                    </>
                  )}

                  <p className="text-center text-gray-500 text-xs mt-4">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">Privacy Policy</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sports Leagues Supported + DCM Stats */}
      <section className="py-16 bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4">
          {/* Sports leagues */}
          <p className="text-center text-gray-500 text-sm mb-6 uppercase tracking-wider">Grade cards from all major sports</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mb-12">
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">NFL</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">NBA</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">MLB</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">NHL</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">UFC</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">WWE</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">Soccer</div>
          </div>

          {/* DCM Stats - 3 column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-2xl p-6 border border-emerald-700/30 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{sportsGraded ?? '—'}</div>
              <div className="text-emerald-400 font-semibold mb-2">Sports Cards Graded</div>
              <p className="text-gray-400 text-sm">
                {sportsGraded
                  ? 'Live count across every sport, updated continuously'
                  : <>Live count from our <Link href="/pop" className="text-emerald-400 hover:text-emerald-300 underline">population report</Link></>}
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-2xl p-6 border border-emerald-700/30 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-white mb-1">Instant</div>
              <div className="text-emerald-400 font-semibold mb-2">Results</div>
              <p className="text-gray-400 text-sm">Get your grade in under 60 seconds — no waiting weeks for a slab</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-2xl p-6 border border-emerald-700/30 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-white mb-1">Detailed</div>
              <div className="text-emerald-400 font-semibold mb-2">Downloadable Reports</div>
              <p className="text-gray-400 text-sm">Professional PDF reports with grades, defect analysis, and printable labels</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Sports set database — the differentiator vs generic AI graders.   */}
      {/* Counts are real (sports_sets); the graded figure is live. Do NOT  */}
      {/* swap these for rounded marketing numbers — that is exactly what   */}
      {/* the old hardcoded "50,000+" tile was.                             */}
      {/* ================================================================ */}
      <section className="py-16 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-300 text-xs font-semibold tracking-wide uppercase">Sports Set Database</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              We know the set before we grade the card
            </h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Modern sports cards live and die by the parallel. DCM checks your card against a
              catalog of 2,951 sets spanning 1901 to 2026, so the set, year, manufacturer and
              parallel on your label are matched — not guessed from a photo.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-10">
            <div className="bg-gray-800/60 rounded-2xl p-6 border border-emerald-700/30 text-center">
              <div className="text-3xl font-bold text-white mb-1">2,951</div>
              <div className="text-emerald-400 font-semibold text-sm mb-1">Sets catalogued</div>
              <p className="text-gray-500 text-xs">Topps, Panini, Bowman, Fleer, Donruss, Leaf and more</p>
            </div>
            <div className="bg-gray-800/60 rounded-2xl p-6 border border-emerald-700/30 text-center">
              <div className="text-3xl font-bold text-white mb-1">9</div>
              <div className="text-emerald-400 font-semibold text-sm mb-1">Sports covered</div>
              <p className="text-gray-500 text-xs">Baseball, basketball, football, hockey, soccer, golf, racing, wrestling, boxing</p>
            </div>
            <div className="bg-gray-800/60 rounded-2xl p-6 border border-emerald-700/30 text-center">
              <div className="text-3xl font-bold text-white mb-1">1901<span className="text-xl">→</span>2026</div>
              <div className="text-emerald-400 font-semibold text-sm mb-1">Years of cards</div>
              <p className="text-gray-500 text-xs">Pre-war tobacco issues through this year&apos;s releases</p>
            </div>
            <div className="bg-gray-800/60 rounded-2xl p-6 border border-emerald-700/30 text-center">
              <div className="text-3xl font-bold text-white mb-1">{sportsGraded ?? '—'}</div>
              <div className="text-emerald-400 font-semibold text-sm mb-1">Sports cards graded</div>
              <p className="text-gray-500 text-xs">
                {sportsGraded ? 'Live count, updated continuously' : 'Live count from our pop report'}
              </p>
            </div>
          </div>

          <div className="max-w-4xl mx-auto bg-gray-800/40 rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <h3 className="text-white font-bold text-lg mb-4">What set matching actually fixes</h3>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex gap-3">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                <p className="text-gray-300 text-sm">
                  <span className="text-white font-semibold">Parallels stay straight.</span>{' '}
                  Prizm, Silver, Refractor, Optic Holo — the base card and its parallels share the
                  same photo and number. Matching against the real set list keeps a base rookie from
                  being labeled as the parallel that&apos;s worth ten times more.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                <p className="text-gray-300 text-sm">
                  <span className="text-white font-semibold">Serial numbering is read, not invented.</span>{' '}
                  A card stamped 07/10 gets that on the label exactly. Numbered parallels are where
                  sports value concentrates, so the print run has to be right.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                <p className="text-gray-300 text-sm">
                  <span className="text-white font-semibold">Rookie cards get flagged correctly.</span>{' '}
                  RC status drives the price. We check the player&apos;s first-print year against the
                  set rather than trusting an &ldquo;RC&rdquo; shield that appears on reprints too.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                <p className="text-gray-300 text-sm">
                  <span className="text-white font-semibold">Vintage gets its real year.</span>{' '}
                  Pre-war and 1950s issues rarely print a year on the card. The set catalog supplies
                  it, so a 1952 Topps doesn&apos;t end up dated by the copyright line.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Sports-specific grading knowledge                                 */}
      {/* ================================================================ */}
      <section className="py-16 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Graded the way sports cards actually fail
            </h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Chrome surface, corner sharpness on thick stock, and vintage centering are what separate
              a 9 from a 10. DCM Optic™ inspects each at magnification, front and back.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            <div className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700/50">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">◇</span>
              </div>
              <h3 className="text-white font-bold mb-2">Chrome &amp; refractor surface</h3>
              <p className="text-gray-400 text-sm">
                Chrome stock shows every scratch and the refractor pattern hides them in glare.
                Magnified inspection separates real surface damage from the finish itself — the most
                common reason a modern rookie is over- or under-graded.
              </p>
            </div>
            <div className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700/50">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">◺</span>
              </div>
              <h3 className="text-white font-bold mb-2">Corners on thick stock</h3>
              <p className="text-gray-400 text-sm">
                Patch and relic cards are thick, and thick corners fray rather than round. All four
                corners are scored separately so one soft corner does not quietly sink the card
                without you knowing which one.
              </p>
            </div>
            <div className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700/50">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⊹</span>
              </div>
              <h3 className="text-white font-bold mb-2">Vintage centering</h3>
              <p className="text-gray-400 text-sm">
                1950s–70s print runs were rarely well centered, and centering is the usual cap on a
                vintage grade. Left/right and top/bottom ratios are measured on both faces and
                reported as numbers, so you see exactly why it capped.
              </p>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <p className="text-center text-gray-500 text-sm mb-4">Cards we grade every day</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Topps Chrome rookies', 'Prizm Silver', 'Bowman 1st Chrome', 'Optic Holo',
                'Numbered parallels', 'Patch autos', 'Vintage Topps', 'Pre-war tobacco',
                'Rookie Card autos', 'Graded-case reholders', 'Panini Select', 'Donruss Optic',
              ].map((t) => (
                <span key={t} className="bg-gray-800/70 border border-gray-700/60 text-gray-300 text-xs px-3 py-1.5 rounded-full">
                  {t}
                </span>
              ))}
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
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-emerald-400 font-bold text-sm mb-2">STEP 1</div>
              <h3 className="text-xl font-bold text-white mb-2">Upload Photos</h3>
              <p className="text-gray-400">Take clear photos of your card's front and back with your phone or camera</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-emerald-400 font-bold text-sm mb-2">STEP 2</div>
              <h3 className="text-xl font-bold text-white mb-2">DCM Optic™ Analysis</h3>
              <p className="text-gray-400">DCM Optic™, our grading engine, examines 30+ condition factors in under 60 seconds</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="text-emerald-400 font-bold text-sm mb-2">STEP 3</div>
              <h3 className="text-xl font-bold text-white mb-2">Get Your Grade</h3>
              <p className="text-gray-400">Receive detailed scores, PSA/BGS/SGC estimates, and downloadable reports</p>
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
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-30" />
                <Image
                  src="/Sports/DCM-Card-LeBron-James-547249-front.jpg"
                  alt="LeBron James Sports Card"
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
              <p className="text-gray-400 mb-6 text-center lg:text-left">
                Every score comes from the same{' '}
                <Link href="/grading-standard" className="text-emerald-400 hover:text-emerald-300 underline">published grading standard</Link>,
                applied the same way to every card.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Centering Ratios</h3>
                    <p className="text-gray-400 text-sm">Precise left/right and top/bottom measurements for both front and back</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Corner & Edge Inspection</h3>
                    <p className="text-gray-400 text-sm">All four corners and edges analyzed for whitening, chips, and wear</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Surface Analysis</h3>
                    <p className="text-gray-400 text-sm">Scratches, print lines, staining, and other surface defects identified</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Pro Grade Estimates</h3>
                    <p className="text-gray-400 text-sm">See estimated PSA, BGS, SGC, and CSG grades before you submit</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Image - Right */}
            <div className="flex-shrink-0 flex justify-center lg:flex-1">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-30" />
                <Image
                  src="/Sports/DCM-MiniReport-LeBron-James-547249.jpg"
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
              <div className="text-3xl font-bold text-emerald-400 mb-2">60 sec</div>
              <div className="text-gray-300">Average grading time</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl font-bold text-emerald-400 mb-2">$0.66</div>
              <div className="text-gray-300">Per card (best value)</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl font-bold text-emerald-400 mb-2">30+</div>
              <div className="text-gray-300">Inspection points</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl font-bold text-emerald-400 mb-2">24/7</div>
              <div className="text-gray-300">Instant availability</div>
            </div>
          </div>
        </div>
      </section>

      {/* Card Brands Section */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Works With All Major Card Brands
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 text-gray-500">
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Panini</span>
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Topps</span>
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Upper Deck</span>
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Bowman</span>
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Donruss</span>
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Prizm</span>
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Select</span>
            <span className="text-lg font-semibold hover:text-gray-300 transition-colors">Mosaic</span>
          </div>
        </div>
      </section>

      {/* Live auto-scrolling feed of the newest public sports grades. Sports
          spans many category values, hence the shared SPORTS_CATEGORIES list. */}
      <LatestGradesCarousel
        apiPath={`/api/cards/latest-grades?limit=15&categories=${encodeURIComponent(SPORTS_CATEGORIES_PARAM)}`}
        title="Real sports cards, really graded"
        subtitle="The newest sports grades from our community — every one publicly verifiable by serial number"
        cardHrefPrefix="/sports"
        className="py-16 bg-gray-950"
        cta={{
          href: user ? '/upload/sports' : '/login?mode=signup&redirect=/upload/sports',
          label: user ? 'Grade Your Sports Cards' : 'Grade Your Sports Cards Free',
          onClick: () => !user && trackSignupClick('latest_grades_section'),
        }}
      />

      {/* ================================================================ */}
      {/* TESTIMONIALS                                                      */}
      {/* ================================================================ */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12">
            What Collectors Are Saying
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { quote: 'I graded 30 cards from my binder in an afternoon. Found two worth sending to PSA and saved myself from submitting the other 28.', name: 'Mike R.', role: 'Pokémon & Sports Collector' },
              { quote: 'The sub-grades tell me exactly why a card missed a 10. That is worth more to me than the number itself.', name: 'Anthony M.', role: 'Sports Card Enthusiast' },
              { quote: 'Being able to check a card before I buy it at a show has completely changed how I shop.', name: 'Paul S.', role: 'TCG Hobbyist' },
            ].map((t) => (
              <div key={t.name} className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700/50">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-300 text-sm mb-4">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SPORTS-SPECIFIC FAQ                                               */}
      {/* ================================================================ */}
      <section className="py-16 bg-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12">Fair Questions</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                q: 'Is a DCM grade the same as a PSA grade?',
                a: (
                  <>
                    No, and we do not claim it is. DCM is its own 10-point grade with four sub-grades, and every report includes{' '}
                    <Link href="/card-grading-companies" className="text-emerald-400 hover:text-emerald-300 underline">estimated equivalents on the PSA, BGS, SGC and CGC scales</Link>{' '}
                    so you know roughly where a card would land. Most collectors use DCM to decide{' '}
                    <Link href="/psa-alternative" className="text-emerald-400 hover:text-emerald-300 underline">which cards are worth paying to submit</Link>.
                  </>
                ),
              },
              {
                q: 'Can you tell a base card from its parallel?',
                a: 'That is exactly what the set database is for. Prizm Silver, Optic Holo, Refractors and numbered parallels share artwork and card numbers with the base card, so we match against the real set list and read the serial numbering off the card rather than guessing from the photo.',
              },
              {
                q: 'Does it work on vintage cards?',
                a: 'Yes — the catalog goes back to 1901. Vintage centering and edge wear are what the magnified inspection is tuned for, and the set data supplies the year for cards that never printed one. Vintage legitimately grades lower on average; the report shows the measurements behind the number.',
              },
              {
                q: 'What about patch cards, autos and relics?',
                a: 'They grade fine. Thick stock corners and on-card autographs are inspected the same way, and the label carries the auto and memorabilia flags. Cards with an embedded relic window are surface-scored around the window rather than through it.',
              },
              {
                q: 'What if I disagree with my grade?',
                a: 'Every report shows the sub-grades and the specific defects behind the number, so you can see the reasoning. Photo quality is the most common cause of a surprising grade — retake with even lighting and no glare and grade it again.',
              },
            ].map((f) => (
              <details key={f.q} className="group bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
                <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4 text-white font-semibold">
                  <span>{f.q}</span>
                  <span className="text-emerald-400 text-xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
                </summary>
                <div className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SEE IT IN ACTION                                                  */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <SectionHeading
            title="See It in Action"
            subtitle="Watch the full grading process from upload to finished label in under 3 minutes"
          />
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-700/50" style={{ aspectRatio: '16 / 9' }}>
            <iframe
              src="https://www.youtube-nocookie.com/embed/oSz9lfvaEK4?rel=0"
              title="DCM Grading — Full Process Walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* MARKET PRICING                                                    */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 bg-gray-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionHeading
            title="Market Pricing at Your Fingertips"
            subtitle="Real-time pricing from multiple sources so you always know what your sports cards are worth"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {[
              { name: 'SportsCardsPro', desc: 'Sports cards', color: 'from-green-500 to-green-600' },
              { name: 'PriceCharting', desc: 'TCG & sealed', color: 'from-blue-500 to-blue-600' },
              { name: 'eBay', desc: 'Sold comparables', color: 'from-yellow-500 to-orange-500' },
              { name: 'Scryfall', desc: 'MTG pricing', color: 'from-purple-500 to-indigo-500' },
            ].map((source) => (
              <div key={source.name} className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-5 text-center">
                <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${source.color} flex items-center justify-center mb-3`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="font-bold text-white text-sm">{source.name}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{source.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 text-center mb-6">
            <p className="text-gray-300">
              See how your card&apos;s <span className="font-semibold text-emerald-400">grade affects its market value</span>. We pull
              grade-adjusted pricing so you can tell whether a raw rookie is worth grading before you spend a cent.
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-700/50 bg-white">
            <Image src="/why-dcm/Price-graded-cards.png" alt="Price by grade — market prices from raw to graded" width={900} height={300} className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* LABEL STUDIO                                                      */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading
            title="Your Label, Your Way"
            subtitle="Design and print professional grading labels for slabs, magnetic one-touch holders, and toploaders"
          />
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 mb-10">
            {[
              { name: 'Graded Slab', img: '/why-dcm/lugia-graded-slab.png', desc: 'Front and back labels for standard grading slab cases' },
              { name: 'Magnetic One-Touch', img: '/why-dcm/lugia-one-touch.png', desc: 'Avery 6871 compatible labels for magnetic holders' },
              { name: 'Toploader', img: '/why-dcm/lugia-top-loader.png', desc: 'Front + back pairs or fold-over labels for toploaders' },
            ].map((label) => (
              <div key={label.name} className="text-center">
                <div className="relative w-full max-w-[180px] mx-auto mb-4" style={{ aspectRatio: '3 / 4' }}>
                  <Image src={label.img} alt={label.name} fill className="object-contain" />
                </div>
                <h3 className="text-white font-bold mb-1">{label.name}</h3>
                <p className="text-emerald-200/80 text-sm">{label.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {['8 Color Themes', 'Custom Gradients', 'Border Controls', 'Color-Match Eyedropper', 'Save 4 Custom Designs'].map((feature) => (
              <span key={feature} className="bg-white/10 border border-white/20 text-white rounded-full px-4 py-1.5">{feature}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* BADGES                                                            */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <SectionHeading
            title="Wear Your Badge"
            subtitle="Show off your status on every graded card label. Fun enhancements for the hobby."
          />
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {[
              { name: 'VIP', letter: 'V', desc: 'Exclusive VIP emblem displayed on all your labels', color: 'from-amber-400 to-orange-500', accent: 'text-amber-400', border: 'border-amber-500/30' },
              { name: 'Card Lovers', letter: 'C', desc: 'Subscriber badge with loyalty rewards and premium perks', color: 'from-purple-400 to-rose-500', accent: 'text-purple-300', border: 'border-purple-500/30' },
            ].map((badge) => (
              <div key={badge.name} className={`bg-gray-800/60 ${badge.border} border rounded-xl p-6`}>
                <div className={`w-14 h-14 mx-auto rounded-full bg-gradient-to-br ${badge.color} flex items-center justify-center mb-3`}>
                  <span className="text-white font-bold text-lg">{badge.letter}</span>
                </div>
                <h3 className={`font-bold ${badge.accent}`}>{badge.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{badge.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 max-w-md mx-auto rounded-xl overflow-hidden border border-gray-700/50">
            <Image src="/why-dcm/card-lover-vip-label.png" alt="Card Lover and VIP badges on a graded card label" width={600} height={200} className="w-full h-auto" />
          </div>
          <p className="text-gray-500 text-xs mt-3">Card Lover and VIP badges displayed on a graded card label</p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* EBAY INSTALIST                                                    */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading
            title="Grade It. List It. Sell It."
            subtitle="InstaList turns any graded card into a complete eBay listing — photos, title, condition, and the full DCM report — in one click."
          />
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="space-y-4 mb-8">
                {[
                  'Professional HTML description auto-generated with grade details',
                  '5 images auto-created: labeled front/back, raw front/back, and mini-report',
                  'Grade automatically mapped to eBay\'s condition system',
                  'Built-in shipping calculator with domestic and international options',
                  'Supports fixed price and auction formats',
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-gray-300 text-sm">{item}</p>
                  </div>
                ))}
              </div>
              {user ? (
                <Link
                  href="/instalist-marketplace"
                  className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-7 py-3.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
                >
                  Open InstaList
                </Link>
              ) : (
                <Link
                  href="/login?mode=signup"
                  onClick={() => trackSignupClick('instalist_section')}
                  className="inline-block bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-7 py-3.5 rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
                >
                  Start with 2 Free Grades
                </Link>
              )}
            </div>
            <EbayListingMonitor />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PRICING — compact 4-tier grid matching /why-dcm                   */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 bg-gray-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionHeading
            title="Simple, Affordable Pricing"
            subtitle="Credits never expire. Buy what you need, grade when you're ready."
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
            {[
              { name: 'VIP', price: '$99', credits: '150', perGrade: '$0.66', bonus: 'VIP badge on all labels', popular: true },
              { name: 'Basic', price: '$2.99', credits: '1', perGrade: '$2.99', bonus: '+1 bonus on first purchase', popular: false },
              { name: 'Pro', price: '$9.99', credits: '5', perGrade: '$2.00', bonus: '+3 bonus on first purchase', popular: false },
              { name: 'Elite', price: '$19.99', credits: '20', perGrade: '$1.00', bonus: '+5 bonus on first purchase', popular: false },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`bg-gray-800/60 rounded-2xl border-2 p-6 text-center relative ${tier.popular ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-700/50'}`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Best Value
                  </span>
                )}
                <h3 className="font-bold text-white text-lg mb-1">{tier.name}</h3>
                <div className="text-3xl font-bold text-white mb-1">{tier.price}</div>
                <p className="text-gray-400 text-sm mb-4">
                  {tier.credits} credit{tier.credits !== '1' ? 's' : ''} &middot; {tier.perGrade}/grade
                </p>
                <p className="text-green-400 text-sm font-medium">{tier.bonus}</p>
              </div>
            ))}
          </div>

          <div className="text-center mb-10">
            <Link
              href={user ? '/credits' : '/login?mode=signup&redirect=/credits'}
              onClick={() => !user && trackSignupClick('pricing_section')}
              className="inline-block bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
            >
              {user ? 'Buy Credits' : 'Start with 2 Free Grades'}
            </Link>
            <p className="text-gray-500 text-sm mt-3">2 free credits at signup &middot; no subscription required</p>
          </div>

          <div className="bg-gradient-to-r from-purple-600 to-rose-500 rounded-2xl p-6 sm:p-8 text-center text-white">
            <h3 className="font-bold text-xl mb-2">&hearts; Card Lovers Subscription</h3>
            <p className="text-rose-100 mb-5 max-w-2xl mx-auto">
              For serious collectors. 70+ credits a month, 20% off all purchases, portfolio tracking,
              and loyalty bonuses that scale with your tenure.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-5">
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3">
                <div className="font-bold text-lg">$49.99<span className="text-sm font-normal">/mo</span></div>
                <p className="text-purple-100 text-xs">70 credits/month</p>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3">
                <div className="font-bold text-lg">$449<span className="text-sm font-normal">/yr</span></div>
                <p className="text-purple-100 text-xs">900 credits/year &middot; $0.50 a grade</p>
              </div>
            </div>
            <Link
              href={user ? '/card-lovers' : '/login?mode=signup&redirect=/card-lovers'}
              onClick={() => !user && trackSignupClick('card_lovers_section')}
              className="inline-block bg-white text-purple-700 px-6 py-3 rounded-xl font-bold hover:bg-purple-50 transition-colors"
            >
              {user ? 'View Card Lovers' : 'Sign Up to Subscribe'}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { icon: '\u{1F3AF}', label: 'DCM Optic\u2122 Grading' },
              { icon: '\u26A1', label: 'Instant Results' },
              { icon: '\u{1F4CA}', label: 'Detailed Reports' },
              { icon: '\u267E\uFE0F', label: 'Credits Never Expire' },
            ].map((f) => (
              <div key={f.label} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 text-center">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-white font-medium text-sm">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-emerald-900 to-teal-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Grade Your Collection?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Stop wondering what your cards are worth. Get instant DCM Optic™ grades and know exactly which rookies and parallels are{' '}
            <Link href="/psa-alternative" className="text-emerald-400 hover:text-emerald-300 underline">worth submitting to PSA</Link>.
          </p>
          {user ? (
            <Link
              href="/credits"
              onClick={() => trackSignupClick('footer_cta')}
              className="inline-block bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-10 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/30"
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
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg"
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
            <Link href="/terms" className="text-emerald-300 hover:text-emerald-200">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-emerald-300 hover:text-emerald-200">Privacy Policy</Link>
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

      {/* Spacer so the floating bar never covers the final CTA */}
      {!user && <div className="h-16" />}

      <FloatingCtaBar
        isAuthenticated={!!user}
        accent="emerald"
        source="sports_landing"
        messages={[
          '2 free grades + bonus credits',
          'Know which rookies are worth submitting',
          'Parallels verified against 2,951 sets',
          'From $0.50/card — credits never expire',
        ]}
      />
    </main>
  )
}
