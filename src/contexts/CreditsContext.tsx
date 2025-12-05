'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getStoredSession, AUTH_STATE_CHANGE_EVENT } from '@/lib/directAuth'

interface CreditsContextType {
  balance: number
  isLoading: boolean
  isFirstPurchase: boolean
  refreshCredits: () => Promise<void>
  deductLocalCredit: () => void
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined)

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFirstPurchase, setIsFirstPurchase] = useState(true)

  const refreshCredits = useCallback(async () => {
    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        setBalance(0)
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/stripe/credits', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setBalance(data.balance)
        setIsFirstPurchase(data.firstPurchaseBonusAvailable)
      } else {
        // If 401, user might not be logged in
        setBalance(0)
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Optimistically deduct a credit locally (actual deduction happens server-side)
  const deductLocalCredit = useCallback(() => {
    setBalance(prev => Math.max(0, prev - 1))
  }, [])

  // Fetch credits on mount and when auth changes
  useEffect(() => {
    refreshCredits()

    // Listen for storage events (auth changes from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.token') {
        refreshCredits()
      }
    }

    // Listen for custom auth event (auth changes from same tab)
    const handleAuthChange = () => {
      console.log('[CreditsContext] Auth state changed, refreshing credits...')
      refreshCredits()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange)
    }
  }, [refreshCredits])

  // Also refresh when window gains focus (in case user completed purchase in another tab)
  useEffect(() => {
    const handleFocus = () => {
      refreshCredits()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refreshCredits])

  return (
    <CreditsContext.Provider
      value={{
        balance,
        isLoading,
        isFirstPurchase,
        refreshCredits,
        deductLocalCredit,
      }}
    >
      {children}
    </CreditsContext.Provider>
  )
}

export function useCredits() {
  const context = useContext(CreditsContext)
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider')
  }
  return context
}
