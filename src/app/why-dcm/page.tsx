'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession, signInWithOAuth, signUp } from '@/lib/directAuth'

declare global {
  interface Window {
    gtag: (...args: any[]) => void
    rdt: (...args: any[]) => void
    fbq: (...args: any[]) => void
  }
}

const trackSignupClick = (location: string) => {
  if (typeof window === 'undefined') return
  if (window.gtag) {
    window.gtag('event', 'signup_click', {
      event_category: 'conversion',
      event_label: location,
      page: 'why-dcm-landing',
    })
    window.gtag('event', 'conversion', {
      send_to: 'G-YLC2FKKBGC',
      event_category: 'signup',
      event_label: `why_dcm_${location}`,
    })
  }
  if (window.rdt) {
    window.rdt('track', 'Lead', { conversionId: `lead_whydcm_${Date.now()}_${location}` })
  }
  if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_name: 'why_dcm_signup_click',
      content_category: 'why_dcm',
      content_ids: [location],
      num_items: 1,
    })
    window.fbq('track', 'Lead', {
      content_name: 'why_dcm_signup',
      content_category: 'why_dcm',
      value: 0,
      currency: 'USD',
    })
  }
}

// ============================================================================
// FEATURED CARD COMPONENT
// ============================================================================

function FeaturedCardSlab({ card }: { card: any }) {
  return (
    <div className="relative w-full max-w-[180px] mx-auto">
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
          boxShadow: '0 0 20px rgba(139,92,246,0.3), 0 0 40px rgba(139,92,246,0.15)',
          border: '1px solid rgba(139,92,246,0.3)',
          padding: '6px',
        }}
      >
        <div className="rounded-lg overflow-hidden bg-gray-900">
          {card.front_url && (
            <img
              src={card.front_url}
              alt={card.card_name || 'Graded card'}
              className="w-full aspect-[2.5/3.5] object-cover"
              loading="lazy"
            />
          )}
        </div>
        <div className="text-center py-1.5">
          <div className="text-white font-bold text-lg leading-none">
            {card.conversational_whole_grade ?? card.dcm_grade_whole ?? '—'}
          </div>
          <div className="text-purple-300 text-[8px] uppercase tracking-wider mt-0.5">
            {card.conversational_condition_label || 'Graded'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// FLOATING CTA BAR
// ============================================================================

function FloatingCtaBar({
  isVisible,
  onExpand,
  isExpanded,
  onClose,
  isAuthenticated,
}: {
  isVisible: boolean
  onExpand: () => void
  isExpanded: boolean
  onClose: () => void
  isAuthenticated: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (isAuthenticated || !isVisible) return null

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setOauthLoading(true)
    setError('')
    trackSignupClick(`floating_${provider}`)
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_redirect', '/credits')
      localStorage.setItem('signup_source', 'why_dcm_floating')
    }
    try {
      await signInWithOAuth(provider)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setOauthLoading(false)
    }
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    trackSignupClick('floating_email')
    try {
      const result = await signUp(email, password)
      if (result.error) {
        setError(result.error)
      } else {
        if (typeof window !== 'undefined') {
          if (window.rdt) window.rdt('track', 'SignUp', { conversionId: `signup_whydcm_${Date.now()}` })
          if (window.gtag) window.gtag('event', 'sign_up', { method: 'email' })
          if (window.fbq) window.fbq('track', 'CompleteRegistration', { content_name: 'Why DCM Floating Signup' })
        }
        setSuccess('Account created! Check your email to confirm.')
        setEmail('')
        setPassword('')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expanded signup form (mobile & desktop) */}
      {isExpanded && (
        <div className="bg-gray-900 border-t border-purple-500/50 shadow-2xl shadow-purple-900/30 p-4 sm:p-6 animate-slide-up">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">Create Your Free Account</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="bg-green-900/40 border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm text-center">
                {success}
              </div>
            ) : (
              <>
                {/* OAuth */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => handleOAuth('google')}
                    disabled={oauthLoading || loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 py-2.5 px-3 rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google
                  </button>
                  <button
                    onClick={() => handleOAuth('facebook')}
                    disabled={oauthLoading || loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1877F2] text-white py-2.5 px-3 rounded-xl text-sm font-medium hover:bg-[#166FE5] disabled:opacity-50 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </button>
                </div>

                {/* Divider */}
                <div className="relative mb-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-gray-900 text-gray-500">or email</span>
                  </div>
                </div>

                {/* Email form */}
                <form onSubmit={handleEmail} className="space-y-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (6+ characters)"
                    required
                    minLength={6}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Creating Account...' : 'Create Free Account'}
                  </button>
                </form>

                <p className="text-gray-500 text-[10px] text-center mt-2">
                  By signing up you agree to our <Link href="/terms" className="text-purple-400 hover:text-purple-300">Terms</Link> and <Link href="/privacy" className="text-purple-400 hover:text-purple-300">Privacy Policy</Link>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Collapsed bar */}
      {!isExpanded && (
        <div className="bg-gray-900/95 backdrop-blur-lg border-t border-purple-500/30 shadow-2xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">First grade free + bonus credits</p>
              <p className="text-purple-300 text-xs hidden sm:block">Sign up now and start grading instantly</p>
            </div>
            <button
              onClick={onExpand}
              className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SECTION COMPONENTS
// ============================================================================

function SectionHeading({ title, subtitle, light = false }: { title: string; subtitle?: string; light?: boolean }) {
  return (
    <div className="text-center mb-10 sm:mb-14">
      <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${light ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
      {subtitle && <p className={`mt-3 text-base sm:text-lg max-w-2xl mx-auto ${light ? 'text-gray-300' : 'text-gray-600'}`}>{subtitle}</p>}
    </div>
  )
}

function StepCard({ number, icon, title, description }: { number: number; icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mb-3 relative">
        {icon}
        <span className="absolute -top-2 -right-2 w-6 h-6 bg-purple-600 text-white rounded-full text-xs font-bold flex items-center justify-center">{number}</span>
      </div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function WhyDcmPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [featuredCards, setFeaturedCards] = useState<any[]>([])
  const [showFloatingCta, setShowFloatingCta] = useState(false)
  const [floatingExpanded, setFloatingExpanded] = useState(false)
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const session = getStoredSession()
    setUser(session?.user || null)
    setIsLoading(false)

    // Analytics
    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'page_view', {
          page_title: 'Why DCM Landing',
          page_location: window.location.href,
          page_path: '/why-dcm',
          traffic_source: 'paid',
        })
      }
      if (window.fbq) {
        window.fbq('track', 'ViewContent', {
          content_name: 'Why DCM Landing Page',
          content_category: 'paid_landing',
          content_type: 'landing_page',
        })
      }
      if (window.rdt) window.rdt('track', 'ViewContent')
    }
  }, [])

  // Fetch featured cards
  useEffect(() => {
    fetch('/api/cards/featured?limit=8')
      .then((r) => r.json())
      .then((data) => {
        if (data.cards) setFeaturedCards(data.cards)
      })
      .catch(() => {})
  }, [])

  // Show floating CTA after scrolling past hero
  useEffect(() => {
    const handleScroll = () => {
      const hero = heroRef.current
      if (!hero) return
      const heroBottom = hero.getBoundingClientRect().bottom
      setShowFloatingCta(heroBottom < -100)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isAuthenticated = !!user

  // Inline signup for hero section
  const [heroEmail, setHeroEmail] = useState('')
  const [heroPassword, setHeroPassword] = useState('')
  const [heroLoading, setHeroLoading] = useState(false)
  const [heroOauthLoading, setHeroOauthLoading] = useState(false)
  const [heroError, setHeroError] = useState('')
  const [heroSuccess, setHeroSuccess] = useState('')

  const handleHeroOAuth = async (provider: 'google' | 'facebook') => {
    setHeroOauthLoading(true)
    setHeroError('')
    trackSignupClick(`hero_${provider}`)
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_redirect', '/credits')
      localStorage.setItem('signup_source', 'why_dcm_hero')
    }
    try {
      await signInWithOAuth(provider)
    } catch (err: any) {
      setHeroError(err.message || 'An error occurred')
      setHeroOauthLoading(false)
    }
  }

  const handleHeroEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setHeroLoading(true)
    setHeroError('')
    setHeroSuccess('')
    trackSignupClick('hero_email')
    try {
      const result = await signUp(heroEmail, heroPassword)
      if (result.error) {
        setHeroError(result.error)
      } else {
        if (typeof window !== 'undefined') {
          if (window.rdt) window.rdt('track', 'SignUp', { conversionId: `signup_whydcm_hero_${Date.now()}` })
          if (window.gtag) window.gtag('event', 'sign_up', { method: 'email' })
          if (window.fbq) window.fbq('track', 'CompleteRegistration', { content_name: 'Why DCM Hero Signup' })
        }
        setHeroSuccess('Account created! Check your email to confirm.')
        setHeroEmail('')
        setHeroPassword('')
      }
    } catch (err: any) {
      setHeroError(err.message || 'An error occurred')
    } finally {
      setHeroLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* ================================================================ */}
      {/* HERO */}
      {/* ================================================================ */}
      <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900">
        {/* Animated card backgrounds */}
        <div className="absolute inset-0 opacity-15 hidden md:block">
          <div className="absolute top-16 left-[3%] w-28 h-40 animate-float-slow">
            <Image src="/promo-charizard.png" alt="" fill className="object-contain rotate-[-12deg]" loading="lazy" sizes="112px" />
          </div>
          <div className="absolute bottom-24 left-[8%] w-24 h-34 animate-float-medium">
            <Image src="/Sports/DCM-Card-LeBron-James-547249-front.jpg" alt="" fill className="object-contain rotate-[8deg]" loading="lazy" sizes="96px" />
          </div>
          <div className="absolute top-8 right-[22%] w-24 h-34 animate-float-fast">
            <Image src="/promo-umbreon.png" alt="" fill className="object-contain rotate-[6deg]" loading="lazy" sizes="96px" />
          </div>
          <div className="absolute bottom-16 right-[8%] w-26 h-36 animate-float-slow">
            <Image src="/Sports/DCM-Card-Shohei-Ohtani-192904-front.jpg" alt="" fill className="object-contain rotate-[-8deg]" loading="lazy" sizes="104px" />
          </div>
          <div className="absolute top-32 left-[42%] w-24 h-34 animate-float-medium hidden lg:block">
            <Image src="/homepage-cards/Black Lotus MTG.png" alt="" fill className="object-contain rotate-[10deg]" loading="lazy" sizes="96px" />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="flex flex-col xl:flex-row items-center gap-12">
            {/* Hero text */}
            <div className="flex-1 text-center xl:text-left">
              <div className="inline-flex items-center gap-2 bg-purple-800/40 border border-purple-500/30 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-purple-200 text-sm font-medium">First Grade Free</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-6">
                Card Grading,<br />
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">In Your Hands</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 mb-8 max-w-xl mx-auto xl:mx-0">
                DCM Grading puts the power of card grading in the hands of collectors. Instant results, detailed reports, market pricing, and custom labels — no mailing your cards, no waiting weeks.
              </p>

              {/* Trust signals */}
              <div className="flex flex-wrap justify-center xl:justify-start gap-x-6 gap-y-2 text-sm text-purple-200">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  10-Point Grading Scale
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Instant Results
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  From $0.50/Card
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Keep Your Cards
                </span>
              </div>
            </div>

            {/* Signup card */}
            {!isAuthenticated && !isLoading && (
              <div className="w-full max-w-md flex-shrink-0">
                <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
                    <h2 className="text-white font-bold text-lg">Start Grading for Free</h2>
                    <p className="text-purple-200 text-sm">Your first grade is on us + bonus credits with first purchase</p>
                  </div>
                  <div className="p-6">
                    {heroSuccess ? (
                      <div className="bg-green-900/40 border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm text-center">{heroSuccess}</div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-4">
                          <button onClick={() => handleHeroOAuth('google')} disabled={heroOauthLoading || heroLoading}
                            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-all font-medium text-sm">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {heroOauthLoading ? 'Connecting...' : 'Continue with Google'}
                          </button>
                          <button onClick={() => handleHeroOAuth('facebook')} disabled={heroOauthLoading || heroLoading}
                            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] text-white py-3 px-4 rounded-xl hover:bg-[#166FE5] disabled:opacity-50 transition-all font-medium text-sm">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            {heroOauthLoading ? 'Connecting...' : 'Continue with Facebook'}
                          </button>
                        </div>
                        <div className="relative mb-4">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700" /></div>
                          <div className="relative flex justify-center text-xs"><span className="px-3 bg-gray-800/80 text-gray-500">or email</span></div>
                        </div>
                        <form onSubmit={handleHeroEmail} className="space-y-3">
                          <input type="email" value={heroEmail} onChange={(e) => setHeroEmail(e.target.value)} placeholder="you@example.com" required
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                          <input type="password" value={heroPassword} onChange={(e) => setHeroPassword(e.target.value)} placeholder="Password (6+ chars)" required minLength={6}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                          {heroError && <p className="text-red-400 text-xs">{heroError}</p>}
                          <button type="submit" disabled={heroLoading}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/25">
                            {heroLoading ? 'Creating Account...' : 'Create Free Account'}
                          </button>
                        </form>
                        <p className="text-gray-500 text-[10px] text-center mt-3">
                          By signing up you agree to our <Link href="/terms" className="text-purple-400">Terms</Link> and <Link href="/privacy" className="text-purple-400">Privacy Policy</Link>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Authenticated: show CTA to collection */}
            {isAuthenticated && !isLoading && (
              <div className="w-full max-w-md flex-shrink-0 text-center">
                <Link href="/collection" className="inline-block bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25">
                  Go to My Collection
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* HOW IT WORKS */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionHeading title="How It Works" subtitle="From photo to professional grade in minutes — not weeks" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <StepCard number={1} title="Upload" description="Snap a photo of your card's front and back"
              icon={<svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
            <StepCard number={2} title="DCM Optic\u2122 Grades" description="Our multi-pass grading system analyzes centering, corners, edges, and surface"
              icon={<svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>} />
            <StepCard number={3} title="Get Results" description="Detailed grade report with sub-scores, defect analysis, and market pricing"
              icon={<svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
            <StepCard number={4} title="Share & Sell" description="Print custom labels, list to eBay instantly, track your portfolio value"
              icon={<svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* DCM OPTIC — THE APPROACH */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading title="The DCM Optic\u2122 Approach" subtitle="A structured, repeatable grading methodology that gives you confidence in every grade" />
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold text-sm">3x</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Multi-Pass Consensus Grading</h3>
                  <p className="text-gray-600 text-sm mt-1">Every card is evaluated three independent times. The results are averaged and reconciled server-side to eliminate variance and hallucinated defects.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Four Sub-Grade Categories</h3>
                  <p className="text-gray-600 text-sm mt-1">Centering, corners, edges, and surface — each scored independently for front and back. Your final grade is determined by the weakest category, not an average.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Server-Verified Results</h3>
                  <p className="text-gray-600 text-sm mt-1">We never trust raw model output. Every grade is recalculated server-side with consensus boosting and standard rounding to ensure accuracy and consistency.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">No More Mailing & Waiting</h3>
                  <p className="text-gray-600 text-sm mt-1">Mail-away grading companies take weeks or months and cost $20-$150+ per card. With DCM, you get results in minutes, from $0.50 per card, and your cards never leave your hands.</p>
                </div>
              </div>
            </div>

            {/* Visual: convergence diagram */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
              <h4 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">Multi-Pass Consensus Example</h4>
              <div className="space-y-4">
                {['Pass 1', 'Pass 2', 'Pass 3'].map((label, i) => {
                  const scores = [
                    { c: 10, co: 9, e: 10, s: 10, f: 9 },
                    { c: 10, co: 10, e: 9, s: 10, f: 9 },
                    { c: 10, co: 9, e: 10, s: 10, f: 9 },
                  ]
                  const s = scores[i]
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 w-12">{label}</span>
                      <div className="flex-1 flex gap-1.5">
                        {[
                          { label: 'C', val: s.c },
                          { label: 'Co', val: s.co },
                          { label: 'E', val: s.e },
                          { label: 'S', val: s.s },
                        ].map((sub) => (
                          <div key={sub.label} className={`flex-1 text-center py-1.5 rounded text-xs font-bold ${sub.val === 10 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {sub.val}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <div className="border-t-2 border-purple-200 pt-4 mt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-purple-700 w-12">Final</span>
                    <div className="flex-1 flex gap-1.5">
                      {['10', '9', '10', '10'].map((val, i) => (
                        <div key={i} className={`flex-1 text-center py-1.5 rounded text-xs font-bold ${val === '10' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {val}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-center mt-3">
                    <span className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-bold">
                      Overall Grade: 9
                      <span className="text-purple-200 text-xs font-normal">(Weakest link: Corners)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* DETAILED CARD REPORTS */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading title="Detailed Card Reports" subtitle="Every grade comes with a full breakdown — not just a number" />
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Featured card showcase */}
            {featuredCards.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {featuredCards.slice(0, 4).map((card) => (
                  <FeaturedCardSlab key={card.id} card={card} />
                ))}
              </div>
            )}
            {featuredCards.length === 0 && (
              <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            )}

            <div className="space-y-5">
              {[
                { title: 'Sub-Grade Breakdown', desc: 'Centering, corners, edges, and surface — each scored for front and back with a weighted composite.', color: 'purple' },
                { title: 'Defect Analysis', desc: 'Identified defects are cataloged with severity ratings, locations, and descriptions so you know exactly what was found.', color: 'blue' },
                { title: 'Condition Label', desc: 'Every grade includes a human-readable condition label — from "Poor" to "Gem Mint" — so there\'s no confusion.', color: 'green' },
                { title: 'Image Confidence Rating', desc: 'We tell you how confident our system is in the grade based on image quality, so you know when to retake photos.', color: 'amber' },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className={`w-8 h-8 rounded-lg bg-${item.color}-100 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <svg className={`w-4 h-4 text-${item.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                    <p className="text-gray-600 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* MARKET PRICING */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionHeading title="Market Pricing at Your Fingertips" subtitle="Real-time pricing from multiple sources so you always know what your cards are worth" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {[
              { name: 'PriceCharting', desc: 'TCG cards', color: 'from-blue-500 to-blue-600' },
              { name: 'SportsCardsPro', desc: 'Sports cards', color: 'from-green-500 to-green-600' },
              { name: 'eBay', desc: 'All card types', color: 'from-yellow-500 to-orange-500' },
              { name: 'Scryfall', desc: 'MTG pricing', color: 'from-purple-500 to-indigo-500' },
            ].map((source) => (
              <div key={source.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-center hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${source.color} flex items-center justify-center mb-3`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{source.name}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{source.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-700">
              See how your card&apos;s <span className="font-semibold text-purple-600">grade affects its market value</span>. We pull grade-adjusted pricing so you can understand the real-world impact of condition on what your card is worth.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CARD DATABASES */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionHeading title="Accurate Card Identification" subtitle="Comprehensive internal databases covering thousands of cards across every major game type" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: 'Pokemon', img: '/promo-charizard.png', sub: 'English + Japanese' },
              { name: 'MTG', img: '/homepage-cards/Black Lotus MTG.png', sub: 'Magic: The Gathering' },
              { name: 'Sports', img: '/Sports/DCM-Card-LeBron-James-547249-front.jpg', sub: '6 categories' },
              { name: 'Lorcana', img: '/homepage-cards/Mickey Mouse Brave Little Prince.png', sub: 'Disney Lorcana' },
              { name: 'One Piece', img: '/homepage-cards/Magneton.png', sub: 'One Piece TCG' },
              { name: 'Yu-Gi-Oh', img: '/homepage-cards/Charizard 1999.png', sub: 'Yu-Gi-Oh!' },
              { name: 'Star Wars', img: '/homepage-cards/Ian Malcom, Chaotician MTG.png', sub: 'Star Wars TCG' },
              { name: 'Other', img: '/homepage-cards/Garbage Pail Kids Adam Bomb.png', sub: 'Digimon, DBZ & more' },
            ].map((cat) => (
              <div key={cat.name} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="aspect-[3/4] relative bg-gray-100 overflow-hidden">
                  <Image src={cat.img} alt={cat.name} fill className="object-contain p-2 group-hover:scale-105 transition-transform" sizes="200px" />
                </div>
                <div className="p-3 text-center">
                  <h3 className="font-bold text-gray-900 text-sm">{cat.name}</h3>
                  <p className="text-gray-500 text-xs">{cat.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* LABEL STUDIO */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading title="Your Label, Your Way" subtitle="Design and print professional grading labels for slabs, magnetic one-touch holders, and toploaders" light />
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {[
              { name: 'Graded Slab', img: '/labels/graded-card-slab.png', desc: 'Insert into standard grading slab cases with front and back labels' },
              { name: 'Magnetic One-Touch', img: '/labels/mag-one-touch-DCM.png', desc: 'Avery 6871 compatible labels for magnetic card holders' },
              { name: 'Toploader', img: '/labels/top-loader-dcm.png', desc: 'Front + back label pairs or fold-over labels for toploaders' },
            ].map((label) => (
              <div key={label.name} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-5 text-center hover:bg-white/15 transition-colors">
                <div className="w-full h-48 relative mb-4">
                  <Image src={label.img} alt={label.name} fill className="object-contain" sizes="300px" />
                </div>
                <h3 className="font-bold text-lg">{label.name}</h3>
                <p className="text-purple-200 text-sm mt-1">{label.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {['8 Color Themes', 'Custom Gradients', 'Border Controls', 'Color-Match Eyedropper', 'Save 4 Custom Designs'].map((feature) => (
              <span key={feature} className="bg-white/10 border border-white/20 rounded-full px-4 py-1.5">{feature}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* EBAY INSTALIST */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading title="List to eBay in Seconds" subtitle="Professional listings created automatically — connect your account and sell with one click" />
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              {[
                'Professional HTML description auto-generated with grade details',
                '5 images auto-created: labeled front/back, raw front/back, and mini-report',
                'Grade automatically mapped to eBay\'s condition system',
                'Built-in shipping calculator with domestic and international options',
                'Supports fixed price and auction formats',
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700 text-sm">{item}</p>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 text-center">
              <div className="grid grid-cols-5 gap-2 mb-4">
                {['Front', 'Back', 'Report', 'Raw F', 'Raw B'].map((label) => (
                  <div key={label} className="aspect-[3/4] bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-[9px] text-gray-500 font-medium">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-xs">5 professional images generated automatically for every listing</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PORTFOLIO — CARD LOVERS */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="inline-block bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4">Card Lovers Exclusive</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Portfolio Market Pricing</h2>
            <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">Track your entire collection&apos;s value in real-time. See price movements, identify your top cards, and understand how grades impact value.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Total Value', desc: 'See your entire collection\u2019s market value at a glance', icon: '$' },
              { title: 'Price Movers', desc: 'Track gainers and losers as prices change', icon: '\u2191' },
              { title: 'Top Cards', desc: 'Identify your most valuable cards by grade and type', icon: '\u2605' },
              { title: 'Grade vs Value', desc: 'Understand how each grade level impacts market price', icon: '\u2261' },
            ].map((feature) => (
              <div key={feature.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3 text-purple-600 font-bold text-lg">{feature.icon}</div>
                <h3 className="font-bold text-gray-900 text-sm">{feature.title}</h3>
                <p className="text-gray-500 text-xs mt-1">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* BADGES */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <SectionHeading title="Wear Your Badge" subtitle="Show off your status on every graded card label. Fun enhancements for the hobby." />
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: 'VIP', desc: 'Exclusive VIP emblem displayed on all your labels', color: 'from-amber-400 to-orange-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
              { name: 'Card Lovers', desc: 'Subscriber badge with loyalty rewards and premium perks', color: 'from-purple-400 to-pink-500', textColor: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
              { name: 'Founder', desc: 'Legacy founder status — a permanent mark of being an early supporter', color: 'from-emerald-400 to-teal-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
            ].map((badge) => (
              <div key={badge.name} className={`${badge.bgColor} ${badge.borderColor} border rounded-xl p-6`}>
                <div className={`w-14 h-14 mx-auto rounded-full bg-gradient-to-br ${badge.color} flex items-center justify-center mb-3`}>
                  <span className="text-white font-bold text-lg">{badge.name[0]}</span>
                </div>
                <h3 className={`font-bold ${badge.textColor}`}>{badge.name}</h3>
                <p className="text-gray-600 text-sm mt-1">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PRICING */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionHeading title="Simple, Affordable Pricing" subtitle="Credits never expire. Buy what you need, grade when you're ready." />
          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            {[
              { name: 'Basic', price: '$2.99', credits: '1', perGrade: '$2.99', bonus: '+1 bonus on first purchase', popular: false },
              { name: 'Pro', price: '$9.99', credits: '5', perGrade: '$2.00', bonus: '+3 bonus on first purchase', popular: true },
              { name: 'Elite', price: '$19.99', credits: '20', perGrade: '$1.00', bonus: '+5 bonus on first purchase', popular: false },
            ].map((tier) => (
              <div key={tier.name} className={`bg-white rounded-2xl shadow-lg border-2 p-6 text-center relative ${tier.popular ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}>
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                )}
                <h3 className="font-bold text-gray-900 text-lg mb-1">{tier.name}</h3>
                <div className="text-3xl font-bold text-gray-900 mb-1">{tier.price}</div>
                <p className="text-gray-500 text-sm mb-4">{tier.credits} credit{tier.credits !== '1' ? 's' : ''} &middot; {tier.perGrade}/grade</p>
                <p className="text-green-600 text-sm font-medium">{tier.bonus}</p>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 sm:p-8 text-center text-white">
            <h3 className="font-bold text-xl mb-2">Card Lovers Subscription</h3>
            <p className="text-purple-200 mb-4">For serious collectors — 70+ credits monthly, 20% discount on purchases, portfolio tracking, and loyalty bonuses</p>
            <div className="flex justify-center gap-4">
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3">
                <div className="font-bold text-lg">$49.99<span className="text-sm font-normal">/mo</span></div>
                <p className="text-purple-200 text-xs">70 credits/month</p>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3">
                <div className="font-bold text-lg">$449<span className="text-sm font-normal">/yr</span></div>
                <p className="text-purple-200 text-xs">900 credits/year</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FEATURED CARDS GALLERY */}
      {/* ================================================================ */}
      {featuredCards.length > 0 && (
        <section className="py-16 sm:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionHeading title="Real Grades from Real Collectors" subtitle="Browse cards graded by the DCM community" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredCards.slice(0, 8).map((card) => (
                <Link key={card.id} href={`/${card.category?.toLowerCase() || 'other'}/${card.id}`} className="group">
                  <FeaturedCardSlab card={card} />
                  <div className="text-center mt-2">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">{card.card_name || 'Graded Card'}</p>
                    <p className="text-xs text-gray-500">{card.category}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* FINAL CTA */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Grade Your First Card?</h2>
          <p className="text-purple-200 text-lg mb-8">Upload a photo, get your grade in minutes. Your first credit is on us.</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-purple-300 mb-8">
            <span>No mailing required</span>
            <span>&middot;</span>
            <span>Instant results</span>
            <span>&middot;</span>
            <span>Keep your cards safe</span>
          </div>
          {!isAuthenticated ? (
            <Link href="/login?mode=signup" onClick={() => trackSignupClick('final_cta')}
              className="inline-block bg-white text-purple-700 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all shadow-lg">
              Sign Up Free
            </Link>
          ) : (
            <Link href="/upload"
              className="inline-block bg-white text-purple-700 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all shadow-lg">
              Grade a Card Now
            </Link>
          )}
        </div>
      </section>

      {/* Bottom padding for floating CTA */}
      {!isAuthenticated && <div className="h-16" />}

      {/* Floating CTA */}
      <FloatingCtaBar
        isVisible={showFloatingCta}
        onExpand={() => setFloatingExpanded(true)}
        isExpanded={floatingExpanded}
        onClose={() => setFloatingExpanded(false)}
        isAuthenticated={isAuthenticated}
      />
    </main>
  )
}
