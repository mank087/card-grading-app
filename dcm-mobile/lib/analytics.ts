/**
 * Analytics — typed wrapper around Firebase Analytics + Meta App Events.
 *
 * Why a wrapper:
 * 1. Single import path for the rest of the app — no `import analytics from
 *    '@react-native-firebase/analytics'` boilerplate scattered across
 *    every screen.
 * 2. Typed event names and params — typos caught at compile time instead
 *    of silently never appearing in GA4.
 * 3. Fan-out — one call here logs to Firebase (→ GA4 property 515081968)
 *    AND mirrors revenue + key events to Meta App Events for ad
 *    attribution. Add new sinks (TikTok, Reddit) here without touching
 *    every event call site.
 * 4. Graceful no-op on Expo Go — both Firebase and the Meta SDK throw if
 *    the native module is missing. Wrap calls in try/catch so dev
 *    iteration in Expo Go isn't blocked by analytics errors.
 *
 * Where events flow:
 *   Firebase Analytics  →  GA4 property 515081968 (DCM Grading)
 *   Meta App Events     →  Meta business / ad account (FB + IG ads
 *                          attribution)
 *
 * IMPORTANT: do NOT log PII (emails, full names, raw card images). Pass
 * Supabase user ID via setUserId, not as a param.
 */

// Firebase analytics — wrapped so dev builds without the native module
// don't crash. Production / EAS dev / preview / production builds all
// include the module via the @react-native-firebase/app plugin in app.json.
let firebaseAnalytics: any = null
try {
  firebaseAnalytics = require('@react-native-firebase/analytics').default
} catch {
  /* Expo Go — native module unavailable, no-op below */
}

// Meta App Events — already installed via react-native-fbsdk-next for
// Facebook login. Pull just the event logger here.
let MetaAppEvents: any = null
try {
  MetaAppEvents = require('react-native-fbsdk-next').AppEventsLogger
} catch {
  /* Expo Go — no-op */
}

const isReady = () => !!firebaseAnalytics

// ─── Event names (single source of truth) ──────────────────────────
// Use Firebase recommended event names where they exist (login, sign_up,
// purchase). Custom events use snake_case to match Firebase convention.

export const EVENTS = {
  // Auth
  SIGN_UP: 'sign_up',                              // Firebase recommended
  LOGIN: 'login',                                   // Firebase recommended

  // Grading
  GRADE_STARTED: 'grade_started',
  GRADE_COMPLETED: 'grade_completed',

  // Monetization
  CREDITS_PURCHASE_INITIATED: 'credits_purchase_initiated',
  PURCHASE: 'purchase',                             // Firebase recommended

  // Engagement
  LABEL_EXPORTED: 'label_exported',
  EBAY_LISTED: 'ebay_listed',
} as const

// ─── Public API ────────────────────────────────────────────────────

/**
 * Log an event to Firebase Analytics. Param keys must be alphanumeric +
 * underscores (Firebase rejects others silently).
 */
export async function logEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!isReady()) return
  try {
    await firebaseAnalytics().logEvent(name, params)
  } catch (e) {
    if (__DEV__) console.warn('[analytics] logEvent failed:', name, e)
  }
}

/**
 * Tag the current session with the Supabase user ID so GA4 can compute
 * cohorts and Meta can attribute conversions to the right user.
 * Call on sign-in success and on app start when a session exists.
 */
export async function setUserId(userId: string | null): Promise<void> {
  if (!isReady()) return
  try {
    await firebaseAnalytics().setUserId(userId)
    if (MetaAppEvents && userId) MetaAppEvents.setUserID(userId)
  } catch (e) {
    if (__DEV__) console.warn('[analytics] setUserId failed:', e)
  }
}

/**
 * Set a user property — sticky attribute that applies to every event
 * for this user (e.g., subscriber tier, account age bucket).
 */
export async function setUserProperty(name: string, value: string | null): Promise<void> {
  if (!isReady()) return
  try {
    await firebaseAnalytics().setUserProperty(name, value)
  } catch (e) {
    if (__DEV__) console.warn('[analytics] setUserProperty failed:', e)
  }
}

/**
 * Log a screen view. Auto-fires on every navigation if you wire up
 * expo-router's navigation listener (see _layout.tsx).
 */
export async function logScreenView(screenName: string, screenClass?: string): Promise<void> {
  if (!isReady()) return
  try {
    await firebaseAnalytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    })
  } catch (e) {
    if (__DEV__) console.warn('[analytics] logScreenView failed:', e)
  }
}

