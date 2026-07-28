'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { signInWithOAuth, signUp } from '@/lib/directAuth'

/**
 * Sticky bottom CTA bar with rotating benefit messages that expands into a
 * full signup form. Extracted from /why-dcm so the category landing pages
 * share one implementation.
 *
 * Self-managing: it watches scroll and reveals itself once the user is past
 * the hero, so a page only needs to render it. Pass `heroRef` for precise
 * "past the hero" behaviour, or omit it to fall back to a scroll threshold.
 *
 * Renders nothing for signed-in users.
 *
 * Requires the global `.animate-slide-up` keyframes and the
 * `body.has-floating-cta` rule in globals.css (both already present) — the
 * latter lifts the HelpBot bubble above this bar.
 */

type Accent = 'purple' | 'emerald'

const ACCENTS: Record<Accent, { border: string; borderStrong: string; button: string; shadow: string; link: string; ring: string }> = {
  purple: {
    border: 'border-purple-500/30',
    borderStrong: 'border-purple-500/50',
    button: 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700',
    shadow: 'shadow-purple-500/25',
    link: 'text-purple-400 hover:text-purple-300',
    ring: 'focus:ring-purple-500',
  },
  emerald: {
    border: 'border-emerald-500/30',
    borderStrong: 'border-emerald-500/50',
    button: 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700',
    shadow: 'shadow-emerald-500/25',
    link: 'text-emerald-400 hover:text-emerald-300',
    ring: 'focus:ring-emerald-500',
  },
}

const DEFAULT_MESSAGES = [
  '2 free grades + bonus credits',
  'Grade cards in minutes, not weeks',
  'Labels, pricing & eBay listing',
  'From $0.50/card — credits never expire',
]

export interface FloatingCtaBarProps {
  isAuthenticated: boolean
  /** Rotating benefit lines. Defaults to the generic DCM set. */
  messages?: string[]
  /** Colour theme — match the host page. */
  accent?: Accent
  /** Identifies the page in analytics, e.g. 'pokemon_landing'. */
  source: string
  /** Where to send the user after signup. */
  redirectTo?: string
  /** Reveal once this element has scrolled out of view. Falls back to 600px. */
  heroRef?: React.RefObject<HTMLElement | null>
}

export default function FloatingCtaBar({
  isAuthenticated,
  messages = DEFAULT_MESSAGES,
  accent = 'purple',
  source,
  redirectTo = '/credits',
  heroRef,
}: FloatingCtaBarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ctaIndex, setCtaIndex] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const a = ACCENTS[accent]

  // Rotate the benefit line
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCtaIndex(prev => (prev + 1) % messages.length)
    }, 4000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [messages.length])

  // Reveal after the hero scrolls past
  useEffect(() => {
    if (isAuthenticated) return
    const handleScroll = () => {
      const hero = heroRef?.current
      if (hero) {
        setIsVisible(hero.getBoundingClientRect().bottom < -100)
      } else {
        setIsVisible(window.scrollY > 600)
      }
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isAuthenticated, heroRef])

  // Lift the HelpBot bubble above the bar
  useEffect(() => {
    if (isAuthenticated) return
    document.body.classList.add('has-floating-cta')
    return () => { document.body.classList.remove('has-floating-cta') }
  }, [isAuthenticated])

  const track = (location: string) => {
    if (typeof window === 'undefined') return
    if (window.gtag) {
      window.gtag('event', 'signup_click', {
        event_category: 'conversion',
        event_label: location,
        page: source,
      })
      window.gtag('event', 'conversion', {
        send_to: 'G-YLC2FKKBGC',
        event_category: 'signup',
        event_label: `${source}_${location}`,
      })
    }
    if (window.rdt) {
      window.rdt('track', 'Lead', { conversionId: `lead_${source}_${Date.now()}_${location}` })
    }
  }

  if (isAuthenticated || !isVisible) return null

  const handleOAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setOauthLoading(true)
    setError('')
    track(`floating_${provider}`)
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_redirect', redirectTo)
      localStorage.setItem('signup_source', `${source}_floating`)
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
    track('floating_email')
    try {
      const result = await signUp(email, password)
      if (result.error) {
        setError(result.error)
      } else {
        if (typeof window !== 'undefined') {
          if (window.rdt) window.rdt('track', 'SignUp', { conversionId: `signup_${source}_${Date.now()}` })
          if (window.gtag) window.gtag('event', 'sign_up', { method: 'email' })
          if (window.fbq) window.fbq('track', 'CompleteRegistration', { content_name: `${source} Floating Signup` })
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
      {isExpanded && (
        <div className={`bg-gray-900 border-t ${a.borderStrong} shadow-2xl p-4 sm:p-6 animate-slide-up`}>
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">Create Your Free Account</h3>
              <button onClick={() => setIsExpanded(false)} className="text-gray-400 hover:text-white p-1" aria-label="Close signup">
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
                <div className="space-y-2 mb-3">
                  <button
                    onClick={() => handleOAuth('google')}
                    disabled={oauthLoading || loading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 py-2.5 px-3 rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-all"
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
                    className="w-full flex items-center justify-center gap-2 bg-[#1877F2] text-white py-2.5 px-3 rounded-xl text-sm font-medium hover:bg-[#166FE5] disabled:opacity-50 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </button>
                  <button
                    onClick={() => handleOAuth('apple')}
                    disabled={oauthLoading || loading}
                    className="w-full flex items-center justify-center gap-2 bg-black text-white py-2.5 px-3 rounded-xl text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    Apple
                  </button>
                </div>

                <div className="relative mb-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-gray-900 text-gray-500">or email</span>
                  </div>
                </div>

                <form onSubmit={handleEmail} className="space-y-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className={`w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 ${a.ring} focus:border-transparent`}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (10+ characters)"
                    required
                    minLength={10}
                    className={`w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 ${a.ring} focus:border-transparent`}
                  />
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full bg-gradient-to-r ${a.button} text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all`}
                  >
                    {loading ? 'Creating Account...' : 'Create Free Account'}
                  </button>
                </form>

                <p className="text-gray-500 text-[10px] text-center mt-2">
                  By signing up you agree to our <Link href="/terms" className={a.link}>Terms</Link> and <Link href="/privacy" className={a.link}>Privacy Policy</Link>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!isExpanded && (
        <div className={`bg-gray-900/95 backdrop-blur-lg border-t ${a.border} shadow-2xl`}>
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-snug">{messages[ctaIndex]}</p>
            </div>
            <button
              onClick={() => { track('floating_expand'); setIsExpanded(true) }}
              className={`flex-shrink-0 bg-gradient-to-r ${a.button} text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${a.shadow}`}
            >
              Sign Up Free
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
