/**
 * Binder API helpers for the mobile app.
 *
 * Mirrors marketplaceApi.ts: every call hits the same web backend routes the
 * collection page uses, so mobile and web can't drift. In particular the
 * ordering logic (fractional indexing) lives on the server, so both clients
 * send the same "put this card after that one" intent and neither computes a
 * position itself.
 *
 * Deliberately no new native dependency anywhere in the binder feature — it's
 * all JS, so it ships over the air.
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

export interface Binder {
  id: string
  name: string
  accent_color: string | null
  card_count: number
  smart_filter: unknown | null
  system_key: string | null
  position: number
}

/**
 * The user's binders. Returns `available: false` when the binders migration
 * isn't applied — callers hide the UI entirely rather than erroring, the same
 * contract the web client uses.
 */
export async function listBinders(): Promise<{ binders: Binder[]; available: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/binders`, { headers: await authHeaders() })
    const data = await res.json()
    if (!res.ok) return { binders: [], available: false }
    if (data?.available === false) return { binders: [], available: false }
    return { binders: data.binders || [], available: true }
  } catch {
    return { binders: [], available: false }
  }
}

export async function createBinder(name: string): Promise<Binder> {
  const res = await fetch(`${API_BASE}/api/binders`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ name }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not create binder')
  return data.binder
}

/** Cards in a binder, in the user's order. */
export async function getBinderCards(binderId: string): Promise<{
  cards: any[]
  reorderable: boolean
}> {
  const res = await fetch(`${API_BASE}/api/binders/${binderId}/cards`, {
    headers: await authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not load binder')
  return { cards: data.cards || [], reorderable: Boolean(data.reorderable) }
}

export async function addCardsToBinder(binderId: string, cardIds: string[]): Promise<{ added: number; skipped: number }> {
  const res = await fetch(`${API_BASE}/api/binders/${binderId}/cards`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ cardIds }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not add cards')
  return data
}

/** Membership only — the cards stay in the collection. */
export async function removeCardsFromBinder(binderId: string, cardIds: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/binders/${binderId}/cards`, {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ cardIds }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Could not remove cards')
  }
}

/**
 * Move a card within a binder. `afterCardId` null = move to the front.
 * The server computes the position — the client never invents one, which is
 * what keeps two devices reordering at once from colliding.
 */
export async function reorderBinderCard(
  binderId: string,
  cardId: string,
  afterCardId: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/binders/${binderId}/cards/reorder`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ cardId, afterCardId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Could not save the new order')
  }
}

/** Which of the user's binders hold this card. */
export async function getCardBinders(cardId: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}/binders`, {
      headers: await authHeaders(),
    })
    const data = await res.json()
    return data.binderIds || []
  } catch {
    return []
  }
}
