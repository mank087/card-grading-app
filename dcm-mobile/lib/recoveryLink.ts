import { isAppOrigin } from './embeddedNavigation'
let pendingLink: string | null = null
const listeners = new Set<(raw: string) => void>()
export function rememberRecoveryLink(raw: string) { pendingLink = raw; listeners.forEach(listener => listener(raw)) }
export function consumeRecoveryLink() { const raw = pendingLink; pendingLink = null; return raw }
export function subscribeRecoveryLinks(listener: (raw: string) => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function recoveryCredentials(raw: string | null, base: string): { access_token: string; refresh_token: string } | { code: string } | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    const custom = url.protocol === 'dcmgrading:'
    if (!custom && !isAppOrigin(raw, base)) return null
    const path = custom ? `/${url.host}${url.pathname}` : url.pathname
    if (path.replace(/\/$/, '') !== '/reset-password') return null
    const params = new URLSearchParams(url.hash.slice(1))
    if (params.get('type') === 'recovery' && params.get('access_token') && params.get('refresh_token')) {
      return { access_token: params.get('access_token')!, refresh_token: params.get('refresh_token')! }
    }
    const code = url.searchParams.get('code')
    return code ? { code } : null
  } catch { return null }
}
