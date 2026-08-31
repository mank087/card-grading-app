'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession } from '../lib/directAuth'
import ScrollingCardBackground from './ui/ScrollingCardBackground'
import { CardSlabGrid } from '@/components/CardSlab'
import { getCardLabelData } from '@/lib/useLabelData'
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout'
import AppStoreBadge, { APP_STORE_URL } from '@/components/AppStoreBadge'
import GooglePlayBadge, { GOOGLE_PLAY_URL } from '@/components/GooglePlayBadge'
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates'
import FeaturedCardsCarousel from '@/components/FeaturedCardsCarousel'

// Pre-redesign homepage preserved at src/app/page.tsx.backup_pre_redesign_20260707
// (July 2026 redesign: outcome-led hero, evergreen New Grader offer replacing the
// "Launch Special", live trust stats, How It Works, transparency strip, closing CTA.)

// Helper functions to extract card info (matching collection page)
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (text === null || text === undefined) return null
  const str = typeof text === 'string' ? text : String(text)
  if (!str) return null
  return str.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '')
}

const getCardInfo = (card: any) => {
  const dvgGrading = card.ai_grading || {}
  const setNameRaw = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading.card_info?.subset
  // Combine set name with subset if available (matching foldable label format)
  const setNameWithSubset = subset ? `${setNameRaw} - ${subset}` : setNameRaw
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: setNameWithSubset,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading.card_info?.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading.card_info?.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number_raw) || stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || dvgGrading.card_info?.card_number,
    serial_number: stripMarkdown(card.conversational_card_info?.serial_number) || dvgGrading.card_info?.serial_number,
    rookie_or_first: card.conversational_card_info?.rookie_or_first || dvgGrading.card_info?.rookie_or_first,
    autographed: card.conversational_card_info?.autographed || false,
  }
}

const getCardGrade = (card: any) => {
  if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
    return card.conversational_decimal_grade
  }
  if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
    return card.dvg_decimal_grade
  }
  if (card.dcm_grade_whole) return card.dcm_grade_whole
  if (card.grade_numeric) return card.grade_numeric
  return null
}

const formatGrade = (grade: number): string => {
  // v6.0: Always return whole number (no .5 scores)
  return Math.round(grade).toString()
}

const getCardLink = (card: any) => `/${categoryToRouteSlug(card.category)}/${card.id}`

/**
 * Live graded-card counter. `target` is the exact live database count (same
 * value /pop shows). On first reveal it starts ~100 below and counts up to the
 * live number, so it reads as "cards actively being graded"; on re-poll it
 * animates the small delta whenever real grading pushes the count higher. It
 * never exceeds the live number, so it can never read higher than /pop.
 */
