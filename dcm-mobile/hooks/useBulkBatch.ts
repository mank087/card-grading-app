/**
 * Data layer for the native bulk review screen.
 *
 * Kept out of the screen so the later phases (row editor, photo pass,
 * publish/progress) can mutate one row after a PATCH without re-downloading
 * the batch — `setItem` merges a server-returned row into local state, which
 * is what every mutating bulk route hands back.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getBatch, isBulkUnavailable, BulkApiError,
} from '@/lib/ebayBulkApi'
import {
  MAX_BULK_ITEMS,
  type BulkBatch, type BulkItem, type BulkCard, type BulkListingRef,
} from '@/lib/ebayBulkTypes'

/** Shown for a 404 — the flag gate and "not your batch" are indistinguishable. */
export const BATCH_NOT_FOUND_MESSAGE =
  'This batch no longer exists, or bulk listing is not switched on for your account.'

export interface UseBulkBatch {
  batch: BulkBatch | null
  items: BulkItem[]
  /** Card rows keyed by id — the item rows carry only `card_id`. */
  cards: Map<string, BulkCard>
  /** Published listings keyed by `BulkItem.listing_row_id`. */
  listings: Map<string, BulkListingRef>
  loading: boolean
  /** A re-read the seller asked for is in flight — drives the pull-to-refresh spinner. */
  refreshing: boolean
  error: string | null
  /** True when the 404 was the feature gate / a missing batch, not a fetch failure. */
  notFound: boolean
  /**
   * Re-read the batch. Resolves to false when the read failed, so a caller that
   * polls can count consecutive failures rather than alarming on the first one.
   * `silent` keeps the poll out of the pull-to-refresh spinner.
   */
  refresh: (opts?: { silent?: boolean }) => Promise<boolean>
  /** Merge a patch (usually a whole server row) into one item. */
  setItem: (itemId: string, patch: Partial<BulkItem>) => void
  setBatch: (patch: Partial<BulkBatch>) => void
}

export function useBulkBatch(batchId: string | undefined): UseBulkBatch {
  const [batch, setBatchState] = useState<BulkBatch | null>(null)
  const [items, setItems] = useState<BulkItem[]>([])
  const [cards, setCards] = useState<Map<string, BulkCard>>(new Map())
  const [listings, setListings] = useState<Map<string, BulkListingRef>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  /**
   * One counter per refresh. The review screen polls every 3 s while a batch
   * runs, so a slow page fetch can land after a newer refresh — or after a
   * PATCH the seller just made and `setItem` already merged. The stale answer
   * is dropped rather than allowed to overwrite it.
   */
  const seqRef = useRef(0)

  const refresh = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (!batchId) {
      setLoading(false)
      setNotFound(true)
      setError(BATCH_NOT_FOUND_MESSAGE)
      return false
    }
    setError(null)
    if (!opts?.silent) setRefreshing(true)
    const seq = ++seqRef.current
    const current = () => mounted.current && seqRef.current === seq
    try {
      const allItems: BulkItem[] = []
      const allCards = new Map<string, BulkCard>()
      const allListings = new Map<string, BulkListingRef>()
      let offset = 0
      // The page size is 100 and so is the batch cap, so this normally runs
      // once; the loop exists because `hasMore` is "the page was full", which
      // is true for an exactly-100-row batch whose next page is empty.
      for (;;) {
        const page = await getBatch(batchId, offset)
        if (!current()) return false
        allItems.push(...page.items)
        for (const c of page.cards) allCards.set(c.id, c)
        for (const l of page.listings) allListings.set(l.id, l)
        if (!page.hasMore || page.items.length === 0 || allItems.length >= MAX_BULK_ITEMS) {
          setBatchState(page.batch)
          break
        }
        offset += page.items.length
      }
      if (!current()) return false
      setItems(allItems)
      setCards(allCards)
      setListings(allListings)
      setNotFound(false)
      return true
    } catch (err) {
      if (!current()) return false
      if (isBulkUnavailable(err) || (err instanceof BulkApiError && err.status === 404)) {
        setNotFound(true)
        setError(BATCH_NOT_FOUND_MESSAGE)
      } else {
        setError(err instanceof Error ? err.message : 'Could not load this batch.')
      }
      return false
    } finally {
      if (current()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [batchId])

  // The first read has the full-screen spinner, so it stays out of the
  // pull-to-refresh one.
  useEffect(() => { setLoading(true); void refresh({ silent: true }) }, [refresh])

  const setItem = useCallback((itemId: string, patch: Partial<BulkItem>) => {
    setItems(prev => prev.map(i => (i.id === itemId ? { ...i, ...patch } : i)))
  }, [])

  const setBatch = useCallback((patch: Partial<BulkBatch>) => {
    setBatchState(prev => (prev ? { ...prev, ...patch } : prev))
  }, [])

  return {
    batch, items, cards, listings, loading, refreshing, error, notFound,
    refresh, setItem, setBatch,
  }
}
