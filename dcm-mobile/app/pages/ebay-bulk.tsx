/**
 * Native bulk listing: review a draft batch, publish it, then watch it go out.
 *
 * The screen has two modes and the batch's own status picks between them:
 *   draft                                   → review + the publish bar
 *   running | paused | complete | failed |
 *   cancelled                               → progress
 *
 * Publishing is a handoff, not a job this screen runs: the publish route queues
 * the rows and returns, and a server drain does the eBay calls. So the progress
 * mode is a reader — it polls, it offers pause/resume/stop, and it says plainly
 * that the seller can close the app.
 *
 * The web equivalent is src/app/instalist-marketplace/bulk/[batchId].
 *
 * Renders its own AppHeaderBar + MobileTabBar (registered headerShown:false in
 * app/pages/_layout.tsx), exactly like ebay-list.tsx.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, FlatList, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  AppState, Linking, type AppStateStatus,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import type { WebViewNavigation } from 'react-native-webview'

import { Colors } from '@/lib/constants'
import AppHeaderBar from '@/components/AppHeaderBar'
import MobileTabBar from '@/components/MobileTabBar'
import { useBulkBatch } from '@/hooks/useBulkBatch'
import { useBulkPhotoPass } from '@/hooks/useBulkPhotoPass'
import BulkSettingsSheet, {
  describePriceRule, describeShipping, describeListingFormat,
} from '@/components/bulk/BulkSettingsSheet'
import BulkItemSheet from '@/components/bulk/BulkItemSheet'
import BulkPhotoPass from '@/components/bulk/BulkPhotoPass'
import BulkProgressPanel, { type ProgressCounts, type BatchControl } from '@/components/bulk/BulkProgressPanel'
import SellerTermsGate from '@/components/bulk/SellerTermsGate'
import OAuthModal from '@/components/marketplace/OAuthModal'
import {
  deleteBatch, publishBatch, pauseBatch, resumeBatch, cancelBatch, retryItem,
  deleteItem, updateItem, getBulkLimits, BulkApiError, type NotReadyRow,
} from '@/lib/ebayBulkApi'
import { checkDisclaimer, getOAuthUrl } from '@/lib/ebayApi'
import { classifyEbayOAuthNavigation } from '@/lib/ebayOAuth'
import {
  BATCH_STATUS_LABEL, PAUSE_REASONS,
  type BulkItem, type BulkCard, type BulkListingRef, type BulkLimits,
} from '@/lib/ebayBulkTypes'

/**
 * Row status → chip colours. Mirrors the web review table's pills. The three
 * in-flight statuses read as one word to the seller: whichever of queued /
 * uploading / publishing a row is in, the answer to "what is happening" is the
 * same and the distinction is ours, not theirs.
 */
const ITEM_STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: Colors.gray[100], fg: Colors.gray[700], label: 'Needs work' },
  ready: { bg: Colors.green[100], fg: Colors.green[700], label: 'Ready' },
  queued: { bg: Colors.purple[100], fg: Colors.purple[700], label: 'Publishing…' },
  uploading: { bg: Colors.purple[100], fg: Colors.purple[700], label: 'Publishing…' },
  publishing: { bg: Colors.purple[100], fg: Colors.purple[700], label: 'Publishing…' },
  live: { bg: Colors.green[100], fg: Colors.green[700], label: 'Live' },
  failed: { bg: Colors.red[100], fg: Colors.red[700], label: 'Failed' },
  skipped: { bg: Colors.gray[100], fg: Colors.gray[500], label: 'Skipped' },
  blocked: { bg: Colors.amber[100], fg: Colors.amber[700], label: 'Held' },
}

const BATCH_STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  draft: { bg: Colors.gray[100], fg: Colors.gray[700] },
  running: { bg: Colors.purple[100], fg: Colors.purple[700] },
  paused: { bg: Colors.amber[100], fg: Colors.amber[700] },
  complete: { bg: Colors.green[100], fg: Colors.green[700] },
  failed: { bg: Colors.red[100], fg: Colors.red[700] },
  cancelled: { bg: Colors.gray[100], fg: Colors.gray[500] },
}

/**
 * The item PATCH's own rule (src/app/api/ebay/bulk/.../items/[itemId]): a draft
 * batch is wholly editable, and beyond that only the rows the drain has come to
 * rest on — "repair mode". Mirrored here so a field is read-only rather than
 * typed into a 409.
 */
const REPAIRABLE_ITEM_STATUSES = new Set(['draft', 'ready', 'failed', 'blocked', 'skipped'])
const REPAIRABLE_BATCH_STATUSES = new Set(['draft', 'running', 'paused', 'complete', 'failed'])

/** Rows Retry can act on. Skipped is included: a re-check costs no eBay call. */
const RETRYABLE_STATUSES = new Set(['failed', 'blocked', 'skipped'])

/** The batch statuses the retry route accepts (anything else answers 409). */
const RETRY_BATCH_STATUSES = new Set(['running', 'paused', 'complete', 'failed'])

/** How often a running batch is re-read. Same cadence as the web page. */
const POLL_MS = 3000

