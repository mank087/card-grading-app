import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

  // Load from Supabase directly (RLS lets users read their own row in user_credits)
  useEffect(() => {
    const userId = user?.id
    if (!userId) { setLoading(false); return }

    let cancelled = false
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

    return () => { cancelled = true }
  }, [user?.id])

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

  const activeConfig = customStyles.find(s => s.id === labelStyle)?.config || null
  const colorOverrides = extractColorOverrides(activeConfig)

  return { labelStyle, customStyles, colorOverrides, loading, switchStyle }
}
