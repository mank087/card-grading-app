import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'

interface CreditsContextType {
  balance: number
  isLoading: boolean
  error: string | null
  hasBalance: boolean
  refresh: () => Promise<void>
}
const CreditsContext = createContext<CreditsContextType>({ balance: 0, isLoading: true, error: null, hasBalance: false, refresh: async () => {} })

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const owner = user?.id ?? null
  const ownerRef = useRef(owner)
  ownerRef.current = owner
  const request = useRef(0)
  const [state, setState] = useState({ owner, balance: 0, isLoading: true, error: null as string | null, hasBalance: false })
  const refresh = useCallback(async () => {
    const sequence = ++request.current
    if (!owner) {
      setState({ owner, balance: 0, isLoading: false, error: null, hasBalance: false })
      return
    }
    setState(prev => prev.owner === owner ? { ...prev, isLoading: true } : { owner, balance: 0, isLoading: true, error: null, hasBalance: false })
    try {
      const { data, error } = await supabase.from('user_credits').select('balance').eq('user_id', owner).single()
      if (error) throw error
      if (typeof data?.balance !== 'number' || !Number.isFinite(data.balance)) throw Error('Invalid balance')
      if (sequence !== request.current || ownerRef.current !== owner) return
      setState({ owner, balance: data.balance, isLoading: false, error: null, hasBalance: true })
    } catch {
      if (sequence !== request.current || ownerRef.current !== owner) return
      setState(prev => ({ ...prev, isLoading: false, error: 'Credit balance unavailable. Tap to retry.' }))
    }
  }, [owner])
  useEffect(() => { void refresh(); return () => { request.current++ } }, [refresh])
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => { if (next === 'active') void refresh() })
    return () => sub.remove()
  }, [refresh])
  // An account switch must never render the previous account's cached balance.
  const value = useMemo(() => ({
    balance: state.owner === owner ? state.balance : 0,
    isLoading: state.owner !== owner || state.isLoading,
    error: state.owner === owner ? state.error : null,
    hasBalance: state.owner === owner && state.hasBalance,
    refresh,
  }), [state, owner, refresh])
  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>
}
export const useCredits = () => useContext(CreditsContext)
