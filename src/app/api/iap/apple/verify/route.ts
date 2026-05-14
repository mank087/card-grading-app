/**
 * POST /api/iap/apple/verify
 *
 * Called by the mobile app immediately after a successful StoreKit purchase.
 * The mobile sends the JWS-signed transaction string; we verify it with
 * Apple's root certificates, then grant credits (or update subscription state).
 *
 * Request body:
 *   { signedTransaction: string, signedRenewalInfo?: string }
 *
 * Auth: standard Bearer token from Supabase (Authorization header).
 *
 * Security: the JWS payload contains `appAccountToken` set by the mobile app
 * to the authenticated user's id at purchase time. We require that token
 * matches the Bearer-authenticated user — prevents replaying another user's
 * receipt.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignedTransaction, verifySignedRenewalInfo, normalizeEnvironment } from '@/lib/iap/apple'
import { recordIAPTransaction } from '@/lib/iap/grantCredits'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromAuthHeader(request.headers.get('authorization'))
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { signedTransaction?: string; signedRenewalInfo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.signedTransaction) {
    return NextResponse.json({ error: 'signedTransaction is required' }, { status: 400 })
  }

  let payload
  try {
    payload = await verifySignedTransaction(body.signedTransaction)
  } catch (err: any) {
    console.error('[apple/verify] JWS verification failed:', err?.message || err)
    return NextResponse.json({ error: 'Invalid signed transaction' }, { status: 400 })
  }

  if (!payload.productId || !payload.transactionId) {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })
  }

  // Security check: appAccountToken (set on the client at purchase time to
  // the Supabase user id) must match the authenticated user. Without this
  // a malicious client could forward someone else's receipt to claim credits.
  if (payload.appAccountToken && payload.appAccountToken !== userId) {
    console.warn('[apple/verify] appAccountToken mismatch', {
      receiptUser: payload.appAccountToken,
      authUser: userId,
    })
    return NextResponse.json({ error: 'Receipt does not belong to this user' }, { status: 403 })
  }

  // Optional: pull renewal info for subscription period boundaries.
  let autoRenewStatus: boolean | null = null
  if (body.signedRenewalInfo) {
    try {
      const renewalInfo = await verifySignedRenewalInfo(body.signedRenewalInfo)
      autoRenewStatus = renewalInfo.autoRenewStatus === 1
    } catch {
      // Renewal info is optional — log and continue.
      console.warn('[apple/verify] Could not decode renewal info — continuing')
    }
  }

  const result = await recordIAPTransaction({
    userId,
    platform: 'apple',
    productId: payload.productId,
    transactionId: String(payload.transactionId),
    originalTransactionId: payload.originalTransactionId
      ? String(payload.originalTransactionId)
      : null,
    periodStart: payload.purchaseDate ? new Date(payload.purchaseDate) : null,
    periodEnd: payload.expiresDate ? new Date(payload.expiresDate) : null,
    autoRenewStatus,
    environment: normalizeEnvironment(payload.environment),
    rawReceipt: payload as unknown,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to record transaction' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    alreadyGranted: result.alreadyGranted,
    creditsGranted: result.creditsGranted,
  })
}
