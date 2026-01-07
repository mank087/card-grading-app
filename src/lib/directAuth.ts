// Direct authentication using fetch - bypasses Supabase client library
// This works around the "Invalid value" fetch error in the Supabase library

import { createClient, Session } from '@supabase/supabase-js'

// Get credentials from environment variables - NO HARDCODED FALLBACKS
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Custom localStorage key for our app's session storage
const SESSION_STORAGE_KEY = 'supabase.auth.token'

// Custom event name for auth state changes (works within same tab)
export const AUTH_STATE_CHANGE_EVENT = 'dcm-auth-state-change'

// Refresh token 5 minutes before expiry
const REFRESH_THRESHOLD_SECONDS = 5 * 60

// Track if refresh is in progress to prevent multiple simultaneous refreshes
let isRefreshing = false

// Track if session refresh interval is set up
let refreshIntervalId: NodeJS.Timeout | null = null

// Dispatch auth state change event (for same-tab updates)
function dispatchAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGE_EVENT))
  }
}

export interface AuthResponse {
  access_token?: string
  refresh_token?: string
  user?: any
  error?: string
}

type OAuthProvider = 'google' | 'facebook'

// Create a Supabase client for OAuth
// Using implicit flow (not PKCE) for simpler callback handling
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit'  // Use implicit flow - tokens come back in URL hash
  }
})

export async function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error_description || data.msg || 'Authentication failed' }
    }

    // Store tokens in localStorage for persistence
    if (typeof window !== 'undefined' && data.access_token) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        user: data.user
      }))
      // Notify other components of auth change
      dispatchAuthChange()
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user
    }
  } catch (err: any) {
    return { error: err.message || 'Network error' }
  }
}

export async function signUp(email: string, password: string): Promise<AuthResponse> {
  try {
    // Use Supabase client for signup to properly handle emailRedirectTo
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'https://www.dcmgrading.com/auth/callback'

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo
      }
    })

    if (error) {
      return { error: error.message || 'Sign up failed' }
    }

    // Supabase returns success even when user already exists (to prevent email enumeration)
    // But when user exists, the identities array is empty
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: 'User already registered' }
    }

    return {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: data.user
    }
  } catch (err: any) {
    return { error: err.message || 'Network error' }
  }
}

// Get raw stored session without auto-refresh (internal use)
function getStoredSessionRaw() {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

// Refresh the session using the refresh token
export async function refreshSession(): Promise<{ success: boolean; error?: string }> {
  if (isRefreshing) {
    console.log('[Auth] Refresh already in progress, skipping...')
    return { success: false, error: 'Refresh in progress' }
  }

  const session = getStoredSessionRaw()
  if (!session?.refresh_token) {
    console.log('[Auth] No refresh token available')
    return { success: false, error: 'No refresh token' }
  }

  isRefreshing = true
  console.log('[Auth] Refreshing session...')

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Auth] Refresh failed:', data.error_description || data.msg)
      // If refresh fails, clear the session - user needs to log in again
      localStorage.removeItem(SESSION_STORAGE_KEY)
      dispatchAuthChange()
      return { success: false, error: data.error_description || data.msg || 'Refresh failed' }
    }

    // Store the new tokens
    const newSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: data.user || session.user // Keep existing user if not returned
    }

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession))
    console.log('[Auth] Session refreshed successfully, new expiry:', new Date(data.expires_at * 1000).toLocaleString())
    dispatchAuthChange()

    return { success: true }
  } catch (err: any) {
    console.error('[Auth] Refresh error:', err)
    return { success: false, error: err.message || 'Network error' }
  } finally {
    isRefreshing = false
  }
}

// Check if session needs refresh (within threshold of expiry)
function sessionNeedsRefresh(session: any): boolean {
  if (!session?.expires_at) return false
  const now = Math.floor(Date.now() / 1000)
  const timeUntilExpiry = session.expires_at - now
  return timeUntilExpiry > 0 && timeUntilExpiry < REFRESH_THRESHOLD_SECONDS
}

// Check if session is expired
function sessionIsExpired(session: any): boolean {
  if (!session?.expires_at) return false
  return session.expires_at < Math.floor(Date.now() / 1000)
}

export function getStoredSession() {
  if (typeof window === 'undefined') return null

  try {
    const session = getStoredSessionRaw()
    if (!session) return null

    // Check if token is expired
    if (sessionIsExpired(session)) {
      console.log('[Auth] Session expired, clearing...')
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    // Check if token needs refresh (but don't block - refresh in background)
    if (sessionNeedsRefresh(session)) {
      console.log('[Auth] Session expiring soon, triggering background refresh...')
      refreshSession() // Fire and forget - don't await
    }

    return session
  } catch {
    return null
  }
}

// Get session with guaranteed fresh token (awaits refresh if needed)
export async function getValidSession() {
  if (typeof window === 'undefined') return null

  const session = getStoredSessionRaw()
  if (!session) return null

  // If expired, try to refresh
  if (sessionIsExpired(session)) {
    console.log('[Auth] Session expired, attempting refresh...')
    const result = await refreshSession()
    if (!result.success) {
      return null
    }
    return getStoredSessionRaw()
  }

  // If about to expire, refresh and wait
  if (sessionNeedsRefresh(session)) {
    console.log('[Auth] Session expiring soon, refreshing...')
    await refreshSession()
    return getStoredSessionRaw()
  }

  return session
}

// Initialize automatic session refresh
// Call this once when the app loads (e.g., in a layout or auth provider)
export function initSessionRefresh() {
  if (typeof window === 'undefined') return

  // Clear any existing interval
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId)
  }

  // Check session and refresh if needed every 1 minute
  refreshIntervalId = setInterval(() => {
    const session = getStoredSessionRaw()
    if (session && sessionNeedsRefresh(session)) {
      console.log('[Auth] Periodic check: session needs refresh')
      refreshSession()
    }
  }, 60 * 1000) // Check every minute

  // Also refresh on user activity (visibility change, focus)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const session = getStoredSessionRaw()
      if (session) {
        if (sessionIsExpired(session)) {
          console.log('[Auth] Tab became visible: session expired, refreshing...')
          refreshSession()
        } else if (sessionNeedsRefresh(session)) {
          console.log('[Auth] Tab became visible: session needs refresh')
          refreshSession()
        }
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Initial check on load
  const session = getStoredSessionRaw()
  if (session && sessionNeedsRefresh(session)) {
    console.log('[Auth] Initial check: session needs refresh')
    refreshSession()
  }

  console.log('[Auth] Session refresh monitoring initialized')
}

