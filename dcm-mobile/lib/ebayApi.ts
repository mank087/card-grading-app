/**
 * eBay API helpers for the mobile app.
 * All calls go through the web backend API routes.
 */

import { supabase } from './supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

// ─── Connection Status ───

export interface EbayConnectionStatus {
  configured: boolean
  connected: boolean
  environment: string
  connection?: {
    ebay_username: string
    ebay_user_id: string
    marketplace_id: string
    connected_at: string
    token_expires_at: string
  }
}

export async function checkEbayStatus(): Promise<EbayConnectionStatus> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/status`, { headers })
  if (!res.ok) throw new Error('Failed to check eBay status')
  return res.json()
}

// ─── Existing Listing Check ───

// Mirrors the response shape of GET /api/ebay/listing/check (snake_case rows
// straight from the ebay_listings table).
export interface ExistingListingCheck {
  hasListing: boolean
  listing?: {
    id: string
    listing_id: string
    listing_url?: string | null
    status: string
    created_at?: string
  } | null
  previousListing?: {
    listing_id: string
    status: string
  } | null
  verified?: boolean
  message?: string
}

export async function checkExistingListing(cardId: string): Promise<ExistingListingCheck> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/listing/check?cardId=${cardId}`, { headers })
  if (!res.ok) return { hasListing: false }
  return res.json()
}

// ─── Image Upload ───

export interface ImageUploadResult {
  urls: {
    front?: string
    back?: string
    miniReport?: string
    rawFront?: string
    rawBack?: string
    additional?: string[]
  }
}

export async function uploadImages(
  cardId: string,
  images: {
    front?: string  // base64 data URL
    back?: string
    miniReport?: string
    rawFront?: string
    rawBack?: string
  },
  additionalImages?: string[]
): Promise<ImageUploadResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/images`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cardId, images, additionalImages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to upload images (HTTP ${res.status})`)
  }
  return res.json()
}

/**
 * A user-picked gallery image source: either a base64 data URL, or a lazy
 * thunk that produces one. Thunks let the caller keep only file URIs in state
 * and read each photo's bytes right before its own upload, so all picked
 * photos are never held in memory simultaneously.
 */
export type AdditionalImageSource = string | (() => Promise<string>)

/**
 * Upload images one at a time to avoid Vercel's 4.5 MB request-body limit.
 * Base64 data URLs are ~33% larger than the original bytes, and a slab/mini-
 * report PNG can easily be 1-3 MB each; bundling 5+ in a single POST exceeds
 * the limit. Splitting into individual calls is slightly slower but reliable.
 */
export async function uploadImagesSequential(
  cardId: string,
  images: {
    front?: string
    back?: string
    miniReport?: string
    rawFront?: string
    rawBack?: string
  },
  additionalImages?: AdditionalImageSource[],
  onProgress?: (label: string, current: number, total: number) => void,
): Promise<ImageUploadResult> {
  const merged: ImageUploadResult['urls'] = {}
  const systemEntries = Object.entries(images).filter(([, v]) => !!v) as Array<[keyof typeof images, string]>
  const extras = additionalImages?.filter(Boolean) ?? []
  const total = systemEntries.length + extras.length
  let current = 0

  for (const [key, dataUrl] of systemEntries) {
    current += 1
    onProgress?.(`Uploading ${key}…`, current, total)
    const result = await uploadImages(cardId, { [key]: dataUrl } as any)
    Object.assign(merged, result.urls)
  }

  const additionalUrls: string[] = []
  for (const source of extras) {
    current += 1
    onProgress?.(`Uploading custom photo ${current}/${total}…`, current, total)
    // Resolve lazy sources one at a time — each photo's base64 lives only for
    // the duration of its own upload request.
    const dataUrl = typeof source === 'function' ? await source() : source
    const result = await uploadImages(cardId, {}, [dataUrl])
    const url = result.urls.additional?.[0]
    if (url) additionalUrls.push(url)
  }
  if (additionalUrls.length > 0) merged.additional = additionalUrls

  return { urls: merged }
}

// ─── Create Listing ───

