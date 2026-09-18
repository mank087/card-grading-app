/**
 * The "Confirm your card details" endpoints, as the app calls them.
 *
 * The server decides everything (prefill, eligibility, candidates, the kill
 * switch); the app only renders. Every call reads the CURRENT session token
 * rather than a prop, so a token refreshed while the sheet was open is used.
 * Mirrors src/components/cards/IdentityReview.tsx and ConfirmCardDetailsDialog.tsx.
 */
import { supabase } from '@/lib/supabase'
import type { IdentityReviewState, ReviewField } from '@/lib/reviewClient'

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

export type { IdentityReviewState }

async function accessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken()
  if (!token) throw new Error('Please sign in again to save your card details.')
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (init.body) headers['Content-Type'] = 'application/json'
  return fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } })
}

/** GET /api/cards/[id]/identity-review. null on any failure (the flow just stays hidden). */
export async function loadIdentityReview(cardId: string): Promise<IdentityReviewState | null> {
  try {
    const response = await authedFetch(`/api/cards/${cardId}/identity-review`)
    if (!response.ok) return null
    const data = (await response.json()) as IdentityReviewState
    return Array.isArray(data?.fields) ? data : null
  } catch {
    return null
  }
}

/** "Review later", and the first-visit close. Throws with the server's message on failure. */
export async function dismissIdentityReview(cardId: string): Promise<void> {
  const response = await authedFetch(`/api/cards/${cardId}/details`, {
    method: 'PATCH',
    body: JSON.stringify({ dismiss: true }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data?.error || 'We could not save that. Please try again.')
  }
}

/** Fire and forget: closing an auto-opened sheet counts as "Review later". */
export function recordFirstVisitDismissal(cardId: string): void {
  dismissIdentityReview(cardId).catch(() => undefined)
}

export interface DetailsSaveResult {
  status: number
  ok: boolean
  data: any
}

/** PATCH /api/cards/[id]/details. The caller handles 409 and 423. */
export async function patchCardDetails(cardId: string, body: Record<string, unknown>): Promise<DetailsSaveResult> {
  const response = await authedFetch(`/api/cards/${cardId}/details`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return { status: response.status, ok: response.ok, data }
}

/** POST /api/pricing/dcm-select. Throws when the pick was not saved. */
export async function selectPricingProduct(cardId: string, productId: string, productName: string): Promise<void> {
  const response = await authedFetch('/api/pricing/dcm-select', {
    method: 'POST',
    body: JSON.stringify({ cardId, productId, productName }),
  })
  if (!response.ok) throw new Error('selection rejected')
}

/**
 * POST /api/cards/[id]/first-look, for an older card with none. The server
 * answers 503 when on-demand first look is switched off, and every failure is
 * `null` here: the stored values are still fine.
 */
export async function requestFirstLook(cardId: string): Promise<ReviewField[] | null> {
  try {
    const response = await authedFetch(`/api/cards/${cardId}/first-look`, { method: 'POST' })
    const data = await response.json().catch(() => null)
    return Array.isArray(data?.fields) ? (data.fields as ReviewField[]) : null
  } catch {
    return null
  }
}

export interface SetOption {
  name: string
  year: string | null
}

/** In-memory per category for the session: MTG alone has ~1,000 sets. */
const setOptionsCache = new Map<string, SetOption[]>()

/** GET /api/cards/set-options?category=. [] when the category has no list (Sports, Other). */
export async function loadSetOptions(category: string): Promise<SetOption[]> {
  const cached = setOptionsCache.get(category)
  if (cached) return cached
  try {
    const response = await fetch(`${API_BASE}/api/cards/set-options?category=${encodeURIComponent(category)}`)
    const data = await response.json().catch(() => null)
    const sets: SetOption[] = Array.isArray(data?.sets) ? data.sets : []
    if (sets.length > 0) setOptionsCache.set(category, sets)
    return sets
  } catch {
    return []
  }
}

/**
 * The server kill switch, for screens that show the flow without loading a
 * card's review state (the collection chips). Fails OPEN on a network error or
 * an older server without the endpoint: the switch is opt-out on the server too,
 * and each card's own review state still answers mode 'none' when it is off.
 */
export async function identityConfirmEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/cards/identity-confirm`)
    if (!response.ok) return true
    const data = await response.json().catch(() => null)
    return data?.enabled !== false
  } catch {
    return true
  }
}
