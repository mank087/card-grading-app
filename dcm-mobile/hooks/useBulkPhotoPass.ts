/**
 * The bulk photo pass — the one part of a batch that cannot be done on the
 * server.
 *
 * Every row lands from the create route with `image_status: 'pending'`: the
 * slab label art and the mini grade report are CANVAS renders, so they only
 * exist where a browser does. The web review page renders them in the page
 * itself; native drives the very same page (/ebay-image-prep) in ONE hidden
 * WebView, a card at a time, and uploads what comes back.
 *
 * Why one at a time rather than the web's concurrency of 3: three WebViews each
 * holding five multi-megabyte base64 data URLs is how you OOM a low-end
 * Android. One mounted WebView, one chunk buffer, cleared per card.
 *
 * What is used from the prep page: THE IMAGES ONLY. The row already carries a
 * server-built title, description and specifics, and the server's description
 * includes this batch's shipping summary — the prep page's does not, so
 * adopting its metadata here would quietly downgrade every bulk listing.
 * `docs=0` also tells the page to skip the Certificate-of-Analysis upload: the
 * bulk drain does not attach documents, so it is a wasted eBay call per card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { supabase } from '@/lib/supabase'
import { useLabelStyle } from '@/hooks/useLabelStyle'
import { uploadImagesSequential } from '@/lib/ebayApi'
import { updateItem } from '@/lib/ebayBulkApi'
import type { BulkItem, BulkCard, BulkBatchStatus } from '@/lib/ebayBulkTypes'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

/**
 * Same watchdog as the single-card wizard: the prep page can load and then post
 * nothing at all (a wedged canvas, a page that threw before the bridge, a dead
 * network mid-render). 90 s is well past the slowest real run.
 */
const PREP_TIMEOUT_MS = 90_000

/**
 * Gallery order — labelled front first, because it becomes eBay's main photo
 * and drives click-through. Twin of DEFAULT_IMAGE_ORDER in
 * src/lib/ebay/prepareListingImages.ts, and the order the chunk stream arrives
 * in; both the upload and the stored `image_urls` follow it.
 */
const IMAGE_ORDER = ['front', 'back', 'rawFront', 'rawBack', 'miniReport'] as const
type ImageKey = (typeof IMAGE_ORDER)[number]

/** The card the pass is working on. `upload` no longer needs the WebView. */
interface Current {
  itemId: string
  cardId: string
  /** Baked into the prep URL, so it is read fresh per card (see below). */
  token: string
  attempt: number
  phase: 'render' | 'upload'
}

export interface BulkPhotoPass {
  /** A card is being rendered or uploaded right now. */
  running: boolean
  /** Cards this pass has finished with (ready or failed). */
  done: number
  /** Cards this pass will have attempted when the queue drains. */
  total: number
  /** Cards still to go, including the one in flight. */
  remaining: number
  /**
   * Rough time left, from the average per-card duration measured so far. Null
   * until two cards have finished — one card's timing is not an average, and a
   * wrong estimate is worse than none.
   */
  etaMs: number | null
  currentItemId: string | null
  /** Work is waiting but the screen is backgrounded / blurred / signed out. */
  paused: boolean
  /** Why, when the seller can do something about it. Null for the usual case. */
  pauseReason: string | null
  /** Put a row back in the queue — Retry photos, and a successful re-check. */
  enqueue: (itemId: string) => void

  // ── Rendering contract for <BulkPhotoPass /> ─────────────────────────────
  /** Null when nothing should be mounted. */
  webViewKey: string | null
  sourceUri: string | null
  onLoadStart: () => void
  onMessage: (raw: string) => void
  onError: (description: string | undefined) => void
}

interface Params {
  batchId: string
  items: BulkItem[]
  cards: Map<string, BulkCard>
  batchStatus: BulkBatchStatus | undefined
  /** Merge a server-returned row back into the list. */
  onItemChanged: (item: BulkItem) => void
}

