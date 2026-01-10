'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession, signInWithOAuth, signUp } from '@/lib/directAuth'
import { CardShow, getShowStatus, getDaysUntil, formatDateRange, generateMetaDescription } from '@/types/cardShow'

// Track conversion events
const trackSignupClick = (showSlug: string, location: string) => {
  if (typeof window !== 'undefined') {
    if ((window as any).gtag) {
      (window as any).gtag('event', 'signup_click', {
        event_category: 'conversion',
        event_label: `${showSlug}_${location}`,
        page: 'card-show-landing'
      })
    }
    if ((window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        content_name: `card_show_${showSlug}`,
        content_category: 'card_show'
      })
    }
    console.log(`[Analytics] Show signup click: ${showSlug} - ${location}`)
  }
}

function ShowCountdown({ show }: { show: CardShow }) {
  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number; secs: number } | null>(null)
  const status = getShowStatus(show)

  useEffect(() => {
    const targetDate = status === 'active'
      ? new Date(show.end_date + 'T23:59:59').getTime()
      : new Date(show.start_date + 'T00:00:00').getTime()

    const calculateCountdown = () => {
      const now = Date.now()
      const difference = targetDate - now

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

    setCountdown(calculateCountdown())
    const timer = setInterval(() => setCountdown(calculateCountdown()), 1000)
    return () => clearInterval(timer)
  }, [show, status])

  if (!countdown) return null

  const label = status === 'active' ? 'Show ends in' : 'Show starts in'

  return (
    <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 border border-gray-700">
      <div className="text-gray-400 text-xs uppercase tracking-wider mb-1 text-center">{label}</div>
      <div className="flex justify-center gap-2">
        <div className="text-center">
          <div className="text-xl font-bold text-white">{countdown.days}</div>
          <div className="text-xs text-gray-500">days</div>
        </div>
        <div className="text-gray-600 text-xl">:</div>
        <div className="text-center">
          <div className="text-xl font-bold text-white">{countdown.hours.toString().padStart(2, '0')}</div>
          <div className="text-xs text-gray-500">hrs</div>
        </div>
        <div className="text-gray-600 text-xl">:</div>
        <div className="text-center">
          <div className="text-xl font-bold text-white">{countdown.mins.toString().padStart(2, '0')}</div>
          <div className="text-xs text-gray-500">min</div>
        </div>
      </div>
    </div>
  )
}

