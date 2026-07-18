'use client'

/**
 * Consent gate for marketing/analytics scripts (2026-07-17).
 *
 * DEFAULT-BLOCKED: Google Analytics/Ads, Meta Pixel, and Reddit Pixel load ONLY
 * after the visitor explicitly accepts. Until then, safe no-op stubs are
 * installed for fbq/rdt/gtag so existing event-tracking call sites throughout
 * the app never throw. "Essential only" (or no choice) = nothing loads.
 *
 * Consent state persists in localStorage + a 1-year cookie (dcm_consent=v1:
 * granted|essential, with timestamp) — the cookie doubles as the audit record
 * of when consent was given. Every choice is also logged server-side
 * (POST /api/consent/log, fire-and-forget) for a durable audit trail.
 *
 * Global Privacy Control: if the browser sends GPC and the visitor has made
 * no explicit choice, we auto-apply "essential only" without showing the
 * banner (CCPA opt-out signal honoring). GPC is CONTROLLING: while the
 * signal is present, the reopened preferences panel does not offer
 * "Accept all" — CA's AG treats GPC as a formal opt-out, and re-soliciting
 * opt-in after an opt-out is restricted (12-month rule). Do not add an
 * override path without counsel's sign-off.
 *
 * Re-open preferences from anywhere via:
 *   window.dispatchEvent(new Event('dcm-open-consent-preferences'))
 *
 * Google Consent Mode v2 defaults are set to DENIED before GA ever loads and
 * updated to granted only on acceptance.
 */

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'dcm_consent_v1'
const COOKIE_NAME = 'dcm_consent'

// Mirror of FULLSCREEN_ROUTES in Navigation.tsx/Footer.tsx — these routes are
// captured as images (incl. the mobile app's hidden label-rendering WebView),
// so the banner must never overlay them. No trackers load there either.
const FULLSCREEN_ROUTES = ['/label-export', '/label-preview']

type ConsentState = 'granted' | 'essential' | null

function readStored(): ConsentState {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'granted' || v === 'essential') return v
  } catch { /* storage unavailable */ }
  return null
}

function persist(state: 'granted' | 'essential') {
  try { localStorage.setItem(STORAGE_KEY, state) } catch { }
  try {
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `${COOKIE_NAME}=${state}.${Date.now()}; expires=${expires}; path=/; SameSite=Lax`
  } catch { }
}

function gpcEnabled(): boolean {
  try { return (navigator as any).globalPrivacyControl === true } catch { return false }
}

/** Server-side audit log. Must never block or break the consent flow. */
function logConsent(choice: 'granted' | 'essential', source: 'banner' | 'gpc') {
  try {
    fetch('/api/consent/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice, source, gpc: gpcEnabled() }),
      keepalive: true,
    }).catch(() => { })
  } catch { }
}

/** No-op stubs so fbq/rdt/gtag call sites never throw pre-consent. */
function installStubs() {
  const w = window as any
  if (typeof w.fbq !== 'function') { const noop: any = () => { }; noop.queue = []; noop.loaded = false; noop._dcmStub = true; w.fbq = noop }
  if (typeof w.rdt !== 'function') { const noop: any = () => { }; noop.callQueue = []; noop._dcmStub = true; w.rdt = noop }
  w.dataLayer = w.dataLayer || []
  if (typeof w.gtag !== 'function') { w.gtag = function gtag() { w.dataLayer.push(arguments) }; (w.gtag as any)._dcmStub = true }
  // Google Consent Mode v2: default DENIED before any Google script can load.
  try { w.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }) } catch { }
}

