'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const REF_CODE_KEY = 'dcm_ref_code'
const REF_TIMESTAMP_KEY = 'dcm_ref_timestamp'
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * Get the stored referral code from localStorage (if still within attribution window)
 */
export function getStoredRefCode(): string | null {
  if (typeof window === 'undefined') return null

  const code = localStorage.getItem(REF_CODE_KEY)
  const timestamp = localStorage.getItem(REF_TIMESTAMP_KEY)

  if (!code || !timestamp) return null

  // Check if the code has expired
  const storedTime = parseInt(timestamp, 10)
  if (Date.now() - storedTime > ATTRIBUTION_WINDOW_MS) {
    // Expired — clean up
    localStorage.removeItem(REF_CODE_KEY)
    localStorage.removeItem(REF_TIMESTAMP_KEY)
    return null
  }

  return code
}

/**
 * Inner component that reads search params (requires Suspense boundary)
 */
function ReferralTrackerInner() {
  const searchParams = useSearchParams()

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
          // Store in localStorage
          localStorage.setItem(REF_CODE_KEY, code)
          localStorage.setItem(REF_TIMESTAMP_KEY, Date.now().toString())

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
