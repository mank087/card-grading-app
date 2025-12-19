'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void
  }
}

// Track conversion events
const trackSignupClick = (location: string, packageType?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    // Send event to Google Analytics
    window.gtag('event', 'signup_click', {
      event_category: 'conversion',
      event_label: location,
      package_type: packageType || 'none',
      page: 'sports-grading-landing'
    })

    // Also send as a conversion event (for Google Ads if connected)
    window.gtag('event', 'conversion', {
      send_to: 'G-YLC2FKKBGC',
      event_category: 'signup',
      event_label: `sports_landing_${location}`
    })

    console.log(`[Analytics] Signup click tracked: ${location}, package: ${packageType}`)
  }
}

const trackPackageSelect = (packageType: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'select_package', {
      event_category: 'engagement',
      event_label: packageType,
      page: 'sports-grading-landing'
    })
  }
}

export default function SportsGradingLanding() {
  const [user, setUser] = useState<any>(null)
  const [selectedPackage, setSelectedPackage] = useState<'single' | 'starter' | 'pro'>('starter')
  const [isLoading, setIsLoading] = useState(true)

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

  const packages = {
    single: { credits: 1, price: 2.99, perCard: 2.99, label: 'Basic', bonus: 1, popular: false },
    starter: { credits: 5, price: 9.99, perCard: 2.00, label: 'Pro', bonus: 3, popular: true },
    pro: { credits: 20, price: 19.99, perCard: 1.00, label: 'Elite', bonus: 5, popular: false }
  }

  const selectedPkg = packages[selectedPackage]

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

        <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: Hero Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                <Image src="/DCM Logo white.png" alt="DCM" width={50} height={50} />
                <span className="text-white/80 text-sm font-medium tracking-wider uppercase">Sports Card Grading</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Know Your Card's Grade
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  Before PSA Does
                </span>
              </h1>

              <p className="text-xl text-gray-300 mb-8 max-w-xl">
                AI-powered grading in <span className="text-white font-semibold">under 60 seconds</span>.
                Get detailed centering, corners, edges & surface analysis — know if your card is worth submitting.
              </p>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 mb-8">
                <div className="flex items-center gap-2 text-gray-400">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>50,000+ Cards Graded</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Instant Results</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>PSA/BGS Estimates</span>
                </div>
              </div>

              {/* CTA for mobile */}
              <div className="lg:hidden">
                <Link
                  href={user ? "/upload/sports" : "/login?mode=signup&redirect=/upload/sports"}
                  onClick={() => trackSignupClick('hero_mobile', selectedPkg.label)}
                  className="inline-block w-full bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-8 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/30"
                >
                  Grade Your Cards Now
                </Link>
              </div>
            </div>

            {/* Right: Pricing Card */}
            <div className="w-full max-w-md">
              <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white text-center">Start Grading Today</h2>
                  <p className="text-emerald-200 text-sm text-center">1 credit = 1 card graded</p>
                </div>

                {/* Package selector */}
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {(Object.keys(packages) as Array<keyof typeof packages>).map((pkg) => (
                      <button
                        key={pkg}
                        onClick={() => {
                          setSelectedPackage(pkg)
                          trackPackageSelect(packages[pkg].label)
                        }}
                        className={`relative py-3 px-2 rounded-lg border-2 transition-all ${
                          selectedPackage === pkg
                            ? 'border-emerald-500 bg-emerald-500/20 text-white'
                            : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {packages[pkg].popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-[10px] font-bold text-gray-900 px-2 py-0.5 rounded-full">
                            BEST VALUE
                          </span>
                        )}
                        <div className="text-sm font-medium">{packages[pkg].label}</div>
                        <div className="text-xs opacity-75">{packages[pkg].credits} credit{packages[pkg].credits > 1 ? 's' : ''}</div>
                        <div className="text-xs opacity-75">${packages[pkg].price}</div>
                      </button>
                    ))}
                  </div>

                  {/* Selected package details */}
                  <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-4xl font-bold text-white">${selectedPkg.price.toFixed(2)}</span>
                    </div>
                    <div className="text-center text-gray-400 text-sm">
                      {selectedPkg.credits} + {selectedPkg.bonus} bonus = <span className="text-white font-semibold">{selectedPkg.credits + selectedPkg.bonus} credits</span>
                    </div>
                    <div className="text-center text-gray-500 text-xs mt-1">
                      ${(selectedPkg.price / (selectedPkg.credits + selectedPkg.bonus)).toFixed(2)} per card with bonus
                    </div>
                    {selectedPackage !== 'single' && (
                      <div className="text-center text-green-400 text-sm font-medium mt-1">
                        Save {Math.round((1 - selectedPkg.perCard / 2.99) * 100)}% vs single cards
                      </div>
                    )}
                  </div>

                  {/* What's included */}
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

                  {/* Launch Special Banner */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-yellow-500/20 via-green-500/20 to-yellow-500/20 border-2 border-yellow-500/50 rounded-lg p-3 mb-4 animate-pulse-subtle">
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />

                    <div className="relative flex items-center justify-center gap-2">
                      {/* Sparkle icon left */}
                      <svg className="w-5 h-5 text-yellow-400 animate-sparkle" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" />
                      </svg>
                      <span className="font-bold text-sm text-yellow-300 tracking-wide">🎉 LAUNCH SPECIAL</span>
                      {/* Sparkle icon right */}
                      <svg className="w-5 h-5 text-yellow-400 animate-sparkle-delayed" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" />
                      </svg>
                    </div>
                    <p className="relative text-center text-green-300 text-sm mt-1 font-medium">
                      {selectedPkg.label} gets <span className="font-bold text-yellow-300">+{selectedPkg.bonus} bonus credit{selectedPkg.bonus > 1 ? 's' : ''}</span> free!
                    </p>
                  </div>

                  {/* CTA Button */}
                  {isLoading ? (
                    <div className="w-full bg-gray-700 text-gray-400 font-bold text-lg px-6 py-4 rounded-xl text-center">
                      Loading...
                    </div>
                  ) : user ? (
                    <Link
                      href="/upload/sports"
                      onClick={() => trackSignupClick('pricing_card_logged_in', selectedPkg.label)}
                      className="block w-full bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-6 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all text-center shadow-lg shadow-emerald-500/30"
                    >
                      Grade Your Cards Now
                    </Link>
                  ) : (
                    <Link
                      href="/login?mode=signup&redirect=/upload/sports"
                      onClick={() => trackSignupClick('pricing_card_signup', selectedPkg.label)}
                      className="block w-full bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-6 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all text-center shadow-lg shadow-emerald-500/30"
                    >
                      Create Account
                    </Link>
                  )}

                  <p className="text-center text-gray-500 text-xs mt-3">
                    No subscription required. Pay only for what you use
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sports Leagues Supported */}
      <section className="py-12 bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-500 text-sm mb-6 uppercase tracking-wider">Grade cards from all major sports</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">NFL</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">NBA</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">MLB</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">NHL</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">UFC</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">WWE</div>
            <div className="text-gray-400 text-lg font-bold opacity-60 hover:opacity-100 transition-opacity">Soccer</div>
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
              <h3 className="text-xl font-bold text-white mb-2">AI Analysis</h3>
              <p className="text-gray-400">Our DCM Optic™ AI examines 30+ condition factors in under 60 seconds</p>
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
              <div className="text-3xl font-bold text-emerald-400 mb-2">$1</div>
              <div className="text-gray-300">Per card (with 20-pack)</div>
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

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-emerald-900 to-teal-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Grade Your Collection?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Stop wondering what your cards are worth. Get instant AI grades and know exactly which rookies and parallels are worth submitting to PSA.
          </p>
          <Link
            href={user ? "/upload/sports" : "/login?mode=signup&redirect=/upload/sports"}
            onClick={() => trackSignupClick('footer_cta', selectedPkg.label)}
            className="inline-block bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-10 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/30"
          >
            Start Grading Now — From $1/Card
          </Link>
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
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.2) rotate(15deg); opacity: 0.8; }
        }
        @keyframes pulse-subtle {
          0%, 100% { box-shadow: 0 0 5px rgba(234, 179, 8, 0.3); }
          50% { box-shadow: 0 0 15px rgba(234, 179, 8, 0.5), 0 0 25px rgba(234, 179, 8, 0.3); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .animate-sparkle {
          animation: sparkle 1.5s ease-in-out infinite;
        }
        .animate-sparkle-delayed {
          animation: sparkle 1.5s ease-in-out infinite 0.75s;
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 5s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
      `}</style>
    </main>
  )
}
