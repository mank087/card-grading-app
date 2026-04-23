import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

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
    if (!session?.access_token) {
      setBalance(0)
      setIsLoading(false)
      return
    }
    try {
      console.log('[Credits] Fetching with token:', session.access_token.substring(0, 20) + '...')
      const response = await fetch(`${API_BASE}/api/stripe/credits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      console.log('[Credits] Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('[Credits] Balance:', data.balance)
        setBalance(data.balance ?? 0)
      } else {
        const errorText = await response.text()
        console.error('[Credits] Error response:', errorText)
      }
    } catch (err) {
      console.error('[Credits] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [session?.access_token])

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
