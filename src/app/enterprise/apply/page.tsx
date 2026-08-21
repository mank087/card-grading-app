'use client'

/**
 * /enterprise/apply — self-serve enterprise application.
 *
 * One sectioned form that collects everything manual onboarding used to:
 * business details, desired store URL, logo (derived variants happen
 * server-side), storefront basics, volume/tier intent, and ToS acceptance.
 * Submits to /api/org/apply → org created in 'pending' status → admin
 * approves → owner subscribes on /store/billing.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getValidSession } from '@/lib/directAuth'
import { useOrgContext } from '@/contexts/OrgContext'
import { ORG_PLANS } from '@/lib/orgPlans'

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
}

export default function EnterpriseApplyPage() {
  const { membership, membershipLoaded, refreshOrg } = useOrgContext()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  const [storeName, setStoreName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [monthlyVolume, setMonthlyVolume] = useState('')
  const [tierIntent, setTierIntent] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [tosAccepted, setTosAccepted] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Pending applications are hidden from all other org surfaces, so this page
  // checks its own status endpoint to show "received" instead of the form.
  const [pendingApplication, setPendingApplication] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const session = await getValidSession()
      if (cancelled) return
      setSignedIn(Boolean(session?.access_token))
      if (!session?.access_token) {
        setPendingApplication(false)
        return
      }
      fetch('/api/org/apply', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(res => (res.ok ? res.json() : { applied: false }))
        .then(data => { if (!cancelled) setPendingApplication(Boolean(data.applied && data.status === 'pending')) })
        .catch(() => { if (!cancelled) setPendingApplication(false) })
    })()
    return () => { cancelled = true }
  }, [])

  const effectiveSlug = useMemo(
    () => (slugTouched && slug ? slug : slugify(storeName)),
    [slug, slugTouched, storeName]
  )

  const onLogoChange = (file: File | null) => {
    setLogoFile(file)
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoPreview(file ? URL.createObjectURL(file) : null)
  }

  const canSubmit =
    storeName.trim().length > 1 &&
    (effectiveSlug === '' || SLUG_RE.test(effectiveSlug)) &&
    tosAccepted &&
    !submitting

  const submit = async () => {
    const session = await getValidSession()
    if (!session?.access_token) return
    setSubmitting(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('storeName', storeName.trim())
      form.set('slug', effectiveSlug)
      form.set('phone', phone.trim())
      form.set('website', website.trim())
      form.set('monthlyVolume', monthlyVolume)
      form.set('tierIntent', tierIntent)
      form.set('tagline', tagline.trim())
      form.set('description', description.trim())
      form.set('tosAccepted', 'true')
      if (logoFile) form.set('logo', logoFile)

      const res = await fetch('/api/org/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setDone(true)
      refreshOrg()
      // Ads conversion: application actually accepted by the API, not just the
      // button click. gtag routes to both the GA4 and AW tags; pre-consent it
      // hits the ConsentManager no-op stub, so nothing fires without consent.
      // The Google Ads conversion action must use this exact event name —
      // 'signup_click' is already taken by consumer CTAs.
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'enterprise_apply', {
          event_category: 'conversion',
          event_label: 'enterprise_application_submitted',
        })
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  if (signedIn === null || !membershipLoaded || pendingApplication === null) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Create your DCM account first</h1>
          <p className="text-gray-600 text-sm mb-6">
            Your store is managed through a regular DCM account. Sign up (or sign in), and we&apos;ll
            bring you right back to the application.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/login?mode=signup&redirect=/enterprise/apply"
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700">
              Sign up
            </Link>
            <Link href="/login?mode=login&redirect=/enterprise/apply"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:border-purple-400">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (membership) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re already part of {membership.name}</h1>
          <p className="text-gray-600 text-sm mb-6">
            Each DCM account can belong to one enterprise account. Manage yours from the billing page.
          </p>
          <Link href="/store/billing"
            className="inline-block px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700">
            Manage your account
          </Link>
        </div>
      </main>
    )
  }

  if (done || pendingApplication) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Application received</h1>
          <p className="text-gray-600 text-sm mb-6">
            Thank you for applying to DCM Enterprise. Our team will review your application and
            reach out with further details, usually within one business day. We&apos;ve also sent a
            confirmation to your email.
          </p>
          <p className="text-gray-600 text-sm mb-6">
            In the meantime, your personal DCM account works as always.
          </p>
          <Link href="/"
            className="inline-block px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700">
            Back to DCM home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p className="uppercase tracking-widest text-purple-600 text-xs font-semibold mb-2">DCM Enterprise</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Set up your enterprise grading account</h1>
          <p className="text-gray-600 text-sm max-w-lg mx-auto">
            Tell us about your brand or business once and it fills your labels, reports, card pages, and
            storefront. We review every application before it goes live.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-8">
          {/* Business details */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Business details</h2>
            <div>
              <label className={labelCls}>Brand or business name *</label>
              <input value={storeName} onChange={e => setStoreName(e.target.value)}
                placeholder="Enter brand or business name" className={inputCls} maxLength={120} />
              <p className="text-xs text-gray-400 mt-1">Exactly as it should appear on slab labels and reports.</p>
            </div>
            <div>
              <label className={labelCls}>Branded URL</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400 whitespace-nowrap">dcmgrading.com/enterprise/</span>
                <input value={effectiveSlug}
                  onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }}
                  className={inputCls} maxLength={32} />
              </div>
              {effectiveSlug && !SLUG_RE.test(effectiveSlug) && (
                <p className="text-xs text-red-500 mt-1">3 to 32 lowercase letters, numbers, and hyphens.</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} maxLength={40} />
              </div>
              <div>
                <label className={labelCls}>Website or social</label>
                <input value={website} onChange={e => setWebsite(e.target.value)}
                  placeholder="https://" className={inputCls} maxLength={200} />
              </div>
            </div>
          </section>

          {/* Logo */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Your logo</h2>
            <p className="text-sm text-gray-600">
              PNG with a transparent background, at least 256px. We automatically create the light and
              dark versions used across label styles. You can add or change it later.
            </p>
            <div className="flex items-center gap-4">
              <label className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-purple-400 cursor-pointer">
                {logoFile ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/png" className="hidden"
                  onChange={e => onLogoChange(e.target.files?.[0] || null)} />
              </label>
              {logoPreview && (
                <div className="flex items-center gap-2">
                  <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="logo preview" className="h-12 w-12 object-contain" />
                  </div>
                  <div className="border border-gray-200 rounded-lg p-2 bg-gray-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="logo on dark" className="h-12 w-12 object-contain" />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Storefront basics */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Enterprise Page basics <span className="text-sm font-normal text-gray-400">(optional)</span></h2>
            <div>
              <label className={labelCls}>Tagline</label>
              <input value={tagline} onChange={e => setTagline(e.target.value)}
                placeholder="Your neighborhood grading counter" className={inputCls} maxLength={140} />
            </div>
            <div>
              <label className={labelCls}>About your brand or business</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} className={inputCls} maxLength={1000} />
            </div>
          </section>

          {/* Volume */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Grading volume</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Cards per month (estimate)</label>
                <select value={monthlyVolume} onChange={e => setMonthlyVolume(e.target.value)} className={inputCls}>
                  <option value="">Select...</option>
                  <option value="under-100">Under 100</option>
                  <option value="100-400">100 to 400</option>
                  <option value="400-1000">400 to 1,000</option>
                  <option value="1000-plus">1,000+</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Plan you&apos;re considering</label>
                <select value={tierIntent} onChange={e => setTierIntent(e.target.value)} className={inputCls}>
                  <option value="">Not sure yet</option>
                  {Object.values(ORG_PLANS).map(p => (
                    <option key={p.key} value={p.key}>
                      {p.name}: ${p.priceUsd}/mo, {p.gradesPerMonth.toLocaleString()} grades
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Terms + submit */}
          <section className="space-y-4 border-t border-gray-100 pt-6">
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={tosAccepted} onChange={e => setTosAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-purple-600" />
              <span>
                I confirm I&apos;m authorized to represent this business, that I have the rights to the
                uploaded logo, and I agree to the{' '}
                <Link href="/enterprise/terms" target="_blank" className="text-purple-600 underline">Enterprise Program Terms</Link>{' '}
                and the <Link href="/terms" target="_blank" className="text-purple-600 underline">DCM Terms and Conditions</Link>.
              </span>
            </label>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}
            <button onClick={submit} disabled={!canSubmit}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Submitting...' : 'Submit application'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              No payment now. After approval you&apos;ll choose a plan (Dealer ${ORG_PLANS.dealer.priceUsd}/mo
              or Enterprise ${ORG_PLANS.enterprise.priceUsd}/mo) from your store billing page.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
