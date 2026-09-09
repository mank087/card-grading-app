import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'

interface CreditsContextType {
  balance: number
  isLoading: boolean
  refresh: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextType>({
  balance: 0,
  isLoading: true,
  refresh: async () => {},
})

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(0)
      setIsLoading(false)
      return
    }
    try {
      // Query user_credits table directly via Supabase (authenticated session)
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('[Credits] Supabase query error:', error.message)
        setBalance(0)
      } else {
        console.log('[Credits] Balance:', data?.balance)
        setBalance(data?.balance ?? 0)
      }
    } catch (err) {
      console.error('[Credits] Error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Android buys credits on the web /credits page inside a WebView and iOS
  // can complete a purchase while the app is backgrounded; neither path
  // tells this context anything. Re-read the balance whenever the app comes
  // back to the foreground so the header badge and the grade flow catch up.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh()
    })
    return () => sub.remove()
  }, [refresh])

  const value = useMemo(
    () => ({ balance, isLoading, refresh }),
    [balance, isLoading, refresh],
  )

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  )
}

export const useCredits = () => useContext(CreditsContext)