export interface CreateListingRequest {
  cardId: string
  grade?: number
  title: string
  description?: string
  price: number
  listingFormat?: 'FIXED_PRICE' | 'AUCTION'
  quantity?: number
  bestOfferEnabled?: boolean
  duration?: string
  imageUrls: string[]
  itemSpecifics?: { name: string; value: string | string[] }[]
  // Shipping
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED'
  domesticShippingService: string
  flatRateAmount?: number
  handlingDays: number
  postalCode: string
  packageWeightOz: number
  packageLengthIn: number
  packageWidthIn: number
  packageDepthIn: number
  // International
  offerInternational: boolean
  internationalShippingType?: 'FLAT_RATE' | 'CALCULATED'
  internationalShippingService?: string
  internationalFlatRateCost?: number
  internationalShipToLocations?: string[]
  // Returns
  domesticReturnsAccepted: boolean
  domesticReturnPeriodDays?: number
  domesticReturnShippingPaidBy?: 'BUYER' | 'SELLER'
  internationalReturnsAccepted: boolean
  internationalReturnPeriodDays?: number
  internationalReturnShippingPaidBy?: 'BUYER' | 'SELLER'
  // Documents
  regulatoryDocumentIds?: string[]
}

export interface CreateListingResult {
  success: boolean
  listingId?: string
  sku: string
  listingUrl?: string
  status: string
  fees?: { name: string; amount: number }[]
  warnings?: { code: string; message: string }[]
  error?: string
  userAction?: string
}

/**
 * Error thrown by createListing — carries the HTTP status so callers can
 * branch on auth failures (401) and disclaimer gates (412) without string
 * matching alone.
 */
export class EbayApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'EbayApiError'
    this.status = status
  }
}

export async function createListing(data: CreateListingRequest): Promise<CreateListingResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/listing`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok && !result.success) {
    throw new EbayApiError(result.error || result.userAction || 'Failed to create listing', res.status)
  }
  return result
}

// ─── Saved Listing Defaults / Templates ───

/**
 * One saved-defaults row (personal or org) as returned by
 * GET /api/ebay/listing-defaults. shippingDefaults mirrors the WEB modal's
 * shippingForm shape (camelCase, numbers as numbers) — not mobile's local
 * `shipping` state — so callers must map it (see ebay-list.tsx).
 */
export interface ListingDefaultsRow {
  descriptionTemplate: string | null
  shippingDefaults: Record<string, unknown> | null
}

export interface ListingDefaultsResponse {
  personal: ListingDefaultsRow | null
  org: ListingDefaultsRow | null
  orgRole: string | null
  orgId: string | null
}

/**
 * Fetch the caller's saved eBay listing defaults. Returns null on any failure
 * (not connected, offline, 401) — every caller falls back to stock defaults,
 * so a missing row is never an error the user has to see.
 */
export async function getListingDefaults(): Promise<ListingDefaultsResponse | null> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/api/ebay/listing-defaults`, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Pick the defaults row that applies to a card, mirroring the web modal's
 * cross-org guard: the org row applies only when the CALLER's org is also the
 * CARD's org; otherwise personal.
 */
export function resolveActiveListingDefaults(
  defaults: ListingDefaultsResponse | null,
  cardOrgId: string | null | undefined
): ListingDefaultsRow | null {
  if (!defaults) return null
  if (cardOrgId && defaults.orgId === cardOrgId && defaults.org) return defaults.org
  return defaults.personal ?? null
}

// TWIN: src/lib/ebay/tradingApi.ts RETIRED_DOMESTIC_SERVICES /
// normalizeDomesticService. Mobile can't import from src/, so this is a local
// copy of the same forward-mapping — a saved default can still carry a retired
// token and mobile's service chips only render known values.
const RETIRED_SHIPPING_SERVICES: Record<string, string> = {
  USPSFirstClass: 'USPSGroundAdvantage',
  USPSFirstClassService: 'USPSGroundAdvantage',
  USPSPriorityExpress: 'USPSPriorityMailExpress',
}

