'use client'

/**
 * /store/settings — Enterprise Brand Setup.
 *
 * The owner's single editable surface for everything brand-related: identity
 * (name, serial prefix), logo, brand colors, slab label design with a live
 * stacked front/back preview, the full public storefront content (text,
 * contact, socials, photos), and the How-it-works / FAQ sections.
 *
 * First visit after approval arrives here in "setup" mode (welcome banner +
 * Finish setup, which stamps the brand_setup_done flag). Owners return any
 * time from the billing page for future edits. The grade credit pool is
 * deliberately absent — that's admin- and billing-page territory.
 */

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getValidSession } from '@/lib/directAuth'
import { useOrgContext } from '@/contexts/OrgContext'
import { DEFAULT_HOW_IT_WORKS, DEFAULT_FAQS, DEFAULT_ABOUT_TITLE, DEFAULT_ABOUT_BULLETS, HowItWorksStep, FaqEntry } from '@/lib/storefrontDefaults'
import LabelDesigner from '@/components/enterprise/LabelDesigner'
import { designToLegacySlab, type OrgLabelDesign } from '@/lib/labels/orgLabelDesign'

/** The flat Brand Setup fields a design implies (mirrors what the API stores). */
function slabFromDesign(d: OrgLabelDesign) {
  const l = designToLegacySlab(d)
  return {
    labelStyle: l.label_style as 'heritage' | 'modern',
    pattern: l.pattern,
    colors: l.colors,
    colorSource: l.color_source as 'brand' | 'card',
    logoVariant: l.logo_variant as 'color' | 'black' | 'white',
    logoScale: l.logo_scale,
  }
}

const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'youtube', 'x'] as const

interface Settings {
  name: string
  slug: string
  status: string
  brandColors: string[]
  serialPrefix: string
  derivedPrefix: string
  tagline: string
  description: string
  aboutTitle: string
  /** null = shared defaults; [] = hidden; else custom. */
  aboutBullets: string[] | null
  address: string
  hours: string
  publicEmail: string
  legalName: string
  heroLogo: 'color' | 'white' | 'none'
  photoDisplay: 'crop' | 'fit'
  showRecentCards: boolean
  socials: Record<string, string>
  photos: { path: string; url: string | null }[]
  slab: {
    labelStyle: 'heritage' | 'modern'
    pattern: string
    colors: string[]
    colorSource: 'brand' | 'card'
    /** Which uploaded logo variant prints on the label mark. */
    logoVariant: 'color' | 'black' | 'white'
    /** Mark size multiplier; the renderer clamps it per card so it can't clip. */
    logoScale: number
    /** The Label Designer document (always resolved by the API). */
    design: OrgLabelDesign
  }
  storefrontEnabled: boolean
  howItWorks: HowItWorksStep[] | null
  faqs: FaqEntry[] | null
  phone: string
  website: string
  setupDone: boolean
  logos: { color: string | null; white: string | null; black: string | null }
}

function StoreSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { refreshOrg } = useOrgContext()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setupMode = searchParams.get('setup') === '1' || (settings ? !settings.setupDone : false)

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const session = await getValidSession()
    if (!session?.access_token) return null
    return fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${session.access_token}` },
    })
  }, [])

  const load = useCallback(async () => {
    const res = await authedFetch('/api/org/settings')
    if (!res) {
      setDenied('Please sign in to manage your enterprise account.')
      setLoading(false)
      return
    }
    const data = await res.json()
    if (!res.ok) setDenied(data.error || 'Not available')
    else setSettings(data.settings)
    setLoading(false)
  }, [authedFetch])

  useEffect(() => { load() }, [load])

  const notify = (msg: string) => {
    setFlash(msg)
    setError(null)
    setTimeout(() => setFlash(null), 2500)
  }

  const save = async (patch: Record<string, unknown>, message: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await authedFetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      // No response at all means we could not produce a valid token — the
      // sign-in lapsed while the form was open. Say that, rather than the
      // generic failure that sent an owner to support with a page full of
      // unsaved work and nothing to act on.
      if (!res) {
        setError('Your sign-in expired while this page was open. Open DCM in another tab to sign in again, then press Save — your changes on this page are still here.')
        return false
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || `Save failed (${res.status}). Please try again, or contact support if it keeps happening.`)
        return false
      }
      notify(message)
      refreshOrg()
      return true
    } finally {
      setBusy(false)
    }
  }

  /** Save + mirror the patch into local state (for fields the UI derives from). */
  const saveAnd = async (patch: Record<string, unknown>, local: Partial<Settings>, message: string) => {
    if (await save(patch, message)) setSettings(prev => (prev ? { ...prev, ...local } : prev))
  }

  const uploadFile = async (field: 'logo' | 'photo', file: File) => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set(field, file)
      const res = await authedFetch('/api/org/settings', { method: 'POST', body: form })
      const data = res ? await res.json() : null
      if (!res?.ok) {
        setError(data?.error || 'Upload failed')
        return
      }
      if (field === 'logo') {
        setSettings(prev => (prev ? { ...prev, logos: data.previews } : prev))
        notify('Logo updated')
      } else {
        setSettings(prev => (prev ? { ...prev, photos: [...prev.photos, { path: data.path, url: data.url }] } : prev))
        notify('Photo added')
      }
      refreshOrg()
    } finally {
      setBusy(false)
    }
  }

  const removePhoto = async (path: string) => {
    setBusy(true)
    try {
      const res = await authedFetch(`/api/org/settings?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      if (res?.ok) {
        setSettings(prev => (prev ? { ...prev, photos: prev.photos.filter(p => p.path !== path) } : prev))
        notify('Photo removed')
      }
    } finally {
      setBusy(false)
    }
  }

  const finishSetup = async () => {
    if (await save({ setupDone: true }, 'Brand setup complete')) {
      setSettings(prev => (prev ? { ...prev, setupDone: true } : prev))
      router.push('/store/billing')
    }
  }

  // Section editors for steps/FAQ work on local drafts with explicit save.
  const [stepsDraft, setStepsDraft] = useState<HowItWorksStep[] | null>(null)
  const [faqsDraft, setFaqsDraft] = useState<FaqEntry[] | null>(null)
  const steps = stepsDraft ?? settings?.howItWorks ?? DEFAULT_HOW_IT_WORKS
  const faqList = faqsDraft ?? settings?.faqs ?? DEFAULT_FAQS

  const saveSteps = async (value: HowItWorksStep[] | null) => {
    await saveAnd({ howItWorks: value }, { howItWorks: value }, value === null ? 'How-it-works restored to defaults' : 'How-it-works saved')
    setStepsDraft(null)
  }
  const saveFaqs = async (value: FaqEntry[] | null) => {
    await saveAnd({ faqs: value }, { faqs: value }, value === null ? 'FAQ restored to defaults' : 'FAQ saved')
    setFaqsDraft(null)
  }

  // Serial prefix live example
  const [prefixDraft, setPrefixDraft] = useState<string | null>(null)
  const effectivePrefix = (prefixDraft ?? settings?.serialPrefix ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || settings?.derivedPrefix || 'ORG'

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (denied || !settings) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enterprise Brand Setup</h1>
          <p className="text-gray-600 text-sm">{denied || 'Not available'}</p>
        </div>
      </main>
    )
  }


  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Enterprise Brand Setup</h1>
          <Link href="/store/billing" className="text-sm text-purple-600 hover:text-purple-800 underline">
            Billing &amp; grades →
          </Link>
        </div>

        {setupMode && !settings.setupDone && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-purple-900 mb-1">Welcome to DCM Enterprise 🎉</h2>
            <p className="text-sm text-purple-800 mb-3">
              Your account is approved. Review everything below, since it fills your labels, reports,
              card pages, and public Enterprise Page. You can change any of it later from this page.
            </p>
            <button onClick={finishSetup} disabled={busy}
              className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
              Finish setup &amp; go to billing
            </button>
          </div>
        )}

        {flash && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">{flash}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

        {/* Identity */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Identity</h2>
          <div>
            <label className={labelCls}>Brand or business name</label>
            <input defaultValue={settings.name} maxLength={120} className={inputCls}
              onBlur={e => e.target.value.trim() !== settings.name && saveAnd({ name: e.target.value }, { name: e.target.value.trim() }, 'Name saved')} />
            <p className="text-xs text-gray-400 mt-1">Appears on labels, reports, and your card pages.</p>
          </div>
          <div>
            <label className={labelCls}>Branded URL</label>
            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              dcmgrading.com/enterprise/{settings.slug}
              <span className="text-xs text-gray-400 ml-2">(fixed; contact DCM to change)</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Serial prefix</label>
            <input
              value={prefixDraft ?? (settings.serialPrefix || settings.derivedPrefix)}
              maxLength={6}
              className={inputCls}
              onChange={e => setPrefixDraft(e.target.value.toUpperCase())}
              onBlur={e => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                const current = settings.serialPrefix || settings.derivedPrefix
                if (v !== current) {
                  saveAnd({ serialPrefix: v }, { serialPrefix: v }, 'Serial prefix saved')
                }
              }} />
            <p className="text-xs text-gray-400 mt-1">
              2 to 6 letters or numbers on your card serials, e.g. {effectivePrefix}442921. Serial numbers
              are random and unique to your account. Changing the prefix only affects future cards.
            </p>
          </div>
        </div>

        {/* Logo */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Logo</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {settings.logos.color && (
              <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logos.color} alt="logo" className="h-14 w-14 object-contain" />
              </div>
            )}
            {settings.logos.white && (
              <div className="border border-gray-200 rounded-lg p-2 bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logos.white} alt="white variant" className="h-14 w-14 object-contain" />
              </div>
            )}
            {settings.logos.black && (
              <div className="border border-gray-200 rounded-lg p-2 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logos.black} alt="black variant" className="h-14 w-14 object-contain" />
              </div>
            )}
            <label className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-purple-400 cursor-pointer">
              {settings.logos.color ? 'Replace logo' : 'Upload logo'}
              <input type="file" accept="image/png" className="hidden" disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('logo', f) }} />
            </label>
          </div>
          <p className="text-xs text-gray-400">PNG, transparent background, at least 256px. Light and dark variants derive automatically.</p>
        </div>

        {/* Brand colors */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Brand colors</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {settings.brandColors.map((c, i) => (
              <input key={`${i}-${c}`} type="color" defaultValue={c}
                onBlur={e => {
                  const next = settings.brandColors.map((p, j) => (j === i ? e.target.value : p))
                  if (JSON.stringify(next) !== JSON.stringify(settings.brandColors)) {
                    saveAnd({ brandColors: next }, { brandColors: next }, 'Brand colors saved')
                  }
                }}
                className="w-10 h-10 border border-gray-300 rounded cursor-pointer" />
            ))}
            {settings.brandColors.length < 5 && (
              <button onClick={() => {
                const next = [...settings.brandColors, '#7C3AED']
                saveAnd({ brandColors: next }, { brandColors: next }, 'Color added')
              }} disabled={busy}
                className="w-10 h-10 border border-dashed border-gray-300 rounded text-gray-400 hover:border-purple-400 hover:text-purple-600">
                +
              </button>
            )}
            {settings.brandColors.length > 1 && (
              <button onClick={() => {
                const next = settings.brandColors.slice(0, -1)
                saveAnd({ brandColors: next }, { brandColors: next }, 'Color removed')
              }} disabled={busy}
                className="px-2 h-10 text-xs text-gray-400 hover:text-red-500">
                remove last
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">First color is your primary accent on card pages and labels.</p>
        </div>

        {/* Slab label design — the enterprise Label Designer */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Slab label design</h2>
          <p className="text-xs text-gray-400 mb-4">
            The design printed on every slab label your account grades, and shown on your public card pages. Changes save as you make them.
          </p>
          <LabelDesigner
            design={settings.slab.design}
            onChange={d => setSettings(s => (s ? { ...s, slab: { ...s.slab, ...slabFromDesign(d), design: d } } : s))}
            onCommit={d => { void save({ slab: { design: d } }, 'Label design saved') }}
            orgName={settings.name}
            serialPrefix={settings.serialPrefix || settings.derivedPrefix}
            brandColors={settings.brandColors}
            logos={settings.logos}
          />
        </div>

        {/* Storefront details */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Enterprise Page</h2>
            <a href={`/enterprise/${settings.slug}`} target="_blank" rel="noreferrer"
              className="text-xs text-purple-600 hover:text-purple-800 underline">
              View your page ↗
            </a>
          </div>
          {!settings.storefrontEnabled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Your Enterprise Page is currently disabled. Contact DCM to re-enable it. Everything you save
              here appears the moment it is back on.
            </p>
          )}
          <div>
            <label className={labelCls}>Tagline</label>
            <input defaultValue={settings.tagline} maxLength={140} className={inputCls}
              onBlur={e => e.target.value.trim() !== settings.tagline && saveAnd({ tagline: e.target.value }, { tagline: e.target.value.trim() }, 'Tagline saved')} />
          </div>
          <div>
            <label className={labelCls}>About your brand or business</label>
            <textarea defaultValue={settings.description} maxLength={1000} rows={3} className={inputCls}
              onBlur={e => e.target.value.trim() !== settings.description && saveAnd({ description: e.target.value }, { description: e.target.value.trim() }, 'Description saved')} />
          </div>
          <div>
            <label className={labelCls}>About headline</label>
            <input defaultValue={settings.aboutTitle} maxLength={120} placeholder={DEFAULT_ABOUT_TITLE} className={inputCls}
              onBlur={e => e.target.value.trim() !== settings.aboutTitle && saveAnd({ aboutTitle: e.target.value }, { aboutTitle: e.target.value.trim() }, 'Headline saved')} />
            <p className="text-xs text-gray-400 mt-1">The heading above your description. Blank uses &quot;{DEFAULT_ABOUT_TITLE}&quot;.</p>
          </div>
          <div>
            <label className={labelCls}>Highlight bullets (one per line, up to 5)</label>
            <textarea
              key={settings.aboutBullets === null ? 'default-bullets' : 'custom-bullets'}
              defaultValue={(settings.aboutBullets ?? DEFAULT_ABOUT_BULLETS).join('\n')}
              rows={3}
              className={inputCls}
              onBlur={e => {
                const lines = e.target.value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 5)
                const current = settings.aboutBullets ?? DEFAULT_ABOUT_BULLETS
                if (JSON.stringify(lines) !== JSON.stringify(current)) {
                  saveAnd({ aboutBullets: lines }, { aboutBullets: lines }, 'Bullets saved')
                }
              }} />
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-gray-400">Shown with checkmarks under your description. Clear all lines to hide the list.</p>
              {settings.aboutBullets !== null && (
                <button onClick={() => saveAnd({ aboutBullets: null }, { aboutBullets: null }, 'Standard bullets restored')} disabled={busy}
                  className="text-xs text-gray-500 hover:text-purple-600 underline shrink-0">
                  Restore standard
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Address</label>
              <textarea defaultValue={settings.address} maxLength={400} rows={2} className={inputCls}
                onBlur={e => e.target.value.trim() !== settings.address && saveAnd({ address: e.target.value }, { address: e.target.value.trim() }, 'Address saved')} />
            </div>
            <div>
              <label className={labelCls}>Hours</label>
              <textarea defaultValue={settings.hours} maxLength={400} rows={2} className={inputCls}
                onBlur={e => e.target.value.trim() !== settings.hours && saveAnd({ hours: e.target.value }, { hours: e.target.value.trim() }, 'Hours saved')} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input defaultValue={settings.phone} maxLength={40} className={inputCls}
                onBlur={e => e.target.value.trim() !== settings.phone && saveAnd({ phone: e.target.value }, { phone: e.target.value.trim() }, 'Phone saved')} />
            </div>
            <div>
              <label className={labelCls}>Public email</label>
              <input defaultValue={settings.publicEmail} maxLength={320} className={inputCls}
                onBlur={e => e.target.value.trim() !== settings.publicEmail && saveAnd({ publicEmail: e.target.value }, { publicEmail: e.target.value.trim() }, 'Email saved')} />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input defaultValue={settings.website} maxLength={200} placeholder="https://" className={inputCls}
                onBlur={e => e.target.value.trim() !== settings.website && saveAnd({ website: e.target.value, storefrontWebsite: e.target.value }, { website: e.target.value.trim() }, 'Website saved')} />
            </div>
            <div>
              <label className={labelCls}>Legal name</label>
              <input defaultValue={settings.legalName} maxLength={120} className={inputCls}
                onBlur={e => e.target.value.trim() !== settings.legalName && saveAnd({ legalName: e.target.value }, { legalName: e.target.value.trim() }, 'Legal name saved')} />
              <p className="text-xs text-gray-400 mt-1">Shown in the Enterprise Page copyright line. Blank uses your display name.</p>
            </div>
            <div>
              <label className={labelCls}>Hero logo</label>
              <select value={settings.heroLogo} className={inputCls}
                onChange={e => saveAnd({ heroLogo: e.target.value }, { heroLogo: e.target.value as Settings['heroLogo'] }, 'Hero logo saved')}>
                <option value="color">Color (default)</option>
                <option value="white">White</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Photo display</label>
              <select value={settings.photoDisplay} className={inputCls}
                onChange={e => saveAnd({ photoDisplay: e.target.value }, { photoDisplay: e.target.value as Settings['photoDisplay'] }, 'Photo display saved')}>
                <option value="crop">Crop to fill</option>
                <option value="fit">Fit whole image</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={settings.showRecentCards}
              onChange={e => saveAnd({ showRecentCards: e.target.checked }, { showRecentCards: e.target.checked }, 'Recently graded feed ' + (e.target.checked ? 'on' : 'off'))}
              className="w-4 h-4 accent-purple-600" />
            Show a live feed of your recently graded public cards
          </label>

          {/* Socials */}
          <div>
            <label className={labelCls}>Social links (full URLs)</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_KEYS.map(k => (
                <input key={k} defaultValue={settings.socials[k] || ''} placeholder={`https://${k === 'x' ? 'x' : k}.com/...`}
                  className={inputCls}
                  onBlur={e => {
                    const v = e.target.value.trim()
                    if (v !== (settings.socials[k] || '')) {
                      const socials = { ...settings.socials, [k]: v }
                      saveAnd({ socials }, { socials }, 'Social links saved')
                    }
                  }} />
              ))}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className={labelCls}>Photos ({settings.photos.length}/8)</label>
            <div className="flex gap-3 flex-wrap">
              {settings.photos.map(p => (
                <div key={p.path} className="relative">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="storefront photo" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gray-100" />
                  )}
                  <button onClick={() => removePhoto(p.path)} disabled={busy}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-gray-300 rounded-full text-xs text-gray-500 hover:text-red-500 shadow-sm">
                    ✕
                  </button>
                </div>
              ))}
              {settings.photos.length < 8 && (
                <label className="w-24 h-24 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-600 cursor-pointer text-sm">
                  + Add
                  <input type="file" accept="image/*" className="hidden" disabled={busy}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('photo', f) }} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* How it works editor */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Enterprise Page: How it works</h2>
            <span className="text-xs text-gray-400">
              {settings.howItWorks === null && stepsDraft === null ? 'Using standard steps' : 'Customized'}
            </span>
          </div>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-600 w-5">{i + 1}.</span>
                  <input value={s.title} maxLength={80} placeholder="Step title" className={inputCls}
                    onChange={e => setStepsDraft(steps.map((p, j) => j === i ? { ...p, title: e.target.value } : p))} />
                  <button onClick={() => setStepsDraft(steps.filter((_, j) => j !== i))}
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0">remove</button>
                </div>
                <textarea value={s.body} maxLength={400} rows={2} placeholder="Step description" className={inputCls}
                  onChange={e => setStepsDraft(steps.map((p, j) => j === i ? { ...p, body: e.target.value } : p))} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {steps.length < 6 && (
              <button onClick={() => setStepsDraft([...steps, { title: '', body: '' }])}
                className="px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-purple-400">
                + Add step
              </button>
            )}
            <button onClick={() => saveSteps(steps)} disabled={busy || stepsDraft === null}
              className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50">
              Save steps
            </button>
            <button onClick={() => saveSteps(null)} disabled={busy}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-purple-600">
              Restore standard steps
            </button>
            <button onClick={() => saveSteps([])} disabled={busy}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-500">
              Hide section
            </button>
          </div>
        </div>

        {/* FAQ editor */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Enterprise Page: FAQ</h2>
            <span className="text-xs text-gray-400">
              {settings.faqs === null && faqsDraft === null ? 'Using standard answers' : 'Customized'}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            The standard answers describe the grading accurately. If you customize them, keep descriptions of
            the grading process factual (AI-assisted visual grading; no authentication claims).
          </p>
          <div className="space-y-3">
            {faqList.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={f.q} maxLength={160} placeholder="Question" className={inputCls}
                    onChange={e => setFaqsDraft(faqList.map((p, j) => j === i ? { ...p, q: e.target.value } : p))} />
                  <button onClick={() => setFaqsDraft(faqList.filter((_, j) => j !== i))}
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0">remove</button>
                </div>
                <textarea value={f.a} maxLength={1000} rows={2} placeholder="Answer" className={inputCls}
                  onChange={e => setFaqsDraft(faqList.map((p, j) => j === i ? { ...p, a: e.target.value } : p))} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {faqList.length < 10 && (
              <button onClick={() => setFaqsDraft([...faqList, { q: '', a: '' }])}
                className="px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-purple-400">
                + Add question
              </button>
            )}
            <button onClick={() => saveFaqs(faqList)} disabled={busy || faqsDraft === null}
              className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50">
              Save FAQ
            </button>
            <button onClick={() => saveFaqs(null)} disabled={busy}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-purple-600">
              Restore standard answers
            </button>
            <button onClick={() => saveFaqs([])} disabled={busy}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-500">
              Hide section
            </button>
          </div>
        </div>

        {setupMode && !settings.setupDone && (
          <div className="text-center">
            <button onClick={finishSetup} disabled={busy}
              className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50">
              Finish setup &amp; go to billing
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

export default function StoreSettingsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <StoreSettingsContent />
    </Suspense>
  )
}
