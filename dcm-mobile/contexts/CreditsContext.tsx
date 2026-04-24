import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  return (
    <CreditsContext.Provider value={{ balance, isLoading, refresh }}>
      {children}
    </CreditsContext.Provider>
  )
}

export const useCredits = () => useContext(CreditsContext)
