/**
 * Shared credit-grant + subscription-state pipeline for IAP transactions.
 *
 * Called by both Apple and Google verify-receipt handlers AND by both
 * server-notification webhooks. Idempotency is enforced by the UNIQUE
 * (platform, transaction_id) constraint on iap_transactions — if the row
 * already exists, we surface "already_granted" and skip the credit update.
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProduct } from '@/lib/iap/products'

export interface RecordIAPInput {
  userId: string
  platform: 'apple' | 'google'
  productId: string
  /** Per-renewal unique ID. Apple: transactionId. Google: orderId. */
  transactionId: string
  /** Apple: originalTransactionId. Google: first purchase token in the lineage. */
  originalTransactionId?: string | null
  /** Google: purchaseToken (used by RTDN webhook to find this row). */
  purchaseToken?: string | null
  /** Subscription period for sub products. */
  periodStart?: Date | null
  periodEnd?: Date | null
  autoRenewStatus?: boolean | null
  isInGracePeriod?: boolean
  environment?: 'production' | 'sandbox'
  rawReceipt?: unknown
  /** For notification webhooks — pass the event type so we can set the
   *  right status (e.g. 'refunded', 'cancelled', 'expired'). */
  statusOverride?: 'active' | 'expired' | 'refunded' | 'revoked' | 'cancelled'
}

export interface RecordIAPResult {
  success: boolean
  alreadyGranted: boolean
  creditsGranted: number
  transactionRowId?: string
  error?: string
}

/**
 * Idempotently record a transaction and grant credits.
 *
 * 1. Look up product definition (validate productId is known).
 * 2. Upsert the iap_transactions row (UNIQUE on platform+transaction_id).
 * 3. If this is a new row (not a duplicate retry), grant credits via
 *    user_credits + credit_transactions.
 * 4. If subscription, update user_credits.is_card_lover + related flags.
 */
