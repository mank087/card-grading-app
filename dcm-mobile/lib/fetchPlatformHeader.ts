/**
 * Monkey-patches global.fetch ONCE at app startup so every outbound request
 * to the DCM API origin carries an `X-Client-Platform` header
 * ('ios_app' | 'android_app'). The server reads this in:
 *
 *   • /api/auth/tag-signup-source — to back-fill OAuth signup attribution
 *   • the 8 card-type grading routes — to set cards.graded_from
 *   • future routes that want to log platform mix
 *
 * Doing this once globally is safer than threading the header through 9
 * separate fetch call sites (lib/api.ts, lib/ebayApi.ts, card/[id].tsx,
 * grade/review.tsx, account.tsx, label-studio.tsx, contact.tsx, etc.) —
 * any future fetch added without thinking about the header will still be
 * tagged correctly. Requests to non-DCM origins (Supabase auth, Stripe in
 * Expo Go, etc.) are passed through untouched.
 */

import { Platform } from 'react-native'

const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com').replace(/\/$/, '')

const CLIENT_PLATFORM = Platform.OS === 'ios' ? 'ios_app'
  : Platform.OS === 'android' ? 'android_app'
  : 'web'

let installed = false

export function installPlatformHeaderFetchPatch(): void {
  if (installed) return
  installed = true

  const originalFetch = global.fetch
  global.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url
      if (url && url.startsWith(API_ORIGIN)) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
        if (!headers.has('X-Client-Platform')) {
          headers.set('X-Client-Platform', CLIENT_PLATFORM)
        }
        return originalFetch(input, { ...init, headers })
      }
    } catch {
      // Header injection is best-effort — never break a request because we
      // couldn't tag it.
    }
    return originalFetch(input, init)
  }) as typeof fetch
}
