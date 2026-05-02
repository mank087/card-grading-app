import { useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export type LabelStyleId = 'modern' | 'traditional' | 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4'

export interface CustomLabelConfig {
  colorPreset?: string
  gradientStart: string
  gradientEnd: string
  borderEnabled?: boolean
  borderColor?: string
  borderWidth?: number
  topEdgeGradient?: string[]
}

export interface SavedCustomStyle {
  id: string
  name: string
  config: CustomLabelConfig
}

export interface LabelColorOverrides {
  gradientStart: string
  gradientEnd: string
  borderEnabled: boolean
  borderColor: string
  isRainbow?: boolean
  isNeonOutline?: boolean
  isCardExtension?: boolean
  topEdgeGradient?: string[]
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
const CACHE_KEY = 'dcm_label_style_cache'

function extractColorOverrides(config: CustomLabelConfig | null | undefined): LabelColorOverrides | undefined {
  if (!config) return undefined
  return {
    gradientStart: config.gradientStart,
    gradientEnd: config.gradientEnd,
    borderEnabled: config.borderEnabled ?? false,
    borderColor: config.borderColor || config.gradientEnd,
    isRainbow: config.colorPreset === 'rainbow',
    isNeonOutline: config.colorPreset === 'neon-outline',
    isCardExtension: config.colorPreset === 'card-extension',
    topEdgeGradient: config.topEdgeGradient,
  }
}

export function useLabelStyle() {
  const { session, user } = useAuth()
  const [labelStyle, setLabelStyle] = useState<LabelStyleId>('modern')
  const [customStyles, setCustomStyles] = useState<SavedCustomStyle[]>([])
  const [loading, setLoading] = useState(true)

  // Hydrate from cache for instant render
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(cached => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.labelStyle) setLabelStyle(parsed.labelStyle)
          if (Array.isArray(parsed.customStyles)) setCustomStyles(parsed.customStyles)
        } catch {}
      }
    })
  }, [])

  // Fetch the user's current saved label_style + custom_label_styles from
  // Supabase. Wrapped so we can call it on initial mount AND on screen focus
  // — without a refetch, a custom style saved on one screen (Label Studio)
  // wouldn't appear in the picker on another screen (Collection) until the
  // app was fully reloaded, since each useLabelStyle call mounts its own
  // local state.
  const fetchRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const userId = user?.id
    if (!userId) { setLoading(false); return }

    let cancelled = false
    const fetchStyles = () => {
      supabase
        .from('user_credits')
        .select('label_style, custom_label_styles')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            console.warn('[useLabelStyle] supabase fetch error:', error.message)
            setLoading(false)
            return
          }
          const next = {
            labelStyle: ((data?.label_style as LabelStyleId) || 'modern'),
            customStyles: (Array.isArray(data?.custom_label_styles) ? data.custom_label_styles : []) as SavedCustomStyle[],
          }
          console.log('[useLabelStyle] loaded:', next.labelStyle, `(${next.customStyles.length} custom)`)
          setLabelStyle(next.labelStyle)
          setCustomStyles(next.customStyles)
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next))
          setLoading(false)
        })
    }

    fetchRef.current = fetchStyles
    fetchStyles()
    return () => { cancelled = true; fetchRef.current = null }
  }, [user?.id])

  // Refetch when the screen using this hook gains focus — picks up new
  // styles saved in another screen since this one was last visible.
  useFocusEffect(
    useCallback(() => {
      // Re-read cache first for instant update, then fetch from server.
      AsyncStorage.getItem(CACHE_KEY).then(cached => {
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (Array.isArray(parsed.customStyles)) setCustomStyles(parsed.customStyles)
            if (parsed.labelStyle) setLabelStyle(parsed.labelStyle)
          } catch {}
        }
      })
      fetchRef.current?.()
    }, []),
  )

  const switchStyle = useCallback(async (id: LabelStyleId) => {
    setLabelStyle(id)
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ labelStyle: id, customStyles }))
    const token = session?.access_token
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/user/label-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ labelStyle: id }),
      })
      if (!res.ok) {
        const errBody = await res.text()
        console.warn('[useLabelStyle] switchStyle non-OK:', res.status, errBody)
      }
    } catch (err) {
      console.warn('[useLabelStyle] switchStyle network error:', err)
    }
  }, [session?.access_token, customStyles])

  // Save (create or update) a custom style. Mirrors web's useCustomLabelStyle.saveCustomStyle.
  // The server slot-assigns a custom-N id when one isn't passed.
  const saveCustomStyle = useCallback(async (style: { id?: string; name: string; config: CustomLabelConfig }): Promise<SavedCustomStyle | null> => {
    const token = session?.access_token
    if (!token) return null
    try {
      const res = await fetch(`${API_BASE}/api/user/label-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'save', style }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || !data.success) {
        console.warn('[useLabelStyle] saveCustomStyle failed:', data.error || res.status)
        return null
      }
      if (Array.isArray(data.customStyles)) setCustomStyles(data.customStyles)
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ labelStyle, customStyles: data.customStyles ?? customStyles }))
      return data.savedStyle ?? null
    } catch (err) {
      console.warn('[useLabelStyle] saveCustomStyle network error:', err)
      return null
    }
  }, [session?.access_token, labelStyle, customStyles])

  const deleteCustomStyle = useCallback(async (id: string): Promise<boolean> => {
    const token = session?.access_token
    if (!token) return false
    try {
      const res = await fetch(`${API_BASE}/api/user/label-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', styleId: id }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || !data.success) return false
      if (Array.isArray(data.customStyles)) setCustomStyles(data.customStyles)
      if (data.labelStyle) setLabelStyle(data.labelStyle)
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        labelStyle: data.labelStyle ?? labelStyle,
        customStyles: data.customStyles ?? customStyles,
      }))
      return true
    } catch (err) {
      console.warn('[useLabelStyle] deleteCustomStyle network error:', err)
      return false
    }
  }, [session?.access_token, labelStyle, customStyles])

  const renameCustomStyle = useCallback(async (id: string, name: string): Promise<boolean> => {
    const token = session?.access_token
    if (!token) return false
    try {
      const res = await fetch(`${API_BASE}/api/user/label-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'rename', styleId: id, name }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || !data.success) return false
      if (Array.isArray(data.customStyles)) setCustomStyles(data.customStyles)
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ labelStyle, customStyles: data.customStyles ?? customStyles }))
      return true
    } catch (err) {
      console.warn('[useLabelStyle] renameCustomStyle network error:', err)
      return false
    }
  }, [session?.access_token, labelStyle, customStyles])

  const activeConfig = customStyles.find(s => s.id === labelStyle)?.config || null
  const colorOverrides = extractColorOverrides(activeConfig)

  return { labelStyle, customStyles, activeConfig, colorOverrides, loading, switchStyle, saveCustomStyle, deleteCustomStyle, renameCustomStyle }
}
