'use client'

/**
 * Consent gate for marketing/analytics scripts (2026-07-17, regions 2026-09-11).
 *
 * Two regimes, chosen per visitor by src/lib/consentRegion.ts:
 *
 *   strict (default everywhere)
 *     DEFAULT-BLOCKED: Google Analytics/Ads, Meta Pixel, Reddit Pixel and the
 *     Microsoft Advertising UET tag load ONLY after the visitor explicitly
 *     accepts. Until then, safe no-op stubs are installed for fbq/rdt/gtag/uetq
 *     so existing event-tracking call sites never throw. "Essential only" (or
 *     no choice) = nothing loads. Applies to the EEA/UK/Switzerland, to any
 *     visitor whose country is unknown, to every GPC visitor, and to the US
 *     unless the flag below is on. This is the behavior shipped in July.
 *
 *   us-optout (US visitors, only while NEXT_PUBLIC_CONSENT_US_OPTOUT=1)
 *     Notice-and-opt-out, the standard US pattern. The Google tag loads with
 *     Consent Mode v2 in the DENIED state before any choice (cookieless pings,
 *     no identifiers, modeled conversions). Meta, Reddit and Microsoft UET
 *     still load only after "Accept". "Opt out" turns everything off and
 *     clears our first-party click-ID cookies. The flag is OFF until counsel
 *     clears the pre-consent Google load; with it off the US is strict.
 *
 * NOTE ON UET (added 2026-09-02, owner-directed): Microsoft's own install
 * instructions say to paste bat.js into <head> on every page, and their
 * Consent Mode pattern loads the script first and then restricts storage.
 * That is deliberately NOT what we do — loading the vendor script at all
 * opens the third-party connection this gate exists to prevent, so UET is
 * injected from loadOtherVendors() like every other tracker and never runs
 * for essential-only or GPC visitors, in either regime.
 *
 * Consent state persists in localStorage + a 1-year cookie (dcm_consent=
 * granted|essential, with timestamp) — the cookie doubles as the audit record
 * of when consent was given. Every choice is also logged server-side
 * (POST /api/consent/log, fire-and-forget, with region + mode) for a durable
 * audit trail.
 *
 * Global Privacy Control: if the browser sends GPC and the visitor has made
 * no explicit choice, we auto-apply "essential only" without showing the
 * banner (CCPA opt-out signal honoring). GPC is CONTROLLING: while the
 * signal is present, the reopened preferences panel does not offer
 * "Accept all" — CA's AG treats GPC as a formal opt-out, and re-soliciting
 * opt-in after an opt-out is restricted (12-month rule). GPC also forces the
 * strict regime regardless of region. Do not add an override path without
 * counsel's sign-off.
 *
 * Re-open preferences from anywhere via:
 *   window.dispatchEvent(new Event('dcm-open-consent-preferences'))
 *
 * VENDOR DISCLOSURE: the banner copy names every vendor. Adding a tracker
 * means updating every variant of that copy in this file.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isStorefrontHost, isOrgPublicPath } from '@/lib/storefrontHost'
import { consentModeFor, readRegionCookie, type ConsentMode, type ConsentRegion } from '@/lib/consentRegion'
import { captureClickIdsFromUrl, clearClickIds } from '@/lib/adClickIds'

const STORAGE_KEY = 'dcm_consent_v1'
const COOKIE_NAME = 'dcm_consent'

// Mirror of FULLSCREEN_ROUTES in Navigation.tsx/Footer.tsx — these routes are
// captured as images (incl. the mobile app's hidden label-rendering WebView),
// so the banner must never overlay them. No trackers load there either.
const FULLSCREEN_ROUTES = ['/label-export', '/label-preview']

const VENDOR_LIST = 'Google Analytics, Google Ads, Meta, Reddit, Microsoft Advertising'

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
function logConsent(choice: 'granted' | 'essential' | 'shown', source: 'banner' | 'gpc', region: ConsentRegion, mode: ConsentMode) {
  try {
    fetch('/api/consent/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice, source, gpc: gpcEnabled(), region, mode }),
      keepalive: true,
    }).catch(() => { })
  } catch { }
}

/** No-op stubs so fbq/rdt/gtag/uetq call sites never throw pre-consent. */
function installStubs() {
  const w = window as any
  if (typeof w.fbq !== 'function') { const noop: any = () => { }; noop.queue = []; noop.loaded = false; noop._dcmStub = true; w.fbq = noop }
  if (typeof w.rdt !== 'function') { const noop: any = () => { }; noop.callQueue = []; noop._dcmStub = true; w.rdt = noop }
  // uetq is a plain array until bat.js replaces it with a UET instance, so an
  // empty array IS the safe stub: pushes queue up and are never transmitted
  // while the script is absent. Nothing to tear down on acceptance either —
  // the loader below reads whatever queued and hands it to UET as o.q.
  if (!Array.isArray(w.uetq)) w.uetq = []
  w.dataLayer = w.dataLayer || []
  if (typeof w.gtag !== 'function') { w.gtag = function gtag() { w.dataLayer.push(arguments) }; (w.gtag as any)._dcmStub = true }
  // Google Consent Mode v2: default DENIED before any Google script can load.
  try { w.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }) } catch { }
}

const GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' }
const DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }

/**
 * Load the Google tag (GA4 + Ads). `granted` = full storage consent; false =
 * Consent Mode v2 denied (cookieless pings only), which is the ONLY thing
 * that ever runs pre-consent, and only in us-optout mode.
 */
function loadGoogle(granted: boolean) {
  const w = window as any
  const d = document
  w.dataLayer = w.dataLayer || []
  w.gtag = function gtag() { w.dataLayer.push(arguments) }
  w.gtag('consent', 'default', DENIED)
  if (granted) w.gtag('consent', 'update', GRANTED)
  w.gtag('js', new Date())
  w.gtag('config', 'G-YLC2FKKBGC')
  w.gtag('config', 'AW-17817758517')
  const ga = d.createElement('script')
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-YLC2FKKBGC'
  ga.async = true
  d.head.appendChild(ga)
}

/** Upgrade an already-loaded denied-mode Google tag to granted. */
function grantGoogle() {
  const w = window as any
  try { w.gtag('consent', 'update', GRANTED) } catch { }
}

/** Meta, Reddit and Microsoft UET. Only ever called after explicit acceptance. */
function loadOtherVendors() {
  const w = window as any
  const d = document

  // Remove stubs so the vendors' own bootstraps (which no-op if already
  // defined) install their real queues.
  if (w.fbq?._dcmStub) { delete w.fbq; delete w._fbq }
  if (w.rdt?._dcmStub) { delete w.rdt }

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

  // Microsoft Advertising UET (tag 343269844).
  // enableAutoSpaTracking lets bat.js count Next.js client-side route changes
  // as pageviews; without it only the first hard load would register.
  ;(function (win: any, doc: Document, t: string, u: string, o: any) {
    win[u] = win[u] || []
    o.ts = new Date().getTime()
    const n = doc.createElement(t) as HTMLScriptElement
    n.src = 'https://bat.bing.net/bat.js?ti=' + o.ti
    n.async = true
    n.onload = function () {
      // Hand the pre-load queue to the real UET instance, then replace it.
      o.q = win[u]
      win[u] = new win.UET(o)
      win[u].push('pageLoad')
    }
    doc.head.appendChild(n)
  })(w, d, 'script', 'uetq', { ti: '343269844', enableAutoSpaTracking: true })
  // Redundant in practice (this only ever runs post-acceptance) but kept so the
  // granted state is explicit in the tag's own record, mirroring gtag above.
  w.uetq.push('consent', 'default', { ad_storage: 'denied' })
  w.uetq.push('consent', 'update', { ad_storage: 'granted' })
}

