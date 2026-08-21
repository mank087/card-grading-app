import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { HERITAGE_BRAND_COLORS } from '@/lib/heritage'

// Custom slots run 'custom-1'..`custom-${MAX_SAVED_LABEL_STYLES}` — the
// template type accepts any slot number; the server validates the range.
export type LabelStyleId = 'modern' | 'traditional' | 'heritage' | `custom-${number}`

/** Saved-design slot cap — mirrors web src/lib/labelPresets.ts (Aug 2026: 4 → 12). */
export const MAX_SAVED_LABEL_STYLES = 12

export interface CustomLabelConfig {
  colorPreset?: string
  gradientStart: string
  gradientEnd: string
  borderEnabled?: boolean
  borderColor?: string
  borderWidth?: number
  topEdgeGradient?: string[]
  /** 'light' | 'dark' force the text polarity; 'auto'/absent = WCAG pick. */
  textColorMode?: 'auto' | 'light' | 'dark'
  /** 'heritage' marks the Round 3 ivory design; other values are modern/traditional. */
  style?: string
  /** Heritage-only fields (mirror web CustomLabelConfig). */
  heritagePattern?: string
  heritageColorSource?: 'card' | 'brand'
  heritageBandColors?: string[]
  heritageGradeColors?: Record<string, string>
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
  /** Border thickness in inches (web convention); consumers convert to px. */
  borderWidth?: number
  /** Resolved text polarity — 'dark' text on light custom gradients.
      Mirrors web labelPresets extractColorOverrides.textPolarity. */
  textPolarity?: 'light' | 'dark'
  isRainbow?: boolean
  isNeonOutline?: boolean
  isCardExtension?: boolean
  topEdgeGradient?: string[]
  /** Set when a saved custom style's config carries style === 'heritage'. */
  isHeritage?: boolean
  heritagePattern?: string
  heritageBandColors?: string[]
  heritageGradeColors?: Record<string, string>
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
const CACHE_KEY = 'dcm_label_style_cache'

// Mirrors web resolveHeritageSelection (src/lib/labels/labelStyleResolution.ts):
// only well-formed #RRGGBB values survive into the overrides.
const HEX_RE = /^#[0-9a-fA-F]{6}$/

// ── Text polarity (compact port of web contrastWCAG + labelPresets) ─────────
// resolveConfigTextPolarity: an explicit textColorMode wins; 'auto' (and
// configs saved before the field existed) picks light vs dark text by the
// better worst-case WCAG contrast over the background the text sits on.
function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number | null {
  const h = hex?.trim().replace(/^#/, '') || ''
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  const r = srgbToLinear(parseInt(h.slice(0, 2), 16))
  const g = srgbToLinear(parseInt(h.slice(2, 4), 16))
  const b = srgbToLinear(parseInt(h.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Contrast vs near-white #fafafa / near-black #0a0a0a (same candidates as web).
const LUM_NEAR_WHITE = luminance('#fafafa')!
const LUM_NEAR_BLACK = luminance('#0a0a0a')!
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

function resolveConfigTextPolarity(config: CustomLabelConfig): 'light' | 'dark' {
  if (config.textColorMode === 'light') return 'light'
  if (config.textColorMode === 'dark') return 'dark'
  // Background stops — mirrors web configBackgroundStops for the presets the
  // mobile config carries (rainbow / card-extension / plain gradient).
  const stops =
    config.colorPreset === 'rainbow'
      ? ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff', '#ff00ff']
      : config.colorPreset === 'card-extension' && config.topEdgeGradient && config.topEdgeGradient.length >= 3
      ? config.topEdgeGradient
      : [config.gradientStart, config.gradientEnd]
  const lums = stops.map(luminance).filter((l): l is number => l !== null)
  if (!lums.length) return 'light'
  // Worst-case contrast of each text candidate across the stops (web samples
  // inside gradient segments too; endpoint stops bound the worst case for the
  // monotone two-stop gradients mobile renders).
  let minWhite = Infinity
  let minBlack = Infinity
  for (const l of lums) {
    minWhite = Math.min(minWhite, contrast(l, LUM_NEAR_WHITE))
    minBlack = Math.min(minBlack, contrast(l, LUM_NEAR_BLACK))
  }
  return minWhite >= minBlack ? 'light' : 'dark'
}

function extractColorOverrides(config: CustomLabelConfig | null | undefined): LabelColorOverrides | undefined {
  if (!config) return undefined
  // Hand-edited palette wins over the source toggle (same precedence as web).
  const customBand = config.heritageBandColors?.filter(c => HEX_RE.test(c))
  const gradeEntries = config.heritageGradeColors
    ? Object.entries(config.heritageGradeColors).filter(([, v]) => HEX_RE.test(v))
    : []
  return {
    gradientStart: config.gradientStart,
    gradientEnd: config.gradientEnd,
    borderEnabled: config.borderEnabled ?? false,
    borderColor: config.borderColor || config.gradientEnd,
    borderWidth: config.borderWidth,
    textPolarity: resolveConfigTextPolarity(config),
    isRainbow: config.colorPreset === 'rainbow',
    isNeonOutline: config.colorPreset === 'neon-outline',
    isCardExtension: config.colorPreset === 'card-extension',
    topEdgeGradient: config.topEdgeGradient,
    // Heritage custom styles: consumers (SlabCard, export URL builders) need
    // to know the config is Heritage rather than a gradient recolour.
    isHeritage: config.style === 'heritage',
    heritagePattern: config.heritagePattern,
    // Brand source pins the band to the DCM purples; hand-edited colours win.
    heritageBandColors:
      customBand && customBand.length >= 2
        ? customBand
        : config.heritageColorSource === 'brand'
        ? HERITAGE_BRAND_COLORS
        : undefined,
    heritageGradeColors: gradeEntries.length ? Object.fromEntries(gradeEntries) : undefined,
  }
}

export function useLabelStyle() {
  const { session, user } = useAuth()
  // Heritage is the product default for users who never picked a style
  // (mirrors the web useCustomLabelStyle + /api/user/label-style defaults).
  const [labelStyle, setLabelStyle] = useState<LabelStyleId>('heritage')
  const [customStyles, setCustomStyles] = useState<SavedCustomStyle[]>([])
  const [loading, setLoading] = useState(true)
  // Latest customStyles for callbacks that fire right after a save — the
  // saveCustomStyle → switchStyle sequence runs before React commits the
  // setCustomStyles state, so the switchStyle closure would otherwise cache
  // a styles array that's missing the style that was just saved. Updated
  // synchronously via setStyles below (an effect would commit too late).
  const customStylesRef = useRef<SavedCustomStyle[]>([])
  const setStyles = useCallback((styles: SavedCustomStyle[]) => {
    customStylesRef.current = styles
    setCustomStyles(styles)
  }, [])

  // Hydrate from cache for instant render
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(cached => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.labelStyle) setLabelStyle(parsed.labelStyle)
          if (Array.isArray(parsed.customStyles)) setStyles(parsed.customStyles)
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
            labelStyle: ((data?.label_style as LabelStyleId) || 'heritage'),
            customStyles: (Array.isArray(data?.custom_label_styles) ? data.custom_label_styles : []) as SavedCustomStyle[],
          }
          console.log('[useLabelStyle] loaded:', next.labelStyle, `(${next.customStyles.length} custom)`)
          setLabelStyle(next.labelStyle)
          setStyles(next.customStyles)
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
            if (Array.isArray(parsed.customStyles)) setStyles(parsed.customStyles)
            if (parsed.labelStyle) setLabelStyle(parsed.labelStyle)
          } catch {}
        }
      })
      fetchRef.current?.()
    }, []),
  )

  const switchStyle = useCallback(async (id: LabelStyleId) => {
    setLabelStyle(id)
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ labelStyle: id, customStyles: customStylesRef.current }))
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
  }, [session?.access_token])

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
      if (Array.isArray(data.customStyles)) setStyles(data.customStyles)
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
      if (Array.isArray(data.customStyles)) setStyles(data.customStyles)
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
      if (Array.isArray(data.customStyles)) setStyles(data.customStyles)
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ labelStyle, customStyles: data.customStyles ?? customStyles }))
      return true
    } catch (err) {
      console.warn('[useLabelStyle] renameCustomStyle network error:', err)
      return false
    }
  }, [session?.access_token, labelStyle, customStyles])

  // Memoize so the returned object references are stable across renders.
  // Without this, every consumer that passes `colorOverrides` to a
  // memoized child (notably SlabCard in the collection grid) re-renders
  // on every parent render — defeating React.memo and causing the entire
  // grid to reflow on every keystroke in the search box.
  const activeConfig = useMemo(
    () => customStyles.find(s => s.id === labelStyle)?.config || null,
    [customStyles, labelStyle],
  )
  const colorOverrides = useMemo(
    () => extractColorOverrides(activeConfig),
    [activeConfig],
  )

  return { labelStyle, customStyles, activeConfig, colorOverrides, loading, switchStyle, saveCustomStyle, deleteCustomStyle, renameCustomStyle }
}