/**
 * A running batch is published by the server, so a phone that briefly cannot
 * reach us has NOT lost anything — one failed poll is not news. Three in a row
 * (nine seconds of silence) is worth saying, in those terms.
 */
const POLL_FAIL_LIMIT = 3
const POLL_ERROR_MESSAGE = "Can't reach DCM right now — listing continues on our servers."

/** Draft-mode list filter. */
type RowFilter = 'all' | 'needswork' | 'failed'

function formatPrice(price: BulkItem['price']): string {
  const n = typeof price === 'string' ? Number(price) : price
  if (n == null || !Number.isFinite(n) || n <= 0) return 'No price'
  return `$${n.toFixed(2)}`
}

export default function EbayBulkScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // `skipped` / `missing` ride along from the create call so the batch screen
  // can account for the cards the seller picked but will not see here.
  const { batchId, skipped, missing } = useLocalSearchParams<{
    batchId?: string; skipped?: string; missing?: string
  }>()
  const id = typeof batchId === 'string' ? batchId : undefined

  const {
    batch, items, cards, listings, loading, refreshing, error, notFound,
    refresh, setItem, setBatch,
  } = useBulkBatch(id)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Publish / run control ───────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false)
  /** Server-authored sentence about the last publish / control attempt. */
  const [publishNote, setPublishNote] = useState<string | null>(null)
  /** Batch-level publish blockers (business policies) — labels, verbatim. */
  const [batchNotReady, setBatchNotReady] = useState<string[]>([])
  /** Rows the publish gate named, so the list can point at them. */
  const [notReadyIds, setNotReadyIds] = useState<Set<string>>(() => new Set())
  const [limits, setLimits] = useState<BulkLimits | null>(null)
  const [controlBusy, setControlBusy] = useState<BatchControl | null>(null)
  const [retryAll, setRetryAll] = useState<{ done: number; total: number } | null>(null)
  /** Set by Stop; the sequential retry loop reads it between cards. */
  const stopRetryAll = useRef(false)
  /** Which draft rows the list is showing. */
  const [filter, setFilter] = useState<RowFilter>('all')
  const [removingNotReady, setRemovingNotReady] = useState(false)
  const [retryingPhotos, setRetryingPhotos] = useState(false)
  /** Consecutive failed polls, and whether that has gone on long enough to say. */
  const pollFailures = useRef(0)
  const [pollError, setPollError] = useState(false)

  const listRef = useRef<FlatList<BulkItem>>(null)

  // ─── Gates the server can raise mid-flow ─────────────────────────────────
  const [termsOpen, setTermsOpen] = useState(false)
  /** What to do once the seller accepts the terms. */
  const afterTerms = useRef<null | 'publish' | 'resume'>(null)
  const [showOAuth, setShowOAuth] = useState(false)
  const [oauthUrl, setOauthUrl] = useState('')
  const [reconnecting, setReconnecting] = useState(false)

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showFlash = useCallback((message: string) => {
    setFlash(message)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => { flashTimer.current = null; setFlash(null) }, 4000)
  }, [])
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  const handleItemChanged = useCallback((next: BulkItem) => {
    setItem(next.id, next)
  }, [setItem])

  const photoPass = useBulkPhotoPass({
    batchId: id ?? '',
    items,
    cards,
    batchStatus: batch?.status,
    onItemChanged: handleItemChanged,
  })

  const status = batch?.status
  const isDraft = status === 'draft'

  // Counts come off the item rows, not batch.*_count: the batch columns are
  // refreshed by the server after each drain tick and lag what's on screen.
  const counts: ProgressCounts & { ready: number } = useMemo(() => {
    const by = (s: string) => items.filter(i => i.status === s).length
    const live = by('live')
    const failed = by('failed')
    const blocked = by('blocked')
    const skipped = by('skipped')
    return {
      total: items.length,
      ready: by('ready'),
      live,
      failed,
      blocked,
      skipped,
      inFlight: by('queued') + by('uploading') + by('publishing'),
      settled: live + failed + blocked + skipped,
      retryable: failed + blocked + skipped,
    }
  }, [items])

  const openItem = useMemo(
    () => (openItemId ? items.find(i => i.id === openItemId) ?? null : null),
    [openItemId, items],
  )

  /**
   * The publish route refuses the whole batch unless every non-skipped row is
   * ready, so these rows — not the ready ones — are what stands between the
   * seller and eBay. They are the button, the filter and the bulk remove.
   */
  const notReadyItems = useMemo(
    () => items.filter(i => i.status !== 'ready' && i.status !== 'skipped'),
    [items],
  )
  const failedItems = useMemo(() => items.filter(i => i.status === 'failed'), [items])
  const notReadyCount = notReadyItems.length

  /** Rows whose slab art never rendered — the pass only picks up `pending`. */
  const failedPhotoItems = useMemo(
    () => items.filter(i => i.image_status === 'failed' && i.status !== 'skipped'),
    [items],
  )

  const visibleItems = useMemo(() => {
    if (!isDraft || filter === 'all') return items
    if (filter === 'failed') return failedItems
    return notReadyItems
  }, [isDraft, filter, items, failedItems, notReadyItems])

  /* ───────────────────────────────────────────── polling + focus ───────── */

  /**
   * Poll while the batch is running, and only then.
   *
   * Keyed on the STATUS, not the batch object: the poll replaces that object
   * every tick, so depending on it would tear the interval down and rebuild it
   * three times a second's worth of work later. A backgrounded app skips its
   * ticks and re-reads the moment it comes forward — the drain does not need us
   * watching, and a phone in a pocket should not be making requests.
   */
  const pollOnce = useCallback(async () => {
    const ok = await refresh({ silent: true })
    if (ok) {
      pollFailures.current = 0
      setPollError(false)
    } else {
      pollFailures.current += 1
      if (pollFailures.current >= POLL_FAIL_LIMIT) setPollError(true)
    }
  }, [refresh])

  useEffect(() => {
    if (!id || status !== 'running') return
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return
      void pollOnce()
    }, POLL_MS)
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void pollOnce()
    })
    return () => {
      clearInterval(timer)
      sub.remove()
      pollFailures.current = 0
      setPollError(false)
    }
  }, [id, status, pollOnce])

  // Coming back to this screen: re-read once. The mount effect covers the first
  // focus, so it is skipped.
  const firstFocus = useRef(true)
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return }
    void refresh({ silent: true })
  }, [refresh]))

  // The seller's remaining eBay allowance, read once. Advisory only — eBay's
  // number is a soft signal and the drain holds rather than fails the overflow,
  // so this never blocks a publish.
  useEffect(() => {
    let stale = false
    getBulkLimits()
      .then(next => { if (!stale) setLimits(next) })
      .catch(() => { /* Unknown allowance is the normal case; say nothing. */ })
    return () => { stale = true }
  }, [])

  /**
   * The create route quietly drops cards that already have a live eBay listing
   * (and ids that aren't the seller's). Picking 40 and landing on 28 with no
   * explanation reads as a bug, so the counts it returned are said once here.
   */
  useEffect(() => {
    const skippedCount = Number(skipped) || 0
    const missingCount = Number(missing) || 0
    const parts: string[] = []
    if (skippedCount > 0) {
      parts.push(
        `${skippedCount} card${skippedCount === 1 ? ' is' : 's are'} already listed on eBay and ` +
        `${skippedCount === 1 ? 'was' : 'were'} skipped.`,
      )
    }
    if (missingCount > 0) {
      parts.push(`${missingCount} card${missingCount === 1 ? '' : 's'} could not be added.`)
    }
    if (parts.length > 0) showFlash(parts.join(' '))
    // Once, on arrival — the params do not change while the screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ────────────────────────────────────────────────────── publishing ───── */

  const handlePublishError = useCallback((err: unknown) => {
    if (!(err instanceof BulkApiError)) {
      setPublishNote('Could not start publishing. Please try again.')
      return
    }
    const body = err.body ?? {}

    // 501: the publish flag is off. The batch is untouched and still a draft.
    if (err.status === 501) {
      setPublishNote(typeof body.message === 'string' ? body.message : err.message)
      return
    }

    // The seller terms have not been accepted on this account yet.
    if (err.status === 412 || body.error === 'disclaimer_required' ||
        /disclaimer_required/i.test(err.message)) {
      afterTerms.current = 'publish'
      setTermsOpen(true)
      return
    }

    // Batch-level: an unchosen business policy blocks every row at once, and
    // the policy pickers are a web-only screen.
    if (Array.isArray(body.batchNotReady) && body.batchNotReady.length > 0) {
      setBatchNotReady(
        body.batchNotReady
          .map((issue: { label?: string }) => issue?.label)
          .filter((label: unknown): label is string => typeof label === 'string'),
      )
      return
    }

    // Row-level: name how many, show the first few reasons, flag the rows.
    if (Array.isArray(body.notReady) && body.notReady.length > 0) {
      const rows = body.notReady as NotReadyRow[]
      setNotReadyIds(new Set(rows.map(r => r.itemId)))
      // Point the list at exactly the rows the gate named — "tap a flagged row"
      // is no help in a 100-card list where four of them are flagged.
      setFilter('needswork')
      const issues = Array.from(new Set(rows.flatMap(r => r.issues ?? []))).slice(0, 3)
      setPublishNote(
        `${rows.length} card${rows.length === 1 ? " isn't" : "s aren't"} ready` +
        (issues.length > 0 ? ` — ${issues.join('; ')}` : '') +
        '. Tap a flagged row to fix it.',
      )
      return
    }

    // "No rows are ready to publish yet.", a 409 "already submitted", anything
    // else the route authored: its sentence beats ours.
    setPublishNote(err.message)
  }, [])

  const doPublish = useCallback(async () => {
    if (!id) return
    setPublishing(true)
    setPublishNote(null)
    setBatchNotReady([])
    setNotReadyIds(new Set())
    try {
      const res = await publishBatch(id)
      setBatch(res.batch)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      showFlash(`${res.queued} card${res.queued === 1 ? '' : 's'} queued for eBay.`)
      void refresh({ silent: true })
    } catch (err) {
      handlePublishError(err)
    } finally {
      setPublishing(false)
    }
  }, [id, setBatch, refresh, showFlash, handlePublishError])

  const readyLabel = `${counts.ready} card${counts.ready === 1 ? '' : 's'}`

  // An auction batch says how long the bidding runs, because that is the part
  // of a publish there is no undoing.
  const publishTitle = useMemo(() => {
    if (batch?.settings?.listingFormat !== 'AUCTION') return `Publish ${readyLabel} to eBay?`
    const days = String(batch.settings.duration ?? '').replace('DAYS_', '') || '7'
    return `Publish ${readyLabel} as ${days}-day auctions?`
  }, [batch?.settings, readyLabel])

  const handlePublishPress = useCallback(() => {
    Alert.alert(
      publishTitle,
      'Listing carries on after you close the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            // Ask about the terms before the round trip: the publish route
            // answers 412 for this, and a modal beats an error message.
            let accepted = false
            try {
              accepted = await checkDisclaimer()
            } catch {
              // Unknown means unaccepted — the gate is cheap and idempotent.
              accepted = false
            }
            if (!accepted) {
              afterTerms.current = 'publish'
              setTermsOpen(true)
              return
            }
            void doPublish()
          },
        },
      ],
    )
  }, [publishTitle, doPublish])

  /**
   * The honest version of the publish button while rows are outstanding: the
   * route would refuse the batch, so the button does the thing that gets the
   * seller closer instead — it shows them the rows.
   */
  const handleFixPress = useCallback(() => {
    setFilter('needswork')
    setPublishNote(null)
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    Haptics.selectionAsync().catch(() => {})
  }, [])

  /** The other way out of a stuck batch: drop the rows rather than fix them. */
  const handleRemoveNotReady = useCallback(() => {
    if (!id || notReadyCount === 0 || removingNotReady) return
    const targets = notReadyItems.map(i => i.id)
    Alert.alert(
      `Remove ${targets.length} card${targets.length === 1 ? '' : 's'} from this batch?`,
      'They are taken out of this batch. The cards and their grades are untouched.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingNotReady(true)
            setPublishNote(null)
            let failures = 0
            // Sequential for the same reason Retry all is: this is up to 100
            // DELETEs and they are all ours to rate-limit.
            for (const itemId of targets) {
              try {
                await deleteItem(id, itemId)
              } catch {
                failures += 1
              }
            }
            setRemovingNotReady(false)
            setFilter('all')
            if (failures > 0) {
              setBanner(`${failures} card${failures === 1 ? '' : 's'} could not be removed.`)
            }
            void refresh({ silent: true })
          },
        },
      ],
    )
  }, [id, notReadyCount, notReadyItems, removingNotReady, refresh])

  /**
   * Batch-level photo retry. The pass only picks up rows marked `pending`, so
   * each row is flipped back before it is handed over — the same two steps the
   * row editor's own Retry photos does, once per failed card.
   */
  const handleRetryPhotosAll = useCallback(async () => {
    if (!id || retryingPhotos || failedPhotoItems.length === 0) return
    setRetryingPhotos(true)
    for (const item of failedPhotoItems) {
      try {
        const res = await updateItem(id, item.id, { image_status: 'pending' })
        setItem(item.id, res.item)
        photoPass.enqueue(item.id)
      } catch {
        // A row that would not flip stays failed and keeps its own Retry.
      }
    }
    setRetryingPhotos(false)
  }, [id, retryingPhotos, failedPhotoItems, setItem, photoPass])

  /* ─────────────────────────────────────────────────── run controls ────── */

  const runControl = useCallback(async (action: BatchControl) => {
    if (!id) return
    setControlBusy(action)
    setPublishNote(null)
    try {
      const res =
        action === 'pause' ? await pauseBatch(id)
        : action === 'resume' ? await resumeBatch(id)
        : await cancelBatch(id)
      setBatch(res.batch)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      void refresh({ silent: true })
    } catch (err) {
      // A 409 means the batch moved under us (the drain finished it, another
      // device paused it) — show what the route said and re-read the truth.
      setPublishNote(err instanceof Error ? err.message : `Could not ${action} this batch.`)
      void refresh({ silent: true })
    } finally {
      setControlBusy(null)
    }
  }, [id, setBatch, refresh])

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Stop publishing?',
      'Cards already live on eBay stay live.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: () => { void runControl('cancel') } },
      ],
    )
  }, [runControl])

  const handleTermsAccepted = useCallback(() => {
    setTermsOpen(false)
    const next = afterTerms.current
    afterTerms.current = null
    if (next === 'publish') void doPublish()
    else if (next === 'resume') void runControl('resume')
  }, [doPublish, runControl])

  const handleTermsClosed = useCallback(() => {
    setTermsOpen(false)
    afterTerms.current = null
  }, [])

  /* ──────────────────────────────────────────────── eBay reconnect ─────── */

  const startReconnect = useCallback(async () => {
    setReconnecting(true)
    setPublishNote(null)
    try {
      const url = await getOAuthUrl()
      setOauthUrl(url)
      setShowOAuth(true)
    } catch (err) {
      setPublishNote(err instanceof Error ? err.message : 'Could not open eBay sign-in.')
    } finally {
      setReconnecting(false)
    }
  }, [])

  const handleOAuthNavigation = useCallback((navState: WebViewNavigation) => {
    const result = classifyEbayOAuthNavigation(navState.url)
    if (result.type === 'pending') return
    setShowOAuth(false)
    if (result.type === 'success') {
      // Give the server a beat to persist the connection before resuming — the
      // drain reads the token the moment the batch goes back to running.
      setTimeout(() => { void runControl('resume') }, 600)
    } else if (result.type === 'failure') {
      setPublishNote(result.message)
    } else {
      setPublishNote('eBay sign-in was cancelled — this batch is still paused.')
    }
  }, [runControl])

  /* ─────────────────────────────────────────────────────────── retry ───── */

  const canRetry = !!status && RETRY_BATCH_STATUSES.has(status)

  /** Returns a sentence to show the seller, or null when the row was re-queued. */
  const retryOne = useCallback(async (itemId: string): Promise<string | null> => {
    if (!id) return 'This batch is no longer open.'
    try {
      const res = await retryItem(id, itemId)
      setItem(itemId, res.item)
      // A retry can reopen a finished batch, which is a batch-level change.
      if (res.batch) setBatch(res.batch)
      if (res.notReady && res.notReady.length > 0) {
        return `Still not ready: ${res.notReady.join(', ')}`
      }
      // A re-check that found the card still listed is a real answer, not a
      // no-op — say so, or the button looks broken.
      if (res.skipped) return 'Still listed on eBay — nothing to do.'
      if (res.alreadyLive) return 'This card is already live on eBay.'
      if (!res.changed) return 'Nothing changed for this card.'
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not retry this card.'
    }
  }, [id, setItem, setBatch])

  /** Sequential on purpose — 50 parallel POSTs is how you rate-limit your own API. */
  const handleRetryAll = useCallback(async () => {
    const targets = items.filter(i => RETRYABLE_STATUSES.has(i.status))
    if (targets.length === 0 || retryAll) return
    setPublishNote(null)
    stopRetryAll.current = false
    setRetryAll({ done: 0, total: targets.length })
    let lastMessage: string | null = null
    let stoppedAt: number | null = null
    for (let i = 0; i < targets.length; i++) {
      const message = await retryOne(targets[i].id)
      if (message) lastMessage = message
      setRetryAll({ done: i + 1, total: targets.length })
      // Checked after the card, not before it: a retry already on the wire is
      // finished rather than abandoned half-published.
      if (stopRetryAll.current) { stoppedAt = i + 1; break }
    }
    stopRetryAll.current = false
    setRetryAll(null)
    if (stoppedAt !== null) {
      setPublishNote(`Stopped after ${stoppedAt} of ${targets.length} cards.`)
    } else if (lastMessage) {
      setPublishNote(lastMessage)
    }
    void refresh({ silent: true })
  }, [items, retryAll, retryOne, refresh])

  const handleStopRetryAll = useCallback(() => {
    stopRetryAll.current = true
  }, [])

  /* ───────────────────────────────────────────────────────── draft UI ──── */

  const handleSettingsSaved = useCallback((nextBatch: typeof batch, reseeded: number) => {
    if (nextBatch) setBatch(nextBatch)
    // The route re-seeds title/price/description on every row whose *_edited
    // flag is false, so the list on screen is stale until it is re-read.
    void refresh({ silent: true })
    showFlash(`Settings saved · ${reseeded} card${reseeded === 1 ? '' : 's'} updated`)
  }, [setBatch, refresh, showFlash])

  const handleDeleteBatch = useCallback(() => {
    if (!id) return
    Alert.alert(
      'Delete this batch?',
      'The batch and its drafts are removed. Your cards and their grades are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteBatch(id)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
              router.back()
            } catch (err) {
              setDeleting(false)
              setBanner(err instanceof Error ? err.message : 'Could not delete this batch.')
            }
          },
        },
      ],
    )
  }, [id, router])

  const pauseReason = status === 'paused' && batch?.last_error
    ? PAUSE_REASONS[batch.last_error]
    : null

  /** eBay's soft monthly ceiling, when it is both known and about to bite. */
  const allowanceNote =
    isDraft && typeof limits?.amountAvailable === 'number' && limits.amountAvailable < counts.ready
      ? `eBay allows about ${limits.amountAvailable} more listing${limits.amountAvailable === 1 ? '' : 's'} this month — the rest will be held.`
      : null

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppHeaderBar showBack title="Bulk listing" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.purple[600]} />
        </View>
        <MobileTabBar />
      </View>
    )
  }

  if (notFound || !batch) {
    return (
      <View style={styles.screen}>
        <AppHeaderBar showBack title="Bulk listing" />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.gray[400]} />
          {/* `error` is normally the route's own sentence; a 404 that arrived
              before it was set would otherwise render nothing at all. */}
          <Text style={styles.missingText}>
            {error ?? "This batch isn't available anymore."}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
        <MobileTabBar />
      </View>
    )
  }

  const chip = BATCH_STATUS_STYLE[batch.status] ?? BATCH_STATUS_STYLE.draft
  /** Nothing is outstanding, so the button really can publish. */
  const canAttemptPublish = notReadyCount === 0
  const publishDisabled =
    publishing || photoPass.running || removingNotReady ||
    (canAttemptPublish && counts.ready === 0)

  return (
    <View style={styles.screen}>
      <AppHeaderBar showBack title="Bulk listing" />

      {isDraft ? (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
              <Text style={[styles.statusChipText, { color: chip.fg }]}>
                {BATCH_STATUS_LABEL[batch.status] ?? batch.status}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => setSettingsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open batch settings"
            >
              <Ionicons name="options-outline" size={14} color={Colors.purple[700]} />
              <Text style={styles.settingsBtnText}>Batch settings</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerCounts}>
            {counts.total} card{counts.total === 1 ? '' : 's'} · {counts.ready} ready
            {' · '}{counts.live} live · {counts.failed} failed
          </Text>
          <Text style={styles.headerDate}>
            {describeListingFormat(batch.settings)} · Price: {describePriceRule(batch.settings?.priceRule)}
            {' · '}Shipping: {describeShipping(batch.settings)}
          </Text>
          <Text style={styles.headerDate}>
            Started {new Date(batch.created_at).toLocaleDateString()}
          </Text>
        </View>
      ) : null}

      {flash && (
        <View style={styles.flashBanner}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.green[600]} />
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      )}

      {/* A draft batch's pause reason never applies; progress mode renders its
          own, with the action that clears it. */}
      {isDraft && pauseReason && (
        <View style={styles.pauseBanner}>
          <Ionicons name="pause-circle" size={16} color={Colors.amber[600]} />
          <Text style={styles.pauseText}>{pauseReason}</Text>
        </View>
      )}

      {/* Server-authored copy — rendered verbatim. */}
      {banner && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{banner}</Text>
        </View>
      )}
      {/* While the batch runs, a read failure is OUR problem, not the seller's:
          the drain is on the server. One bad poll says nothing at all, and
          three say it in terms that do not suggest the batch stopped. */}
      {error && !notFound && (status !== 'running' || pollError) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            {status === 'running' ? POLL_ERROR_MESSAGE : error}
          </Text>
        </View>
      )}
      {publishNote && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{publishNote}</Text>
        </View>
      )}
      {batchNotReady.length > 0 && (
        <View style={styles.errorBanner}>
          {batchNotReady.map(label => (
            <Text key={label} style={styles.errorText}>{label}</Text>
          ))}
          {/* The business-policy pickers are a web-only screen; sending the
              seller round in circles on the phone would be worse. */}
          <Text style={styles.errorHint}>Choose policies on the web version.</Text>
        </View>
      )}

      {isDraft && (
        <BulkPhotoPass
          pass={photoPass}
          failedPhotoCount={failedPhotoItems.length}
          onRetryPhotos={() => { void handleRetryPhotosAll() }}
          retryingPhotos={retryingPhotos}
        />
      )}

      {/* Draft-mode filter strip. A zero chip is not a filter worth offering,
          so only All is always there. */}
      {isDraft && items.length > 0 && (
        <View style={styles.filterRow}>
          {([
            ['all', 'All', items.length],
            ['needswork', 'Needs work', notReadyCount],
            ['failed', 'Failed', failedItems.length],
          ] as const).map(([key, label, count]) => (
            (key === 'all' || count > 0) && (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, filter === key && styles.filterChipActive]}
                onPress={() => setFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === key }}
                accessibilityLabel={`${label}, ${count} cards`}
              >
                <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            )
          ))}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={visibleItems}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 12 + Math.max(insets.bottom, 4) }}
        refreshing={refreshing}
        onRefresh={() => { void refresh() }}
        ListHeaderComponent={
          isDraft ? null : (
            <BulkProgressPanel
              batch={batch}
              counts={counts}
              busy={controlBusy}
              onPause={() => { void runControl('pause') }}
              onResume={() => { void runControl('resume') }}
              onCancel={handleCancel}
              onAcceptTerms={() => { afterTerms.current = 'resume'; setTermsOpen(true) }}
              onReconnect={() => { void startReconnect() }}
              reconnecting={reconnecting}
              onRetryAll={() => { void handleRetryAll() }}
              retryAll={retryAll}
              onStopRetryAll={handleStopRetryAll}
              // Replace, not push: this screen is where a publish ends, and
              // pushing the tab on top of it left Back walking into a finished
              // batch the seller had already said goodbye to.
              onBack={() => router.replace('/(tabs)/instalist-marketplace' as any)}
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.missingText}>
              {isDraft && filter !== 'all' && items.length > 0
                ? 'No cards match this filter.'
                : 'This batch has no cards in it.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          isDraft ? (
            <TouchableOpacity
              style={[styles.deleteBatchBtn, deleting && styles.deleteBatchBtnDisabled]}
              onPress={handleDeleteBatch}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete this batch"
            >
              {deleting
                ? <ActivityIndicator size="small" color={Colors.red[600]} />
                : <Ionicons name="trash-outline" size={14} color={Colors.red[600]} />}
              <Text style={styles.deleteBatchText}>Delete batch</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <BulkRow
            item={item}
            card={cards.get(item.card_id)}
            listing={item.listing_row_id ? listings.get(item.listing_row_id) : undefined}
            working={photoPass.currentItemId === item.id}
            flagged={notReadyIds.has(item.id)}
            // Progress mode: only a row the seller can do something about opens.
            openable={isDraft || RETRYABLE_STATUSES.has(item.status)}
            onPress={() => setOpenItemId(item.id)}
          />
        )}
      />

      {/* ─────────────────────────────────────────── publish bar ─────────── */}
      {/* MobileTabBar below already pads the home indicator, so this bar does
          not pad it a second time. */}
      {isDraft && (
        <View style={styles.publishBar}>
          <View style={styles.publishTopRow}>
            <View style={styles.publishTextCol}>
              <Text style={styles.publishCount}>
                {counts.ready} of {counts.total - counts.skipped} ready
                {counts.skipped > 0 ? ` · ${counts.skipped} skipped` : ''}
              </Text>
              {allowanceNote && <Text style={styles.publishHint}>{allowanceNote}</Text>}
            </View>
            <TouchableOpacity
              style={[styles.publishBtn, publishDisabled && styles.publishBtnDisabled]}
              onPress={canAttemptPublish ? handlePublishPress : handleFixPress}
              disabled={publishDisabled}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                canAttemptPublish
                  ? `Publish ${readyLabel} to eBay`
                  : `Show the ${notReadyCount} cards that are not ready`
              }
            >
              {publishing
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons
                    name={canAttemptPublish ? 'rocket' : 'construct'}
                    size={18}
                    color={Colors.white}
                  />}
              <Text style={styles.publishBtnText}>
                {photoPass.running
                  ? 'Preparing photos…'
                  : canAttemptPublish
                    ? `Publish ${readyLabel}`
                    : `Fix ${notReadyCount} card${notReadyCount === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>
          </View>
          {/* The publish route is all-or-nothing, so a seller who does not want
              to fix those rows needs the other way past them. */}
          {!canAttemptPublish && !photoPass.running && (
            <TouchableOpacity
              style={styles.removeNotReadyBtn}
              onPress={handleRemoveNotReady}
              disabled={removingNotReady}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${notReadyCount} cards that are not ready`}
            >
              {removingNotReady && <ActivityIndicator size="small" color={Colors.gray[500]} />}
              <Text style={styles.removeNotReadyText}>
                Remove the {notReadyCount} not-ready card{notReadyCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isDraft && (
        <BulkSettingsSheet
          visible={settingsOpen}
          batch={batch}
          onClose={() => setSettingsOpen(false)}
          onSaved={handleSettingsSaved}
          onConflict={message => { setBanner(message); void refresh({ silent: true }) }}
        />
      )}

      {openItem && (
        <BulkItemSheet
          visible
          batchId={batch.id}
          item={openItem}
          card={cards.get(openItem.card_id)}
          editable={
            isDraft ||
            (REPAIRABLE_ITEM_STATUSES.has(openItem.status) &&
              REPAIRABLE_BATCH_STATUSES.has(batch.status))
          }
          // Photos are fixed once a batch has run — re-rendering slab art
          // belongs to the review step, and the drain publishes whatever URLs
          // the row already carries.
          photosEditable={isDraft}
          listingFormat={batch.settings?.listingFormat === 'AUCTION' ? 'AUCTION' : 'FIXED_PRICE'}
          onClose={() => setOpenItemId(null)}
          onItemChanged={handleItemChanged}
          onItemRemoved={() => { setOpenItemId(null); void refresh({ silent: true }) }}
          onEnqueuePhotos={photoPass.enqueue}
          onRetry={
            !isDraft && canRetry && RETRYABLE_STATUSES.has(openItem.status)
              ? () => retryOne(openItem.id)
              : undefined
          }
        />
      )}

      <SellerTermsGate
        visible={termsOpen}
        onClose={handleTermsClosed}
        onAccepted={handleTermsAccepted}
      />

      <OAuthModal
        visible={showOAuth}
        url={oauthUrl}
        insets={insets.top}
        onClose={() => setShowOAuth(false)}
        onNavStateChange={handleOAuthNavigation}
      />

      <MobileTabBar />
    </View>
  )
}

