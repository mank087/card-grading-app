/**
 * EmblemsContext — single source of truth for the user's label badge
 * preferences (Founder ★ / VIP ◆ / Card Lovers ♥).
 *
 * Replaces the per-consumer useUserEmblems hook that fetched independently.
 * Now there's one Supabase fetch on app start, one cached state, and a
 * setter that all consumers see immediately. Toggling a badge in the
 * picker (label-studio or my account web view) updates state synchronously
 * AND persists to user_credits.preferred_label_emblem in the background,
 * so every other consumer (slab gallery tiles, card detail, collection
 * cards) re-renders with the new selection on the next frame.
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const CACHE_KEY = 'dcm_user_emblems_cache'

export type EmblemKey = 'founder' | 'vip' | 'card_lover'

export interface EmblemsState {
  showFounder: boolean
  showVip: boolean
  showCardLovers: boolean
  isFounder: boolean
  isVip: boolean
  isCardLover: boolean
  selectedEmblems: string[]
  loading: boolean
}

interface EmblemsContextValue extends EmblemsState {
  /** Toggle a badge on/off. Returns true if the change was applied (e.g.
   *  rejected when at the 2-badge max trying to add a 3rd). */
  setEmblemSelected: (key: EmblemKey, on: boolean) => boolean
  refresh: () => Promise<void>
}

const DEFAULT: EmblemsState = {
  showFounder: false,
  showVip: false,
  showCardLovers: false,
  isFounder: false,
  isVip: false,
  isCardLover: false,
  selectedEmblems: [],
  loading: true,
}

const EmblemsContext = createContext<EmblemsContextValue>({
  ...DEFAULT,
  setEmblemSelected: () => false,
  refresh: async () => {},
})

const MAX_BADGES = 2

function parseSelected(raw: string | null | undefined): string[] {
  if (!raw || raw === 'auto' || raw === 'none') return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function deriveShowFlags(state: Pick<EmblemsState, 'isFounder' | 'isVip' | 'isCardLover' | 'selectedEmblems'>) {
  return {
    showFounder: state.isFounder && state.selectedEmblems.includes('founder'),
    showVip: state.isVip && state.selectedEmblems.includes('vip'),
    showCardLovers: state.isCardLover && state.selectedEmblems.includes('card_lover'),
  }
}

export function EmblemsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<EmblemsState>(DEFAULT)

  // Hydrate from cache for instant first paint
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(cached => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as EmblemsState
          setState({ ...parsed, loading: true })
        } catch {}
      }
    })
  }, [])

  const fetchFromServer = useCallback(async () => {
    const userId = user?.id
    if (!userId) {
      setState(s => ({ ...s, loading: false }))
      return
    }
    const { data, error } = await supabase
      .from('user_credits')
      .select('is_founder, is_vip, is_card_lover, show_founder_badge, show_vip_badge, show_card_lover_badge, preferred_label_emblem')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[EmblemsContext] fetch error:', error.message)
      setState(s => ({ ...s, loading: false }))
      return
    }
    const isFounder = !!data?.is_founder
    const isVip = !!data?.is_vip
    const isCardLover = !!data?.is_card_lover
    const showFounderBadge = data?.show_founder_badge !== false
    const showVipBadge = data?.show_vip_badge !== false
    const showCardLoverBadge = data?.show_card_lover_badge !== false
    const selectedEmblems = parseSelected(data?.preferred_label_emblem)
    const next: EmblemsState = {
      isFounder,
      isVip,
      isCardLover,
      selectedEmblems,
      showFounder: isFounder && showFounderBadge && selectedEmblems.includes('founder'),
      showVip: isVip && showVipBadge && selectedEmblems.includes('vip'),
      showCardLovers: isCardLover && showCardLoverBadge && selectedEmblems.includes('card_lover'),
      loading: false,
    }
    setState(next)
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...next, loading: false })).catch(() => {})
  }, [user?.id])

  useEffect(() => { fetchFromServer() }, [fetchFromServer])

  const setEmblemSelected = useCallback((key: EmblemKey, on: boolean): boolean => {
    let applied = true
    setState(prev => {
      const set = new Set(prev.selectedEmblems)
      if (on) {
        if (set.has(key)) return prev
        if (set.size >= MAX_BADGES) {
          applied = false
          return prev
        }
        set.add(key)
      } else {
        if (!set.has(key)) return prev
        set.delete(key)
      }
      const selectedEmblems = Array.from(set)
      const showFlags = deriveShowFlags({
        isFounder: prev.isFounder,
        isVip: prev.isVip,
        isCardLover: prev.isCardLover,
        selectedEmblems,
      })
      const next: EmblemsState = {
        ...prev,
        selectedEmblems,
        ...showFlags,
      }
      // Persist + refresh cache (fire-and-forget; UI already updated)
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...next, loading: false })).catch(() => {})
      const csv = selectedEmblems.join(',')
      if (user?.id) {
        supabase
          .from('user_credits')
          .update({ preferred_label_emblem: csv || 'none' })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.warn('[EmblemsContext] save error:', error.message)
          })
      }
      return next
    })
    return applied
  }, [user?.id])

  const value = useMemo(
    () => ({ ...state, setEmblemSelected, refresh: fetchFromServer }),
    [state, setEmblemSelected, fetchFromServer],
  )

  return (
    <EmblemsContext.Provider value={value}>
      {children}
    </EmblemsContext.Provider>
  )
}

export function useUserEmblems(): EmblemsContextValue {
  return useContext(EmblemsContext)
}
