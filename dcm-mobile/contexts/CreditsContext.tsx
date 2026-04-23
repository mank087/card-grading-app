import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { api } from '@/lib/api'

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
  const { session } = useAuth()
  const [balance, setBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!session) {
      setBalance(0)
      setIsLoading(false)
      return
    }
    try {
      const data = await api.get('/api/user/credits', session.access_token)
      setBalance(data.balance ?? 0)
    } catch {
      // Silently fail — balance stays at last known value
    } finally {
      setIsLoading(false)
    }
  }, [session])

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