/** Map a possibly-retired/unknown saved service token onto a valid one. */
export function normalizeShippingService(service: string | null | undefined): string {
  if (!service) return DEFAULT_SHIPPING_SERVICE
  const mapped = RETIRED_SHIPPING_SERVICES[service]
  if (mapped) return mapped
  return SHIPPING_SERVICES.some(s => s.value === service) ? service : DEFAULT_SHIPPING_SERVICE
}

// ─── Item Specifics / Aspects ───

export async function getAspects(categoryId: string): Promise<any[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/aspects?category_id=${categoryId}`, { headers })
  if (!res.ok) return []
  const data = await res.json()
  return data.aspects || []
}

// ─── Disclaimer ───

export async function checkDisclaimer(): Promise<boolean> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/disclaimer`, { headers })
  if (!res.ok) return false
  const data = await res.json()
  return data.accepted === true
}

export async function acceptDisclaimer(): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/disclaimer`, { method: 'POST', headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to record disclaimer acceptance')
  }
}

// ─── OAuth URL ───

export async function getOAuthUrl(): Promise<string> {
  const headers = await getAuthHeaders()
  const url = `${API_BASE}/api/ebay/auth?return_url=${encodeURIComponent(API_BASE + '/ebay-auth-success')}`
  console.log('[ebay/getOAuthUrl] fetching', url, 'with header keys', Object.keys(headers), 'tokenLen', (headers['Authorization'] || '').length)
  const res = await fetch(url, { method: 'GET', headers })
  console.log('[ebay/getOAuthUrl] response status', res.status)
  if (!res.ok) {
    let msg = `Failed to get OAuth URL (HTTP ${res.status})`
    try {
      const body = await res.json()
      console.warn('[ebay/getOAuthUrl] error body', body)
      if (body?.error) msg = body.error
    } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  if (!data?.authUrl) throw new Error('No authUrl in response')
  return data.authUrl
}

// ─── Helpers ───

// NOTE: title generation lives in lib/ebayTitleBuilder.ts (web-parity twin of
// src/lib/ebay/titleBuilder.ts) — use buildEbayTitleFromCard(card) from there.

// TWIN LIST: src/lib/ebay/tradingApi.ts DOMESTIC_SHIPPING_SERVICES — keep the
// values/labels identical. These are eBay Trading API ShippingService tokens;
// an invalid token is rejected at AddItem time (mobile previously shipped a
// bogus 'USPSPriorityExpress'). USPSFirstClass is retired in favour of
// USPSGroundAdvantage.
export const SHIPPING_SERVICES = [
  { value: 'USPSGroundAdvantage', label: 'USPS Ground Advantage' },
  { value: 'USPSPriority', label: 'USPS Priority Mail' },
  { value: 'USPSPriorityMailExpress', label: 'USPS Priority Mail Express' },
  { value: 'UPSGround', label: 'UPS Ground' },
  { value: 'UPS3rdDay', label: 'UPS 3 Day Select' },
  { value: 'UPS2ndDay', label: 'UPS 2nd Day Air' },
  { value: 'UPSNextDay', label: 'UPS Next Day Air' },
  { value: 'FedExHomeDelivery', label: 'FedEx Home Delivery' },
  { value: 'FedExGround', label: 'FedEx Ground' },
  { value: 'FedEx2Day', label: 'FedEx 2Day' },
]

/** Default domestic service (web parity: DEFAULT_DOMESTIC_SHIPPING_SERVICE). */
export const DEFAULT_SHIPPING_SERVICE = 'USPSGroundAdvantage'

// eBay requires GTC (Good 'Til Cancelled) for fixed-price listings — day-based
// durations only apply to auctions (web parity: GTC only for Buy It Now).
export const FIXED_PRICE_DURATION_OPTIONS = [
  { value: 'GTC', label: 'Good Til Cancelled' },
]

export const AUCTION_DURATION_OPTIONS = [
  { value: 'DAYS_1', label: '1 Day' },
  { value: 'DAYS_3', label: '3 Days' },
  { value: 'DAYS_5', label: '5 Days' },
  { value: 'DAYS_7', label: '7 Days' },
  { value: 'DAYS_10', label: '10 Days' },
]

export const ALL_DURATION_OPTIONS = [...FIXED_PRICE_DURATION_OPTIONS, ...AUCTION_DURATION_OPTIONS]