/** One card in the batch. Tapping it opens the row editor. */
function BulkRow({
  item, card, listing, working, flagged, openable, onPress,
}: {
  item: BulkItem
  card: BulkCard | undefined
  /** The eBay listing this row published, when it has one. */
  listing: BulkListingRef | undefined
  /** The photo pass is rendering this row right now. */
  working: boolean
  /** The publish gate named this row as not ready. */
  flagged: boolean
  openable: boolean
  onPress: () => void
}) {
  const status = ITEM_STATUS_STYLE[item.status] ?? ITEM_STATUS_STYLE.draft
  // The row's own uploaded photos win over the card thumbnail: once the photo
  // pass has run, that IS what the buyer will see on eBay.
  const thumb = item.image_urls?.[0] ?? card?.front_url ?? null
  const showMessage =
    item.status === 'failed' || item.status === 'blocked' || item.status === 'skipped'

  const body = (
    <>
      <View style={styles.thumb}>
        {thumb ? <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" /> : null}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title?.trim() || card?.card_name || 'Untitled'}
        </Text>
        <View style={styles.rowMetaRow}>
          <Text style={styles.rowPrice}>{formatPrice(item.price)}</Text>
          <View style={[styles.itemChip, { backgroundColor: status.bg }]}>
            <Text style={[styles.itemChipText, { color: status.fg }]}>{status.label}</Text>
          </View>
          {working && <ActivityIndicator size="small" color={Colors.purple[600]} />}
        </View>

        {item.readiness && item.readiness.length > 0 && (
          <View style={styles.issueRow}>
            {item.readiness.map(issue => (
              <View key={issue.code} style={styles.issueChip}>
                <Text style={styles.issueChipText}>{issue.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Server-authored copy — rendered verbatim, it names the exact card
            problem (or the listing this card already has). */}
        {showMessage && !!item.error_message && (
          <Text style={item.status === 'failed' ? styles.failedNote : styles.mutedNote}>
            {item.error_message}
          </Text>
        )}

        {item.status === 'live' && listing?.listing_url && (
          <TouchableOpacity
            onPress={() => { Linking.openURL(listing.listing_url as string).catch(() => {}) }}
            accessibilityRole="link"
            accessibilityLabel="View this listing on eBay"
          >
            <Text style={styles.listingLink}>
              View on eBay{listing.listing_id ? ` (item ${listing.listing_id})` : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {openable && (
        <Ionicons name="chevron-forward" size={16} color={Colors.gray[300]} style={{ alignSelf: 'center' }} />
      )}
    </>
  )

  // A row with nothing to open is a plain row, not a button that does nothing.
  if (!openable) {
    return <View style={[styles.row, flagged && styles.rowFlagged]}>{body}</View>
  }

  return (
    <TouchableOpacity
      style={[styles.row, flagged && styles.rowFlagged]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.title?.trim() || 'untitled listing'}`}
    >
      {body}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray[50] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  missingText: { fontSize: 14, color: Colors.gray[600], textAlign: 'center', lineHeight: 20 },
  backBtn: {
    backgroundColor: Colors.purple[600],
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
  },
  backBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
    paddingHorizontal: 12, paddingVertical: 10, gap: 4,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusChipText: { fontSize: 10, fontWeight: '800' },
  settingsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50],
  },
  settingsBtnText: { fontSize: 11, fontWeight: '700', color: Colors.purple[700] },
  headerCounts: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  headerDate: { fontSize: 11, color: Colors.gray[500] },

  flashBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.green[50],
    paddingHorizontal: 12, paddingVertical: 8,
  },
  flashText: { flex: 1, fontSize: 12, color: Colors.green[700], fontWeight: '600' },

  pauseBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.amber[50],
    borderBottomWidth: 1, borderBottomColor: Colors.amber[200],
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pauseText: { flex: 1, fontSize: 12, color: Colors.amber[700], lineHeight: 17 },
  errorBanner: {
    backgroundColor: Colors.red[50],
    paddingHorizontal: 12, paddingVertical: 8, gap: 2,
  },
  errorText: { fontSize: 12, color: Colors.red[700], lineHeight: 17 },
  errorHint: { fontSize: 12, fontWeight: '700', color: Colors.red[700] },

  separator: { height: 1, backgroundColor: Colors.gray[100] },
  row: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  rowFlagged: {
    backgroundColor: Colors.amber[50],
    borderLeftWidth: 3, borderLeftColor: Colors.amber[500],
  },
  thumb: {
    width: 48, height: 64, borderRadius: 6,
    backgroundColor: Colors.gray[100], overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray[900], lineHeight: 18 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowPrice: { fontSize: 12, color: Colors.gray[600] },
  itemChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  itemChipText: { fontSize: 10, fontWeight: '800' },
  issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  issueChip: {
    backgroundColor: Colors.amber[50],
    borderColor: Colors.amber[200], borderWidth: 1,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  issueChipText: { fontSize: 10, fontWeight: '700', color: Colors.amber[700] },
  mutedNote: { fontSize: 11, color: Colors.gray[500], lineHeight: 15 },
  failedNote: { fontSize: 11, color: Colors.red[600], lineHeight: 15 },
  listingLink: { fontSize: 11, fontWeight: '700', color: Colors.purple[600] },

  filterRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
    paddingHorizontal: 12, paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  filterChipActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  filterChipText: { fontSize: 11, fontWeight: '700', color: Colors.gray[500] },
  filterChipTextActive: { color: Colors.purple[700] },

  publishBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray[200],
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12,
    gap: 8,
  },
  publishTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  removeNotReadyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 6,
  },
  removeNotReadyText: { fontSize: 12, fontWeight: '600', color: Colors.gray[600] },
  publishTextCol: { flex: 1, minWidth: 0, gap: 2 },
  publishCount: { fontSize: 12, fontWeight: '700', color: Colors.gray[900] },
  publishHint: { fontSize: 10, color: Colors.amber[700], lineHeight: 14 },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.purple[600], borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishBtnText: { fontSize: 14, fontWeight: '800', color: Colors.white },

  deleteBatchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 16, marginHorizontal: 12, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  deleteBatchBtnDisabled: { opacity: 0.4 },
  deleteBatchText: { fontSize: 12, fontWeight: '700', color: Colors.red[600] },
})
