'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getStoredSession } from '@/lib/directAuth'
import { getStoredRefCode as readStoredRefCode, storeRefCode } from '@/lib/referralStorage'

/** Per-tab marker so a code is bound to the account at most once per session. */
const BOUND_KEY = 'dcm_ref_bound'

/**
 * Get the stored referral code from localStorage (if still within attribution window).
 * Kept as an export for existing callers; the logic lives in lib/referralStorage.
 */
export function getStoredRefCode(): string | null {
  return readStoredRefCode()
}

/**
 * Inner component that reads search params (requires Suspense boundary)
 */
function ReferralTrackerInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  useEffect(() => {
    const refCode = searchParams.get('ref')
    if (!refCode) return

    const code = refCode.toUpperCase().trim()
    if (!code) return

    // Validate the code is real before storing
    fetch(`/api/affiliate/validate?code=${encodeURIComponent(code)}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          storeRefCode(code)

          // Fire-and-forget: record the click
          fetch('/api/affiliate/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              landing_page: window.location.pathname,
            }),
          }).catch(() => {
            // Ignore click tracking errors
          })
        }
      })
      .catch(() => {
        // Ignore validation errors — don't block user experience
      })
  }, [searchParams])

  // Oct 2026: once this browser holds a referral code AND a signed-in session,
  // attach the code to the account (POST /api/affiliate/bind), so a purchase
  // from another browser or device is still attributed. The server refuses
  // self-referrals, inactive codes and accounts that have already paid, and a
  // code already on the account wins. Runs on navigation, at most once per tab.
  useEffect(() => {
    const code = readStoredRefCode()
    if (!code) return
    let marker: string | null = null
    try { marker = sessionStorage.getItem(BOUND_KEY) } catch { /* private mode */ }
    if (marker === code) return
    const session = getStoredSession()
    const token = (session as { access_token?: string } | null)?.access_token
    if (!token) return
    try { sessionStorage.setItem(BOUND_KEY, code) } catch { /* private mode */ }
    fetch('/api/affiliate/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    }).catch(() => {
      try { sessionStorage.removeItem(BOUND_KEY) } catch { /* ignore */ }
    })
  }, [pathname])

  return null
}

/**
 * Client component that captures ?ref=CODE from URL params.
 * Wrapped in Suspense since useSearchParams requires it in App Router.
 */
export default function ReferralTracker() {
  return (
    <Suspense fallback={null}>
      <ReferralTrackerInner />
    </Suspense>
  )
}