/** Load the real trackers. Only ever called after explicit acceptance. */
function loadMarketingScripts() {
  const w = window as any
  const d = document

  // Remove stubs so the vendors' own bootstraps (which no-op if already
  // defined) install their real queues.
  if (w.fbq?._dcmStub) { delete w.fbq; delete w._fbq }
  if (w.rdt?._dcmStub) { delete w.rdt }

  // Google Consent Mode v2 → granted, then GA/Ads
  w.dataLayer = w.dataLayer || []
  w.gtag = function gtag() { w.dataLayer.push(arguments) }
  w.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' })
  w.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' })
  w.gtag('js', new Date())
  w.gtag('config', 'G-YLC2FKKBGC')
  w.gtag('config', 'AW-17817758517')
  const ga = d.createElement('script')
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-YLC2FKKBGC'
  ga.async = true
  d.head.appendChild(ga)

  // Reddit Pixel
  ;(function (win: any, doc: Document) {
    if (!win.rdt) {
      const p: any = (win.rdt = function () { p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments) })
      p.callQueue = []
      const t = doc.createElement('script')
      t.src = 'https://www.redditstatic.com/ads/pixel.js'
      t.async = true
      doc.head.appendChild(t)
    }
    win.rdt('init', 'a2_i6zsi175k40r')
    win.rdt('track', 'PageVisit')
  })(w, d)

  // Meta Pixel
  ;(function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return
    const n: any = (f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) })
    if (!f._fbq) f._fbq = n
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true; t.src = v
    b.head.appendChild(t)
  })(w, d, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  w.fbq('init', '2308558869571917')
  w.fbq('track', 'PageView')
}

export default function ConsentManager() {
  const pathname = usePathname()
  const suppressed = !!pathname && FULLSCREEN_ROUTES.some(p => pathname.startsWith(p))
  const [consent, setConsent] = useState<ConsentState>(null)
  const [bannerOpen, setBannerOpen] = useState(false)
  const [loadedForThisPage, setLoadedForThisPage] = useState(false)
  const [gpcActive, setGpcActive] = useState(false)

  useEffect(() => {
    if (suppressed) { installStubs(); return }
    installStubs()
    setGpcActive(gpcEnabled())
    let stored = readStored()
    if (gpcEnabled() && stored !== 'essential') {
      // Honor Global Privacy Control: opt out silently, no banner. This also
      // supersedes an earlier stored "granted" — the GPC signal is the more
      // recent expression of the visitor's intent, and CA treats it as a
      // formal opt-out request. Persisting keeps this to one audit-log row.
      persist('essential')
      logConsent('essential', 'gpc')
      stored = 'essential'
    }
    setConsent(stored)
    setBannerOpen(stored === null)
    if (stored === 'granted') { loadMarketingScripts(); setLoadedForThisPage(true) }
    const reopen = () => setBannerOpen(true)
    window.addEventListener('dcm-open-consent-preferences', reopen)
    return () => window.removeEventListener('dcm-open-consent-preferences', reopen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressed])

  const choose = useCallback((state: 'granted' | 'essential') => {
    persist(state)
    logConsent(state, 'banner')
    setConsent(state)
    setBannerOpen(false)
    if (state === 'granted' && !loadedForThisPage) { loadMarketingScripts(); setLoadedForThisPage(true) }
    if (state === 'essential' && loadedForThisPage) {
      // Scripts from a prior acceptance are already on this page; a reload
      // gives a clean tracker-free page immediately.
      window.location.reload()
    }
  }, [loadedForThisPage])

  if (suppressed || !bannerOpen) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]" role="dialog" aria-label="Cookie preferences">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-gray-700 flex-1">
          {gpcActive ? (
            <>
              Your browser is sending a Global Privacy Control signal, so optional tracking
              (Google Analytics, Meta, Reddit) is turned off and will stay off. Essential
              features like sign-in and checkout work normally. See our{' '}
              <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a>.
            </>
          ) : (
            <>
              We use cookies and similar technologies for analytics and advertising. Optional tracking
              (Google Analytics, Meta, Reddit) only runs if you allow it — essential features like
              sign-in and checkout work either way. See our{' '}
              <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a>.
            </>
          )}
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose('essential')}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {gpcActive ? 'OK' : 'Essential only'}
          </button>
          {/* GPC is a formal CCPA opt-out; while the signal is present we do
              not offer opt-in. Do not change without counsel's approval. */}
          {!gpcActive && (
            <button
              onClick={() => choose('granted')}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Accept all
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
