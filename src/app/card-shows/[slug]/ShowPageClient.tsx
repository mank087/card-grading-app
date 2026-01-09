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
    <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
      <div className="text-gray-400 text-xs uppercase tracking-wider mb-2 text-center">{label}</div>
      <div className="flex justify-center gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{countdown.days}</div>
          <div className="text-xs text-gray-500">days</div>
        </div>
        <div className="text-gray-600 text-2xl">:</div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{countdown.hours.toString().padStart(2, '0')}</div>
          <div className="text-xs text-gray-500">hours</div>
        </div>
        <div className="text-gray-600 text-2xl">:</div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{countdown.mins.toString().padStart(2, '0')}</div>
          <div className="text-xs text-gray-500">mins</div>
        </div>
        <div className="text-gray-600 text-2xl">:</div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{countdown.secs.toString().padStart(2, '0')}</div>
          <div className="text-xs text-gray-500">secs</div>
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
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-teal-900 to-blue-900" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-96 h-96 bg-emerald-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-400 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">
          <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 items-center">
            {/* Left: Show Info */}
            <div className="flex-1 text-center xl:text-left">
              {/* Breadcrumb */}
              <div className="flex items-center justify-center xl:justify-start gap-2 text-sm text-gray-400 mb-6">
                <Link href="/card-shows" className="hover:text-emerald-400 transition-colors">Card Shows</Link>
                <span>/</span>
                <span className="text-gray-300">{show.name}</span>
              </div>

              {/* Status Badge */}
              <div className="flex flex-wrap items-center justify-center xl:justify-start gap-3 mb-4">
                {status === 'active' ? (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-white animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    HAPPENING NOW
                  </span>
                ) : daysUntil <= 7 ? (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-yellow-500 text-gray-900">
                    {daysUntil === 0 ? 'STARTS TODAY' : daysUntil === 1 ? 'STARTS TOMORROW' : `${daysUntil} DAYS AWAY`}
                  </span>
                ) : null}
                <span className="text-emerald-300 text-sm font-medium uppercase tracking-wider">{show.show_type}</span>
              </div>

              {/* Logo if available */}
              {show.logo_url && (
                <div className="mb-6">
                  <Image src={show.logo_url} alt={show.name} width={200} height={80} className="mx-auto xl:mx-0" />
                </div>
              )}

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                {show.headline || `Attending ${show.name}?`}
              </h1>

              <p className="text-xl text-gray-300 mb-6 max-w-xl mx-auto xl:mx-0">
                {show.subheadline || 'Grade your cards instantly with DCM. Pre-screen before buying, verify seller claims.'}
              </p>

              {/* Date & Location */}
              <div className="flex flex-wrap gap-6 justify-center xl:justify-start mb-8">
                <div className="flex items-center gap-2 text-gray-300">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold">{formatDateRange(show.start_date, show.end_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{show.city}, {show.state}</span>
                </div>
              </div>

              {/* Venue */}
              {show.venue_name && (
                <div className="bg-white/5 rounded-lg p-4 mb-6 max-w-md mx-auto xl:mx-0">
                  <div className="text-white font-semibold">{show.venue_name}</div>
                  {show.venue_address && <div className="text-gray-400 text-sm">{show.venue_address}</div>}
                </div>
              )}

              {/* Countdown */}
              <div className="mb-8 max-w-sm mx-auto xl:mx-0">
                <ShowCountdown show={show} />
              </div>

              {/* Show Stats */}
              <div className="flex flex-wrap gap-4 justify-center xl:justify-start">
                {show.estimated_tables && (
                  <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-3">
                    <div className="text-2xl font-bold text-white">{show.estimated_tables}+</div>
                    <div className="text-emerald-300 text-sm">Vendor Tables</div>
                  </div>
                )}
                {show.estimated_attendance && (
                  <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-3">
                    <div className="text-2xl font-bold text-white">{show.estimated_attendance}</div>
                    <div className="text-emerald-300 text-sm">Expected Attendance</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Signup Card */}
            <div className="w-full max-w-md">
              <div className="bg-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white text-center">Grade Cards at {show.short_name || show.name}</h2>
                  <p className="text-emerald-200 text-sm text-center">Sign up and start grading instantly</p>
                </div>

                <div className="p-6">
                  {/* Special Offer */}
                  {show.special_offer && (
                    <div className="relative mb-5">
                      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl blur opacity-30"></div>
                      <div className="relative bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-400/50 rounded-xl p-4 text-center">
                        <div className="text-yellow-300 font-bold">{show.special_offer}</div>
                        {show.offer_code && (
                          <div className="mt-1 bg-gray-900 rounded px-3 py-1 inline-block">
                            <span className="text-yellow-400 font-mono text-sm">Code: {show.offer_code}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

                  {/* What you get */}
                  <div className="space-y-2 mb-5">
                    {['AI-powered 30-point inspection', 'Centering, corners, edges & surface', 'PSA, BGS, SGC grade estimates', 'Downloadable grade report & label', 'Results in under 60 seconds'].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Auth Form */}
                  {user ? (
                    <Link
                      href="/credits"
                      onClick={() => trackSignupClick(show.slug, 'logged_in_cta')}
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
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password (min 6 characters)"
                          required
                          minLength={6}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        {successMessage && <p className="text-green-400 text-sm text-center">{successMessage}</p>}
                        <button
                          type="submit"
                          disabled={emailLoading || isSigningUp}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50"
                        >
                          {emailLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                      </form>
                    </>
                  )}

                  <p className="text-center text-gray-500 text-xs mt-4">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">Privacy Policy</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Grade at This Show */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Why Grade Cards at {show.short_name || show.name}?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            With {show.estimated_tables ? `${show.estimated_tables}+ vendor tables` : 'hundreds of vendors'} and {show.estimated_attendance || 'thousands of'} collectors expected, make smarter buying decisions with instant AI grading.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Pre-Screen Purchases</h3>
              <p className="text-gray-400 text-sm">Grade cards before buying to avoid overpaying for damaged cards</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Verify Seller Claims</h3>
              <p className="text-gray-400 text-sm">Confirm condition claims from vendors with instant AI analysis</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Know PSA Potential</h3>
              <p className="text-gray-400 text-sm">See estimated PSA/BGS grades before deciding to submit</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Instant Results</h3>
              <p className="text-gray-400 text-sm">Get grades in 60 seconds, right at the show floor</p>
            </div>
          </div>
        </div>
      </section>

      {/* What is DCM Grading */}
      <section className="py-16 bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">
                What is DCM Grading?
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                DCM is an AI-powered card grading service that lets you <strong className="text-white">instantly grade any trading card using just your phone</strong>. No shipping, no waiting weeks for results. Get professional-grade analysis in 60 seconds.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Phone-Based Grading</h3>
                </div>
                <p className="text-gray-400">
                  Simply take photos of your card's front and back with your smartphone. Our AI analyzes the images and delivers comprehensive grading results - perfect for on-the-spot decisions at card shows.
                </p>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Results in 60 Seconds</h3>
                </div>
                <p className="text-gray-400">
                  No more waiting weeks for PSA or BGS. DCM's AI delivers detailed analysis in under a minute, so you can make informed decisions before the seller moves on to the next buyer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards We Grade */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Cards We Grade
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              DCM grades virtually every type of trading card. Whether you're hunting for vintage sports cards, chasing Pokemon hits, or collecting non-sports cards, we've got you covered.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {[
              { name: 'Pokemon', icon: '⚡' },
              { name: 'Sports Cards', icon: '🏈' },
              { name: 'Magic: The Gathering', icon: '🔮' },
              { name: 'Disney Lorcana', icon: '✨' },
              { name: 'One Piece', icon: '🏴‍☠️' },
              { name: 'Yu-Gi-Oh!', icon: '🎴' },
            ].map((card, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center hover:border-emerald-500/50 transition-colors">
                <div className="text-3xl mb-2">{card.icon}</div>
                <div className="text-white font-medium text-sm">{card.name}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-400 mb-4">Plus non-sports cards including:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Star Wars', 'Garbage Pail Kids', 'Marvel', 'WWE', 'Dragon Ball', 'Flesh and Blood', 'Weiss Schwarz', 'Panini', 'Topps'].map((type, i) => (
                <span key={i} className="px-3 py-1 bg-gray-800 rounded-full text-gray-300 text-sm border border-gray-700">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 30-Point Inspection */}
      <section className="py-16 bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              30-Point Inspection
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Our DCM Optic™ AI examines every critical aspect of your card's condition to determine if it's truly Mint, Near Mint, or has hidden flaws that affect value.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Centering</h3>
              <p className="text-gray-400 text-sm">
                Precise left/right and top/bottom border measurements on both front and back. Even slight off-centering can impact grade and value.
              </p>
              <div className="mt-3 text-xs text-blue-400">
                Front & back analysis
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Corners</h3>
              <p className="text-gray-400 text-sm">
                All four corners analyzed for whitening, dings, bends, and wear. Corner condition is often the biggest factor in a card's final grade.
              </p>
              <div className="mt-3 text-xs text-purple-400">
                All 4 corners examined
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Edges</h3>
              <p className="text-gray-400 text-sm">
                All four edges inspected for chipping, whitening, nicks, and fuzzing. Edge wear from handling is common but often overlooked.
              </p>
              <div className="mt-3 text-xs text-orange-400">
                Top, bottom, left, right
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Surface</h3>
              <p className="text-gray-400 text-sm">
                Scratches, print lines, staining, creases, and holo scratches identified. Surface defects can tank an otherwise pristine card's grade.
              </p>
              <div className="mt-3 text-xs text-emerald-400">
                Scratches, print defects, holo
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Step by Step */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            How to Grade Cards at {show.short_name || show.name}
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Grade cards right at the vendor's table in just 4 simple steps
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="relative">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-white text-xl font-bold">1</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Snap Photos</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Use your phone camera to photograph the card's front and back. Our app includes alignment guides for perfect shots.
                </p>
                <div className="text-xs text-emerald-400">Works with any smartphone</div>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-white text-xl font-bold">2</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Upload & Select Card Type</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Upload your photos and select the card type - Pokemon, sports, Magic, or any other TCG. DCM automatically identifies the card.
                </p>
                <div className="text-xs text-emerald-400">Auto card identification</div>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-white text-xl font-bold">3</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">AI Analysis</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Our DCM Optic™ AI performs a 30-point inspection analyzing centering, corners, edges, and surface condition in under 60 seconds.
                </p>
                <div className="text-xs text-emerald-400">Results in 60 seconds</div>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </div>
            </div>

            <div>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-white text-xl font-bold">4</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Get Your Grade</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Receive your DCM grade (1-10), subgrades, PSA/BGS/SGC estimates, downloadable PDF report, and printable label.
                </p>
                <div className="text-xs text-emerald-400">Reports & labels included</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-16 bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              What You Get With Every Grade
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Every DCM grade comes with comprehensive reports and tools to help you make informed decisions
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Detailed PDF Report</h3>
              <p className="text-gray-400 text-sm">
                Download a professional report showing your grade, subgrades for each category, defect analysis, and high-resolution images of your card.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Printable Labels</h3>
              <p className="text-gray-400 text-sm">
                Get printable labels featuring your card's grade, subgrades, and a unique QR code. Perfect for display, sales, or inserting into card slabs.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">PSA/BGS/SGC Estimates</h3>
              <p className="text-gray-400 text-sm">
                See estimated grades from PSA, BGS, and SGC based on our analysis. Know if your card is worth submitting for professional grading.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Example Reports Section */}
      <section className="py-16 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              See Real Grading Results
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Here's what a DCM grade looks like - detailed analysis and professional reports for any card type
            </p>
          </div>

          {/* Pokemon Example */}
          <div className="max-w-5xl mx-auto mb-16">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">⚡</span>
              <h3 className="text-xl font-bold text-white">Pokemon Card Example</h3>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Card Image */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl blur-xl opacity-30" />
                  <Image
                    src="/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg"
                    alt="Umbreon ex Pokemon Card"
                    width={200}
                    height={280}
                    className="relative rounded-xl shadow-2xl border border-gray-700"
                  />
                </div>
              </div>

              {/* Analysis Points */}
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-blue-400 text-sm font-medium mb-1">Centering</div>
                    <div className="text-white font-bold">9</div>
                    <div className="text-gray-500 text-xs">Near perfect alignment</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-purple-400 text-sm font-medium mb-1">Corners</div>
                    <div className="text-white font-bold">10</div>
                    <div className="text-gray-500 text-xs">Gem Mint corners</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-orange-400 text-sm font-medium mb-1">Edges</div>
                    <div className="text-white font-bold">10</div>
                    <div className="text-gray-500 text-xs">Pristine edges</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-emerald-400 text-sm font-medium mb-1">Surface</div>
                    <div className="text-white font-bold">10</div>
                    <div className="text-gray-500 text-xs">Flawless surface</div>
                  </div>
                </div>
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                  <div className="text-emerald-400 text-sm font-medium">Overall DCM Grade</div>
                  <div className="text-3xl font-bold text-white">9</div>
                  <div className="text-gray-400 text-xs">PSA Estimate: 9 | BGS Estimate: 9.0</div>
                </div>
              </div>

              {/* Report Image */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-30" />
                  <Image
                    src="/Pokemon/DCM-MiniReport-Umbreon-ex-887696.jpg"
                    alt="DCM Pokemon Grading Report"
                    width={220}
                    height={320}
                    className="relative rounded-xl shadow-2xl border border-gray-700"
                  />
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Downloadable Report
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sports Example */}
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🏀</span>
              <h3 className="text-xl font-bold text-white">Sports Card Example</h3>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Card Image */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-30" />
                  <Image
                    src="/Sports/DCM-Card-LeBron-James-547249-front.jpg"
                    alt="LeBron James Sports Card"
                    width={200}
                    height={280}
                    className="relative rounded-xl shadow-2xl border border-gray-700"
                  />
                </div>
              </div>

              {/* Analysis Points */}
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-blue-400 text-sm font-medium mb-1">Centering</div>
                    <div className="text-white font-bold">10</div>
                    <div className="text-gray-500 text-xs">Perfect centering</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-purple-400 text-sm font-medium mb-1">Corners</div>
                    <div className="text-white font-bold">9</div>
                    <div className="text-gray-500 text-xs">Near Mint corners</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-orange-400 text-sm font-medium mb-1">Edges</div>
                    <div className="text-white font-bold">9</div>
                    <div className="text-gray-500 text-xs">Clean edges</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-emerald-400 text-sm font-medium mb-1">Surface</div>
                    <div className="text-white font-bold">9</div>
                    <div className="text-gray-500 text-xs">Minimal wear</div>
                  </div>
                </div>
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                  <div className="text-emerald-400 text-sm font-medium">Overall DCM Grade</div>
                  <div className="text-3xl font-bold text-white">9</div>
                  <div className="text-gray-400 text-xs">PSA Estimate: 9 | BGS Estimate: 9.0</div>
                </div>
              </div>

              {/* Report Image */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-30" />
                  <Image
                    src="/Sports/DCM-MiniReport-LeBron-James-547249.jpg"
                    alt="DCM Sports Grading Report"
                    width={220}
                    height={320}
                    className="relative rounded-xl shadow-2xl border border-gray-700"
                  />
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Downloadable Report
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Show Details */}
      {(show.description || show.highlights) && (
        <section className="py-16 bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">About {show.name}</h2>

              {show.description && (
                <p className="text-gray-300 mb-6">{show.description}</p>
              )}

              {show.highlights && show.highlights.length > 0 && (
                <div className="grid md:grid-cols-2 gap-3">
                  {show.highlights.map((highlight, i) => (
                    <div key={i} className="flex items-center gap-2 text-gray-300">
                      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              )}

              {show.website_url && (
                <div className="mt-6">
                  <a
                    href={show.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                  >
                    Visit official show website
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-emerald-900 to-teal-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready for {show.short_name || show.name}?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Sign up now and get 1 free credit to grade cards at the show.
          </p>
          {user ? (
            <Link
              href="/credits"
              onClick={() => trackSignupClick(show.slug, 'footer_cta')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-10 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all shadow-lg"
            >
              Get Credits & Start Grading
            </Link>
          ) : (
            <Link
              href="/login?mode=signup&redirect=/credits"
              onClick={() => trackSignupClick(show.slug, 'footer_cta')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-10 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all shadow-lg"
            >
              Sign Up Free - Get 1 Credit
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>
      </section>

      {/* View All Shows Link */}
      <section className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center">
          <Link href="/card-shows" className="text-gray-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            View all upcoming card shows
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
