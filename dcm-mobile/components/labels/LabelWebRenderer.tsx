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

import { useRef, useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { useAuth } from '@/contexts/AuthContext'

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
  side = 'front',
  cardId,
  type = 'slab-custom',
}: LabelWebRendererProps) {
  const { session } = useAuth()
  const webViewRef = useRef<WebView>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyRef = useRef(false)
  const [pageReady, setPageReady] = useState(false)

  const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
  const token = session?.access_token || ''

  // Initial URL — embeds config as base64 customConfig so the page can
  // render even before the first postMessage arrives.
  const initialCustomConfigB64 = (() => {
    if (!config) return ''
    try {
      const json = JSON.stringify({ ...config, side })
      return typeof global.btoa === 'function'
        ? global.btoa(json)
        : Buffer.from(json, 'utf-8').toString('base64')
    } catch { return '' }
  })()

  const url = cardId && token
    ? `${API_BASE}/label-preview/${cardId}?token=${encodeURIComponent(token)}&type=${type}&side=${side}&customConfig=${encodeURIComponent(initialCustomConfigB64)}`
    : ''

  // Send config updates to the page (re-renders canvas without reload)
  useEffect(() => {
    if (!config || !cardData || !pageReady) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!webViewRef.current || !readyRef.current) return
      // The page listens for 'message' events on window. Dispatch one with
      // our new config; page re-renders.
      const payload = JSON.stringify({ type: 'preview-config', config, side })
      const escaped = payload.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      webViewRef.current.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: '${escaped}' })); true;`
      )
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [config, cardData, side, pageReady])

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'label-preview-ready' && msg.dataUrl) {
        onRender(msg.dataUrl)
      }
    } catch { /* ignore malformed */ }
  }

  const handleLoad = () => {
    readyRef.current = true
    setPageReady(true)
  }

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
