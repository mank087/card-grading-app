/**
 * Site-wide dismissible launch banner. Appears at the very top of every page
 * (above the sticky <Navigation>) announcing the iOS + Google Play launches.
 *
 * Mobile-first responsive — shorter copy below ~640px. Dismissal persists
 * across sessions via localStorage. Key includes a version suffix so we can
 * force-show the banner again when the message changes — bump the version
 * whenever the announcement copy changes materially.
 *
 * Mounted once in src/components/ClientLayout.tsx so it appears site-wide
 * without each page wiring it in.
 */

'use client'

import { useEffect, useState } from 'react'
import { APP_STORE_URL } from './AppStoreBadge'
import { GOOGLE_PLAY_URL } from './GooglePlayBadge'

const DISMISS_KEY = 'dcm-launch-banner-dismissed-v2-ios-android'

export default function LaunchBanner() {
  // Render nothing on the initial server-side mount so hydration doesn't
  // mismatch the localStorage-driven decision. Becomes either true or
  // false on mount.
  const [visible, setVisible] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
      setVisible(!dismissed)
    } catch {
      // localStorage blocked (private mode, etc.) — show the banner anyway.
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Best-effort; if storage is blocked the banner just won't persist its
      // dismissal across reloads.
    }
    // Collapse the reserved .launch-banner-slot synchronously so the nav
    // slides up smoothly instead of leaving a 40px gap behind. Matches the
    // pre-paint script in src/app/layout.tsx — keep both in sync.
    try {
      document.documentElement.setAttribute('data-banner-state', 'dismissed')
    } catch { /* SSR-safety; no-op */ }
    setVisible(false)
  }

  return (
    <div
      // data-dcm-launch-banner is the stable selector the mobile app's
      // InAppPage WebView uses to hide this banner — users browsing the
      // website from inside the iOS/Android app don't need a "download
      // the app" prompt. Don't rename without updating
      // dcm-mobile/components/ui/InAppPage.tsx.
      data-dcm-launch-banner
      className="bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white relative z-[60]"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
        <span className="text-base sm:text-lg flex-shrink-0" aria-hidden>🎉</span>

        {/* Mobile copy (≤ sm) */}
        <span className="text-xs sm:hidden flex-1 min-w-0">
          <strong>Now on iOS &amp; Android!</strong>{' '}
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold whitespace-nowrap"
          >
            App Store
          </a>
          {' · '}
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold whitespace-nowrap"
          >
            Google Play
          </a>
        </span>

        {/* Desktop / tablet copy */}
        <span className="hidden sm:flex flex-1 min-w-0 items-center flex-wrap gap-x-2 text-sm">
          <strong className="whitespace-nowrap">DCM Grading is now on iPhone &amp; Android!</strong>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold whitespace-nowrap"
          >
            App Store
          </a>
          <span className="opacity-80">·</span>
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold whitespace-nowrap"
          >
            Google Play
          </a>
          <span className="opacity-80 whitespace-nowrap">
            — grade cards on the go, or keep using the web.
          </span>
        </span>

        <button
          onClick={dismiss}
          aria-label="Dismiss launch banner"
          className="flex-shrink-0 text-white/80 hover:text-white text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  )
}
