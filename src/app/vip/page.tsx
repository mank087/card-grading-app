'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession } from '@/lib/directAuth'

// Declare global types for tracking pixels
declare global {
  interface Window {
    rdt: (...args: unknown[]) => void
    gtag: (...args: unknown[]) => void
    fbq: (...args: unknown[]) => void
  }
}


export default function VipPage() {
  const router = useRouter()
  const { refreshCredits } = useCredits()
  const [isVip, setIsVip] = useState(false)
  const [checkingVip, setCheckingVip] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Reset loading state when page is restored from bfcache (e.g. returning from Stripe)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setPurchasing(false)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // Check authentication and VIP status
  useEffect(() => {
    const session = getStoredSession()
    const authenticated = !!session?.access_token
    setIsAuthenticated(authenticated)

    async function checkVipStatus() {
      if (!authenticated) {
        setCheckingVip(false)
        return
      }

      try {
        const session = getStoredSession()
        const response = await fetch('/api/user/label-emblem-preference', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setIsVip(data.is_vip || false)
        }
      } catch (error) {
        console.error('Error checking VIP status:', error)
      } finally {
        setCheckingVip(false)
      }
    }

    checkVipStatus()
  }, [])

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push('/login?mode=signup&redirect=/vip')
      return
    }

    setPurchasing(true)

    try {
      const session = getStoredSession()
      const refCode = typeof window !== 'undefined' ? localStorage.getItem('dcm_ref_code') : null
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ tier: 'vip', ref_code: refCode || undefined }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      // Track InitiateCheckout event
      if (typeof window !== 'undefined') {
        if (window.fbq) {
          window.fbq('track', 'InitiateCheckout', {
            value: 99,
            currency: 'USD',
            content_type: 'product',
            content_ids: ['vip'],
            num_items: 150
          })
        }
        if (window.gtag) {
          window.gtag('event', 'begin_checkout', {
            value: 99,
            currency: 'USD',
            items: [{ item_id: 'vip', item_name: 'VIP Package', price: 99 }]
          })
        }
      }

      window.location.href = url
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout. Please try again.')
      setPurchasing(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-slate-100 to-indigo-50">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-[10%] w-20 h-20 bg-gray-400 rounded-full blur-3xl" />
          <div className="absolute top-40 right-[15%] w-32 h-32 bg-indigo-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-[30%] w-24 h-24 bg-slate-400 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 shadow-lg text-gray-800" style={{ background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 25%, #d4d4d4 50%, #f0f0f0 75%, #c0c0c0 100%)' }}>
              <span className="text-indigo-600 text-lg">◆</span>
              Best Value Package
            </div>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image src="/DCM-logo.png" alt="DCM" width={80} height={80} className="rounded-xl shadow-lg" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              Get the <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-600 to-indigo-600">VIP Package</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Our best value credit package with exclusive VIP perks. Purchase as many times as you like!
            </p>

            {isVip && (
              <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold">
                <span className="text-lg">◆</span>
                You&apos;re a VIP!
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Package Details */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Left: Package Card */}
              <div className="rounded-3xl p-8 text-gray-800 shadow-2xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 25%, #d4d4d4 50%, #f0f0f0 75%, #c0c0c0 100%)' }}>
                {/* Animated shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-pulse" style={{ animationDuration: '3s' }}></div>

                {/* Decorative diamond */}
                <div className="absolute top-4 right-4 text-indigo-600">
                  <span className="text-3xl">◆</span>
                </div>

                <div className="relative">
                  <div className="text-indigo-600 font-semibold text-sm uppercase tracking-wide mb-2">
                    VIP Package
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-5xl font-bold text-gray-900">$99</span>
                    <span className="text-gray-500 text-lg">one-time</span>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-lg"><strong>150</strong> grading credits</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-lg"><strong>VIP diamond emblem</strong> on card labels</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-lg"><strong>Best cost per grade</strong> for one-time purchases</span>
                    </div>
                  </div>

                  <div className="text-center text-gray-600 text-sm mb-4">
                    $0.66 per grade • Save 78% vs Basic
                  </div>

                  {/* CTA Button */}
                  {checkingVip ? (
                    <div className="w-full bg-gray-300 text-gray-500 font-bold py-4 px-6 rounded-xl text-center">
                      Checking status...
                    </div>
                  ) : (
                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {purchasing ? 'Processing...' : isAuthenticated ? 'Get VIP Package' : 'Sign Up & Get VIP Package'}
                    </button>
                  )}
                  {isVip && (
                    <p className="text-center text-indigo-600 text-xs mt-2 flex items-center justify-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      You&apos;re already a VIP! Purchase again to add more credits.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Benefits Breakdown */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">What You Get</h2>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xl">150</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">150 Grading Credits</h3>
                      <p className="text-gray-600 text-sm">
                        Grade up to 150 cards — Pokemon, Sports, MTG, Lorcana, One Piece, or any trading card.
                        At $0.66 per grade, this is our best value for one-time purchases.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #e8e8e8 0%, #d4d4d4 50%, #c0c0c0 100%)' }}>
                      <span className="text-indigo-600 text-2xl">◆</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Exclusive VIP Emblem</h3>
                      <p className="text-gray-600 text-sm">
                        A distinguished diamond emblem appears on all your card labels.
                        Toggle it on or off in your account settings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Purchase Multiple Times</h3>
                      <p className="text-gray-600 text-sm">
                        Unlike limited offers, you can buy the VIP Package as many times as you want.
                        Stock up on credits at our best rate whenever you need them.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Comparison */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Compare the Value</h2>

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-gray-600 font-semibold">Package</th>
                    <th className="px-6 py-4 text-center text-gray-600 font-semibold">Credits</th>
                    <th className="px-6 py-4 text-center text-gray-600 font-semibold">Price</th>
                    <th className="px-6 py-4 text-center text-gray-600 font-semibold">Per Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-6 py-4 text-gray-700">Basic</td>
                    <td className="px-6 py-4 text-center text-gray-700">1</td>
                    <td className="px-6 py-4 text-center text-gray-700">$2.99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$2.99</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-700">Pro</td>
                    <td className="px-6 py-4 text-center text-gray-700">5</td>
                    <td className="px-6 py-4 text-center text-gray-700">$9.99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$2.00</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-700">Elite</td>
                    <td className="px-6 py-4 text-center text-gray-700">20</td>
                    <td className="px-6 py-4 text-center text-gray-700">$19.99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$1.00</td>
                  </tr>
                  <tr className="bg-gradient-to-r from-gray-100 to-indigo-50">
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-indigo-600">◆</span>
                        VIP
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-900">150</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-900">$99</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">$0.66</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-gray-500 text-sm">
              The best value for serious collectors — save 78% compared to Basic!
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Frequently Asked Questions
            </h2>

            <div className="space-y-4">
              {[
                {
                  q: "Can I buy multiple VIP Packages?",
                  a: "Yes! You can purchase the VIP Package as many times as you want. Each purchase adds 150 credits to your account at our best rate of $0.66 per grade."
                },
                {
                  q: "Do the 150 credits expire?",
                  a: "No, credits never expire. Use them whenever you want — there's no time limit."
                },
                {
                  q: "Can I turn off the VIP emblem on my labels?",
                  a: "Yes! You can toggle the VIP diamond emblem on or off in your account settings. It's completely up to you whether to display it."
                },
                {
                  q: "What's the difference between VIP and Card Lovers?",
                  a: "VIP is a one-time purchase that gives you 150 credits and the VIP emblem. Card Lovers is a monthly subscription that provides ongoing credits, a 20% discount on additional purchases, and the Card Lover heart emblem. Choose VIP for bulk credits, or Card Lovers for regular monthly grading needs."
                },
                {
                  q: "Can I have multiple emblems?",
                  a: "Yes! If you're a Founder, VIP, and Card Lover, you can choose to display up to 2 emblems on your card labels from your account settings."
                }
              ].map((faq, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                  <p className="text-gray-600 text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 text-gray-800" style={{ background: 'linear-gradient(135deg, #d4d4d4 0%, #e8e8e8 25%, #c0c0c0 50%, #e0e0e0 75%, #b8b8b8 100%)' }}>
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">
            Ready to Get VIP?
          </h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Get 150 credits at our best rate plus the exclusive VIP diamond emblem.
          </p>

          <button
            onClick={handlePurchase}
            disabled={purchasing || checkingVip}
            className="inline-block bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {purchasing ? 'Processing...' : 'Get VIP Package — $99'}
          </button>

          {isVip && (
            <p className="mt-4 text-indigo-700 text-sm flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              You&apos;re already a VIP! Purchase again to add more credits.
            </p>
          )}

          <p className="mt-6 text-gray-500 text-sm">
            Questions? <Link href="/contact" className="text-indigo-600 hover:underline">Contact us</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
