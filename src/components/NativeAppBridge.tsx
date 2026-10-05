'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { awaitNativeSession, isNativeHost, postNativeMessage } from '@/lib/nativeAppBridge'
import { getStoredSession } from '@/lib/directAuth'

/** The native host validates both the sending origin and every requested destination. */
export default function NativeAppBridge() {
  const pathname = usePathname()
  useEffect(() => { postNativeMessage('navigation', { url: window.location.href }) }, [pathname])
  useEffect(() => {
    let cancelled = false
    let detach = () => {}
    void awaitNativeSession().then(() => {
    if (cancelled || !isNativeHost()) return
    postNativeMessage('ready')
    const authChanged = () => {
      if (!(window as Window & { __dcmApplyingSession?: boolean }).__dcmApplyingSession && !localStorage.getItem('supabase.auth.token')) postNativeMessage('auth-sign-out')
    }
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.('a')
      if (!anchor || event.defaultPrevented) return
      const url = new URL(anchor.href, window.location.href)
      if (anchor.hasAttribute('download')) {
        event.preventDefault()
        if (url.protocol === 'blob:' || url.protocol === 'data:' || url.origin === location.origin) {
          const token = url.origin === location.origin && url.protocol !== 'blob:' ? getStoredSession()?.access_token : null
          void fetch(url.href, { redirect: 'error', ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) }).then(r => {
            if (!r.ok) throw Error('Download failed')
            return r.blob()
          }).then(blob => {
            if (blob.size > 20 * 1024 * 1024) throw Error('This file is too large to share in the app. Try a smaller export.')
            const reader = new FileReader()
            reader.onload = () => postNativeMessage('download', { name: anchor.download || 'dcm-export', dataUrl: reader.result })
            reader.onerror = () => postNativeMessage('download-error')
            reader.readAsDataURL(blob)
          }).catch(() => postNativeMessage('download-error'))
        } else postNativeMessage('download-error')
        return
      }
      // Same-origin purchase/auth/native destinations are handed off before Next's click handler.
      if (url.origin === location.origin && /^\/(credits|vip|card-lovers|login|register|upload|collection)\/?$/.test(url.pathname)) {
        event.preventDefault()
        event.stopPropagation()
        postNativeMessage('navigate', { url: url.href })
      } else if (anchor.target === '_blank') {
        event.preventDefault()
        postNativeMessage('navigate', { url: url.href })
      }
    }
    window.addEventListener('dcm-auth-state-change', authChanged)
    document.addEventListener('click', click, true)
    detach = () => { window.removeEventListener('dcm-auth-state-change', authChanged); document.removeEventListener('click', click, true) }
    }).catch(() => { /* The host has a retry surface for failed handshakes. */ })
    return () => { cancelled = true; detach() }
  }, [])
  return null
}
