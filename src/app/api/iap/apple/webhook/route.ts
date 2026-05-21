/**
 * POST /api/iap/apple/webhook
 *
 * App Store Server Notifications V2 endpoint. Apple posts to this URL
 * for subscription lifecycle events: renewals, refunds, cancellations,
 * grace periods, billing failures, etc.
 *
 * Configured in App Store Connect:
 *   App Information → App Store Server Notifications → Production URL =
 *   https://dcmgrading.com/api/iap/apple/webhook
 *
 * Auth: the JWS signature on the payload IS the auth — only Apple's
 * private keys can sign it, and we verify against Apple's root cert chain.
 *
 * Notification types handled:
 *   DID_RENEW                 — subscription auto-renewed, grant credits
 *   SUBSCRIBED                — initial sub or resubscription, grant
 *   REFUND                    — mark refunded, expire Card Lovers
 *   REVOKE                    — family-sharing revoke, expire Card Lovers
 *   DID_FAIL_TO_RENEW         — billing failed, enter grace period flag
 *   EXPIRED                   — sub period ended without renewal
 *   DID_CHANGE_RENEWAL_STATUS — user toggled auto-renew (track only)
 *
 * Idempotency: transaction_id is unique per renewal cycle. Re-delivery
 * is safe — recordIAPTransaction short-circuits on duplicate rows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyServerNotification, verifySignedTransaction, verifySignedRenewalInfo, normalizeEnvironment } from '@/lib/iap/apple'
import { recordIAPTransaction, expireCardLovers } from '@/lib/iap/grantCredits'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  let body: { signedPayload?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.signedPayload) {
    return NextResponse.json({ error: 'signedPayload is required' }, { status: 400 })
  }

  let notification
  try {
    notification = await verifyServerNotification(body.signedPayload)
  } catch (err: any) {
    console.error('[apple/webhook] Notification JWS verification failed:', err?.message || err)
    return NextResponse.json({ error: 'Invalid signed payload' }, { status: 400 })
  }

  const notificationType = notification.notificationType
  const subtype = notification.subtype
  console.log('[apple/webhook] Received:', notificationType, subtype)

  // Verify the embedded transaction payload (every notification carries one).
  const signedTransaction = notification.data?.signedTransactionInfo
  if (!signedTransaction) {
    console.warn('[apple/webhook] No signedTransactionInfo in notification:', notificationType)
    return NextResponse.json({ received: true, ignored: true })
  }

  let txn
  try {
    txn = await verifySignedTransaction(signedTransaction)
  } catch (err: any) {
    console.error('[apple/webhook] Transaction JWS verification failed:', err?.message || err)
    return NextResponse.json({ error: 'Invalid embedded transaction' }, { status: 400 })
  }

  if (!txn.productId || !txn.transactionId) {
    return NextResponse.json({ received: true, ignored: 'malformed' })
  }

  // We need a user id. For the webhook path, appAccountToken is set by
  // the original client purchase. If absent (legacy), fall back to looking
  // up by original_transaction_id in our existing iap_transactions table.
  let userId = (txn.appAccountToken as string) || null
  if (!userId && txn.originalTransactionId) {
    const { data: existing } = await supabaseAdmin
      .from('iap_transactions')
      .select('user_id')
      .eq('platform', 'apple')
      .eq('original_transaction_id', String(txn.originalTransactionId))
      .limit(1)
      .maybeSingle()
    userId = existing?.user_id ?? null
  }

  if (!userId) {
    console.error('[apple/webhook] Could not resolve user for transaction', txn.transactionId)
    // 200 anyway so Apple doesn't keep retrying — we logged for forensics.
    return NextResponse.json({ received: true, ignored: 'no_user' })
  }

  // Map notification type to our status enum + grant policy.
  let statusOverride: 'active' | 'expired' | 'refunded' | 'revoked' | 'cancelled' | undefined
  let isInGracePeriod = false
  let shouldExpireSubscription = false

  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
      statusOverride = 'active'
      break
    case 'EXPIRED':
      statusOverride = 'expired'
      shouldExpireSubscription = true
      break
    case 'REFUND':
      statusOverride = 'refunded'
      shouldExpireSubscription = true
      break
    case 'REVOKE':
      statusOverride = 'revoked'
      shouldExpireSubscription = true
      break
    case 'DID_FAIL_TO_RENEW':
      // GRACE_PERIOD subtype → user retains access. Otherwise the renewal lapsed.
      if (subtype === 'GRACE_PERIOD') {
        isInGracePeriod = true
        statusOverride = 'active'
      } else {
        statusOverride = 'expired'
        shouldExpireSubscription = true
      }
      break
    case 'DID_CHANGE_RENEWAL_STATUS':
      // Auto-renew toggle — no state change to Card Lovers itself.
      statusOverride = 'active'
      break
    default:
      // Acknowledged but not actioned. Apple sends many event types; we
      // handle the ones that matter for billing state.
      console.log('[apple/webhook] Unhandled notification type:', notificationType)
      return NextResponse.json({ received: true, ignored: notificationType })
  }

  // Pull autoRenewStatus from renewalInfo if present.
  let autoRenewStatus: boolean | null = null
  const signedRenewalInfo = notification.data?.signedRenewalInfo
  if (signedRenewalInfo) {
    try {
      const renewal = await verifySignedRenewalInfo(signedRenewalInfo)
      autoRenewStatus = renewal.autoRenewStatus === 1
    } catch {
      /* non-fatal */
    }
  }

  await recordIAPTransaction({
    userId,
    platform: 'apple',
    productId: txn.productId,
    transactionId: String(txn.transactionId),
    originalTransactionId: txn.originalTransactionId ? String(txn.originalTransactionId) : null,
    periodStart: txn.purchaseDate ? new Date(txn.purchaseDate) : null,
    periodEnd: txn.expiresDate ? new Date(txn.expiresDate) : null,
    autoRenewStatus,
    isInGracePeriod,
    environment: normalizeEnvironment(txn.environment),
    rawReceipt: { notificationType, subtype, txn } as unknown,
    statusOverride,
  })

  if (shouldExpireSubscription) {
    await expireCardLovers(userId)
  }

  return NextResponse.json({ received: true })
}
