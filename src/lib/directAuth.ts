// Direct authentication using fetch - bypasses Supabase client library
// This works around the "Invalid value" fetch error in the Supabase library

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zyxtqcvwkbpvsjsszbzg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eHRxY3Z3a2JwdnNqc3N6YnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NjI2NTUsImV4cCI6MjA3MzUzODY1NX0.-U0WoZvZSPpbeZ6w4H9t3MH3EsIkMO_hs4CKB9sJ858'

export interface AuthResponse {
  access_token?: string
  refresh_token?: string
  user?: any
  error?: string
}

type OAuthProvider = 'google' | 'facebook'

// Create a Supabase client for OAuth (OAuth requires the client library)
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
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
      localStorage.setItem('supabase.auth.token', JSON.stringify({
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
    const stored = localStorage.getItem('supabase.auth.token')
    if (!stored) return null

    const session = JSON.parse(stored)

    // Check if token is expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      localStorage.removeItem('supabase.auth.token')
      return null
    }

    return session
  } catch {
    return null
  }
}

export function signOut() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('supabase.auth.token')
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
    const { data: { session }, error } = await supabaseClient.auth.getSession()

    if (error) {
      return { error: error.message }
    }

    // Store the session in localStorage for consistency with email/password auth
    if (session && typeof window !== 'undefined') {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(new Date(session.expires_at!).getTime() / 1000),
        user: session.user
      }))
    }

    return { session }
  } catch (err: any) {
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
