import { View, Text, StyleSheet, ActivityIndicator, BackHandler, TouchableOpacity, Platform, Alert, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { useRouter, useSegments, useNavigation } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as WebBrowser from 'expo-web-browser'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import MobileTabBar from '@/components/MobileTabBar'
import AppHeaderBar from '@/components/AppHeaderBar'
import { APP_USER_AGENT_SUFFIX, withEmbeddedParams } from '@/lib/embeddedWeb'
import { embeddedDestination, isAppOrigin, sessionInjection } from '@/lib/embeddedNavigation'
import { inAppChromeInjection } from '@/lib/embeddedChrome'

const WEB_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
interface InAppPageProps { path: string; title?: string }

export default function InAppPage({ path, title }: InAppPageProps) {
  const router = useRouter()
  const segments = useSegments()
  const navigation = useNavigation()
  const { session, isLoading: authLoading, signOut } = useAuth()
  const { refresh } = useCredits()
  const sessionRef = useRef(session)
  sessionRef.current = session
  const isTabContext = segments[0] === '(tabs)'
  const initialUrl = useMemo(() => withEmbeddedParams(new URL(path.startsWith('/') && !path.startsWith('//') ? path : '/', WEB_URL).href), [path])
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const webViewRef = useRef<WebView>(null)
  const currentUrl = useRef(initialUrl)
  const lastAppUrl = useRef(initialUrl)
  const downloadBusy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { setUrl(initialUrl); setLoading(true); setError(null); setCanGoBack(false) }, [initialUrl])
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => { setLoading(false); setError('This page is taking too long to load. Check your connection and retry.') }, 30000)
    return () => clearTimeout(timer)
  }, [loading, url])
  const injection = useMemo(() => sessionInjection(WEB_URL, session), [session])
  useEffect(() => { webViewRef.current?.injectJavaScript(injection) }, [injection])

  const syncSession = useCallback(async () => {
    const owner = sessionRef.current?.user.id
    try {
      let { data: { session: latest } } = await supabase.auth.getSession()
      if (latest && (latest.expires_at ?? 0) < Date.now() / 1000 + 300) {
        const result = await supabase.auth.refreshSession()
        if (result.error) throw result.error
        latest = result.data.session
      }
      if (mounted.current && owner === sessionRef.current?.user.id) webViewRef.current?.injectJavaScript(sessionInjection(WEB_URL, latest))
    } catch { if (mounted.current) setError('Your session could not be refreshed. Check your connection and retry.') }
  }, [])
  useFocusEffect(useCallback(() => {
    void syncSession(); void refresh()
    if (isAppOrigin(currentUrl.current, WEB_URL)) webViewRef.current?.injectJavaScript("window.dispatchEvent(new Event('focus')); true;")
  }, [syncSession, refresh]))

  const back = () => {
    if (canGoBack) webViewRef.current?.goBack()
    else if (router.canGoBack()) router.back()
    else router.replace('/')
  }
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false
      webViewRef.current?.goBack(); return true
    })
    return () => sub.remove()
  }, [canGoBack]))
  useEffect(() => {
    if (!isTabContext) return
    return navigation.addListener('tabPress' as never, () => {
      setUrl(initialUrl)
      webViewRef.current?.injectJavaScript(`location.replace(${JSON.stringify(initialUrl)}); true;`)
    })
  }, [isTabContext, navigation, initialUrl])

  const navigate = useCallback((raw: string, loadWeb = false): boolean => {
    const destination = embeddedDestination(raw, WEB_URL, Platform.OS, !!sessionRef.current)
    // A purchase launched from another page gets its own native stack screen on both platforms.
    // Returning leaves the batch's selected File objects intact; Android's screen still uses Stripe.
    const separateCredits = loadWeb && isAppOrigin(raw, WEB_URL) && new URL(raw).pathname === '/credits' && new URL(initialUrl).pathname !== '/credits'
    if (destination.kind === 'native' || separateCredits) {
      // Fallback for programmatic SPA navigation: do not leave a web purchase page behind the native screen.
      webViewRef.current?.injectJavaScript(`if(location.href===${JSON.stringify(raw)} && location.href!==${JSON.stringify(lastAppUrl.current)}) location.replace(${JSON.stringify(lastAppUrl.current)}); true;`)
      router.push((destination.kind === 'native' ? destination.href : '/pages/credits') as never)
      return false
    }
    if (destination.kind === 'external') {
      const open = /^https?:/.test(destination.url) ? WebBrowser.openBrowserAsync(destination.url) : Linking.openURL(destination.url)
      void open.then(() => { void refresh() }).catch(() => Alert.alert('Unable to open link', 'Please try again.'))
      return false
    }
    if (destination.kind === 'blocked') return false
    if (isAppOrigin(destination.url, WEB_URL)) lastAppUrl.current = destination.url
    if (loadWeb) { setLoading(true); setError(null); setUrl(isAppOrigin(destination.url, WEB_URL) ? withEmbeddedParams(destination.url) : destination.url) }
    return true
  }, [router, refresh, initialUrl])

  const download = async (message: { name?: string; dataUrl?: string; url?: string }) => {
    if (downloadBusy.current) return
    downloadBusy.current = true
    let file: string | null = null
    try {
      const name = (message.name || 'dcm-export').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'dcm-export'
      file = `${FileSystem.cacheDirectory}dcm-${Date.now()}-${name}`
      if (message.dataUrl) {
        const match = message.dataUrl.match(/^data:(application\/(?:pdf|zip)|text\/csv|image\/(?:png|jpeg))(?:;charset=[a-zA-Z0-9_-]+)?;base64,([a-zA-Z0-9+/=\r\n]+)$/)
        if (!match || message.dataUrl.length > 28 * 1024 * 1024) throw Error('Unsupported file. Try exporting fewer cards.')
        await FileSystem.writeAsStringAsync(file, match[2], { encoding: FileSystem.EncodingType.Base64 })
      } else if (message.url && isAppOrigin(message.url, WEB_URL)) {
        // No token on the URL and no bearer forwarded across a redirect. Signed file endpoints own authorization.
        const response = await FileSystem.downloadAsync(message.url, file)
        if (response.status !== 200) throw Error('The file could not be downloaded. Please regenerate it.')
      } else throw Error('Use the label or report export controls to download this file.')
      if (!await Sharing.isAvailableAsync()) throw Error('Sharing is unavailable on this device.')
      await Sharing.shareAsync(file)
    } catch (reason) { Alert.alert('Download unavailable', reason instanceof Error ? reason.message : 'Please try again.') }
    finally {
      if (file) void FileSystem.deleteAsync(file, { idempotent: true }).catch(() => {})
      downloadBusy.current = false
    }
  }

  // Payment links must resolve through the platform router before any web checkout is rendered on iOS.
  const initialDestination = embeddedDestination(initialUrl, WEB_URL, Platform.OS, !!session)
  useEffect(() => {
    if (!authLoading && initialDestination.kind === 'native') router.replace(initialDestination.href as never)
  }, [authLoading, initialDestination.kind, initialDestination.kind === 'native' ? initialDestination.href : '', router])

  if (authLoading || initialDestination.kind === 'native') return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading page" /></View>
  return <View style={styles.container}>
    {!isTabContext && <AppHeaderBar showBack title={title} onBack={back} />}
    <View style={{ flex: 1 }}>
      <WebView
        key={session?.user.id || 'guest'}
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        applicationNameForUserAgent={APP_USER_AGENT_SUFFIX}
        originWhitelist={['https://*', 'http://*', 'mailto:*', 'tel:*']}
        injectedJavaScriptBeforeContentLoaded={injection}
        injectedJavaScript={`${injection}\n${inAppChromeInjection}`}
        onLoadStart={() => { setLoading(true); setError(null) }}
        onLoadEnd={() => setLoading(false)}
        onLoad={() => webViewRef.current?.injectJavaScript(`${injection}\n${inAppChromeInjection}`)}
        onError={() => { setLoading(false); setError('This page could not load. Check your connection and retry.') }}
        onHttpError={event => { if (event.nativeEvent.url === currentUrl.current) { setLoading(false); setError('This page is temporarily unavailable. Please retry.') } }}
        onContentProcessDidTerminate={() => { setLoading(false); setError('The page was interrupted. Reload to continue.') }}
        onRenderProcessGone={() => { setLoading(false); setError('The page was interrupted. Reload to continue.') }}
        onShouldStartLoadWithRequest={request => request.isTopFrame === false || navigate(request.url)}
        onOpenWindow={event => { navigate(event.nativeEvent.targetUrl, true) }}
        onNavigationStateChange={state => { currentUrl.current = state.url; setCanGoBack(state.canGoBack) }}
        onMessage={event => {
          if (!isAppOrigin(event.nativeEvent.url, WEB_URL)) return
          try {
            const message = JSON.parse(event.nativeEvent.data)
            if (message.version !== 1) return
            if (message.type === 'ready' || message.type === 'auth-refresh') void syncSession()
            else if (message.type === 'auth-sign-out') void signOut()
            else if (message.type === 'credits-changed') void refresh()
            else if (['navigate', 'navigation'].includes(message.type) && typeof message.url === 'string') navigate(message.url, message.type === 'navigate')
            else if (message.type === 'download') void download(message)
            else if (message.type === 'download-error') Alert.alert('Download unavailable', 'Please try exporting fewer cards, or regenerate the file.')
          } catch { /* Ignore messages outside the versioned app contract. */ }
        }}
        javaScriptEnabled domStorageEnabled sharedCookiesEnabled allowsBackForwardNavigationGestures
        allowFileAccess={false} allowFileAccessFromFileURLs={false} mixedContentMode="never"
      />
      {loading && !error && <View pointerEvents="none" style={styles.overlay}><ActivityIndicator size="large" color={Colors.purple[600]} accessibilityLabel="Loading page" /></View>}
      {error && <View style={styles.overlay} accessibilityLiveRegion="polite">
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setError(null); setLoading(true); void syncSession(); webViewRef.current?.reload() }}><Text style={styles.buttonText}>Retry</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={back}><Text style={styles.buttonText}>Go back</Text></TouchableOpacity>
      </View>}
    </View>
    {!isTabContext && <MobileTabBar />}
  </View>
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white }, webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: Colors.gray[50] },
  error: { color: Colors.gray[800], fontSize: 16, textAlign: 'center', marginBottom: 16 },
  button: { backgroundColor: Colors.purple[600], padding: 14, borderRadius: 8, marginBottom: 10, minWidth: 120 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
})
