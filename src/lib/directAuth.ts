// Direct authentication using fetch - bypasses Supabase client library
// This works around the "Invalid value" fetch error in the Supabase library

import { createClient, Session } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zyxtqcvwkbpvsjsszbzg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eHRxY3Z3a2JwdnNqc3N6YnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NjI2NTUsImV4cCI6MjA3MzUzODY1NX0.-U0WoZvZSPpbeZ6w4H9t3MH3EsIkMO_hs4CKB9sJ858'

// Custom localStorage key for our app's session storage
const SESSION_STORAGE_KEY = 'supabase.auth.token'

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
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
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
      return { error: data.error_description || data.msg || 'Sign up failed' }
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

export function getStoredSession() {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) return null

    const session = JSON.parse(stored)

    // Check if token is expired
    if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
      console.log('[Auth] Session expired, clearing...')
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    return session
  } catch {
    return null
  }
}

export function signOut() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    // Also sign out from Supabase client (for OAuth sessions)
    supabaseClient.auth.signOut()
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
