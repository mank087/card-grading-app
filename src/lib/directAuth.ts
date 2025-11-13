// Direct authentication using fetch - bypasses Supabase client library
// This works around the "Invalid value" fetch error in the Supabase library

const SUPABASE_URL = 'https://zyxtqcvwkbpvsjsszbzg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eHRxY3Z3a2JwdnNqc3N6YnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NjI2NTUsImV4cCI6MjA3MzUzODY1NX0.-U0WoZvZSPpbeZ6w4H9t3MH3EsIkMO_hs4CKB9sJ858'

export interface AuthResponse {
  access_token?: string
  refresh_token?: string
  user?: any
  error?: string
}

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
  }
}