export default function ShowPageClient({ show }: { show: CardShow }) {
  const [user, setUser] = useState<any>(null)
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
  }, [])

  const handleOAuthSignup = async (provider: 'google' | 'facebook') => {
    setIsSigningUp(true)
    setOauthProvider(provider)
    setError('')
    trackSignupClick(show.slug, `${provider}_signup`)

    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_redirect', '/credits')
      localStorage.setItem('signup_source', `card_show_${show.slug}`)
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
    trackSignupClick(show.slug, 'email_signup')

    try {
      const result = await signUp(email, password)
      if (result.error) {
        setError(result.error)
      } else {
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

  const status = getShowStatus(show)
  const daysUntil = getDaysUntil(show)

  return (
    <main className="min-h-screen bg-gray-900">
      {/* HERO SECTION - Conversion Optimized */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        {/* Background accents */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-6 md:py-10">
          {/* Show Badge - Compact */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {status === 'active' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                LIVE NOW
              </span>
            ) : daysUntil <= 7 ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-gray-900">
                {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil} DAYS`}
              </span>
            ) : null}
            <span className="text-gray-400 text-sm">{show.name}</span>
          </div>

          {/* Main Headline - Mobile First */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
              Grade Cards <span className="text-emerald-400">Instantly</span><br className="md:hidden" /> From Your Phone
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              Know if a card is worth buying in 60 seconds. Pre-screen before you pay, right at the show.
            </p>
          </div>

          {/* Key Features Strip - Above the fold */}
          <div className="flex flex-wrap justify-center gap-3 mb-6 text-sm">
            <div className="flex items-center gap-1.5 bg-gray-800/60 backdrop-blur px-3 py-1.5 rounded-full border border-gray-700">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-200">30-Point AI Inspection</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-800/60 backdrop-blur px-3 py-1.5 rounded-full border border-gray-700">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-200">PSA/BGS Estimates</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-800/60 backdrop-blur px-3 py-1.5 rounded-full border border-gray-700">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-200">60-Second Results</span>
            </div>
          </div>

          {/* Main Content: Video + Signup */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-center max-w-5xl mx-auto">
            {/* Left: Video Demo */}
            <div className="w-full lg:w-1/2 flex justify-center">
              <div className="relative">
                {/* Video Container - Vertical Format */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-700" style={{ width: '280px', height: '500px' }}>
                  <iframe
                    src="https://www.youtube.com/embed/xctI85Z9dos?autoplay=0&rel=0&modestbranding=1"
                    title="DCM Card Grading Demo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                {/* Badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-gray-900 text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                  See how it works
                </div>
              </div>
            </div>

            {/* Right: Signup Card */}
            <div className="w-full lg:w-1/2 max-w-md">
              <div className="bg-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                {/* Free Credit Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">🎁</span>
                    <span className="text-white font-bold text-lg">Grade Your First Card FREE</span>
                  </div>
                </div>

                <div className="p-5">
                  {/* Promo Code */}
                  {show.special_offer && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-center">
                      <div className="text-yellow-300 text-sm font-medium">{show.special_offer}</div>
                      {show.offer_code && (
                        <div className="mt-1">
                          <span className="text-gray-400 text-sm mr-1">Promo Code:</span>
                          <span className="bg-gray-900 text-yellow-400 font-mono text-sm px-2 py-0.5 rounded">
                            {show.offer_code}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* What You Get - Compact */}
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Centering analysis
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Corner & edge check
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Surface inspection
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Downloadable report
                    </div>
                  </div>

                  {/* Auth Buttons */}
                  {user ? (
                    <Link
                      href="/credits"
                      onClick={() => trackSignupClick(show.slug, 'logged_in_cta')}
                      className="block w-full bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-6 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all text-center shadow-lg"
                    >
                      Start Grading Now
                    </Link>
                  ) : (
                    <>
                      {/* OAuth Buttons */}
                      <div className="space-y-2.5 mb-3">
                        <button
                          onClick={() => handleOAuthSignup('google')}
                          disabled={isSigningUp || emailLoading}
                          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50"
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
                          className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50"
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
                      <div className="relative my-3">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-600"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-gray-800 text-gray-500">or</span>
                        </div>
                      </div>

                      {/* Email Form - Compact */}
                      <form onSubmit={handleEmailSignup} className="space-y-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email"
                          required
                          className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          required
                          minLength={6}
                          className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                        {successMessage && <p className="text-green-400 text-xs text-center">{successMessage}</p>}
                        <button
                          type="submit"
                          disabled={emailLoading || isSigningUp}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 text-sm"
                        >
                          {emailLoading ? 'Creating...' : 'Sign Up Free'}
                        </button>
                      </form>
                    </>
                  )}

                  <p className="text-center text-gray-500 text-xs mt-3">
                    By signing up, you agree to our{' '}
                    <Link href="/terms" className="text-emerald-400">Terms</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Countdown - Below signup on mobile */}
          <div className="mt-6 max-w-xs mx-auto lg:hidden">
            <ShowCountdown show={show} />
          </div>
        </div>
      </section>

      {/* How It Works - 3 Steps */}
      <section className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Grade Any Card in 3 Steps
          </h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">1. Snap Photos</h3>
              <p className="text-gray-400 text-sm">Take front & back photos with your phone at the vendor table</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">2. AI Analyzes</h3>
              <p className="text-gray-400 text-sm">DCM inspects centering, corners, edges & surface in 60 seconds</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">3. Get Your Grade</h3>
              <p className="text-gray-400 text-sm">See the grade, PSA estimate & download your report instantly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cards We Grade - Compact */}
      <section className="py-10 bg-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold text-white text-center mb-6">
            Works With All Card Types
          </h2>

          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {[
              { name: 'Pokemon', icon: '⚡' },
              { name: 'Sports', icon: '🏈' },
              { name: 'Magic', icon: '🔮' },
              { name: 'Lorcana', icon: '✨' },
              { name: 'One Piece', icon: '🏴‍☠️' },
              { name: 'Yu-Gi-Oh', icon: '🎴' },
              { name: 'Non-Sports', icon: '🎬' },
            ].map((card, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-900/50 rounded-full px-4 py-2 border border-gray-700">
                <span className="text-lg">{card.icon}</span>
                <span className="text-gray-200 text-sm font-medium">{card.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Reports - Compact */}
      <section className="py-12 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Real Grading Results
          </h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Pokemon Example */}
            <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <Image
                src="/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg"
                alt="Pokemon Card Example"
                width={100}
                height={140}
                className="rounded-lg shadow-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-400 mb-1">Pokemon</div>
                <div className="text-white font-bold mb-2">Umbreon ex</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-gray-500">Centering:</span> <span className="text-emerald-400">9</span></div>
                  <div><span className="text-gray-500">Corners:</span> <span className="text-emerald-400">10</span></div>
                  <div><span className="text-gray-500">Edges:</span> <span className="text-emerald-400">10</span></div>
                  <div><span className="text-gray-500">Surface:</span> <span className="text-emerald-400">10</span></div>
                </div>
                <div className="mt-2 text-lg font-bold text-emerald-400">Grade: 9</div>
              </div>
            </div>

            {/* Sports Example */}
            <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <Image
                src="/Sports/DCM-Card-LeBron-James-547249-front.jpg"
                alt="Sports Card Example"
                width={100}
                height={140}
                className="rounded-lg shadow-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-400 mb-1">Sports</div>
                <div className="text-white font-bold mb-2">LeBron James</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-gray-500">Centering:</span> <span className="text-emerald-400">10</span></div>
                  <div><span className="text-gray-500">Corners:</span> <span className="text-emerald-400">9</span></div>
                  <div><span className="text-gray-500">Edges:</span> <span className="text-emerald-400">9</span></div>
                  <div><span className="text-gray-500">Surface:</span> <span className="text-emerald-400">9</span></div>
                </div>
                <div className="mt-2 text-lg font-bold text-emerald-400">Grade: 9</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Show Details - Moved Lower */}
      <section className="py-12 bg-gray-800 border-t border-gray-700">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{show.name}</h2>
                <div className="flex flex-wrap gap-4 text-gray-300">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDateRange(show.start_date, show.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span>{show.city}, {show.state}</span>
                  </div>
                </div>
                {show.venue_name && (
                  <div className="text-gray-400 text-sm mt-2">{show.venue_name}</div>
                )}
              </div>
              <div className="hidden lg:block">
                <ShowCountdown show={show} />
              </div>
            </div>

            {/* Show Stats */}
            {(show.estimated_tables || show.estimated_attendance) && (
              <div className="flex gap-6 mt-6">
                {show.estimated_tables && (
                  <div>
                    <div className="text-2xl font-bold text-white">{show.estimated_tables}+</div>
                    <div className="text-gray-400 text-sm">Vendor Tables</div>
                  </div>
                )}
                {show.estimated_attendance && (
                  <div>
                    <div className="text-2xl font-bold text-white">{show.estimated_attendance}</div>
                    <div className="text-gray-400 text-sm">Expected Attendance</div>
                  </div>
                )}
              </div>
            )}

            {show.description && (
              <p className="text-gray-300 mt-6">{show.description}</p>
            )}

            {show.website_url && (
              <a
                href={show.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 mt-4 text-sm"
              >
                Official show website
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 bg-gradient-to-r from-emerald-900 to-teal-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Ready to Grade Cards at {show.short_name || show.name}?
          </h2>
          <p className="text-gray-300 mb-6">
            Sign up free and get 1 credit to try DCM at the show.
          </p>
          {user ? (
            <Link
              href="/credits"
              onClick={() => trackSignupClick(show.slug, 'footer_cta')}
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-8 py-3 rounded-xl hover:bg-gray-100 transition-all shadow-lg"
            >
              Start Grading
            </Link>
          ) : (
            <Link
              href="/login?mode=signup&redirect=/credits"
              onClick={() => trackSignupClick(show.slug, 'footer_cta')}
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-8 py-3 rounded-xl hover:bg-gray-100 transition-all shadow-lg"
            >
              Sign Up Free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>
      </section>

      {/* Footer Link */}
      <section className="py-6 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center">
          <Link href="/card-shows" className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">
            ← View all upcoming card shows
          </Link>
        </div>
      </section>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            "name": show.name,
            "startDate": show.start_date,
            "endDate": show.end_date,
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "eventStatus": "https://schema.org/EventScheduled",
            "location": {
              "@type": "Place",
              "name": show.venue_name || `${show.city}, ${show.state}`,
              "address": {
                "@type": "PostalAddress",
                "addressLocality": show.city,
                "addressRegion": show.state,
                "addressCountry": show.country
              }
            },
            "description": show.description || generateMetaDescription(show),
            "organizer": {
              "@type": "Organization",
              "name": "DCM Grading",
              "url": "https://www.dcmgrading.com"
            }
          })
        }}
      />
    </main>
  )
}
