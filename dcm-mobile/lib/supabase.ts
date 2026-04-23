import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Use AsyncStorage instead of SecureStore for Supabase session persistence.
// SecureStore has a 2048 byte limit on Android which truncates the session JSON.
// AsyncStorage has no size limit and works reliably for auth tokens.
const AsyncStorageAdapter = {
  getItem: (key: string) => {
    return AsyncStorage.getItem(key)
  },
  setItem: (key: string, value: string) => {
    AsyncStorage.setItem(key, value)
  },
  removeItem: (key: string) => {
    AsyncStorage.removeItem(key)
  },
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorageAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
