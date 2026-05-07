/**
 * completeOAuthFromUrl — handle every shape of OAuth callback URL that
 * Supabase + the configured provider can return on mobile.
 *
 * Supabase 2.x defaults to PKCE flow, which surfaces an authorization
 * `code` param that needs to be exchanged for a session via
 * exchangeCodeForSession(). Older / implicit flows surface
 * `access_token` + `refresh_token` directly, which can be handed to
 * setSession() as-is. Some providers also redirect with `error` /
 * `error_description` query params on user-rejected or invalid-redirect
 * cases — we forward those to the caller so they can show a real
 * message instead of a silent no-op.
 *
 * Used by both /(auth)/login.tsx and /(auth)/register.tsx for the
 * Google + Facebook OAuth handlers.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface OAuthCompleteResult {
  ok: boolean
  error?: string
  /** Which path actually succeeded — for log/debug only */
  flow?: 'pkce' | 'implicit'
}

export async function completeOAuthFromUrl(
  rawUrl: string,
  supabase: SupabaseClient,
): Promise<OAuthCompleteResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, error: 'Got back an unexpected URL from the sign-in flow.' }
  }

  // Some Supabase callbacks put params in the hash, others in the
  // query string. Read both into one map.
  const hash = parsed.hash?.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  const search = parsed.search?.startsWith('?') ? parsed.search.slice(1) : parsed.search
  const merged = new URLSearchParams()
  if (search) new URLSearchParams(search).forEach((v, k) => merged.set(k, v))
  if (hash) new URLSearchParams(hash).forEach((v, k) => merged.set(k, v))

  // Provider error short-circuit — surface it instead of silently failing
  const errParam = merged.get('error') || merged.get('error_code')
  if (errParam) {
    const description = merged.get('error_description') || merged.get('error_message') || errParam
    return { ok: false, error: decodeURIComponent(description.replace(/\+/g, ' ')) }
  }

  // PKCE flow — auth code that must be exchanged for a session
  const code = merged.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return { ok: false, error: error.message }
    return { ok: true, flow: 'pkce' }
  }

  // Implicit flow — tokens already issued, hand them to setSession
  const accessToken = merged.get('access_token')
  const refreshToken = merged.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, flow: 'implicit' }
  }

  // Returned URL had no code, no tokens, no error — that means the
  // user dismissed the sheet or the provider redirected somewhere we
  // weren't expecting.
  return { ok: false, error: 'Sign-in didn\'t complete. Please try again.' }
}