// Clean up session refresh (call on unmount if needed)
export function cleanupSessionRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId)
    refreshIntervalId = null
  }
}

export function signOut() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    // Also sign out from Supabase client (for OAuth sessions)
    supabaseClient.auth.signOut()
    // Notify other components of auth change
    dispatchAuthChange()
  }
}

// OAuth Sign In (Google, Facebook)
export async function signInWithOAuth(provider: OAuthProvider): Promise<{ error?: string }> {
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })

    if (error) {
      return { error: error.message }
    }

    // The user will be redirected to the OAuth provider
    return {}
  } catch (err: any) {
    return { error: err.message || 'OAuth sign in failed' }
  }
}

// Get the current OAuth session (after redirect)
export async function getOAuthSession() {
  try {
    console.log('[OAuth] Getting session from Supabase...')

    // For implicit flow, tokens are in the URL hash
    // Supabase client with detectSessionInUrl:true should parse them automatically
    // But we need to give it a moment to process

    // First, check if there are tokens in the URL hash
    if (typeof window !== 'undefined' && window.location.hash) {
      console.log('[OAuth] URL hash detected, parsing tokens...')
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const expiresIn = hashParams.get('expires_in')

      if (accessToken) {
        console.log('[OAuth] Found access_token in URL hash')

        // Get user info from Supabase using the token
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(accessToken)

        if (userError) {
          console.error('[OAuth] Error getting user:', userError)
          return { error: userError.message }
        }

        if (user) {
          console.log('[OAuth] User retrieved:', user.email)

          // Calculate expires_at
          const expiresAt = Math.floor(Date.now() / 1000) + (parseInt(expiresIn || '3600'))

          // Store session in our custom localStorage key
          const sessionData = {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            user: user
          }

          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
          console.log('[OAuth] Session stored successfully in localStorage')
          // Notify other components of auth change
          dispatchAuthChange()

          // Clear the hash from URL to prevent re-processing
          window.history.replaceState(null, '', window.location.pathname)

          return { session: sessionData }
        }
      }
    }

    // Fallback: try to get session from Supabase client
    console.log('[OAuth] No hash tokens, checking Supabase client session...')
    const { data: { session }, error } = await supabaseClient.auth.getSession()

    if (error) {
      console.error('[OAuth] Session error:', error)
      return { error: error.message }
    }

    // Store the session in localStorage for consistency with email/password auth
    if (session && typeof window !== 'undefined') {
      console.log('[OAuth] Session found from Supabase client, storing in localStorage...')
      console.log('[OAuth] User:', session.user?.email)
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600, // Default 1 hour if not provided
        user: session.user
      }))
      console.log('[OAuth] Session stored successfully')
      // Notify other components of auth change
      dispatchAuthChange()
      return { session }
    } else {
      console.warn('[OAuth] No session found')
      return { error: 'No session found. Please try again.' }
    }
  } catch (err: any) {
    console.error('[OAuth] Exception:', err)
    return { error: err.message || 'Failed to get session' }
  }
}

// Get authenticated Supabase client with stored session
export function getAuthenticatedClient() {
  const session = getStoredSession()

  // Import createClient dynamically to avoid module issues
  const { createClient } = require('@supabase/supabase-js')

  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : {}
      }
    }
  )
}

// Send password reset email
export async function resetPasswordForEmail(email: string): Promise<{ error?: string }> {
  try {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : 'https://www.dcmgrading.com/reset-password'

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo
    })

    if (error) {
      return { error: error.message }
    }

    return {}
  } catch (err: any) {
    return { error: err.message || 'Failed to send reset email' }
  }
}

// Update user's password (after clicking reset link)
export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    })

    if (error) {
      return { error: error.message }
    }

    return {}
  } catch (err: any) {
    return { error: err.message || 'Failed to update password' }
  }
}

// Set session from URL (for password reset flow)
export async function setSessionFromUrl(): Promise<{ error?: string }> {
  try {
    // Check for tokens in URL hash (Supabase sends them there for password reset)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (accessToken && type === 'recovery') {
        console.log('[Auth] Recovery token found in URL, setting session...')

        const { data, error } = await supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        })

        if (error) {
          return { error: error.message }
        }

        // Store session
        if (data.session) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: data.session.user
          }))
          dispatchAuthChange()
        }

        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname)

        return {}
      }
    }

    return { error: 'No recovery token found' }
  } catch (err: any) {
    return { error: err.message || 'Failed to set session' }
  }
}
