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

export interface ExistingListingCheck {
  hasActiveListing: boolean
  listing?: { listingId: string; listingUrl: string; status: string }
  previousListing?: { listingId: string; status: string; message: string }
}

export async function checkExistingListing(cardId: string): Promise<ExistingListingCheck> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/listing/check?cardId=${cardId}`, { headers })
  if (!res.ok) return { hasActiveListing: false }
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
    throw new Error(err.error || 'Failed to upload images')
  }
  return res.json()
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

export async function createListing(data: CreateListingRequest): Promise<CreateListingResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/listing`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok && !result.success) {
    throw new Error(result.error || result.userAction || 'Failed to create listing')
  }
  return result
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
  await fetch(`${API_BASE}/api/ebay/disclaimer`, { method: 'POST', headers })
}

// ─── OAuth URL ───

export async function getOAuthUrl(): Promise<string> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api/ebay/auth?return_url=${encodeURIComponent(API_BASE + '/ebay-auth-success')}`, { headers })
  if (!res.ok) {
    let msg = `Failed to get OAuth URL (HTTP ${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  if (!data?.authUrl) throw new Error('No authUrl in response')
  return data.authUrl
}

// ─── Helpers ───

export const CATEGORY_MAP: Record<string, string> = {
  Pokemon: '183454',
  MTG: '183454',
  Lorcana: '183454',
  'One Piece': '183454',
  'Yu-Gi-Oh': '183454',
  Sports: '261328',
  Other: '183050',
}

export function generateTitle(card: any): string {
  const ci = card.conversational_card_info || {}
  const parts: string[] = []
  const name = card.card_name || card.featured || ci.card_name || ci.player_or_character || ''
  if (name) parts.push(name)
  const set = card.card_set || ci.set_name || ''
  if (set) parts.push(set)
  const num = card.card_number || ci.card_number || ''
  if (num) parts.push(`#${num}`)
  const grade = card.conversational_whole_grade
  if (grade != null) parts.push(`DCM Grade ${Math.round(grade)}`)
  const condition = card.conversational_condition_label || ''
  if (condition) parts.push(condition)
  return parts.join(' - ').substring(0, 80)
}

export const SHIPPING_SERVICES = [
  { value: 'USPSPriority', label: 'USPS Priority Mail' },
  { value: 'USPSFirstClass', label: 'USPS First Class' },
  { value: 'USPSPriorityExpress', label: 'USPS Priority Express' },
  { value: 'UPSGround', label: 'UPS Ground' },
  { value: 'UPS3rdDay', label: 'UPS 3 Day Select' },
  { value: 'FedExHomeDelivery', label: 'FedEx Home Delivery' },
]

export const DURATION_OPTIONS = [
  { value: 'GTC', label: 'Good Til Cancelled' },
  { value: 'DAYS_1', label: '1 Day' },
  { value: 'DAYS_3', label: '3 Days' },
  { value: 'DAYS_5', label: '5 Days' },
  { value: 'DAYS_7', label: '7 Days' },
  { value: 'DAYS_10', label: '10 Days' },
  { value: 'DAYS_30', label: '30 Days' },
]
