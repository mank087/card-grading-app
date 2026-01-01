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

// Countdown end date: February 1, 2026 at 12:00 AM EST (midnight)
const COUNTDOWN_END = new Date('2026-02-01T00:00:00-05:00').getTime()

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calculateTimeLeft(): TimeLeft {
  const now = new Date().getTime()
  const difference = COUNTDOWN_END - now

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((difference % (1000 * 60)) / 1000),
  }
}

export default function FoundersPage() {
  const router = useRouter()
  const { refreshCredits } = useCredits()
  // Initialize to null to avoid hydration mismatch - only calculate on client
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [isFounder, setIsFounder] = useState(false)
  const [checkingFounder, setCheckingFounder] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Update countdown every second - only runs on client
  useEffect(() => {
    // Set initial value on mount
    const initialTimeLeft = calculateTimeLeft()
    setTimeLeft(initialTimeLeft)

    if (initialTimeLeft.days === 0 && initialTimeLeft.hours === 0 &&
        initialTimeLeft.minutes === 0 && initialTimeLeft.seconds === 0) {
      setIsExpired(true)
      return
    }

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft()
      setTimeLeft(newTimeLeft)

      if (newTimeLeft.days === 0 && newTimeLeft.hours === 0 &&
          newTimeLeft.minutes === 0 && newTimeLeft.seconds === 0) {
        setIsExpired(true)
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Check authentication and founder status
  useEffect(() => {
    const session = getStoredSession()
    const authenticated = !!session?.access_token
    setIsAuthenticated(authenticated)

    async function checkFounderStatus() {
      if (!authenticated) {
        setCheckingFounder(false)
        return
      }

      try {
        const session = getStoredSession()
        const response = await fetch('/api/founders/status', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setIsFounder(data.isFounder)
        }
      } catch (error) {
        console.error('Error checking founder status:', error)
      } finally {
        setCheckingFounder(false)
      }
    }

    checkFounderStatus()
  }, [])

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push('/login?mode=signup&redirect=/founders')
      return
    }

    if (isFounder) {
      return
    }

    setPurchasing(true)

    try {
      const session = getStoredSession()
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ tier: 'founders' }),
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
            content_ids: ['founders'],
            num_items: 150
          })
        }
        if (window.gtag) {
          window.gtag('event', 'begin_checkout', {
            value: 99,
            currency: 'USD',
            items: [{ item_id: 'founders', item_name: 'Founders Package', price: 99 }]
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

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-gray-900 text-white text-3xl md:text-5xl font-bold rounded-xl w-16 md:w-24 h-16 md:h-24 flex items-center justify-center shadow-lg">
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-gray-600 text-sm mt-2 uppercase tracking-wide">{label}</span>
    </div>
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-[10%] w-20 h-20 bg-yellow-400 rounded-full blur-3xl" />
          <div className="absolute top-40 right-[15%] w-32 h-32 bg-orange-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-[30%] w-24 h-24 bg-amber-400 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-4 py-2 rounded-full text-sm font-semibold mb-6 shadow-lg">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Limited Time Offer
            </div>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image src="/DCM-logo.png" alt="DCM" width={80} height={80} className="rounded-xl shadow-lg" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              Become a <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500">DCM Founder</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Join our exclusive group of early supporters and unlock lifetime benefits to celebrate the launch of DCM and begin your Card Grading Journey with Us!
            </p>

            {/* Countdown Timer */}
            {!isExpired && timeLeft ? (
              <div className="mb-10">
                <p className="text-gray-500 mb-4 text-sm uppercase tracking-wide">Offer ends in</p>
                <div className="flex justify-center gap-3 md:gap-6">
                  <TimeBlock value={timeLeft.days} label="Days" />
                  <TimeBlock value={timeLeft.hours} label="Hours" />
                  <TimeBlock value={timeLeft.minutes} label="Mins" />
                  <TimeBlock value={timeLeft.seconds} label="Secs" />
                </div>
              </div>
            ) : !isExpired && !timeLeft ? (
              <div className="mb-10">
                <p className="text-gray-500 mb-4 text-sm uppercase tracking-wide">Offer ends in</p>
                <div className="flex justify-center gap-3 md:gap-6">
                  <TimeBlock value={0} label="Days" />
                  <TimeBlock value={0} label="Hours" />
                  <TimeBlock value={0} label="Mins" />
                  <TimeBlock value={0} label="Secs" />
                </div>
              </div>
            ) : (
              <div className="mb-10 bg-red-100 text-red-700 px-6 py-4 rounded-xl inline-block">
                <p className="font-semibold">This offer has expired</p>
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
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                {/* Decorative star */}
                <div className="absolute top-4 right-4 text-yellow-400">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>

                <div className="text-yellow-400 font-semibold text-sm uppercase tracking-wide mb-2">
                  Founders Package
                </div>

                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold">$99</span>
                  <span className="text-gray-400 text-lg">one-time</span>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-lg"><strong>150</strong> grading credits</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-lg"><strong>20% off</strong> all future purchases</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-lg"><strong>Founder badge</strong> on your collection</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-lg"><strong>Founder emblem</strong> on card labels</span>
                  </div>
                </div>

                <div className="text-center text-gray-400 text-sm mb-4">
                  $0.66 per grade • Best value ever offered
                </div>

                {/* CTA Button */}
                {checkingFounder ? (
                  <div className="w-full bg-gray-700 text-gray-400 font-bold py-4 px-6 rounded-xl text-center">
                    Checking status...
                  </div>
                ) : isFounder ? (
                  <div className="w-full bg-green-600 text-white font-bold py-4 px-6 rounded-xl text-center flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    You&apos;re a Founder!
                  </div>
                ) : isExpired ? (
                  <div className="w-full bg-gray-600 text-gray-300 font-bold py-4 px-6 rounded-xl text-center cursor-not-allowed">
                    Offer Expired
                  </div>
                ) : (
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasing ? 'Processing...' : isAuthenticated ? 'Become a Founder' : 'Sign Up & Become a Founder'}
                  </button>
                )}
              </div>

              {/* Right: Benefits Breakdown */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">What You Get</h2>

                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xl">150</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">150 Grading Credits</h3>
                      <p className="text-gray-600 text-sm">
                        Grade up to 150 cards — Pokemon, Sports, MTG, or any trading card.
                        At $0.66 per grade, this is our best value ever.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">20%</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Lifetime 20% Discount</h3>
                      <p className="text-gray-600 text-sm">
                        Every future credit purchase is automatically discounted.
                        This benefit never expires — it&apos;s yours forever.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Exclusive Founder Status</h3>
                      <p className="text-gray-600 text-sm">
                        A golden Founder badge appears on your collection page and on every
                        card label you generate. Toggle it on or off in your settings.
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
                    <td className="px-6 py-4 text-center text-gray-700">5 + 3 bonus</td>
                    <td className="px-6 py-4 text-center text-gray-700">$9.99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$1.25</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-700">Elite</td>
                    <td className="px-6 py-4 text-center text-gray-700">20 + 5 bonus</td>
                    <td className="px-6 py-4 text-center text-gray-700">$19.99</td>
                    <td className="px-6 py-4 text-center text-gray-700">$0.80</td>
                  </tr>
                  <tr className="bg-gradient-to-r from-yellow-50 to-orange-50">
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Founders
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
              Plus founders get 20% off all future purchases — the savings continue forever.
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
                  q: "What happens after January 31, 2026?",
                  a: "The Founders Package will no longer be available for purchase. If you've already purchased it, you keep all benefits forever — the credits, the 20% discount, and the founder badge."
                },
                {
                  q: "Can I buy multiple Founders Packages?",
                  a: "No, the Founders Package is limited to one per account. It's designed to be an exclusive benefit for early supporters."
                },
                {
                  q: "Do the 150 credits expire?",
                  a: "No, credits never expire. Use them whenever you want — there's no time limit."
                },
                {
                  q: "Can I turn off the founder badge on my labels?",
                  a: "Yes! You can toggle the founder emblem on or off in your account settings. The badge on your collection page will always show, but label display is up to you."
                },
                {
                  q: "Does the 20% discount stack with other promotions?",
                  a: "The founder discount applies to all regular credit packages. If we run special promotions in the future, we'll clarify how they interact with founder benefits."
                },
                {
                  q: "I'm already a DCM user. Can I still become a founder?",
                  a: "Absolutely! Any user can purchase the Founders Package before the deadline. Your existing credits will remain, and the 150 founder credits will be added to your balance."
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
      <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Become a Founder?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Join us at the beginning and enjoy exclusive benefits for the lifetime of your account.
          </p>

          {!isExpired && !isFounder && (
            <button
              onClick={handlePurchase}
              disabled={purchasing || checkingFounder}
              className="inline-block bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 text-gray-900 font-bold text-lg px-10 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {purchasing ? 'Processing...' : 'Get the Founders Package — $99'}
            </button>
          )}

          {isFounder && (
            <div className="inline-flex items-center gap-2 bg-green-600 text-white font-bold text-lg px-10 py-4 rounded-xl">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              You&apos;re Already a Founder!
            </div>
          )}

          <p className="mt-6 text-gray-500 text-sm">
            Questions? <Link href="/contact" className="text-yellow-400 hover:underline">Contact us</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
