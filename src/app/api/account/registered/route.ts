/**
 * Server-side registration conversion (2026-10-22).
 * POST (Bearer token), no body.
 *
 * Called once from /auth/callback for a brand-new account, after the
 * click-ID sync has finished, so the stored record is in place. Queues a
 * Meta CompleteRegistration with event id reg_<userId>, the same eventID the
 * browser pixel sends, so Meta deduplicates the pair. Consent gating is
 * inside enqueueAdConversion (stored consent must be 'granted'). Idempotent:
 * the (platform, event_id) unique index ignores repeats. Only accounts
 * created in the last 7 days qualify (Meta's event-age limit), so an old
 * account cannot be reported as a fresh signup.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enqueueAdConversion, META_MAX_EVENT_AGE_MS } from '@/lib/adConversions'
import { registrationEventId } from '@/lib/analyticsTransactionId'

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = authResult.user.id
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
    const createdAt = data?.user?.created_at ? new Date(data.user.created_at) : null
    if (!createdAt || Date.now() - createdAt.getTime() > META_MAX_EVENT_AGE_MS) {
      return NextResponse.json({ success: true, queued: 0 })
    }
    const queued = await enqueueAdConversion({
      userId,
      source: 'web',
      eventId: registrationEventId(userId),
      value: 0,
      event: 'registration',
      occurredAt: createdAt,
    })
    return NextResponse.json({ success: true, queued })
  } catch (error) {
    console.error('[registered] unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
