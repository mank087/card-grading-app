/**
 * InstaList Marketplace API helpers for the mobile app.
 *
 * Mirrors the ebayApi.ts pattern — every call hits the same web backend
 * routes the marketplace web page uses, so mobile + web are guaranteed
 * to see the same data without forking server-side logic.
 *
 * Auth: Bearer token from the active Supabase session (see ebayApi.ts).
 */

import { supabase } from './supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

// ─── Eligible cards (List a Card picker) ───────────────────────────────────

/**
 * Raw card row returned by /api/ebay/eligible-cards. We pass it through
 * to ebay-list.tsx by id, so only the picker-display fields are typed
 * strictly — the rest is `unknown`.
 */
export interface EligibleCard {
  id: string
  card_name: string | null
  category: string | null
  serial: string | null
  front_url: string | null
  back_url: string | null
  front_path: string | null
  back_path: string | null
  conversational_whole_grade: number | null
  dcm_price_estimate: number | null
  ebay_price_median: number | null
  created_at: string
  [key: string]: unknown
}

export interface EligibleCardsResponse {
  cards: EligibleCard[]
  alreadyListedCount: number
  truncated?: boolean
}

export async function fetchEligibleCards(): Promise<EligibleCardsResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/eligible-cards`, { headers })
  if (!res.ok) throw new Error(`Couldn't load your graded cards (HTTP ${res.status})`)
  const json = await res.json()
  return {
    cards: json.cards ?? [],
    alreadyListedCount: json.alreadyListedCount ?? 0,
    truncated: !!json.truncated,
  }
}

// ─── Marketplace stats (header strip) ──────────────────────────────────────

export interface MarketplaceStats {
  activeCount: number
  soldCount: number
  endedCount: number
  grossRevenue: number
  totalViews: number
  totalWatchers: number
  currency: string
}

export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/stats`, { headers })
  if (!res.ok) throw new Error(`Couldn't load marketplace stats (HTTP ${res.status})`)
  return res.json()
}

// ─── My listings (Active / Sold / Ended tabs) ──────────────────────────────

export interface MarketplaceListing {
  id: string
  cardId: string
  cardName: string
  cardCategory: string | null
  cardSerial: string | null
  cardGrade: number | null
  thumbnailUrl: string | null
  sku: string
  listingId: string | null
  listingUrl: string | null
  title: string
  price: number
  currency: string
  quantity: number
  quantitySold: number
  listingFormat: string
  duration: string
  status: string
  viewCount: number
  watchCount: number
  publishedAt: string | null
  endedAt: string | null
  soldAt: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface MyListingsResponse {
  active: MarketplaceListing[]
  sold: MarketplaceListing[]
  ended: MarketplaceListing[]
}

export async function fetchMyListings(): Promise<MyListingsResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/my-listings`, { headers })
  if (!res.ok) throw new Error(`Couldn't load your listings (HTTP ${res.status})`)
  const json = await res.json()
  return {
    active: json.active ?? [],
    sold: json.sold ?? [],
    ended: json.ended ?? [],
  }
}

// ─── On-demand sync (POST) ─────────────────────────────────────────────────

export interface SyncMeResponse {
  success?: boolean
  skipped?: boolean
  retryAfterSec?: number
  activeCount?: number
  sold?: number
  ended?: number
  /** Total status transitions = sold + ended. Convenience for the pill. */
  transitions?: number
  error?: string
}

/**
 * Trigger a sync of the user's eBay listings (active → sold/ended diffs).
 * Self-rate-limited server-side (3 min window) — safe to call on every
 * marketplace screen mount + on focus-refresh.
 */
export async function triggerSyncMe(): Promise<SyncMeResponse> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/sync-me`, { method: 'POST', headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok && !json.skipped) {
    // Surface a friendly message; caller decides whether to show it.
    return { error: json.error || `Sync failed (HTTP ${res.status})` }
  }
  const transitions = (json.sold ?? 0) + (json.ended ?? 0)
  return { ...json, transitions }
}

// ─── Override: force-mark a listing as ended in DCM ────────────────────────

/**
 * Used by the "I've already ended this listing" override when eBay's API
 * still reports the listing as Active due to propagation delay. Mirrors
 * the web modal's button.
 */
export async function markListingEnded(listingRowId: string): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/listing/mark-ended`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ listingRowId }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error || `Failed to mark listing ended (HTTP ${res.status})`)
  }
}
