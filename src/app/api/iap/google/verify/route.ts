/**
 * POST /api/iap/google/verify
 *
 * Called by the mobile app immediately after a successful Google Play Billing
 * purchase. The mobile sends the purchaseToken; we verify it via the Google
 * Play Developer API (purchases.products.get / purchases.subscriptions.get),
 * then grant credits and acknowledge the purchase.
 *
 * Request body:
 *   { productId: string, purchaseToken: string, productType: 'consumable' | 'subscription' }
 *
 * Auth: Bearer token from Supabase. Unlike Apple's appAccountToken, Google's
 * obfuscatedAccountId field carries the same signal. We set it client-side
 * to the Supabase user id and verify it matches the authenticated user here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getProductPurchase,
  getSubscriptionPurchase,
  acknowledgeProductPurchase,
  acknowledgeSubscriptionPurchase,
} from '@/lib/iap/google'
import { recordIAPTransaction } from '@/lib/iap/grantCredits'
import { getProduct } from '@/lib/iap/products'

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

  let body: { productId?: string; purchaseToken?: string; productType?: 'consumable' | 'subscription' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { productId, purchaseToken, productType } = body
  if (!productId || !purchaseToken || !productType) {
    return NextResponse.json(
      { error: 'productId, purchaseToken, and productType are required' },
      { status: 400 },
    )
  }

  const product = getProduct(productId)
  if (!product) {
    return NextResponse.json({ error: 'Unknown product' }, { status: 400 })
  }
  if (product.type !== productType) {
    return NextResponse.json({ error: 'productType mismatch' }, { status: 400 })
  }

  // Branch on consumable vs subscription — Google has separate APIs.
  let transactionId: string
  let periodStart: Date | null = null
  let periodEnd: Date | null = null
  let autoRenewStatus: boolean | null = null
  let obfuscatedAccountId: string | undefined

  try {
    if (productType === 'subscription') {
      const sub = await getSubscriptionPurchase(productId, purchaseToken)

      // Sanity: paymentState 1 = received, 2 = free trial. 0 = pending = reject.
      if (sub.paymentState !== undefined && sub.paymentState === 0) {
        return NextResponse.json({ error: 'Purchase pending' }, { status: 400 })
      }

      transactionId = String(sub.orderId || purchaseToken)
      if (sub.startTimeMillis) periodStart = new Date(Number(sub.startTimeMillis))
      if (sub.expiryTimeMillis) periodEnd = new Date(Number(sub.expiryTimeMillis))
      autoRenewStatus = sub.autoRenewing ?? null
      obfuscatedAccountId = sub.obfuscatedExternalAccountId || undefined

      // Google requires acknowledgement within 3 days or it auto-refunds.
      if (sub.acknowledgementState === 0) {
        await acknowledgeSubscriptionPurchase(productId, purchaseToken)
      }
    } else {
      const purchase = await getProductPurchase(productId, purchaseToken)

      // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
      if (purchase.purchaseState === 1) {
        return NextResponse.json({ error: 'Purchase canceled' }, { status: 400 })
      }
      if (purchase.purchaseState === 2) {
        return NextResponse.json({ error: 'Purchase pending' }, { status: 400 })
      }

      transactionId = String(purchase.orderId || purchaseToken)
      obfuscatedAccountId = purchase.obfuscatedExternalAccountId || undefined

      if (purchase.acknowledgementState === 0) {
        await acknowledgeProductPurchase(productId, purchaseToken)
      }
    }
  } catch (err: any) {
    console.error('[google/verify] Google API error:', err?.message || err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }

  // Security check: obfuscatedAccountId set by the client at purchase time
  // must match the authenticated user. Same role as Apple's appAccountToken.
  if (obfuscatedAccountId && obfuscatedAccountId !== userId) {
    console.warn('[google/verify] obfuscatedAccountId mismatch', {
      receiptUser: obfuscatedAccountId,
      authUser: userId,
    })
    return NextResponse.json({ error: 'Receipt does not belong to this user' }, { status: 403 })
  }

  const result = await recordIAPTransaction({
    userId,
    platform: 'google',
    productId,
    transactionId,
    originalTransactionId: purchaseToken, // For Google, the purchaseToken IS the lineage marker
    purchaseToken,
    periodStart,
    periodEnd,
    autoRenewStatus,
    rawReceipt: body as unknown,
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