/**
 * Map an expo-router segment array (from useSegments()) to a friendly
 * screen name + class for GA4 reporting. Without this, Firebase's
 * automatic screen reporting on iOS reports the underlying native
 * UIViewController class names (RNSScreen, RCTFabricModalHostViewController,
 * etc.) which are useless for user-facing analytics.
 *
 * Segments are the Expo Router file-system path. Examples:
 *   ['(tabs)', 'grade']                     → "Grade Tab"
 *   ['(tabs)', 'collection']                → "Collection"
 *   ['(auth)', 'login']                     → "Login"
 *   ['card', '[id]']                        → "Card Detail"
 *   ['grade', 'capture']                    → "Grade — Capture"
 *   ['pages', 'credits']                    → "Credits (Web)"
 *
 * Add new mappings here as new screens are added; unknown segment
 * combinations fall through to a generic "Unknown: <segments>" label
 * so they're visible in GA4 and easy to spot for follow-up.
 */
export function segmentsToScreenName(segments: readonly string[]): { name: string; className: string } {
  if (!segments || segments.length === 0) {
    return { name: 'Home', className: 'Home' }
  }

  const group = segments[0]
  const route = segments[1] ?? ''

  // (tabs) group — main bottom-nav screens.
  if (group === '(tabs)') {
    const tabMap: Record<string, string> = {
      grade: 'Grade Tab',
      collection: 'Collection',
      labels: 'Label Studio',
      'market-pricing': 'Portfolio',
      account: 'Account',
    }
    const friendly = tabMap[route] || `Tab: ${route}`
    return { name: friendly, className: friendly }
  }

  // (auth) group — pre-login screens.
  if (group === '(auth)') {
    const authMap: Record<string, string> = {
      login: 'Login',
      register: 'Register',
      'forgot-password': 'Forgot Password',
    }
    const friendly = authMap[route] || `Auth: ${route}`
    return { name: friendly, className: friendly }
  }

  // Card detail (dynamic [id] route).
  if (group === 'card') {
    return { name: 'Card Detail', className: 'Card Detail' }
  }

  // Grade flow.
  if (group === 'grade') {
    const gradeMap: Record<string, string> = {
      capture: 'Grade — Capture',
      review: 'Grade — Review',
      processing: 'Grade — Processing',
    }
    const friendly = gradeMap[route] || `Grade: ${route}`
    return { name: friendly, className: friendly }
  }

  // WebView pages — anything under pages/ is a web page loaded in
  // SFSafariViewController-like context. Suffix with (Web) to
  // distinguish from native screens of the same name.
  if (group === 'pages') {
    if (!route) return { name: 'Web Pages', className: 'Web Pages' }
    const title = route
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return { name: `${title} (Web)`, className: `${title} (Web)` }
  }

  // Fallback — surface the path so unknown screens are visible in GA4.
  const fallback = segments.filter(s => !!s).join('/') || 'Unknown'
  return { name: `Unknown: ${fallback}`, className: 'Unknown' }
}

// ─── Domain helpers (one per high-value event) ─────────────────────
// Wrappers that enforce the param shape so individual screens don't
// need to remember the exact key names.

export function trackSignUp(method: 'email' | 'google' | 'apple') {
  logEvent(EVENTS.SIGN_UP, { method })
  if (MetaAppEvents) {
    try { MetaAppEvents.logEvent('fb_mobile_complete_registration', { fb_registration_method: method }) }
    catch { /* no-op */ }
  }
}

export function trackLogin(method: 'email' | 'google' | 'apple') {
  logEvent(EVENTS.LOGIN, { method })
}

export function trackGradeStarted(category: string) {
  logEvent(EVENTS.GRADE_STARTED, { category })
}

export function trackGradeCompleted(category: string, grade: number) {
  logEvent(EVENTS.GRADE_COMPLETED, { category, grade })
}

export function trackCreditsPurchaseInitiated(pack?: string) {
  logEvent(EVENTS.CREDITS_PURCHASE_INITIATED, pack ? { pack } : undefined)
}

/**
 * Revenue event — used by Meta and Google Ads ad-network optimization.
 * Should fire once per successful purchase (server-side webhook ideal,
 * client-side after return from web checkout is acceptable fallback).
 */
export function trackPurchase(params: {
  value: number
  currency: string
  pack?: string
  credits?: number
  transactionId?: string
}) {
  logEvent(EVENTS.PURCHASE, {
    value: params.value,
    currency: params.currency,
    ...(params.pack ? { pack: params.pack } : {}),
    ...(params.credits ? { credits: params.credits } : {}),
    ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
  })
  if (MetaAppEvents) {
    try {
      MetaAppEvents.logPurchase(params.value, params.currency, {
        ...(params.pack ? { fb_content_id: params.pack } : {}),
      })
    } catch { /* no-op */ }
  }
}

export function trackLabelExported(type: string) {
  logEvent(EVENTS.LABEL_EXPORTED, { type })
}

export function trackEbayListed() {
  logEvent(EVENTS.EBAY_LISTED)
}
