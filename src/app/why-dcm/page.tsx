'use client'

import { RelatedGuides } from '@/components/design/RelatedGuides'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getStoredSession, signInWithOAuth, signUp } from '@/lib/directAuth'
import AppStoreBadge from '@/components/AppStoreBadge'
import GooglePlayBadge from '@/components/GooglePlayBadge'
import FloatingCtaBar from '@/components/marketing/FloatingCtaBar'
import WhyDcmCapabilities from '@/components/marketing/WhyDcmCapabilities'
import { ReferenceCardShowcase } from '@/components/design/ReferenceCardShowcase'
import { ActionLink, SectionHeading, Icon } from '@/components/design/Primitives'

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


export default function WhyDcmPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
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

  const isAuthenticated = !!user

  // Live graded-card count — same endpoint as the /pop page and homepage
  // trust bar (totals.totalGraded), so the numbers always agree.
  const [popTotal, setPopTotal] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/pop/categories')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const total = data?.totals?.totalGraded
        if (typeof total === 'number' && total > 0) setPopTotal(total)
      })
      .catch(() => { /* strip falls back to non-numeric copy */ })
  }, [])

  // Inline signup for hero section
  const [heroEmail, setHeroEmail] = useState('')
  const [heroPassword, setHeroPassword] = useState('')
  const [heroLoading, setHeroLoading] = useState(false)
  const [heroOauthLoading, setHeroOauthLoading] = useState(false)
  const [heroError, setHeroError] = useState('')
  const [heroSuccess, setHeroSuccess] = useState('')

  const handleHeroOAuth = async (provider: 'google' | 'facebook' | 'apple') => {
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

  return <div className="dcm-brand dcm-why-page">
    <section ref={heroRef} className="dcm-hero dcm-dark">
      <div className="dcm-container dcm-why-hero">
        <div className="dcm-why-intro">
          <p className="dcm-eyebrow">Why DCM · 2 free grades</p>
          <h1>Why DCM Grading?<br /><span>Your collection, connected.</span></h1>
          <p className="dcm-lead">Grade your cards, track your portfolio, create custom labels and prepare eBay listings. Explore everything DCM brings to your collection, without mailing your cards away.</p>
          <div className="dcm-actions"><ActionLink href="/get-started" variant="secondary">How It Works</ActionLink><ActionLink href="#benefits" variant="text">Explore the benefits →</ActionLink></div>
        </div>
        <ReferenceCardShowcase page="why-dcm" />
        <div className="dcm-why-signup">
            {/* Signup card */}
            {!isAuthenticated && !isLoading && (
              <div className="w-full max-w-md flex-shrink-0">
                <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                  <div className="bg-purple-600 px-6 py-4">
                    <h2 className="text-white font-bold text-lg">Start Grading for Free</h2>
                    <p className="text-purple-100 text-sm">Your first 2 grades are on us + bonus credits with first purchase</p>
                  </div>
                  <div className="p-6">
                    {heroSuccess ? (
                      <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-3 rounded-xl text-sm text-center">{heroSuccess}</div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-4">
                          <button onClick={() => handleHeroOAuth('google')} disabled={heroOauthLoading || heroLoading}
                            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 py-3 px-4 rounded-xl border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all font-medium text-sm">
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
                          <button onClick={() => handleHeroOAuth('apple')} disabled={heroOauthLoading || heroLoading}
                            className="w-full flex items-center justify-center gap-3 bg-black text-white py-3 px-4 rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-all font-medium text-sm">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </svg>
                            {heroOauthLoading ? 'Connecting...' : 'Continue with Apple'}
                          </button>
                        </div>
                        <div className="relative mb-4">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                          <div className="relative flex justify-center text-xs"><span className="px-3 bg-white text-gray-400">or email</span></div>
                        </div>
                        <form onSubmit={handleHeroEmail} className="space-y-3">
                          <input aria-label="Email address" autoComplete="email" type="email" value={heroEmail} onChange={(e) => setHeroEmail(e.target.value)} placeholder="you@example.com" required
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" />
                          <input aria-label="Password" autoComplete="new-password" type="password" value={heroPassword} onChange={(e) => setHeroPassword(e.target.value)} placeholder="Password (10+ chars)" required minLength={10}
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" />
                          {heroError && <p role="alert" className="text-red-600 text-sm">{heroError}</p>}
                          <button type="submit" disabled={heroLoading}
                            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-purple-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/25">
                            {heroLoading ? 'Creating Account...' : 'Create Free Account'}
                          </button>
                        </form>
                        <p className="text-gray-600 text-xs text-center mt-3">
                          By signing up you agree to our <Link href="/terms" className="text-purple-600 hover:text-purple-700">Terms</Link> and <Link href="/privacy" className="text-purple-600 hover:text-purple-700">Privacy Policy</Link>
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
                <Link href="/collection" className="inline-block bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:from-purple-700 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25">
                  Go to My Collection
                </Link>
              </div>
            )}

        </div>
      </div>
    </section>
    <div className="dcm-why-proof dcm-container"><span>{popTotal ? `${popTotal.toLocaleString()} cards graded` : 'Built for trading card collectors'}</span><span>4 condition subgrades</span><span>Verifiable reports</span><span>Your cards stay with you</span></div>
    <div role="navigation" className="dcm-why-section-nav dcm-container" aria-label="Explore DCM features">{[['grading','Grading'],['reports','Reports'],['portfolio','Portfolio'],['labels','Label Studio'],['instalist','eBay InstaList'],['explore','Card tools'],['walkthrough','Watch the walkthrough'],['plans','Plans & membership']].map(([id,label]) => <a key={id} href={`#${id}`}>{label}</a>)}</div>
    <section id="benefits" className="dcm-section dcm-container">
      <SectionHeading eyebrow="From the first photo to your next decision" title="More than a number on a card.">A connected workflow for understanding, organizing and sharing your collection.</SectionHeading>
      <div className="dcm-why-benefits">
        {([
          ['scan', 'Understand the condition', 'Centering, corners, edges and surface are assessed on both sides, with findings you can review in the card report.', '#grading', 'Explore DCM Optic'],
          ['report', 'See why it earned that grade', 'Review the analysis and photo evidence behind your result. Compare it with the published DCM grading standard.', '#reports', 'Explore card reports'],
          ['label', 'Give your card its own identity', 'A Heritage label pairs your card’s colors with its recorded grade, condition and verifiable serial number.', '#labels', 'Explore label options'],
          ['collection', 'Keep your collection together', 'Organize your graded cards and revisit their reports. Follow market estimates and portfolio insights as your collection grows.', '#portfolio', 'Explore Portfolio'],
          ['sell', 'Share the condition with buyers', 'Use InstaList to bring your card photos and condition breakdown into an eBay listing, with the report behind the grade.', '#instalist', 'Explore InstaList'],
          ['chart', 'Put the grade in context', 'Browse DCM’s population data to see grade distributions across categories and individual cards.', '#explore', 'Explore card tools'],
        ] as const).map(([icon, title, copy, href, link]) => <article key={title}><Icon name={icon} /><h3>{title}</h3><p>{copy}</p><ActionLink href={href} variant="text">{link} →</ActionLink></article>)}
      </div>
    </section>
    <WhyDcmCapabilities /><RelatedGuides />
    <section className="dcm-section dcm-surface">
      <div className="dcm-container dcm-why-next">
        <div><SectionHeading eyebrow="Made for your collecting routine" title="Start with the cards you have.">Photograph the front and back, upload them and review your grade and condition analysis. Pokémon, sports, Magic: The Gathering, One Piece and more.</SectionHeading><ActionLink href="/get-started" variant="primary">Prepare your first card</ActionLink></div>
        <div className="dcm-why-note"><p className="dcm-eyebrow">Better photos, clearer analysis</p><h3>The details need to be visible.</h3><p>Use even lighting, keep every edge in frame and avoid glare. Your report explains the findings and limitations of the photos you provide.</p><ActionLink href="/grading-limitations" variant="text">Understand the limitations →</ActionLink></div>
      </div>
    </section>
    <section id="plans" className="dcm-section dcm-container">
      <SectionHeading eyebrow="Choose your pace" title="Grade a few. Build a collection.">Start with your two free grades, then choose the credit package or membership that fits.</SectionHeading>
      <div className="dcm-why-plans">
        <article><p className="dcm-eyebrow">On your schedule</p><h3>Grading credits</h3><p>Buy credits when you need them. Compare packages and first-purchase bonuses.</p><ActionLink href="/credits" variant="secondary">View pricing</ActionLink></article>
        <article><p className="dcm-eyebrow">A bigger collection</p><h3>VIP package</h3><p>Explore the credit bundle and VIP label benefits for your next group of cards.</p><ActionLink href="/vip" variant="secondary">Explore VIP</ActionLink></article>
        <article><p className="dcm-eyebrow">An ongoing hobby</p><h3>Card Lovers</h3><p>Compare monthly and annual memberships, ongoing credits and member benefits.</p><ActionLink href="/card-lovers" variant="secondary">Explore membership</ActionLink></article>
      </div>
    </section>
    <section className="dcm-section dcm-surface"><div className="dcm-container dcm-why-faq">
      <SectionHeading eyebrow="Before your first grade" title="Questions collectors ask." />
      <details><summary>What does the grade tell me?</summary><p>The DCM grade summarizes the condition visible in your photographs. Open the report to review the four subgrades, findings and supporting evidence. Photo quality affects what can be assessed.</p><ActionLink href="/grading-standard" variant="text">Read the grading standard</ActionLink></details>
      <details><summary>Can someone else verify my card’s grade?</summary><p>Share your public card report or serial number so another collector can review the recorded grade and condition analysis.</p></details>
      <details><summary>What if I disagree with my grade?</summary><p>Review the report’s findings and photo evidence first. If glare or focus obscures a detail, take clearer photos. Contact support if something still looks wrong.</p><ActionLink href="/contact" variant="text">Contact support</ActionLink></details>
    </div></section>
    <section className="dcm-section dcm-dark"><div className="dcm-container dcm-why-next">
      <div><p className="dcm-eyebrow">Your next card starts here</p><h2>Get to know your collection.</h2><p className="dcm-lead">Your first two grades are on us.</p><Link className="dcm-button dcm-button--primary" href={isAuthenticated ? '/upload' : '/login?mode=signup'} onClick={() => { if (!isAuthenticated) trackSignupClick('final_cta') }}>{isAuthenticated ? 'Grade a Card' : 'Create Free Account'}</Link></div>
      <div><h3>Take DCM with you.</h3><p className="dcm-lead">Grade and manage your cards on your phone.</p><div className="dcm-actions"><AppStoreBadge variant="white" /><GooglePlayBadge /></div></div>
    </div></section>
    {!isAuthenticated && <div className="h-16" />}
    <FloatingCtaBar isAuthenticated={isAuthenticated} accent="purple" source="why_dcm" heroRef={heroRef} />
  </div>
}