export function useBulkPhotoPass({
  batchId, items, cards, batchStatus, onItemChanged,
}: Params): BulkPhotoPass {
  // The seller's saved label style decides what the slab art looks like, and
  // these photos are what the buyer sees. Starting before it resolves would
  // upload a stock label for a Heritage or enterprise account, so the pass
  // waits for `loading` exactly as the web page does.
  const { labelStyle, loading: labelStyleLoading } = useLabelStyle()

  const [current, setCurrent] = useState<Current | null>(null)
  /** Rows this pass has already attempted — one attempt per card per pass. */
  const [attempted, setAttempted] = useState<Set<string>>(() => new Set())
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [focused, setFocused] = useState(false)
  /** The session was gone when a card was picked — the pass waits, it doesn't die. */
  const [noSession, setNoSession] = useState(false)
  /** When the pass picked its first card — the clock the estimate is read off. */
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Latest rows for the async work, so finishing a card doesn't need the
  // closure that started it.
  const itemsRef = useRef(items)
  const cardsRef = useRef(cards)
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { cardsRef.current = cards }, [cards])

  const currentRef = useRef<Current | null>(null)
  useEffect(() => { currentRef.current = current }, [current])

  /** Chunked bridge buffer (v2): one image per message, cleared per card. */
  const chunkRef = useRef<Record<string, string>>({})
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  /** The watchdog is declared above `fail`, and fires long after either. */
  const failRef = useRef<(itemId: string) => void>(() => {})

  const clearWatchdog = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])
  useEffect(() => clearWatchdog, [clearWatchdog])

  /** Fails `started` if it is still the card in flight when the clock runs out. */
  const armWatchdog = useCallback((started: Current) => {
    clearWatchdog()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      const now = currentRef.current
      if (!now || now.itemId !== started.itemId || now.attempt !== started.attempt) return
      console.warn('[bulk-photos] prep timed out for', started.itemId)
      failRef.current(started.itemId)
    }, PREP_TIMEOUT_MS)
  }, [clearWatchdog])

  /* ------------------------------------------------------- run gating -- */

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setAppActive(state === 'active')
    })
    return () => sub.remove()
  }, [])

  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      // Coming back to the screen is a good moment to find out whether the
      // session is back — a sign-in elsewhere in the app costs nothing to retry.
      setNoSession(false)
      return () => setFocused(false)
    }, []),
  )

  // The other way back: the session refreshing (or a fresh sign-in) while the
  // seller is still sitting on this screen.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => setNoSession(false))
    return () => data.subscription.unsubscribe()
  }, [])

  // Photos belong to the review step. Once a batch is running its rows are the
  // drain's, and re-rendering slab art over them would race the publish.
  const canRun =
    batchStatus === 'draft' && focused && appActive && !labelStyleLoading && !noSession

  const queue = useMemo(
    () => items
      .filter(i => i.image_status === 'pending' && i.status !== 'skipped' && !attempted.has(i.id))
      .map(i => i.id),
    [items, attempted],
  )

  /* --------------------------------------------------------- finishing -- */

  const finish = useCallback(async (itemId: string, patch: Parameters<typeof updateItem>[2]) => {
    clearWatchdog()
    chunkRef.current = {}
    try {
      const res = await updateItem(batchId, itemId, patch)
      if (mountedRef.current) onItemChanged(res.item)
    } catch (err) {
      // Best effort: the row keeps whatever image_status it had, and the queue
      // still moves on because the id is marked attempted below. The seller's
      // way back is Retry photos on the row.
      console.warn('[bulk-photos] could not save row state:', err)
    }
    if (!mountedRef.current) return
    setAttempted(prev => {
      const next = new Set(prev)
      next.add(itemId)
      return next
    })
    setCurrent(null)
  }, [batchId, clearWatchdog, onItemChanged])

  const fail = useCallback((itemId: string) => {
    void finish(itemId, { image_status: 'failed' })
  }, [finish])
  failRef.current = fail

  /* ------------------------------------------------ picking the next -- */

  useEffect(() => {
    if (!canRun || current || queue.length === 0) return
    let cancelled = false
    const itemId = queue[0]
    const item = itemsRef.current.find(i => i.id === itemId)
    if (!item) return

    ;(async () => {
      // A fresh token per card rather than one captured when the screen
      // mounted: the prep URL BAKES the access token, and a 100-card pass runs
      // for long enough to outlive one. supabase-js refreshes on read, so this
      // is the cheap way to never hand the WebView an expired session.
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (cancelled || !mountedRef.current) return
      if (!token) {
        // Signed out mid-pass. Stop rather than hand the WebView a URL with no
        // token in it, and say so — silence here looked like a wedged pass.
        setNoSession(true)
        return
      }
      setNoSession(prev => (prev ? false : prev))
      setStartedAt(prev => prev ?? Date.now())
      attemptRef.current += 1
      chunkRef.current = {}
      setCurrent({
        itemId,
        cardId: item.card_id,
        token,
        attempt: attemptRef.current,
        phase: 'render',
      })
    })()

    return () => { cancelled = true }
  }, [canRun, current, queue])

  // Start the clock when the card is picked, not when the WebView says it is
  // loading: a WebView that never fires onLoadStart at all (it failed to mount,
  // the URL never resolved) would otherwise hold the pass open forever.
  // onLoadStart re-arms it, so a page that does load gets the full 90 s.
  useEffect(() => {
    if (!current || current.phase !== 'render') return
    armWatchdog(current)
  }, [current, armWatchdog])

  // Backgrounded, blurred or signed out mid-render: drop the half-done card
  // WITHOUT marking it attempted, so it starts again from scratch (a fresh
  // WebView key, an empty buffer) when the screen comes back. A card already
  // uploading is left alone — its bytes are on the wire and the PATCH is the
  // last step, so letting it land is both safe and cheaper than redoing it.
  useEffect(() => {
    if (canRun || !current || current.phase !== 'render') return
    clearWatchdog()
    chunkRef.current = {}
    setCurrent(null)
  }, [canRun, current, clearWatchdog])

  /* ---------------------------------------------------- bridge handlers -- */

  const onLoadStart = useCallback(() => {
    chunkRef.current = {}
    const started = currentRef.current
    if (started) armWatchdog(started)
    else clearWatchdog()
  }, [armWatchdog, clearWatchdog])

  const handleComplete = useCallback(async (images: Record<string, string>) => {
    const active = currentRef.current
    if (!active || active.phase !== 'render') return
    clearWatchdog()
    // Unmount the WebView before uploading: its data URLs are the largest
    // thing in memory and nothing needs them once they are copied out. The ref
    // moves FIRST so a second complete message in the same tick — the chunked
    // and the legacy protocol both firing — is rejected on the phase check
    // above rather than uploading the same card twice.
    const uploading: Current = { ...active, phase: 'upload' }
    currentRef.current = uploading
    setCurrent(uploading)
    chunkRef.current = {}

    // The upload has its own clock. Five multi-megabyte PUTs on a phone that
    // walked out of Wi-Fi can hang without ever throwing, and with the WebView
    // already gone nothing else would ever move this card on.
    let uploadTimer: ReturnType<typeof setTimeout> | null = null
    try {
      const work = (async () => {
        const ordered: Partial<Record<ImageKey, string>> = {}
        for (const key of IMAGE_ORDER) {
          const dataUrl = images[key]
          if (typeof dataUrl === 'string' && dataUrl) ordered[key] = dataUrl
        }
        if (Object.keys(ordered).length === 0) throw new Error('The prep page returned no images')

        const result = await uploadImagesSequential(active.cardId, ordered)
        const urls = IMAGE_ORDER
          .map(key => result.urls[key])
          .filter((u): u is string => typeof u === 'string' && u.length > 0)

        await finish(active.itemId, {
          image_urls: urls,
          image_status: urls.length > 0 ? 'ready' : 'failed',
        })
      })()
      await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          uploadTimer = setTimeout(() => reject(new Error('The photo upload timed out')), PREP_TIMEOUT_MS)
        }),
      ])
    } catch (err) {
      // A timeout is treated exactly like an upload throw. If the abandoned
      // upload does land later its own PATCH follows this one, which is the
      // better of the two outcomes anyway.
      console.warn('[bulk-photos] photo prep failed for', active.itemId, err)
      fail(active.itemId)
    } finally {
      if (uploadTimer) clearTimeout(uploadTimer)
    }
  }, [clearWatchdog, fail, finish])

  const onMessage = useCallback((raw: string) => {
    try {
      const msg = JSON.parse(raw)
      if (msg.type === 'ebay-prep-image' && typeof msg.key === 'string' && typeof msg.dataUrl === 'string') {
        // Chunked protocol (v2): buffer each image as it arrives.
        chunkRef.current[msg.key] = msg.dataUrl
      } else if (msg.type === 'ebay-prep-complete') {
        // The metadata riding on this message (title, description, specifics,
        // regulatoryDocumentId) is deliberately ignored — see the file header.
        void handleComplete({ ...chunkRef.current })
      } else if (msg.type === 'images-ready' && msg.images) {
        // Legacy protocol: one giant message (an old cached prep page).
        void handleComplete(msg.images)
      } else if (msg.type === 'error') {
        const active = currentRef.current
        console.warn('[bulk-photos] prep page error:', msg.message)
        if (active && active.phase === 'render') fail(active.itemId)
      }
    } catch {
      // A message we can't parse is not a reason to fail the card — the
      // watchdog still covers a page that goes quiet.
    }
  }, [fail, handleComplete])

  const onError = useCallback((description: string | undefined) => {
    const active = currentRef.current
    console.warn('[bulk-photos] WebView load error:', description)
    if (active && active.phase === 'render') fail(active.itemId)
  }, [fail])

  /* ---------------------------------------------------------- progress -- */

  const done = attempted.size
  const remaining = queue.length + (current ? 1 : 0)
  const total = done + remaining
  // Wall-clock over cards finished, not a per-card stopwatch: the pass is
  // paused whenever the screen is backgrounded, and the seller is being told
  // how long to keep it open, not how long the renders take.
  const etaMs =
    startedAt !== null && done >= 2 && remaining > 0
      ? Math.round(((Date.now() - startedAt) / done) * remaining)
      : null
  // The label style resolving is the pass loading, not the pass paused — the
  // strip would otherwise flash "paused" for a beat every time it opens.
  const paused =
    !canRun && !labelStyleLoading && batchStatus === 'draft' &&
    (queue.length > 0 || current !== null)
  const pauseReason = paused && noSession ? 'Sign in again to prepare photos' : null

  const enqueue = useCallback((itemId: string) => {
    setAttempted(prev => {
      if (!prev.has(itemId)) return prev
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }, [])

  const renderCard = current && current.phase === 'render' ? current : null

  return {
    running: current !== null,
    done,
    total,
    remaining,
    etaMs,
    currentItemId: current?.itemId ?? null,
    paused,
    pauseReason,
    enqueue,
    webViewKey: renderCard ? `bulk-prep-${renderCard.itemId}-${renderCard.attempt}` : null,
    sourceUri: renderCard
      ? `${API_BASE}/ebay-image-prep/${renderCard.cardId}` +
        `?token=${encodeURIComponent(renderCard.token)}` +
        `&labelStyle=${labelStyle}&bridge=2&docs=0`
      : null,
    onLoadStart,
    onMessage,
    onError,
  }
}
