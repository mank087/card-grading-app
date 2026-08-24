'use client'

/**
 * Warn before leaving a page with unsaved edits.
 *
 * Covers the three ways an owner leaves Brand Setup: closing / reloading the
 * tab (native beforeunload prompt), clicking any in-app link (intercepted in
 * the capture phase and answered with our own modal), and the browser back
 * button (popstate — we push the entry back and show the same modal).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PendingNav { href: string }

export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter()
  const [pending, setPending] = useState<PendingNav | null>(null)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const href = a.getAttribute('href') || ''
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      setPending({ href: url.pathname + url.search + url.hash })
    }
    const onPopState = () => {
      if (!dirtyRef.current) return
      // Put the entry back and ask; "Leave" then really goes back.
      history.pushState(null, '', window.location.href)
      setPending({ href: '__back__' })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  const stay = useCallback(() => setPending(null), [])
  const leave = useCallback(() => {
    const p = pending
    setPending(null)
    dirtyRef.current = false
    if (!p) return
    if (p.href === '__back__') { history.go(-2); return }
    router.push(p.href)
  }, [pending, router])

  return { pending: !!pending, stay, leave }
}

/** The modal the guard shows; the page decides what "save" means. */
export function UnsavedChangesDialog({ open, onStay, onLeave, onSave, saving }: {
  open: boolean
  onStay: () => void
  onLeave: () => void
  /** Optional: save first, then leave. */
  onSave?: () => Promise<boolean> | boolean
  saving?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h2 id="unsaved-title" className="text-lg font-semibold text-gray-900">You have unsaved changes</h2>
        <p className="text-sm text-gray-600">Your label design changes haven&apos;t been saved. If you leave now, they&apos;ll be lost.</p>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={onStay} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Keep editing</button>
          <button type="button" onClick={onLeave} className="px-4 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50">Leave without saving</button>
          {onSave && (
            <button type="button" disabled={saving}
              onClick={async () => { if (await onSave()) onLeave() }}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save and leave'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
