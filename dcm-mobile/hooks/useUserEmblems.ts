import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const CACHE_KEY = 'dcm_user_emblems_cache'

export interface UserEmblems {
  showFounder: boolean
  showVip: boolean
  showCardLovers: boolean
  // Raw entitlement flags so consumers can render account settings if needed
  isFounder: boolean
  isVip: boolean
  isCardLover: boolean
  selectedEmblems: string[]
  loading: boolean
}

const DEFAULT: UserEmblems = {
  showFounder: false,
  showVip: false,
  showCardLovers: false,
  isFounder: false,
  isVip: false,
  isCardLover: false,
  selectedEmblems: [],
  loading: true,
}

function parseSelected(raw: string | null | undefined): string[] {
  if (!raw || raw === 'auto' || raw === 'none') return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * Loads the user's emblem entitlements + visibility toggles from user_credits
 * via Supabase (RLS allows self-read). Mirrors the web's eligibility logic:
 * an emblem renders only if (entitled) AND (badge toggled on) AND (selected in preferences).
 */
export function useUserEmblems(): UserEmblems {
  const { user } = useAuth()
  const [state, setState] = useState<UserEmblems>(DEFAULT)

  // Hydrate from cache for instant render
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(cached => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setState({ ...parsed, loading: true })
        } catch {}
      }
    })
  }, [])

  useEffect(() => {
    const userId = user?.id
    if (!userId) { setState(s => ({ ...s, loading: false })); return }

    let cancelled = false
    supabase
      .from('user_credits')
      .select('is_founder, is_vip, is_card_lover, show_founder_badge, show_vip_badge, show_card_lover_badge, preferred_label_emblem')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[useUserEmblems] fetch error:', error.message)
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

        const next: UserEmblems = {
          isFounder,
          isVip,
          isCardLover,
          selectedEmblems,
          showFounder: isFounder && showFounderBadge && selectedEmblems.includes('founder'),
          showVip: isVip && showVipBadge && selectedEmblems.includes('vip'),
          showCardLovers: isCardLover && showCardLoverBadge && selectedEmblems.includes('card_lover'),
          loading: false,
        }
        console.log('[useUserEmblems] loaded:', { selectedEmblems, isFounder, isVip, isCardLover })
        setState(next)
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...next, loading: false }))
      })

    return () => { cancelled = true }
  }, [user?.id])

  return state
}
