'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { GradingQueueProvider } from '@/contexts/GradingQueueContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import PersistentStatusBar from '@/components/PersistentStatusBar'
import HelpBot from '@/components/helpbot/HelpBot'
import ReferralTracker from '@/components/ReferralTracker'
import { useBackgroundGrading } from '@/hooks/useBackgroundGrading'
import {
  initSessionRefresh, cleanupSessionRefresh, getStoredSession, AUTH_STATE_CHANGE_EVENT,
} from '@/lib/directAuth'

function BackgroundGradingMonitor() {
  useBackgroundGrading()
  return null
}

// Scroll to top on route changes
function ScrollToTop() {
  const pathname = usePathname()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// Background market-pricing refresh trigger. Fire-and-forget on session
// start so cards whose dcm_price_updated_at is older than 7 days get
// topped up without the user hitting the manual button.
//
// Safety nets that make spamming this harmless:
//   - Server filters to cards stale > 7 days, so most calls do zero work.
//   - Server enforces 60s per-user cool-down and an active-Card-Lover
//     check; non-subscribers get a fast rejection.
//   - Per-batch cap (150) on the server so this never runs longer than
//     ~225s; the user closing the tab mid-refresh just means the server
//     completes whatever's in-flight and the next session picks up where
//     the freshness column left off.
function triggerBackgroundPriceRefresh() {
  try {
    const session = getStoredSession()
    if (!session?.access_token) return
    // July 2026: refresh-prices is open to all authenticated users (stale-
    // only + batch cap + cool-down bound the cost), so fire unconditionally.
    void fetch('/api/market-pricing/refresh-prices', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trigger: 'login' }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })
  } catch { /* no-op */ }
}

// Card-detail freshness: when the user opens any card detail page, top up
// THAT card's price if it's >7 days stale. Owner + staleness + a 60s
// per-card cool-down are enforced server-side, so firing on every detail
// navigation is cheap (a fresh card is a single indexed select).
const CARD_DETAIL_RE = /^\/(pokemon|mtg|sports|lorcana|onepiece|yugioh|starwars|other)\/([0-9a-f-]{36})$/i

function CardDetailPriceRefresher() {
  const pathname = usePathname()
  useEffect(() => {
    const match = pathname?.match(CARD_DETAIL_RE)
    if (!match) return
    try {
      const session = getStoredSession()
      if (!session?.access_token) return
      void fetch(`/api/cards/${match[2]}/refresh-price`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        keepalive: true,
      }).catch(() => { /* fire-and-forget */ })
    } catch { /* no-op */ }
  }, [pathname])
  return null
}

// Initialize session refresh monitoring to keep users logged in
function SessionRefreshMonitor() {
  useEffect(() => {
    initSessionRefresh()
    // Fire once on mount for users already signed in. Wraps in a
    // microtask so it never blocks first paint, even on slow networks.
    queueMicrotask(triggerBackgroundPriceRefresh)
    // Fire again whenever the custom auth-state-change event signals
    // a fresh sign-in. directAuth dispatches this on signInWithPassword,
    // OAuth callback, and token refresh — the no-op exit when there's
    // no session keeps refresh-only events cheap.
    const handler = () => triggerBackgroundPriceRefresh()
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handler)
    return () => {
      cleanupSessionRefresh()
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handler)
    }
  }, [])
  return null
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CreditsProvider>
      <GradingQueueProvider>
        <ScrollToTop />
        <BackgroundGradingMonitor />
        <SessionRefreshMonitor />
        <CardDetailPriceRefresher />
        <ReferralTracker />
        <Toaster
          position="top-center"
          reverseOrder={false}
          gutter={8}
          containerStyle={{
            top: 80, // Below navigation
          }}
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '14px',
              maxWidth: '400px',
            },
          }}
        />
        <PersistentStatusBar />
        <HelpBot />
        {/* LaunchBanner retired July 2026 — app-store visibility moved into
            the Navigation (desktop xl row + mobile menu). */}
        {children}
      </GradingQueueProvider>
    </CreditsProvider>
  )
}