function AnimatedGradedCount({ target }: { target: number | null }) {
  const [display, setDisplay] = useState<number | null>(null)
  const displayRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (target == null) return
    // First reveal starts ~100 below the live count and climbs up to it;
    // subsequent live increases animate just the small delta.
    const from = displayRef.current == null
      ? Math.max(0, target - 100)
      : displayRef.current
    const to = target
    if (from === to) {
      displayRef.current = to
      setDisplay(to)
      return
    }
    const durationMs = displayRef.current == null ? 4800 : 2000
    const startTime = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      const val = Math.round(from + (to - from) * eased)
      displayRef.current = val
      setDisplay(val)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target])

  if (display == null) return <>Thousands of</>
  return <>{display.toLocaleString('en-US')}</>
}

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [featuredCards, setFeaturedCards] = useState<any[]>([])
  const [featuredCardsLoading, setFeaturedCardsLoading] = useState(true)
  const [popTotal, setPopTotal] = useState<number | null>(null)

  useEffect(() => {
    const getUser = async () => {
      // Use direct auth session instead of Supabase client
      const session = getStoredSession()
      const sessionUser = session?.user
      setUser(sessionUser)
      setAuthChecked(true)
    }

    getUser()
  }, [])

  // Fetch featured cards (public for everyone)
  useEffect(() => {
    const getFeaturedCards = async () => {
      try {
        const response = await fetch('/api/cards/featured')
        const data = await response.json()
        setFeaturedCards(data.cards || [])
      } catch (err) {
        console.error('Error fetching featured cards:', err)
      } finally {
        setFeaturedCardsLoading(false)
      }
    }

    getFeaturedCards()
  }, [])

  // Live graded-card count from the SAME endpoint the /pop page reads
  // (totals.totalGraded), so the two can never disagree. Re-polled on an
  // interval; the route is edge-cached (s-maxage=300) so repeat calls are
  // near-free and an open tab still reflects newly graded cards over time.
  useEffect(() => {
    let active = true
    const load = () => {
      fetch('/api/pop/categories')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          const total = data?.totals?.totalGraded
          if (active && typeof total === 'number' && total > 0) setPopTotal(total)
        })
        .catch(() => { /* fallback copy stays */ })
    }
    load()
    const id = setInterval(load, 45000)
    return () => { active = false; clearInterval(id) }
  }, [])


  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section — outcome-led headline; the legal entity name lives in
          the logo alt/footer, not the pitch. */}
      <section className="relative bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20 overflow-hidden">
        {/* Scrolling Card Background */}
        <ScrollingCardBackground opacity={40} blur={2} speed={1} />

        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/70 to-purple-700/70 z-0"></div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/DCM Logo white.png"
              alt="DCM Logo"
              width={100}
              height={100}
              className="object-contain"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Professional Card Grading. Instant Results.
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
            Snap two photos. <span className="font-semibold">DCM Optic™</span> inspects centering, corners,
            edges, and surface, then hands you a grade, condition report, market value, and printable slab
            label in about a minute. Sports, Pokémon®, Magic: The Gathering®, Disney Lorcana®, and more.
          </p>

          <div className="min-h-[76px] flex flex-col items-center justify-center">
            {!authChecked ? (
              <div className="h-12 w-40 bg-white/20 rounded-lg animate-pulse"></div>
            ) : user ? (
              <div className="space-x-4">
                <Link
                  href="/upload"
                  className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
                >
                  Grade a Card
                </Link>
                <Link
                  href="/collection"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors inline-block"
                >
                  View Collection
                </Link>
              </div>
            ) : (
              <>
                <Link
                  href="/login?mode=signup"
                  className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
                >
                  Grade 2 Cards Free
                </Link>
                <p className="text-sm text-white/80 mt-3">
                  No credit card required
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Trust bar. The graded count comes from the same endpoint as the
          /pop page, so the two always agree. */}
      <section className="bg-slate-900 text-white border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm">
            <Link href="/pop" className="flex items-center gap-2 hover:text-purple-300 transition-colors">
              <span className="text-purple-400 font-bold text-base tabular-nums">
                <AnimatedGradedCount target={popTotal} />
              </span>
              <span className="text-gray-300">cards graded</span>
            </Link>
            <Link href="/featured" className="flex items-center gap-2 hover:text-purple-300 transition-colors">
              <span className="text-purple-400 font-bold text-base">Featured</span>
              <span className="text-gray-300">cards</span>
            </Link>
            <Link href="/labels" className="flex items-center gap-2 hover:text-purple-300 transition-colors">
              <span className="text-purple-400 font-bold text-base">Custom</span>
              <span className="text-gray-300">label studio</span>
            </Link>
            <span className="flex items-center gap-2">
              <span className="text-purple-400 font-bold text-base">
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition-colors underline decoration-purple-400/40 underline-offset-2">iOS</a>
                {' '}&amp;{' '}
                <a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition-colors underline decoration-purple-400/40 underline-offset-2">Android</a>
              </span>
              <span className="text-gray-300">apps available</span>
            </span>
          </div>
        </div>
      </section>

      {/* New Grader Offer — evergreen welcome offer (replaces the retired
          "DCM Launch Special" / "Limited Time" framing; the numbers below are
          exactly what src/lib/credits.ts grants). */}
      <section className="py-12 relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Background Card Image - Styled with rotation and zoom, focusing on label and top of card */}
        <div className="absolute inset-0 flex items-center justify-end pointer-events-none overflow-hidden">
          <div
            className="absolute right-[-10%] md:right-[0%] lg:right-[5%] top-[-20%] w-[400px] md:w-[500px] lg:w-[600px] opacity-30 md:opacity-40"
            style={{
              transform: 'rotate(-12deg)',
            }}
          >
            <Image
              src="/promo-umbreon.png"
              alt=""
              width={600}
              height={840}
              className="object-contain object-top drop-shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-purple-900/80 to-transparent"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/20">
              <span className="text-yellow-400 text-xl">🎁</span>
              <span className="text-white font-semibold">New Grader Welcome</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Start With 2 Free Grades
            </h2>
            <p className="text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 font-semibold mb-4">
              Then up to 5 bonus credits with your first credit pack.
            </p>
            <p className="text-lg text-gray-300 mb-6 max-w-xl">
              Every new account starts with 2 free credits, enough to grade two cards with full
              reports and labels included. When you buy your first pack, we top it up:
              +1 bonus credit on Basic, +2 on Pro, +5 on Elite. Credits never expire, and you can{' '}
              <Link href="/cheapest-card-grading" className="text-purple-300 hover:text-purple-200 underline">
                see how the cost compares
              </Link>{' '}
              to mail-away grading.
            </p>

            {/* App availability callout */}
            <p className="text-base sm:text-lg text-white font-semibold mb-6 max-w-xl">
              <span aria-hidden>📱</span> Now available on iPhone, iPad &amp; Android.
              <span className="block text-sm sm:text-base font-normal text-gray-300 mt-1">
                Grade on the go, or right here on the web.
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                href="/login?mode=signup"
                className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg hover:shadow-orange-500/25 hover:shadow-xl"
              >
                Grade 2 Cards Free
              </Link>
              <AppStoreBadge variant="black" height={52} />
              <GooglePlayBadge height={52} />
            </div>

            <p className="text-gray-400 text-sm mt-6">
              No subscription required • Pay only for what you use
            </p>
          </div>
        </div>
      </section>

      {/* How It Works — the 3-step flow prospects previously had to leave the
          homepage to learn. */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            From raw card to graded, valued, and ready to sell in about a minute
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="text-center p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-700 font-bold text-xl">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Snap two photos</h3>
              <p className="text-gray-600 text-sm">
                Front and back, with your phone or any camera. Built-in capture guides and a photo
                quality check help you get a gradeable shot on the first try.
              </p>
            </div>
            {/* Step 2 */}
            <div className="text-center p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="bg-purple-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-700 font-bold text-xl">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">DCM Optic™ grades it</h3>
              <p className="text-gray-600 text-sm">
                Independent evaluations inspect centering, corners, edges, and surface, including
                magnified region-by-region analysis, then agree on a grade with a full written report.
              </p>
            </div>
            {/* Step 3 */}
            <div className="text-center p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="bg-green-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-700 font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Slab it, sell it, show it</h3>
              <p className="text-gray-600 text-sm">
                Get the market value, print a custom slab label, download the grading report, and list
                straight to eBay with InstaList. Or just watch your collection&apos;s value grow.
              </p>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link
              href="/featured"
              className="inline-block text-purple-600 hover:text-purple-700 font-semibold"
            >
              See real grading reports from the community &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section - Why Choose DCM */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Why Choose DCM?</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            The complete solution for grading, managing, and showcasing your trading card collection —{' '}
            <Link href="/why-dcm" className="text-purple-600 hover:text-purple-700 underline">see the full case</Link>.
          </p>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
            {/* 1. Machine Learning Accuracy */}
            <div className="text-center p-4">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Machine Learning</h3>
              <p className="text-gray-600 text-sm">
                <Link href="/ai-card-grading" className="text-purple-600 hover:text-purple-700 underline">DCM Optic™, our grading engine</Link>,
                delivers consistent, detailed, and{' '}
                <Link href="/ai-card-grading-accuracy" className="text-purple-600 hover:text-purple-700 underline">reliable condition assessments</Link>.
              </p>
            </div>

            {/* 2. Detailed Card Condition */}
            <div className="text-center p-4">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Detailed Card Condition</h3>
              <p className="text-gray-600 text-sm">Comprehensive 30-point inspection across centering, corners, edges, and surface.</p>
            </div>

            {/* 3. Build Your Collection */}
            <div className="text-center p-4">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Build Your Collection</h3>
              <p className="text-gray-600 text-sm">Manage your collection with your actual card images, not stock photos. DCM and third-party graded cards welcome.</p>
            </div>

            {/* 4. Accurate Market Pricing */}
            <div className="text-center p-4">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Accurate Market Pricing</h3>
              <p className="text-gray-600 text-sm">Direct links to eBay and TCGPlayer for real-time, up-to-date market pricing.</p>
            </div>

            {/* 5. Downloadable Labels & Reports */}
            <div className="text-center p-4">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Labels &amp; Reports</h3>
              <p className="text-gray-600 text-sm">
                Download{' '}
                <Link href="/reports-and-labels" className="text-purple-600 hover:text-purple-700 underline">professional grading labels and analysis reports</Link>{' '}
                for display, online auctions, or in-person sales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Cards Section - Auto-Scrolling Carousel */}
      {featuredCardsLoading ? (
        <section className="py-16 bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="container mx-auto px-4">
            <div className="mb-8">
              <div className="h-8 w-64 bg-gray-300/50 rounded animate-pulse mb-2"></div>
              <div className="h-5 w-96 bg-gray-300/50 rounded animate-pulse"></div>
            </div>
            <div className="flex gap-6 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[280px] h-[400px] bg-gray-300/30 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        </section>
      ) : featuredCards.length > 0 ? (
        <FeaturedCardsCarousel featuredCards={featuredCards} />
      ) : null}

      {/* Transparency strip — AI grading you can audit. These pages already
          exist; stating limitations openly is a trust asset, not a liability. */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">How we grade, in the open</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Grading you can audit.{' '}
            <Link href="/grading-standard" className="text-purple-600 hover:text-purple-700 underline">Our standards</Link>,
            our data, and our limits are all public.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <Link href="/grading-rubric" className="block p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
              <h3 className="text-lg font-semibold mb-2 text-purple-700">Public grading rubric &rarr;</h3>
              <p className="text-gray-600 text-sm">
                The exact standards DCM Optic™ grades against, from centering tolerances to corner,
                edge, and surface criteria, published for anyone to read.
              </p>
            </Link>
            <Link href="/pop" className="block p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
              <h3 className="text-lg font-semibold mb-2 text-purple-700">Population report &rarr;</h3>
              <p className="text-gray-600 text-sm">
                Every grade we&apos;ve ever issued, aggregated and public. See exactly how rare a
                DCM 10 really is for any card we&apos;ve graded.
              </p>
            </Link>
            <Link href="/grading-limitations" className="block p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
              <h3 className="text-lg font-semibold mb-2 text-purple-700">Honest limitations &rarr;</h3>
              <p className="text-gray-600 text-sm">
                Photo-based grading has limits, and we document them: what DCM Optic™ can and
                can&apos;t see, and when a physical grade is the better choice.
              </p>
            </Link>
            <Link href="/card-grading-companies" className="block p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
              <h3 className="text-lg font-semibold mb-2 text-purple-700">How DCM compares &rarr;</h3>
              <p className="text-gray-600 text-sm">
                DCM next to PSA, BGS, SGC, and CGC on price, turnaround, and what you actually get
                back, so you can decide which grade a card is worth.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="py-16 bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Your first two grades are free
          </h2>
          <p className="text-lg text-white/85 mb-8 max-w-xl mx-auto">
            See what your collection is really worth. Graded, valued, and ready to sell in about a minute.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login?mode=signup"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
            >
              Grade 2 Cards Free
            </Link>
            <AppStoreBadge variant="black" height={48} />
            <GooglePlayBadge height={48} />
          </div>
        </div>
      </section>

    </main>
  )
}