export default function ConsentManager() {
  const pathname = usePathname()
  // Tenant subdomains rewrite to /enterprise/{slug}/* with a '/' browser
  // pathname (see src/middleware.ts) — org pages carry no DCM chrome and load
  // no trackers, so the host is checked alongside the path.
  const [tenantHost, setTenantHost] = useState(false)
  useEffect(() => { setTenantHost(isStorefrontHost(window.location.hostname)) }, [])
  const suppressed = tenantHost || (!!pathname && (FULLSCREEN_ROUTES.some(p => pathname.startsWith(p)) || isOrgPublicPath(pathname)))
  const [consent, setConsent] = useState<ConsentState>(null)
  const [bannerOpen, setBannerOpen] = useState(false)
  const [gpcActive, setGpcActive] = useState(false)
  const [region, setRegion] = useState<ConsentRegion>('unknown')
  const [mode, setMode] = useState<ConsentMode>('strict')
  // What is actually running on this page, so a later "opt out" can reload
  // for a clean page and a later "accept" can upgrade instead of re-adding.
  const googleLoaded = useRef<'none' | 'denied' | 'granted'>('none')
  const vendorsLoaded = useRef(false)

  useEffect(() => {
    if (suppressed) { installStubs(); return }
    installStubs()
    const gpc = gpcEnabled()
    const r = readRegionCookie()
    const m = consentModeFor(r, gpc)
    setGpcActive(gpc)
    setRegion(r)
    setMode(m)

    let stored = readStored()
    if (gpc && stored !== 'essential') {
      // Honor Global Privacy Control: opt out silently, no banner. This also
      // supersedes an earlier stored "granted" — the GPC signal is the more
      // recent expression of the visitor's intent, and CA treats it as a
      // formal opt-out request. Persisting keeps this to one audit-log row.
      persist('essential')
      logConsent('essential', 'gpc', r, m)
      clearClickIds()
      stored = 'essential'
    }
    setConsent(stored)
    setBannerOpen(stored === null)
    if (stored === null) {
      // Impression record, once per browser session, so the accept rate can be
      // measured against everyone who saw the banner, not only those who clicked.
      try {
        if (!sessionStorage.getItem('dcm_consent_shown')) {
          sessionStorage.setItem('dcm_consent_shown', '1')
          logConsent('shown', 'banner', r, m)
        }
      } catch { logConsent('shown', 'banner', r, m) }
    }

    if (stored === 'granted') {
      loadGoogle(true); googleLoaded.current = 'granted'
      loadOtherVendors(); vendorsLoaded.current = true
      captureClickIdsFromUrl()
    } else if (stored === null && m === 'us-optout') {
      // US notice-and-opt-out: Google in Consent Mode denied only. Nothing
      // else, and never for GPC (m is forced to strict above).
      loadGoogle(false); googleLoaded.current = 'denied'
      captureClickIdsFromUrl()
    }

    const reopen = () => setBannerOpen(true)
    window.addEventListener('dcm-open-consent-preferences', reopen)
    return () => window.removeEventListener('dcm-open-consent-preferences', reopen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressed])

  const choose = useCallback((state: 'granted' | 'essential') => {
    persist(state)
    logConsent(state, 'banner', region, mode)
    setConsent(state)
    setBannerOpen(false)
    if (state === 'granted') {
      if (googleLoaded.current === 'none') { loadGoogle(true); googleLoaded.current = 'granted' }
      else if (googleLoaded.current === 'denied') { grantGoogle(); googleLoaded.current = 'granted' }
      if (!vendorsLoaded.current) { loadOtherVendors(); vendorsLoaded.current = true }
      captureClickIdsFromUrl()
    } else {
      clearClickIds()
      if (googleLoaded.current !== 'none' || vendorsLoaded.current) {
        // Scripts from a prior acceptance (or the denied-mode Google tag) are
        // already on this page; a reload gives a clean tracker-free page.
        window.location.reload()
      }
    }
  }, [region, mode])

  if (suppressed || !bannerOpen) return null

  const equalButtons = mode === 'strict' && region === 'eu'
  const secondaryBtn = 'px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50'
  const primaryBtn = equalButtons ? secondaryBtn : 'px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700'

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]" role="dialog" aria-label="Cookie preferences">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
        {!gpcActive && mode === 'strict' && (
          <p className="text-sm font-semibold text-gray-900 mb-1">Help us improve DCM</p>
        )}
        <p className="text-sm text-gray-700">
          {gpcActive ? (
            <>
              Your browser is sending a Global Privacy Control signal, so optional tracking
              ({VENDOR_LIST}) is turned off and will stay off. Essential features like sign-in
              and checkout work normally. See our{' '}
              <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a>.
            </>
          ) : mode === 'us-optout' ? (
            <>
              We use cookies and similar technologies for analytics and advertising
              ({VENDOR_LIST}). You can opt out at any time here or through &ldquo;Do Not Sell or
              Share My Personal Information&rdquo; in the footer. Essential features like sign-in
              and checkout work either way. See our{' '}
              <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a>.
            </>
          ) : (
            <>
              We use analytics and advertising cookies to see which features people use and
              which ads bring collectors here. They run only if you accept. Grading, sign-in
              and checkout work either way. Optional partners: {VENDOR_LIST}.{' '}
              <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a>.
            </>
          )}
        </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => choose('essential')} className={secondaryBtn}>
            {gpcActive ? 'OK' : mode === 'us-optout' ? 'Opt out' : 'Decline'}
          </button>
          {/* GPC is a formal CCPA opt-out; while the signal is present we do
              not offer opt-in. Do not change without counsel's approval. */}
          {!gpcActive && (
            <button onClick={() => choose('granted')} className={primaryBtn}>
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
