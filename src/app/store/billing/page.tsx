'use client'

/**
 * /store/billing — enterprise org billing home ("store credits page").
 *
 * Members see both credit buckets and plan state read-only; owners also get
 * self-serve actions: subscribe (published tiers only — pilot deals stay
 * admin-issued), buy overage packs, cancel at period end / resume, and the
 * Stripe Billing Portal for card + invoices. All amounts render from the
 * API's ORG_PLANS payload — the same constants the checkout route charges.
 */

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'
import { useOrgContext } from '@/contexts/OrgContext'

interface BillingState {
  org: {
    id: string
    name: string
    slug: string
    status: string
    plan: string | null
    monthlyCredits: number
    overageCredits: number
    totalCredits: number
    monthlyAllotment: number
    brandColor: string | null
    hasPaymentMethod: boolean
  } | null
  role?: 'owner' | 'member'
  subscription?: {
    attached: boolean
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
    status: string | null
  }
  plans?: Record<string, { key: string; name: string; priceUsd: number; gradesPerMonth: number; perCardUsd: number }>
  overagePack?: { priceUsd: number; grades: number; perGradeUsd: number }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function StoreBillingContent() {
  const searchParams = useSearchParams()
  const { refreshOrg } = useOrgContext()
  const [state, setState] = useState<BillingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packs, setPacks] = useState(1)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmUpgrade, setConfirmUpgrade] = useState(false)
  const checkoutResult = searchParams.get('checkout')

  const load = useCallback(async () => {
    const session = getStoredSession()
    if (!session?.access_token) {
      setState({ org: null })
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/org/billing', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = res.ok ? await res.json() : { org: null }
      setState(data)
    } catch {
      setState({ org: null })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // After a successful checkout the webhook fills the balance asynchronously —
  // refetch a couple of times so the numbers appear without a manual reload.
  useEffect(() => {
    if (checkoutResult === 'success') {
      const t1 = setTimeout(() => { load(); refreshOrg() }, 2500)
      const t2 = setTimeout(() => { load(); refreshOrg() }, 8000)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [checkoutResult, load, refreshOrg])

  const post = async (path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    const session = getStoredSession()
    if (!session?.access_token) return null
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return null
      }
      return data
    } catch {
      setError('Network error. Please try again.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const startCheckout = async (body: Record<string, unknown>) => {
    const data = await post('/api/org/billing/checkout', body)
    if (data?.url) window.location.href = data.url as string
  }

  const manage = async (action: 'cancel' | 'resume' | 'portal' | 'upgrade') => {
    const data = await post('/api/org/billing/manage', { action })
    if (action === 'portal' && data?.url) {
      window.location.href = data.url as string
      return
    }
    if (data) {
      setConfirmCancel(false)
      setConfirmUpgrade(false)
      await load()
      refreshOrg()
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (!state?.org) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No store found</h1>
          <p className="text-gray-600 text-sm mb-6">
            This page is for DCM Enterprise store members. Interested in grading under your own brand?
          </p>
          <Link href="/enterprise" className="inline-block px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700">
            Learn about DCM Enterprise
          </Link>
        </div>
      </main>
    )
  }

  const { org, role, subscription, plans, overagePack } = state
  const isOwner = role === 'owner'
  const monthlyUsed = Math.max(0, org.monthlyAllotment - org.monthlyCredits)
  const monthlyPct = org.monthlyAllotment > 0 ? Math.min(100, (org.monthlyCredits / org.monthlyAllotment) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: org.brandColor || '#7C3AED' }} />
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <span className="text-sm text-gray-400">Store billing</span>
          {isOwner && (
            <span className="ml-auto flex items-center gap-3">
              <Link href="/enterprise/launch-kit" className="text-sm text-purple-600 hover:text-purple-800 underline">
                Launch kit
              </Link>
              <Link href="/store/settings" className="text-sm text-purple-600 hover:text-purple-800 underline">
                Brand setup
              </Link>
            </span>
          )}
        </div>

        {/* Checkout result / errors / status banners */}
        {checkoutResult === 'success' && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
            Payment received. Your grades are being added now, which can take a few seconds.
          </div>
        )}
        {checkoutResult === 'cancelled' && (
          <div className="bg-gray-100 border border-gray-200 text-gray-600 rounded-lg px-4 py-3 text-sm">
            Checkout cancelled. No charge was made.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}
        {org.status === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
            Your application is awaiting DCM approval. You&apos;ll get an email when it&apos;s ready, and then you can start your plan here.
          </div>
        )}
        {org.status === 'suspended' && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            Your store is suspended. Contact DCM support to resolve this.
          </div>
        )}

        {/* Credit buckets */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly grades</div>
            <div className="text-3xl font-bold text-gray-900">
              {org.monthlyCredits}
              <span className="text-base font-normal text-gray-400"> / {org.monthlyAllotment || '—'}</span>
            </div>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${monthlyPct}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {subscription?.attached && subscription.currentPeriodEnd
                ? subscription.cancelAtPeriodEnd
                  ? `${monthlyUsed} used this cycle. Plan ends ${formatDate(subscription.currentPeriodEnd)}, grades usable until then.`
                  : `${monthlyUsed} used this cycle. Resets to ${org.monthlyAllotment} on ${formatDate(subscription.currentPeriodEnd)}.`
                : 'Refreshes each billing cycle once a plan is active.'}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Overage grades</div>
            <div className="text-3xl font-bold text-gray-900">{org.overageCredits}</div>
            <p className="text-xs text-gray-500 mt-3">
              From overage packs. These roll over month to month and never expire. They&apos;re used
              automatically after your monthly grades run out.
            </p>
          </div>
        </div>

        {/* Plan section */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan</h2>

          {subscription?.attached ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-semibold text-gray-900 capitalize">
                    {org.plan || 'Enterprise plan'}
                    {subscription.cancelAtPeriodEnd && (
                      <span className="ml-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        ends {formatDate(subscription.currentPeriodEnd)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {org.monthlyAllotment} grades/month
                    {subscription.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (
                      <> · renews {formatDate(subscription.currentPeriodEnd)}</>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {org.plan === 'dealer' && !subscription.cancelAtPeriodEnd && plans?.enterprise && (
                      <button onClick={() => setConfirmUpgrade(true)} disabled={busy}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                        Upgrade to {plans.enterprise.name}
                      </button>
                    )}
                    <button onClick={() => manage('portal')} disabled={busy}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-purple-400 disabled:opacity-50">
                      Payment method &amp; invoices
                    </button>
                    {subscription.cancelAtPeriodEnd ? (
                      <button onClick={() => manage('resume')} disabled={busy}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                        Resume plan
                      </button>
                    ) : confirmCancel ? (
                      <span className="flex items-center gap-2">
                        <button onClick={() => manage('cancel')} disabled={busy}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                          Confirm cancel
                        </button>
                        <button onClick={() => setConfirmCancel(false)} disabled={busy}
                          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                          Keep plan
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmCancel(true)} disabled={busy}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-red-300 hover:text-red-600 disabled:opacity-50">
                        Cancel plan
                      </button>
                    )}
                  </div>
                )}
              </div>
              {confirmCancel && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                  Your Enterprise Account keeps its monthly grades until {formatDate(subscription.currentPeriodEnd)}, then
                  the plan ends and remaining monthly grades expire. Overage pack credits are yours and never
                  expire. You can resume any time before the end date at no charge.
                </p>
              )}
              {confirmUpgrade && plans?.enterprise && (
                <div className="text-xs text-gray-600 bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-2">
                  <p>
                    Upgrading to {plans.enterprise.name} adds{' '}
                    <strong>{(plans.enterprise.gradesPerMonth - (plans.dealer?.gradesPerMonth ?? 0)).toLocaleString()} monthly grades right now</strong>{' '}
                    and your renewal becomes ${plans.enterprise.priceUsd}/mo for{' '}
                    {plans.enterprise.gradesPerMonth.toLocaleString()} grades. Your card is charged a prorated
                    difference for the rest of this cycle today.
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => manage('upgrade')} disabled={busy}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50">
                      Confirm upgrade
                    </button>
                    <button onClick={() => setConfirmUpgrade(false)} disabled={busy}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                      Not now
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : org.status === 'active' && isOwner && plans ? (
            <div>
              <p className="text-sm text-gray-600 mb-4">Choose a plan to activate your store&apos;s monthly grades.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.values(plans).map(p => (
                  <div key={p.key} className="border border-gray-200 rounded-xl p-5 hover:border-purple-300 transition-colors">
                    <div className="font-bold text-gray-900">{p.name}</div>
                    <div className="mt-1">
                      <span className="text-2xl font-bold text-gray-900">${p.priceUsd}</span>
                      <span className="text-sm text-gray-500">/mo</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {p.gradesPerMonth.toLocaleString()} grades every month
                    </div>
                    <div className="text-sm font-semibold text-purple-600">${p.perCardUsd.toFixed(2)} per card</div>
                    <button onClick={() => startCheckout({ kind: 'plan', planKey: p.key })} disabled={busy}
                      className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                      Subscribe
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {org.status !== 'active'
                ? 'Plan setup unlocks once your store is approved and active.'
                : 'No plan is active yet. Ask your store owner to set one up here.'}
            </p>
          )}
        </div>

        {/* Overage packs */}
        {org.status === 'active' && overagePack && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Overage packs</h2>
            <p className="text-sm text-gray-600 mb-4">
              ${overagePack.priceUsd.toFixed(2)} per {overagePack.grades} grades
              (${overagePack.perGradeUsd.toFixed(2)}/grade). Pack credits roll over and never expire.
            </p>
            {!subscription?.attached ? (
              <p className="text-sm text-gray-500">
                Overage packs become available once your plan is active. They top up a hot month on top
                of your monthly grades.
              </p>
            ) : isOwner ? (
              <div className="flex items-center gap-3 flex-wrap">
                <select value={packs} onChange={e => setPacks(parseInt(e.target.value, 10))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {[1, 2, 4, 8, 20, 40].map(n => (
                    <option key={n} value={n}>
                      {n} pack{n > 1 ? 's' : ''} ({n * overagePack.grades} grades)
                    </option>
                  ))}
                </select>
                <button onClick={() => startCheckout({ kind: 'topup', packs })} disabled={busy}
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                  Buy for ${(packs * overagePack.priceUsd).toFixed(2)}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Ask your account owner to buy packs when the pool runs low.</p>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          All prices in USD. Questions about your plan?{' '}
          <Link href="/enterprise#contact" className="underline hover:text-gray-600">Contact the DCM team</Link>.
        </p>
      </div>
    </main>
  )
}

export default function StoreBillingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <StoreBillingContent />
    </Suspense>
  )
}
