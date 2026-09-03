/**
 * Bulk eBay listing client — every /api/ebay/bulk/** route the native flow
 * touches.
 *
 * Same posture as lib/ebayApi.ts: one module-private auth-header helper, the
 * shared API_BASE, and no client-side state. The bulk routes are gated behind
 * a server flag (EBAY_BULK_ENABLED) which answers 404 BEFORE auth, so "the
 * feature is off" and "that batch isn't yours" look identical on the wire —
 * both are handled as "not available / not found" in the UI.
 */

import { supabase } from './supabase'
import type {
  BulkBatchPayload, BulkBatchSummary, BulkBatch, BulkItem, BulkBatchSettings,
  BulkLimits, ReadinessIssue,
} from './ebayBulkTypes'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * A non-2xx from a bulk route. `message` is the server's own `error`/`message`
 * text verbatim — the routes author seller-facing copy (readiness reasons,
 * pause reasons, "already submitted") that is better than anything we could
 * invent here. `body` carries the structured extras some routes return
 * alongside it (`notReady`, `batchNotReady`, `error: 'not_enabled'`).
 */
export class BulkApiError extends Error {
  status: number
  body: any

  constructor(message: string, status: number, body?: any) {
    super(message)
    this.name = 'BulkApiError'
    this.status = status
    this.body = body
  }
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/bulk${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      (typeof json?.error === 'string' && json.error) ||
      (typeof json?.message === 'string' && json.message) ||
      `Bulk request failed (HTTP ${res.status})`
    throw new BulkApiError(message, res.status, json)
  }
  return json as T
}

/**
 * True when the failure means "bulk listing isn't switched on for this
 * account". The flag gate answers 404 `{"error":"Not found"}` before auth, and
 * so does a batch that isn't the caller's — from the client's side they are
 * the same recoverable state: stop offering bulk, don't alarm the seller.
 */
export function isBulkUnavailable(err: unknown): boolean {
  return err instanceof BulkApiError && err.status === 404 && err.body?.error === 'Not found'
}

// ─── Availability probe ────────────────────────────────────────────────────

let probeResult: boolean | null = null
let probeInFlight: Promise<boolean> | null = null

/**
 * Is bulk listing available to this seller? There is no client feature flag on
 * mobile (EXPO_PUBLIC_* are baked at build time and the server flag can flip
 * without a new binary), so the probe IS the flag: a cheap batches list.
 *
 * A non-404 failure (network, 500, an expired session) answers `false` and is
 * NOT cached — bulk UI stays hidden for this attempt rather than showing a
 * strip that would error on tap, and the next refresh gets to try again. Only
 * a definitive 200/404 is remembered for the session.
 */
export async function probeBulkAvailable(): Promise<boolean> {
  if (probeResult !== null) return probeResult
  if (probeInFlight) return probeInFlight

  probeInFlight = (async () => {
    try {
      await listBatches(5)
      probeResult = true
    } catch (err) {
      if (isBulkUnavailable(err)) probeResult = false
      else return false
    } finally {
      probeInFlight = null
    }
    return probeResult ?? false
  })()

  return probeInFlight
}

/** Forget the cached probe — call after a sign-out or an account switch. */
export function resetBulkProbe(): void {
  probeResult = null
  probeInFlight = null
}

// ─── Batches ───────────────────────────────────────────────────────────────

export async function listBatches(limit = 8): Promise<BulkBatchSummary[]> {
  const json = await request<{ batches: BulkBatchSummary[] }>(
    `/batches?limit=${Math.min(20, Math.max(1, limit))}`,
  )
  return json.batches ?? []
}

export interface CreateBatchResult {
  success: true
  batchId: string
  itemCount: number
  /** Cards dropped because they already have a live/pending eBay listing. */
  skippedCount: number
  /** Ids that aren't the caller's cards — silently omitted from the batch. */
  missingCount: number
}

/**
 * Start a batch. Settings are optional and normally omitted: the route seeds
 * them from the seller's saved listing defaults, which is what they'd expect
 * to get anyway.
 */
