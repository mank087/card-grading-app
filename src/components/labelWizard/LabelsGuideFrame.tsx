'use client'

/**
 * Wraps the server-rendered /labels guide copy.
 *
 * - Signed out (and on the server): the guide renders open, so crawlers and
 *   first-time visitors get the full copy in the initial HTML.
 * - Signed in: collapsed into a closed "How Label Studio works" disclosure.
 *   The copy stays in the DOM either way.
 * - Org-scope members: hidden, since they're redirected to Brand Setup and
 *   can't use the flow the guide describes.
 *
 * Auth lives in localStorage, so the signed-in check runs after mount; until
 * then the server markup is kept as-is to avoid a hydration mismatch.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { getStoredSession } from '@/lib/directAuth'
import { useOrgContext } from '@/contexts/OrgContext'

export default function LabelsGuideFrame({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false)
  const { membership, membershipLoaded, isOrgScope } = useOrgContext()

  useEffect(() => {
    setSignedIn(Boolean(getStoredSession()?.user))
  }, [])

  if (membershipLoaded && isOrgScope && membership) return null

  if (!signedIn) return <>{children}</>

  return (
    <details className="dcm-labels-guide-collapsed border-t border-gray-200 bg-white">
      <summary className="max-w-6xl mx-auto px-4 sm:px-6 py-5 cursor-pointer text-sm font-semibold text-gray-700 hover:text-purple-700">
        How Label Studio works
      </summary>
      {children}
    </details>
  )
}
