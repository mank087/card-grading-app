/**
 * Resolves the platform a request came from based on headers.
 *
 * Mobile clients send `X-Client-Platform: ios_app | android_app` via the
 * global fetch interceptor in dcm-mobile/lib/fetchPlatformHeader.ts. Web
 * requests don't send the header, so we default to 'web'.
 *
 * Used by:
 *   • Card grading routes — to set cards.graded_from at grading time
 *   • Anywhere else that wants to know "did this come from mobile?"
 */

import type { NextRequest } from 'next/server'

export type GradedFrom = 'web' | 'ios_app' | 'android_app'

const VALID: ReadonlySet<GradedFrom> = new Set<GradedFrom>(['web', 'ios_app', 'android_app'])

export function resolveGradedFrom(request: NextRequest): GradedFrom {
  const raw = request.headers.get('x-client-platform') || ''
  const normalized = raw.toLowerCase() as GradedFrom
  if (VALID.has(normalized)) return normalized
  return 'web'
}