export async function createBatch(
  cardIds: string[],
  settings?: Partial<BulkBatchSettings>,
): Promise<CreateBatchResult> {
  return request<CreateBatchResult>('/batches', {
    method: 'POST',
    body: settings ? { cardIds, settings } : { cardIds },
  })
}

/** One page of a batch. Page size is 100 server-side; follow `hasMore`. */
export async function getBatch(batchId: string, offset = 0): Promise<BulkBatchPayload> {
  return request<BulkBatchPayload>(`/batches/${batchId}?offset=${offset}`)
}

export async function updateBatchSettings(
  batchId: string,
  settings: Partial<BulkBatchSettings>,
): Promise<{ success: true; batch: BulkBatch; reseeded: number }> {
  return request(`/batches/${batchId}`, { method: 'PATCH', body: { settings } })
}

/** Draft batches only — a submitted batch is history and stays. */
export async function deleteBatch(batchId: string): Promise<{ success: true }> {
  return request(`/batches/${batchId}`, { method: 'DELETE' })
}

// ─── Items ─────────────────────────────────────────────────────────────────

/** The item fields the routes accept. Each one sets its `*_edited` flag. */
export interface BulkItemPatch {
  title?: string
  price?: number | string | null
  description_html?: string
  item_specifics?: BulkItem['item_specifics']
  image_urls?: string[]
  image_status?: 'pending' | 'ready' | 'failed'
}

export async function updateItem(
  batchId: string,
  itemId: string,
  patch: BulkItemPatch,
): Promise<{ success: true; item: BulkItem }> {
  return request(`/batches/${batchId}/items/${itemId}`, { method: 'PATCH', body: patch })
}

/** Drop a card from a draft batch. */
export async function deleteItem(batchId: string, itemId: string): Promise<{ success: true }> {
  return request(`/batches/${batchId}/items/${itemId}`, { method: 'DELETE' })
}

/** Rebuild title/description/specifics/price from the card. Photos untouched. */
export async function regenerateItem(
  batchId: string,
  itemId: string,
): Promise<{ success: true; item: BulkItem }> {
  return request(`/batches/${batchId}/items/${itemId}/regenerate`, { method: 'POST' })
}

export interface RecheckResult {
  success: true
  item: BulkItem
  changed: boolean
  /** The card picked up an active listing elsewhere since the batch started. */
  stillListed?: true
}

export async function recheckItem(batchId: string, itemId: string): Promise<RecheckResult> {
  return request(`/batches/${batchId}/items/${itemId}/recheck`, { method: 'POST' })
}

export interface RetryResult {
  success: true
  item: BulkItem
  changed: boolean
  alreadyLive?: true
  skipped?: true
  notReady?: string[]
  /** Present when the retry reopened a complete/failed batch. */
  batch?: BulkBatch
}

export async function retryItem(batchId: string, itemId: string): Promise<RetryResult> {
  return request(`/batches/${batchId}/items/${itemId}/retry`, { method: 'POST' })
}

// ─── Run control ───────────────────────────────────────────────────────────

/** Rows the publish gate refused, as returned in a 400 body. */
export interface NotReadyRow {
  itemId: string
  cardId: string
  status: string
  issues: string[]
}

export async function publishBatch(
  batchId: string,
): Promise<{ success: true; queued: number; batch: BulkBatch }> {
  return request(`/batches/${batchId}/publish`, { method: 'POST' })
}

export async function pauseBatch(
  batchId: string,
): Promise<{ success: true; batch: BulkBatch }> {
  return request(`/batches/${batchId}/pause`, { method: 'POST' })
}

export async function resumeBatch(
  batchId: string,
): Promise<{ success: true; queued: number; batch: BulkBatch }> {
  return request(`/batches/${batchId}/resume`, { method: 'POST' })
}

/** Stops the drain. Nothing already live on eBay is undone. */
export async function cancelBatch(
  batchId: string,
): Promise<{ success: true; released: number; batch: BulkBatch }> {
  return request(`/batches/${batchId}/cancel`, { method: 'POST' })
}

// ─── Allowance ─────────────────────────────────────────────────────────────

export async function getBulkLimits(): Promise<BulkLimits> {
  return request<BulkLimits>('/limits')
}

// Re-exported so screens can type a publish-gate body without a second import.
export type { ReadinessIssue }
