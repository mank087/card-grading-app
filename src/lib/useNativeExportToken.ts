'use client'
import { useEffect, useState } from 'react'

/** Backward compatible with installed clients. New clients never put bearer tokens in URLs. */
export function useNativeExportToken(legacyToken: string | null): string {
  const [token, setToken] = useState(legacyToken || '')
  useEffect(() => {
    if (legacyToken) { setToken(legacyToken); return }
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (message?.type === 'dcm-auth' && typeof message.token === 'string' && message.token.length < 16384) setToken(message.token)
      } catch { /* Unrelated preview messages are ignored. */ }
    }
    window.addEventListener('message', receive)
    // Injection can precede React hydration. The host stores only in memory, never in the URL/DOM.
    const initial = (window as Window & { __dcmExportToken?: string }).__dcmExportToken
    if (initial) setToken(initial)
    return () => window.removeEventListener('message', receive)
  }, [legacyToken])
  return token
}
