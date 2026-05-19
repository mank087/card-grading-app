import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { Platform } from 'react-native'
import { Session, User } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { setUserId as setAnalyticsUserId } from '@/lib/analytics'

// Server-side handle_new_user() trigger reads this from raw_user_meta_data
// and writes it to public.users.signup_source so the admin revenue/analytics
// dashboards can show "X% of users came from mobile."
const SIGNUP_PLATFORM = Platform.OS === 'ios' ? 'ios_app'
  : Platform.OS === 'android' ? 'android_app'
  : 'web' // expo web fallback

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

// Best-effort OAuth attribution upgrade. Idempotent + safe — the server
// only flips signup_source if the row is still 'web' AND the user was
// created within the last 60 minutes.
async function tagSignupSource(accessToken: string): Promise<void> {
  if (SIGNUP_PLATFORM === 'web') return // Expo Web — server defaults are correct
  await fetch(`${API_BASE}/api/auth/tag-signup-source`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Client-Platform': SIGNUP_PLATFORM,
      'Content-Type': 'application/json',
    },
  })
}

// Sentry — wrapped in try/catch like everywhere else (Expo Go lacks the
// native module). When available, tag every captured exception with the
// Supabase user ID so crashes can be triaged per-user without PII.
let Sentry: any = null
try {
  Sentry = require('@sentry/react-native')
} catch {
  /* Expo Go path */
}
function setSentryUser(userId: string | null) {
  if (!Sentry?.setUser) return
  try {
    Sentry.setUser(userId ? { id: userId } : null)
  } catch (e) {
    if (__DEV__) console.warn('[Sentry] setUser failed:', e)
  }
}

// App-owned cache keys cleared on sign-out so account-switching on a shared
// device doesn't leak the previous user's collection, label preferences, or
// queued grades. Supabase's own `sb-*-auth-token` keys are managed by its SDK
// and intentionally left alone — supabase.auth.signOut handles those.
const APP_CACHE_KEYS = [
  'dcm_label_style_cache',
  'dcm_user_emblems_cache',
  'dcm_grading_queue',
  'dcm_hide_photo_tips',
  'dcm_avery6871_last_pos',
  'dcm_avery8167_last_pos',
  'dcm_avery8167_pairs_last_pos',
] as const

async function clearAppCaches(userId: string | undefined) {
  try {
    const keys = userId
      ? [...APP_CACHE_KEYS, `dcm_collection_cache_${userId}`]
      : [...APP_CACHE_KEYS]
    await AsyncStorage.multiRemove(keys as string[])
  } catch {
    // Best-effort — never block sign-out on cache failures.
  }
}

interface SignUpResult {
  error: any
  /** Supabase silently returns success when signUp is called with an
   *  email that already exists (anti-enumeration behavior). The signal is
   *  `data.user.identities` being empty. We surface that here so the UI
   *  can route the user to the login screen instead of telling them to
   *  check their inbox for a confirmation that won't arrive. */
  existingAccount: boolean
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, existingAccount: false }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
      // Tag analytics with the Supabase user ID so GA4 can compute
      // cohorts and Meta can attribute conversions to this user. Same
      // ID flows to Sentry so crash reports carry the affected user.
      setAnalyticsUserId(session?.user?.id ?? null)
      setSentryUser(session?.user?.id ?? null)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
      setAnalyticsUserId(session?.user?.id ?? null)
      setSentryUser(session?.user?.id ?? null)

      // OAuth sign-ups (Apple, Google, Facebook) can't pass user metadata
      // through signInWithIdToken / signInWithOAuth, so the
      // handle_new_user trigger defaults their signup_source to 'web'.
      // The /api/auth/tag-signup-source endpoint upgrades it to
      // ios_app/android_app, but only for users created in the last 60
      // minutes — safe to spray on every SIGNED_IN event without harming
      // long-time users who later sign into the mobile app.
      if (event === 'SIGNED_IN' && session?.access_token) {
        tagSignupSource(session.access_token).catch((err) => {
          if (__DEV__) console.warn('[Auth] tag-signup-source failed:', err)
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { signup_platform: SIGNUP_PLATFORM } },
    })
    // Supabase 2.x: existing user → no error, but identities array is
    // empty (the user object is a stub for anti-enumeration). New user →
    // identities has at least one entry. Either way, surface the signal.
    const existingAccount = !error && Array.isArray(data?.user?.identities) && data.user.identities.length === 0
    return { error, existingAccount }
  }

  const signOut = async () => {
    await clearAppCaches(user?.id)
    await supabase.auth.signOut()
  }

  // Memoize the context value so consumers don't re-render every time
  // an unrelated parent state changes — only when the actual auth
  // primitives change. signIn/signUp/signOut are stable closures
  // recreated each render, but they only matter for their identity
  // when consumers depend on it; consumers of this context are the
  // entire app, so cheap stability here cuts the cascade significantly.
  const value = useMemo(
    () => ({ user, session, isLoading, signIn, signUp, signOut }),
    [user, session, isLoading],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
