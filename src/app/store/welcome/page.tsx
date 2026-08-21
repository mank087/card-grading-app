'use client'

/**
 * /store/welcome — post-subscription confirmation for enterprise accounts.
 *
 * The plan checkout's success URL lands here (pack top-ups still return to
 * the billing page). Confirms what was purchased and walks the owner through
 * what happens next, so the system is legible on day one. Polls the billing
 * API briefly because the webhook fills the plan asynchronously.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getValidSession } from '@/lib/directAuth'
import { useOrgContext } from '@/contexts/OrgContext'

interface BillingState {
  org: {
    name: string
    slug: string
    plan: string | null
    monthlyCredits: number
    monthlyAllotment: number
    brandColor: string | null
    storefrontEnabled?: boolean
  } | null
  subscription?: { attached: boolean; currentPeriodEnd: string | null }
  plans?: Record<string, { key: string; name: string; priceUsd: number; gradesPerMonth: number }>
}

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Your public Enterprise page is live',
    body: 'Your branded Enterprise Page is already published. Everything you save in Brand Setup (logo, story, FAQ, photos) appears on it immediately, and its link is ready to share on your socials and listings.',
  },
  {
    title: 'Start grading for your Enterprise account',
    body: 'Use the workspace switcher in the top navigation to make sure your brand is selected, then grade as usual. Every grade in your workspace draws from your monthly pool, and each card is stamped with your branding and serial.',
  },
  {
    title: 'Your cards live in their own collection',
    body: "Cards graded in your Enterprise workspace appear in your brand's collection view, kept separate from any personal DCM account. Switch workspaces any time to move between the two.",
  },
  {
    title: 'Print your slab labels',
    body: 'Every graded card gets a printable label in your house design, front and back, with your serial prefix and a QR code that resolves to your branded registry page. Buyers can verify any slab you produce, forever.',
  },
  {
    title: 'Your monthly grades and overage packs',
    body: 'Your allotment refreshes to its full amount every billing cycle. If a hot month runs you dry, overage packs add grades that never expire. Manage all of it, including payment method and cancellation, from your billing page.',
  },
  {
    title: 'Launch it',
    body: 'Grab the Launch Kit for printable counter signage in your branding, a staff pitch sheet, and ready-to-post social captions announcing that you grade cards now.',
  },
]

export default function StoreWelcomePage() {
  const { refreshOrg } = useOrgContext()
  const [state, setState] = useState<BillingState | null>(null)
  const [attempts, setAttempts] = useState(0)

  const load = useCallback(async () => {
    const session = await getValidSession()
    if (!session?.access_token) {
      setState({ org: null })
      return
    }
    try {
      const res = await fetch('/api/org/billing', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = res.ok ? await res.json() : { org: null }
      // Never blank a loaded page on a transient fetch failure
      setState(prev => (data.org || !prev?.org ? data : prev))
    } catch {
      setState(prev => prev ?? { org: null })
    }
  }, [])

  useEffect(() => { load(); refreshOrg() }, [load, refreshOrg])

  // The webhook attaches the plan a moment after redirect; retry a few times.
  useEffect(() => {
    if (state && state.org && !state.subscription?.attached && attempts < 4) {
      const t = setTimeout(() => { setAttempts(a => a + 1); load() }, 2500)
      return () => clearTimeout(t)
    }
  }, [state, attempts, load])

  // Keep the balance and renewal date live: refetch on tab focus and on a
  // slow interval, so grading in another tab is reflected here.
  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const interval = setInterval(load, 30000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      clearInterval(interval)
    }
  }, [load])

  if (!state) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (!state.org) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Welcome</h1>
          <p className="text-gray-600 text-sm mb-6">This page is for DCM Enterprise accounts.</p>
          <Link href="/enterprise" className="inline-block px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700">
            Learn about DCM Enterprise
          </Link>
        </div>
      </main>
    )
  }

  const { org, subscription, plans } = state
  const planInfo = org.plan && plans?.[org.plan] ? plans[org.plan] : null
  const brand = org.brandColor || '#7C3AED'
  const renewal = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Confirmation */}
        <div className="bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to DCM Enterprise, {org.name}</h1>
          {subscription?.attached ? (
            <p className="text-gray-600">
              Your <span className="font-semibold capitalize">{planInfo?.name || org.plan || 'Enterprise'}</span> plan
              is active{planInfo ? <> at ${planInfo.priceUsd}/mo</> : null}:{' '}
              <span className="font-semibold">
                {org.monthlyCredits.toLocaleString()} of {org.monthlyAllotment.toLocaleString()} monthly grades available
              </span>
              {renewal ? <>, renewing {renewal}</> : null}.
            </p>
          ) : (
            <p className="text-gray-600">
              Payment received. Your plan is activating now, which takes a few seconds. Your monthly grades
              will appear here shortly.
            </p>
          )}
        </div>

        {/* What happens next */}
        <div className="bg-white rounded-2xl shadow-md p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">What happens next</h2>
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span
                  className="shrink-0 w-8 h-8 rounded-full text-white font-bold text-sm flex items-center justify-center"
                  style={{ backgroundColor: brand }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-0.5">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* CTAs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/upload"
            className="text-center px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700">
            Grade your first card
          </Link>
          <Link href="/enterprise/launch-kit"
            className="text-center px-6 py-3 border border-purple-200 bg-purple-50 text-purple-700 rounded-xl font-semibold hover:border-purple-400">
            Open your Launch Kit
          </Link>
          <Link href="/store/settings"
            className="text-center px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-purple-400">
            Review Brand Setup
          </Link>
          <Link href="/store/billing"
            className="text-center px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-purple-400">
            Billing &amp; grades
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Questions at any point?{' '}
          <Link href="/enterprise#contact" className="underline hover:text-gray-600">Contact the DCM team</Link>.
        </p>
      </div>
    </main>
  )
}
