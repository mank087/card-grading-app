import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'

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

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
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
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  const signOut = async () => {
    await clearAppCaches(user?.id)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
