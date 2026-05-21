/**
 * POST /api/iap/google/webhook
 *
 * Google Play Real-Time Developer Notifications (RTDN) endpoint. Google
 * Cloud Pub/Sub delivers JSON push messages here whenever a subscription
 * or one-time-product event occurs: renewals, cancellations, refunds,
 * grace period, etc.
 *
 * Setup:
 *   1. Create a Pub/Sub topic in Google Cloud (e.g. `dcm-iap-rtdn`)
 *   2. In Play Console → Monetize → Subscriptions and products → RTDN,
 *      paste the topic name
 *   3. In Pub/Sub, add a push subscription with endpoint
 *      https://dcmgrading.com/api/iap/google/webhook?token=<SECRET>
 *   4. Set `GOOGLE_RTDN_VERIFY_TOKEN` in Vercel env to the same secret
 *
 * Auth: URL token (Pub/Sub push subscriptions don't natively sign messages
 * for simple token verification; we rely on the secret in the query string).
 *
 * Idempotency: same as Apple — UNIQUE (platform, transaction_id) on
 * iap_transactions prevents double-grants on Pub/Sub re-delivery.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getProductPurchase,
  getSubscriptionPurchase,
  acknowledgeProductPurchase,
  acknowledgeSubscriptionPurchase,
} from '@/lib/iap/google'
import { recordIAPTransaction, expireCardLovers } from '@/lib/iap/grantCredits'
import { getProduct } from '@/lib/iap/products'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const VERIFY_TOKEN = process.env.GOOGLE_RTDN_VERIFY_TOKEN

interface PubSubMessage {
  message?: {
    data?: string
    messageId?: string
    publishTime?: string
  }
  subscription?: string
}

interface DeveloperNotification {
  version: string
  packageName: string
  eventTimeMillis: string
  subscriptionNotification?: {
    version: string
    notificationType: number
    purchaseToken: string
    subscriptionId: string
  }
  oneTimeProductNotification?: {
    version: string
    notificationType: number
    purchaseToken: string
    sku: string
  }
  testNotification?: { version: string }
}

export async function POST(request: NextRequest) {
  // URL-token gate.
  const tokenFromQuery = request.nextUrl.searchParams.get('token')
  if (!VERIFY_TOKEN || tokenFromQuery !== VERIFY_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let envelope: PubSubMessage
  try {
    envelope = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = envelope.message?.data
  if (!data) {
    // Pub/Sub keepalive — ack with 200.
    return NextResponse.json({ received: true, keepalive: true })
  }

  let notification: DeveloperNotification
  try {
    const decoded = Buffer.from(data, 'base64').toString('utf-8')
    notification = JSON.parse(decoded)
  } catch (err: any) {
    console.error('[google/webhook] Could not decode Pub/Sub data:', err?.message || err)
    return NextResponse.json({ error: 'Invalid Pub/Sub payload' }, { status: 400 })
  }

  // Google sends a one-time test notification on setup — ack and skip.
  if (notification.testNotification) {
    console.log('[google/webhook] Test notification received — RTDN wired up correctly')
    return NextResponse.json({ received: true, test: true })
  }

  if (notification.subscriptionNotification) {
    return handleSubscriptionNotification(notification.subscriptionNotification)
  }

  if (notification.oneTimeProductNotification) {
    return handleOneTimeProductNotification(notification.oneTimeProductNotification)
  }

  console.log('[google/webhook] Unknown notification shape — acking')
  return NextResponse.json({ received: true, ignored: true })
}

async function handleSubscriptionNotification(n: {
  notificationType: number
  purchaseToken: string
  subscriptionId: string
}): Promise<NextResponse> {
  const { subscriptionId, purchaseToken, notificationType } = n

  const product = getProduct(subscriptionId)
  if (!product || product.type !== 'subscription') {
    return NextResponse.json({ received: true, ignored: 'unknown_sub' })
  }

  // Fetch current state from Google Play Developer API — webhook payload
  // doesn't include expiry/autorenew flags, only the type + token.
  let sub
  try {
    sub = await getSubscriptionPurchase(subscriptionId, purchaseToken)
  } catch (err: any) {
    console.error('[google/webhook] API fetch failed:', err?.message || err)
    return NextResponse.json({ error: 'API fetch failed' }, { status: 500 })
  }

  // Resolve user from obfuscatedExternalAccountId OR by purchase token lookup.
  let userId = sub.obfuscatedExternalAccountId ?? null
  if (!userId) {
    const { data: existing } = await supabaseAdmin
      .from('iap_transactions')
      .select('user_id')
      .eq('platform', 'google')
      .eq('purchase_token', purchaseToken)
      .limit(1)
      .maybeSingle()
    userId = existing?.user_id ?? null
  }

  if (!userId) {
    console.error('[google/webhook] No user for subscription token:', purchaseToken.slice(0, 16))
    return NextResponse.json({ received: true, ignored: 'no_user' })
  }

  // Map RTDN type to our status.
  // 1=recovered, 2=renewed, 3=canceled, 4=purchased, 5=on_hold, 6=grace,
  // 7=restarted, 12=revoked, 13=expired
  let statusOverride: 'active' | 'expired' | 'refunded' | 'revoked' | 'cancelled' | undefined
  let isInGracePeriod = false
  let shouldExpireSubscription = false
  switch (notificationType) {
    case 1: // RECOVERED
    case 2: // RENEWED
    case 4: // PURCHASED
    case 7: // RESTARTED
      statusOverride = 'active'
      break
    case 6: // IN_GRACE_PERIOD
      statusOverride = 'active'
      isInGracePeriod = true
      break
    case 3: // CANCELED — auto-renew turned off; access continues until expiry
      statusOverride = 'cancelled'
      // Don't expire Card Lovers yet — only on 13 (expired)
      break
    case 5: // ON_HOLD — billing failed past grace period
    case 13: // EXPIRED
      statusOverride = 'expired'
      shouldExpireSubscription = true
      break
    case 12: // REVOKED (refunded by Google)
      statusOverride = 'revoked'
      shouldExpireSubscription = true
      break
    default:
      // Acknowledge unhandled types so Pub/Sub stops retrying.
      console.log('[google/webhook] Unhandled subscription notification type:', notificationType)
      return NextResponse.json({ received: true, ignored: notificationType })
  }

  // Acknowledge new purchases.
  if (sub.acknowledgementState === 0) {
    await acknowledgeSubscriptionPurchase(subscriptionId, purchaseToken)
  }

  await recordIAPTransaction({
    userId,
    platform: 'google',
    productId: subscriptionId,
    transactionId: String(sub.orderId || purchaseToken),
    originalTransactionId: purchaseToken,
    purchaseToken,
    periodStart: sub.startTimeMillis ? new Date(Number(sub.startTimeMillis)) : null,
    periodEnd: sub.expiryTimeMillis ? new Date(Number(sub.expiryTimeMillis)) : null,
    autoRenewStatus: sub.autoRenewing ?? null,
    isInGracePeriod,
    rawReceipt: { notificationType, sub } as unknown,
    statusOverride,
  })

  if (shouldExpireSubscription) {
    await expireCardLovers(userId)
  }

  return NextResponse.json({ received: true })
}

async function handleOneTimeProductNotification(n: {
  notificationType: number
  purchaseToken: string
  sku: string
}): Promise<NextResponse> {
  const { sku, purchaseToken, notificationType } = n

  const product = getProduct(sku)
  if (!product || product.type !== 'consumable') {
    return NextResponse.json({ received: true, ignored: 'unknown_product' })
  }

  if (notificationType !== 1) {
    // Only 1 = PURCHASED is interesting; 2 = CANCELED for one-times is rare.
    return NextResponse.json({ received: true, ignored: notificationType })
  }

  let purchase
  try {
    purchase = await getProductPurchase(sku, purchaseToken)
  } catch (err: any) {
    console.error('[google/webhook] API fetch failed:', err?.message || err)
    return NextResponse.json({ error: 'API fetch failed' }, { status: 500 })
  }

  const userId = purchase.obfuscatedExternalAccountId ?? null
  if (!userId) {
    // For one-time products we have no fallback — verify route should have
    // run first. Likely this RTDN is just confirming a purchase the
    // verify route already recorded.
    return NextResponse.json({ received: true, ignored: 'no_user' })
  }

  if (purchase.acknowledgementState === 0) {
    await acknowledgeProductPurchase(sku, purchaseToken)
  }

  await recordIAPTransaction({
    userId,
    platform: 'google',
    productId: sku,
    transactionId: String(purchase.orderId || purchaseToken),
    originalTransactionId: purchaseToken,
    purchaseToken,
    rawReceipt: { notificationType, purchase } as unknown,
    statusOverride: 'active',
  })

  return NextResponse.json({ received: true })
}