export async function recordIAPTransaction(input: RecordIAPInput): Promise<RecordIAPResult> {
  const product = getProduct(input.productId)
  if (!product) {
    return { success: false, alreadyGranted: false, creditsGranted: 0, error: `Unknown product: ${input.productId}` }
  }

  // 1. Check for existing row first (idempotency).
  const { data: existing } = await supabaseAdmin
    .from('iap_transactions')
    .select('id, status')
    .eq('platform', input.platform)
    .eq('transaction_id', input.transactionId)
    .maybeSingle()

  if (existing) {
    // Existing row — update status if changing (e.g. refund notification),
    // but DO NOT re-grant credits. This is the idempotency safety net.
    if (input.statusOverride && input.statusOverride !== existing.status) {
      await supabaseAdmin
        .from('iap_transactions')
        .update({ status: input.statusOverride })
        .eq('id', existing.id)
      // Note: refund handling (reversing credits) is intentionally NOT in v1.
      // We log the status change so the data is there for an admin tool later.
      // notification_count is bumped via a Postgres trigger (TODO) — leaving
      // it out here avoids a races between the previous-value read and the write.
    }
    return { success: true, alreadyGranted: true, creditsGranted: 0, transactionRowId: existing.id }
  }

  // 2. Insert new row.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('iap_transactions')
    .insert({
      user_id: input.userId,
      platform: input.platform,
      product_id: input.productId,
      product_type: product.type,
      transaction_id: input.transactionId,
      original_transaction_id: input.originalTransactionId ?? null,
      purchase_token: input.purchaseToken ?? null,
      credits_granted: product.credits,
      subscription_period_start: input.periodStart?.toISOString() ?? null,
      subscription_period_end: input.periodEnd?.toISOString() ?? null,
      auto_renew_status: input.autoRenewStatus ?? null,
      is_in_grace_period: input.isInGracePeriod ?? false,
      status: input.statusOverride ?? 'active',
      raw_receipt: input.rawReceipt ?? null,
      environment: input.environment ?? 'production',
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    // Race condition: another request inserted between our check and our insert.
    // Retry the existing-row path.
    if (insertError?.code === '23505') {
      console.warn('[IAP grantCredits] Race on insert — retrying lookup')
      const { data: raceExisting } = await supabaseAdmin
        .from('iap_transactions')
        .select('id')
        .eq('platform', input.platform)
        .eq('transaction_id', input.transactionId)
        .maybeSingle()
      return {
        success: true,
        alreadyGranted: true,
        creditsGranted: 0,
        transactionRowId: raceExisting?.id,
      }
    }
    console.error('[IAP grantCredits] Insert failed:', insertError)
    return { success: false, alreadyGranted: false, creditsGranted: 0, error: insertError?.message }
  }

  // 3. Grant credits via the existing user_credits + credit_transactions pipeline.
  //    For 'active' status only — refunds/revokes get the row but no grant.
  const shouldGrantCredits = (input.statusOverride ?? 'active') === 'active'
  if (shouldGrantCredits) {
    await grantCreditsForTransaction(input.userId, product.credits, {
      platform: input.platform,
      productId: product.productId,
      productLabel: product.label,
      transactionId: input.transactionId,
      iapTransactionRowId: inserted.id,
    })
  }

  // 4. Update Card Lovers state for subscriptions.
  if (product.type === 'subscription' && shouldGrantCredits) {
    await updateCardLoversState(input.userId, {
      platform: input.platform,
      plan: product.subscriptionPeriod ?? 'monthly',
      periodEnd: input.periodEnd ?? null,
    })
  }

  return {
    success: true,
    alreadyGranted: false,
    creditsGranted: product.credits,
    transactionRowId: inserted.id,
  }
}

/**
 * Grants credits to user_credits.balance and writes a credit_transactions
 * ledger row. Mirrors the Stripe purchase pattern.
 */
async function grantCreditsForTransaction(
  userId: string,
  credits: number,
  meta: {
    platform: 'apple' | 'google'
    productId: string
    productLabel: string
    transactionId: string
    iapTransactionRowId: string
  },
): Promise<void> {
  // Fetch current balance for ledger.
  const { data: uc } = await supabaseAdmin
    .from('user_credits')
    .select('balance, total_purchased')
    .eq('user_id', userId)
    .maybeSingle()

  const newBalance = (uc?.balance ?? 0) + credits
  const newTotalPurchased = (uc?.total_purchased ?? 0) + credits

  // Update balance.
  await supabaseAdmin
    .from('user_credits')
    .upsert(
      {
        user_id: userId,
        balance: newBalance,
        total_purchased: newTotalPurchased,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  // Ledger entry.
  await supabaseAdmin.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: credits,
    balance_after: newBalance,
    description: `IAP: ${meta.productLabel}`,
    metadata: {
      platform: meta.platform,
      product_id: meta.productId,
      iap_transaction_id: meta.transactionId,
      iap_transaction_row_id: meta.iapTransactionRowId,
    },
  })
}

/**
 * Flip the Card Lovers flags on user_credits when a subscription becomes active.
 */
async function updateCardLoversState(
  userId: string,
  meta: { platform: 'apple' | 'google'; plan: 'monthly' | 'annual'; periodEnd: Date | null },
): Promise<void> {
  await supabaseAdmin
    .from('user_credits')
    .upsert(
      {
        user_id: userId,
        is_card_lover: true,
        card_lover_plan: meta.plan,
        card_lover_provider: meta.platform,
        card_lover_current_period_end: meta.periodEnd?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
}

/**
 * Called by server-notification webhooks when a subscription expires,
 * is refunded, or is otherwise revoked. Flips Card Lovers off without
 * touching the credit balance (credits already granted are kept).
 */
export async function expireCardLovers(userId: string): Promise<void> {
  await supabaseAdmin
    .from('user_credits')
    .update({
      is_card_lover: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}
