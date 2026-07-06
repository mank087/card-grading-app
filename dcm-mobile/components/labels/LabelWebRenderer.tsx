/**
 * LabelWebRenderer
 *
 * Hidden WebView that renders the slab label preview by loading the web's
 * /label-preview page — which uses the SAME canvas generators
 * (renderFrontCanvas / renderBackCanvas from customSlabLabelGenerator) that
 * drive the download PDFs. This eliminates drift between the on-device
 * preview and the downloaded label.
 *
 * Flow:
 *   1. Mount → WebView loads /label-preview/[cardId] with the initial config
 *      embedded in the URL (token, type, side, customConfig).
 *   2. Page renders the canvas + posts back the PNG data URL via
 *      window.ReactNativeWebView.postMessage.
 *   3. On every subsequent config change, mobile sends the updated config
 *      via injectJavaScript('window.dispatchEvent(new MessageEvent(...)))'
 *      — page re-renders the canvas without reloading + posts back the new
 *      PNG.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { useAuth } from '@/contexts/AuthContext'
import { useUserEmblems } from '@/hooks/useUserEmblems'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LabelConfig {
  width: number       // inches
  height: number      // inches
  colorPreset: string
  gradientStart: string
  gradientEnd: string
  style: 'modern' | 'traditional'
  borderEnabled: boolean
  borderColor: string
  borderWidth: number
  topEdgeGradient?: string[]
  gradientAngle?: number
  geometricPattern?: number
  customColors?: string[]
  layoutStyle?: string
  preset?: string
  /** Label text polarity — forwarded to the web /label-preview so it
      resolves white vs dark text (matches CustomLabelConfig.textColorMode). */
  textColorMode?: 'auto' | 'light' | 'dark'
  /** Grade digit color + typography scale (July 2026) — forwarded to the web
      renderer; matches CustomLabelConfig.gradeColor / fontScale. */
  gradeColor?: string
  fontScale?: number
}

export interface LabelCardData {
  primaryName: string
  contextLine: string
  featuresLine: string
  serial: string
  grade: number | null
  condition: string
  isAlteredAuthentic?: boolean
  subScores?: { centering: number; corners: number; edges: number; surface: number }
  qrUrl?: string
}

export interface LabelWebRendererProps {
  config: LabelConfig | null
  cardData: LabelCardData | null
  onRender: (base64DataUrl: string) => void
  /** Called when the preview page reports a render/load failure
      ('label-preview-error' postMessage, WebView load error, or a
      terminated content process). */
  onError?: (message: string) => void
  side?: 'front' | 'back'
  /** The Card UUID being previewed — used to load the web preview page. */
  cardId?: string
  /** Which preset type to use as the base config — defaults to 'slab-custom'
   *  so the customizer config flows through. Slab-modern/traditional should
   *  pass their own preset to anchor the colors. */
  type?: 'slab-modern' | 'slab-traditional' | 'slab-custom' | 'slab-bordered'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LabelWebRenderer({
  config,
  cardData,
  onRender,
  onError,
  side = 'front',
  cardId,
  type = 'slab-custom',
}: LabelWebRendererProps) {
  const { session } = useAuth()
  const emblems = useUserEmblems()
  const webViewRef = useRef<WebView>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyRef = useRef(false)
  const reloadAttemptsRef = useRef(0)
  const [pageReady, setPageReady] = useState(false)

  const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
  const token = session?.access_token || ''

  // Initial URL — embeds config as base64 customConfig so the page can
  // render even before the first postMessage arrives. The config (and side)
  // are FROZEN at first availability so the URL stays stable for the life
  // of the component: recomputing it from the live config would change the
  // WebView source on every color/border tweak and force a full page reload
  // (re-fetch card, QR, logos) instead of the cheap injected
  // 'preview-config' message below.
  const initialRef = useRef<{ config: LabelConfig; side: 'front' | 'back' } | null>(null)
  if (!initialRef.current && config) {
    initialRef.current = { config, side }
  }
  const initialCustomConfigB64 = (() => {
    const initial = initialRef.current
    if (!initial) return ''
    try {
      const json = JSON.stringify({ ...initial.config, side: initial.side })
      return typeof global.btoa === 'function'
        ? global.btoa(json)
        : Buffer.from(json, 'utf-8').toString('base64')
    } catch { return '' }
  })()

  const url = cardId && token && initialRef.current
    ? `${API_BASE}/label-preview/${cardId}?token=${encodeURIComponent(token)}&type=${type}&side=${initialRef.current.side}&customConfig=${encodeURIComponent(initialCustomConfigB64)}`
    : ''

  // Send config updates to the page (re-renders canvas without reload).
  // Emblems flow through the same message: when the user toggles a badge
  // in LabelBadgesPicker the EmblemsContext updates synchronously; this
  // effect's dep on showFounder/showVip/showCardLovers re-fires and the
  // /label-preview page picks up the new flags before re-rendering.
  useEffect(() => {
    if (!config || !cardData || !pageReady) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!webViewRef.current || !readyRef.current) return
      const payload = JSON.stringify({
        type: 'preview-config',
        config,
        side,
        // Live label-text edits (Card Name / Set / Year / # / Features and
        // the grade-derived condition). The page fetches card data once and
        // caches it, so without this the canvas preview never reflects text
        // edits made in the mobile Label Text section.
        labelText: {
          primaryName: cardData.primaryName,
          contextLine: cardData.contextLine,
          featuresLine: cardData.featuresLine,
          condition: cardData.condition,
        },
        emblems: {
          showFounderEmblem: !!emblems.showFounder,
          showVipEmblem: !!emblems.showVip,
          showCardLoversEmblem: !!emblems.showCardLovers,
        },
      })
      const escaped = payload.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      webViewRef.current.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: '${escaped}' })); true;`
      )
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [config, cardData, side, pageReady, emblems.showFounder, emblems.showVip, emblems.showCardLovers])

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'label-preview-ready' && msg.dataUrl) {
        onRender(msg.dataUrl)
      } else if (msg.type === 'label-preview-error') {
        const message = msg.message || 'Label preview failed to render'
        console.warn('[LabelWebRenderer] preview error:', message)
        onError?.(message)
      }
    } catch { /* ignore malformed */ }
  }

  const handleLoad = () => {
    readyRef.current = true
    reloadAttemptsRef.current = 0
    setPageReady(true)
  }

  // WebView-level failures (network error, crashed WKWebView content
  // process) — surface the error and reload the page. Capped so a dead
  // network doesn't reload forever.
  const handleLoadFailure = useCallback((reason: string) => {
    console.warn('[LabelWebRenderer] load failure:', reason)
    onError?.(reason)
    readyRef.current = false
    setPageReady(false)
    if (reloadAttemptsRef.current < 3) {
      reloadAttemptsRef.current += 1
      webViewRef.current?.reload()
    }
  }, [onError])

  // Don't render the WebView until we have the basic params
  if (!url) {
    return <View style={styles.container} pointerEvents="none" />
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        onLoad={handleLoad}
        onError={(e) => handleLoadFailure(e.nativeEvent?.description || 'WebView load error')}
        onContentProcessDidTerminate={() => handleLoadFailure('WebView content process terminated')}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  webview: {
    height: 0,
    width: 0,
  },
})
