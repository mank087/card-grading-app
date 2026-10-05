/** Versioned bridge: only the new native host enables this contract. */
type HostWindow = Window & { __dcmNativeBridge?: number; __dcmApplyingSession?: boolean; ReactNativeWebView?: { postMessage: (data: string) => void } }
/** Available before Android delivers its session injection, so the web SDK cannot rotate native refresh tokens. */
export function expectsNativeSession(): boolean {
  return typeof window !== 'undefined' && !!(window as HostWindow).ReactNativeWebView && /DCMBridge\/1/.test(navigator.userAgent)
}
export function isNativeHost(): boolean {
  return typeof window !== 'undefined' && (window as HostWindow).__dcmNativeBridge === 1 && !!(window as HostWindow).ReactNativeWebView
}
export function postNativeMessage(type: string, payload: Record<string, unknown> = {}): void {
  if (isNativeHost()) (window as HostWindow).ReactNativeWebView?.postMessage(JSON.stringify({ ...payload, type, version: 1 }))
}
/** Android's early WebView injection is best-effort. Wait before an auth-only page redirects. */
export function awaitNativeSession(): Promise<void> {
  if (!expectsNativeSession() || (window as HostWindow).__dcmNativeBridge === 1) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); window.removeEventListener('dcm-native-session', done); resolve() }
    const timer = setTimeout(() => { window.removeEventListener('dcm-native-session', done); reject(Error('Your app session could not be loaded. Go back and reopen this page.')) }, 12000)
    window.addEventListener('dcm-native-session', done)
    ;(window as HostWindow).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready', version: 1 }))
  })
}
let pendingRefresh: Promise<{ success: boolean; error?: string }> | null = null
export function refreshNativeSession(): Promise<{ success: boolean; error?: string }> {
  if (pendingRefresh) return pendingRefresh
  pendingRefresh = new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer)
      window.removeEventListener('dcm-native-session', finish)
      pendingRefresh = null
      try {
        const session = JSON.parse(localStorage.getItem('supabase.auth.token') || 'null')
        resolve({ success: !!session?.access_token && session.expires_at > Date.now() / 1000 })
      } catch { resolve({ success: false, error: 'Please sign in again.' }) }
    }
    const timer = setTimeout(finish, 12000)
    window.addEventListener('dcm-native-session', finish)
    postNativeMessage('auth-refresh')
  })
  return pendingRefresh
}
