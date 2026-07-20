/**
 * Stripe Webhook Handler
 * Processes payment events and credits user accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, CARD_LOVERS_SUBSCRIPTION, getSubscriptionPeriodEnd } from '@/lib/stripe';
import {
  addCredits,
  updateStripeCustomerId,
  setFounderStatus,
  setVipStatus,
  activateCardLoverSubscription,
  processCardLoverRenewal,
  cancelCardLoverSubscription,
  getUserCredits,
  findUserIdByStripeCustomer,
} from '@/lib/credits';
import {
  getAffiliateByCode,
  getAffiliateByPromotionCode,
  createCommission,
  reverseCommission,
} from '@/lib/affiliates';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

/**
 * Safely convert a Stripe Unix timestamp to a Date.
 * Returns a fallback date (30 days from now) if the timestamp is invalid.
 */
function safeTimestampToDate(timestamp: number | undefined | null): Date {
  if (typeof timestamp === 'number' && timestamp > 0 && isFinite(timestamp)) {
    return new Date(timestamp * 1000);
  }
  console.warn('[Webhook] Invalid timestamp, using fallback (30 days from now):', timestamp);
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

// Create Supabase client for idempotency checks
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Check if a Stripe session has already been processed (idempotency check)
 * Prevents duplicate credit additions if Stripe retries the webhook
 */
async function checkSessionProcessed(sessionId: string): Promise<{ hasBeenProcessed: boolean; error?: string }> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .limit(1);

  if (error) {
    console.error('Error checking session idempotency:', error);
    return { hasBeenProcessed: false, error: error.message };
  }

  return { hasBeenProcessed: data && data.length > 0 };
}

// Disable body parsing - we need raw body for signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint active' });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'payment_intent.succeeded': {
        // Backup handler if checkout.session.completed doesn't fire
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

  // Check if this is a subscription checkout
  if (session.mode === 'subscription') {
    await handleSubscriptionCheckout(session);
    return;
  }

  // Extract metadata for one-time purchases
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;
  const credits = parseInt(session.metadata?.credits || '0', 10);
  const bonusCredits = parseInt(session.metadata?.bonusCredits || '1', 10); // Default to 1 for backwards compatibility
  const isFirstPurchase = session.metadata?.isFirstPurchase === 'true';
  const isFoundersPackage = session.metadata?.isFoundersPackage === 'true';
  const isVipPackage = session.metadata?.isVipPackage === 'true';

  if (!userId || !credits) {
    console.error('Missing required metadata:', { userId, credits });
    return;
  }

  // IDEMPOTENCY CHECK: Prevent duplicate processing if Stripe retries the webhook
  const { hasBeenProcessed, error: idempotencyError } = await checkSessionProcessed(session.id);
  if (idempotencyError) {
    console.error('Error checking idempotency:', idempotencyError);
    // Continue anyway - better to risk duplicate than to fail a legitimate payment
  } else if (hasBeenProcessed) {
    console.log('Session already processed, skipping:', session.id);
    return;
  }

  // Update Stripe customer ID if we have it
  if (session.customer && typeof session.customer === 'string') {
    await updateStripeCustomerId(userId, session.customer);
  }

  // Handle Founders Package separately
  if (isFoundersPackage) {
    console.log('Processing Founders Package purchase:', {
      userId,
      sessionId: session.id,
    });

    const founderResult = await setFounderStatus(userId, {
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : undefined,
    });

    if (founderResult.success) {
      console.log('Founder status set successfully:', { userId });
    } else {
      console.error('Failed to set founder status:', { userId, error: founderResult.error });
    }
    await processAffiliateAttribution(session, userId);
    return;
  }

  // Handle VIP Package separately
  if (isVipPackage) {
    console.log('Processing VIP Package purchase:', {
      userId,
      sessionId: session.id,
    });

    const vipResult = await setVipStatus(userId, {
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : undefined,
    });

    if (vipResult.success) {
      console.log('VIP status set successfully:', { userId });
    } else {
      console.error('Failed to set VIP status:', { userId, error: vipResult.error });
    }
    await processAffiliateAttribution(session, userId);
    return;
  }

  // Regular credit purchase
  console.log('Adding credits:', {
    userId,
    tier,
    credits,
    bonusCredits,
    isFirstPurchase,
    sessionId: session.id,
    paymentIntentId: session.payment_intent,
  });

  // Add credits to user account
  const result = await addCredits(userId, credits, {
    stripeSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : undefined,
    description: `Purchased ${tier} package (${credits} credits)`,
    isFirstPurchase,
    bonusCredits, // Tier-specific bonus: Basic=1, Pro=3, Elite=5
  });

  if (result.success) {
    console.log('Credits added successfully:', {
      userId,
      newBalance: result.newBalance,
      bonusAdded: result.bonusAdded,
      bonusAmount: result.bonusAmount,
    });
  } else {
    console.error('Failed to add credits:', { userId, result });
  }

  // Affiliate attribution for one-time purchases
  await processAffiliateAttribution(session, userId);
}

/**
 * Handle subscription checkout - initial Card Lovers subscription
 */
async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  console.log('Processing subscription checkout:', session.id);

  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as 'monthly' | 'annual' | undefined;

  if (!userId || !plan) {
    console.error('Missing required subscription metadata:', { userId, plan });
    return;
  }

  // IDEMPOTENCY CHECK
  const { hasBeenProcessed, error: idempotencyError } = await checkSessionProcessed(session.id);
  if (idempotencyError) {
    console.error('Error checking idempotency:', idempotencyError);
  } else if (hasBeenProcessed) {
    console.log('Subscription session already processed, skipping:', session.id);
    return;
  }

  // Get subscription details from Stripe
  if (!session.subscription) {
    console.error('No subscription ID in checkout session');
    return;
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id;

  // Second idempotency layer: the session-id check above can't catch the case
  // where /api/subscription/status reconciliation already activated this
  // subscription (it has no session id). Skip if a grant event exists for
  // this subscription so a delayed checkout webhook can't double-credit.
  const supabase = getServiceClient();
  const { data: priorGrant } = await supabase
    .from('subscription_events')
    .select('id')
    .eq('user_id', userId)
    .eq('stripe_subscription_id', subscriptionId)
    .in('event_type', ['subscribed', 'renewed'])
    .limit(1);
  if (priorGrant && priorGrant.length > 0) {
    console.log('Subscription already granted (reconciliation or earlier event), skipping:', subscriptionId);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update Stripe customer ID
  if (session.customer && typeof session.customer === 'string') {
    await updateStripeCustomerId(userId, session.customer);
  }

  // Store userId in subscription metadata for future webhooks
  await stripe.subscriptions.update(subscriptionId, {
    metadata: { userId },
  });

  console.log('Activating Card Lovers subscription:', {
    userId,
    plan,
    subscriptionId,
    periodEnd: getSubscriptionPeriodEnd(subscription),
  });

  // Activate the subscription
  const result = await activateCardLoverSubscription(userId, {
    plan,
    subscriptionId,
    currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    stripeSessionId: session.id,
  });

  if (result.success) {
    console.log('Card Lovers subscription activated:', {
      userId,
      creditsAdded: result.creditsAdded,
    });
  } else {
    console.error('Failed to activate Card Lovers subscription:', result.error);
  }

  // Affiliate attribution for subscription (first invoice only)
  await processAffiliateAttribution(session, userId);
}

/**
 * Stripe SDK v20+ (API version 2025-03-31 and later) moved `subscription`
 * from the top-level Invoice object to invoice.parent.subscription_details.
 * Returns null for non-subscription invoices (one-time charges).
 *
 * This is the bug behind multiple silent Card Lovers renewal misses (see
 * scripts/fix-*-renewal*.ts): the old `invoice.subscription` check was always
 * undefined under the new schema, so every renewal hit the "not a subscription
 * invoice" early-return and the user was never credited despite Stripe taking
 * the payment.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = (invoice as any).parent?.subscription_details?.subscription;
  const fromTop = (invoice as any).subscription;
  const value = fromParent ?? fromTop;
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/**
 * Handle invoice.paid event - processes subscription renewals
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log('Processing invoice.paid:', invoice.id);

  // Skip if not a subscription invoice
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    console.log('Not a subscription invoice, skipping');
    return;
  }

  // Get the subscription to check if it's Card Lovers
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Check if this is a Card Lovers subscription by checking price ID
  const priceId = subscription.items.data[0]?.price.id;
  const isCardLoversMonthly = priceId === CARD_LOVERS_SUBSCRIPTION.monthly.priceId;
  const isCardLoversAnnual = priceId === CARD_LOVERS_SUBSCRIPTION.annual.priceId;

  if (!isCardLoversMonthly && !isCardLoversAnnual) {
    console.log('Not a Card Lovers subscription, skipping');
    return;
  }

  // Get user ID from subscription metadata, with fallback lookup by Stripe
  // customer ID. Older subscriptions (created before stripe.subscriptions.
  // update was added in handleSubscriptionCheckout) don't have userId in
  // their metadata — without this fallback, every renewal for those subs
  // would silently skip and never credit the user. This was the root cause
  // of multiple missed Card Lovers renewals (see fix-jeffrey-may1-renewal.ts
  // and fix-john-weaver-renewals.ts).
  let userId = subscription.metadata?.userId;
  if (!userId) {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    if (customerId) {
      const found = await findUserIdByStripeCustomer(customerId);
      if (found) {
        userId = found;
        console.log(`[handleInvoicePaid] Resolved userId via stripe_customer_id fallback (${customerId} → ${userId}); patching subscription metadata.`);
        // Self-heal: write userId back to subscription metadata so future
        // webhooks for this subscription don't need the fallback.
        try {
          await stripe.subscriptions.update(subscription.id, {
            metadata: { ...subscription.metadata, userId },
          });
        } catch (err) {
          console.warn('[handleInvoicePaid] Failed to backfill subscription metadata (non-fatal):', err);
        }
      }
    }
  }
  if (!userId) {
    console.error('Missing userId in subscription metadata AND no match by stripe_customer_id:', subscription.id, 'customer:', subscription.customer);
    return;
  }

  // Skip initial subscription invoice (handled by checkout.session.completed)
  if (invoice.billing_reason === 'subscription_create') {
    console.log('Initial subscription invoice, skipping (handled by checkout)');
    return;
  }

  // Defensive guard: skip if the subscription is cancelled or pending cancel.
  // Stripe normally doesn't fire invoice.paid for cancelled subscriptions, but
  // this protects against out-of-order webhook delivery (3-day retry window),
  // manual webhook replays from the Stripe dashboard, and admin actions on
  // the Stripe side. Without this guard, a stale invoice.paid arriving after
  // /api/stripe/cancel-subscription marked the sub cancel_at_period_end
  // would still credit the user.
  if (subscription.cancel_at_period_end || subscription.status === 'canceled') {
    console.log('[handleInvoicePaid] Subscription is cancelled or pending cancellation — skipping renewal credit:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
    return;
  }

  // Process renewal
  if (invoice.billing_reason === 'subscription_cycle') {
    console.log('Processing subscription renewal:', {
      userId,
      subscriptionId: subscription.id,
      plan: isCardLoversMonthly ? 'monthly' : 'annual',
    });

    const result = await processCardLoverRenewal(userId, {
      stripeInvoiceId: invoice.id,
      subscriptionId: subscription.id,
      currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    });

    if (result.success) {
      console.log('Card Lovers renewal processed:', {
        userId,
        creditsAdded: result.creditsAdded,
        bonusCredits: result.bonusCredits,
      });
      // Clear past-due flag set by handleInvoicePaymentFailed (if any).
      // Non-fatal if the column doesn't exist yet.
      try {
        const supabase = getServiceClient();
        await supabase
          .from('user_credits')
          .update({
            card_lover_payment_failed_at: null,
            card_lover_last_failed_invoice_id: null,
          })
          .eq('user_id', userId)
          .not('card_lover_payment_failed_at', 'is', null);
      } catch (err: any) {
        console.warn('[handleInvoicePaid] Could not clear past-due flag (non-fatal):', err?.message || err);
      }
    } else {
      console.error('Failed to process Card Lovers renewal:', result.error);
    }
  }
}

/**
 * Handle invoice.payment_failed event - subscription renewal payment failed
 * (declined card, expired card, insufficient funds, locked card, etc.).
 *
 * Stripe automatically retries via Smart Retries over the next ~1 week before
 * marking the subscription unpaid/canceled. This handler records the failure
 * so we can show a past-due banner on the account page and trigger a recovery
 * email pointing to the Stripe Customer Portal where the user can update
 * their payment method.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    console.log('Not a subscription invoice, skipping');
    return;
  }

  // Confirm this is a Card Lovers subscription before flipping any flags
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const isCardLovers =
    priceId === CARD_LOVERS_SUBSCRIPTION.monthly.priceId ||
    priceId === CARD_LOVERS_SUBSCRIPTION.annual.priceId;
  if (!isCardLovers) {
    console.log('Not a Card Lovers subscription, skipping');
    return;
  }

  // Resolve userId — metadata first, customer fallback (same pattern as
  // handleInvoicePaid).
  let userId = subscription.metadata?.userId;
  if (!userId) {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    if (customerId) {
      const found = await findUserIdByStripeCustomer(customerId);
      if (found) userId = found;
    }
  }
  if (!userId) {
    console.error('[handleInvoicePaymentFailed] Missing userId; subscription:', subscription.id);
    return;
  }

  const nextAttempt = (invoice as any).next_payment_attempt
    ? new Date((invoice as any).next_payment_attempt * 1000).toISOString()
    : null;

  console.log('[handleInvoicePaymentFailed] Card Lovers payment failed:', {
    userId,
    subscriptionId,
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count,
    nextPaymentAttempt: nextAttempt,
  });

  // Flip the past-due flag on user_credits so the account page can show a
  // banner. Schema added by migrations/add_card_lover_payment_failed_at.sql.
  const supabase = getServiceClient();
  const { error: flagErr } = await supabase
    .from('user_credits')
    .update({
      card_lover_payment_failed_at: new Date().toISOString(),
      card_lover_last_failed_invoice_id: invoice.id,
    })
    .eq('user_id', userId);
  if (flagErr) {
    // Non-fatal — the column may not have been added yet. Log and move on so
    // we still return 200 OK to Stripe and don't trigger retries.
    console.warn('[handleInvoicePaymentFailed] Could not flip past-due flag (column may be missing):', flagErr.message);
  }

  // Audit row in subscription_events for visibility.
  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'payment_failed',
    plan: priceId === CARD_LOVERS_SUBSCRIPTION.monthly.priceId ? 'monthly' : 'annual',
    credits_added: 0,
    bonus_credits: 0,
    stripe_subscription_id: subscription.id,
    stripe_invoice_id: invoice.id,
    metadata: {
      attempt_count: invoice.attempt_count,
      next_payment_attempt: nextAttempt,
    },
  });
}

/**
 * Handle subscription updated - checks for plan upgrades
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing subscription.updated:', subscription.id);

  // Get user ID from metadata, with same stripe_customer_id fallback used by
  // handleInvoicePaid — see comment there.
  let userId = subscription.metadata?.userId;
  if (!userId) {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    if (customerId) {
      const found = await findUserIdByStripeCustomer(customerId);
      if (found) {
        userId = found;
        console.log(`[handleSubscriptionUpdated] Resolved userId via stripe_customer_id fallback (${customerId} → ${userId}); patching metadata.`);
        try {
          await stripe.subscriptions.update(subscription.id, {
            metadata: { ...subscription.metadata, userId },
          });
        } catch (err) {
          console.warn('[handleSubscriptionUpdated] Failed to backfill metadata (non-fatal):', err);
        }
      }
    }
  }
  if (!userId) {
    console.error('Missing userId in subscription metadata AND no match by stripe_customer_id:', subscription.id);
    return;
  }

  // Check current price to see if this is a Card Lovers subscription
  const priceId = subscription.items.data[0]?.price.id;
  const isCardLoversMonthly = priceId === CARD_LOVERS_SUBSCRIPTION.monthly.priceId;
  const isCardLoversAnnual = priceId === CARD_LOVERS_SUBSCRIPTION.annual.priceId;

  if (!isCardLoversMonthly && !isCardLoversAnnual) {
    console.log('Not a Card Lovers subscription update, skipping');
    return;
  }

  // Get current user status
  const userCredits = await getUserCredits(userId);
  if (!userCredits) {
    console.error('User credits not found:', userId);
    return;
  }

  // Check for upgrade from monthly to annual
  if (isCardLoversAnnual && userCredits.card_lover_plan === 'monthly') {
    console.log('Detected upgrade from monthly to annual:', userId);
    // Upgrade will be handled when the invoice is paid
    // Just log for now
  }

  const supabase = getServiceClient();

  // Mirror Stripe's pending-cancellation state into our DB. Previously this
  // handler recorded NOTHING, so a cancel scheduled via
  // /api/stripe/cancel-subscription left no DB trace — the only persisted
  // record was the final 'cancelled' event on subscription.deleted. Now we
  // persist the flag + the effective date and log a one-time audit event on
  // each transition (scheduled ↔ reversed).
  const newPeriodEnd = getSubscriptionPeriodEnd(subscription);
  const willCancel = subscription.cancel_at_period_end === true;
  const wasCancel = userCredits.card_lover_cancel_at_period_end === true;

  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      // Keep the sub id current and write the period end (the old code only
      // logged this — the DB never actually moved).
      card_lover_subscription_id: subscription.id,
      card_lover_current_period_end: newPeriodEnd.toISOString(),
      card_lover_cancel_at_period_end: willCancel,
      card_lover_cancel_at: willCancel ? newPeriodEnd.toISOString() : null,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('[handleSubscriptionUpdated] Failed to persist subscription update:', updateError);
  }

  if (willCancel !== wasCancel) {
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: willCancel ? 'cancel_scheduled' : 'cancel_reversed',
      plan: isCardLoversAnnual ? 'annual' : 'monthly',
      credits_added: 0,
      bonus_credits: 0,
      stripe_subscription_id: subscription.id,
      metadata: willCancel
        ? { cancel_at: newPeriodEnd.toISOString() }
        : { resumed: true },
    });
    console.log(`[handleSubscriptionUpdated] ${willCancel ? 'cancel_scheduled' : 'cancel_reversed'} for user ${userId}`);
  }
}

/**
 * Handle subscription deleted - cancellation complete
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription.deleted:', subscription.id);

  // Get user ID from metadata, with stripe_customer_id fallback (same as
  // handleInvoicePaid / handleSubscriptionUpdated).
  let userId = subscription.metadata?.userId;
  if (!userId) {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    if (customerId) {
      const found = await findUserIdByStripeCustomer(customerId);
      if (found) userId = found;
    }
  }
  if (!userId) {
    console.error('Missing userId in subscription metadata AND no match by stripe_customer_id:', subscription.id);
    return;
  }

  // Cancel the Card Lovers subscription in our database
  const result = await cancelCardLoverSubscription(userId, {
    subscriptionId: subscription.id,
  });

  if (result.success) {
    console.log('Card Lovers subscription cancelled:', userId);
  } else {
    console.error('Failed to cancel Card Lovers subscription:', result.error);
  }
}

/**
 * Process affiliate attribution for a checkout session.
 * Looks up affiliate from metadata ref_code or Stripe promotion code.
 */
async function processAffiliateAttribution(session: Stripe.Checkout.Session, userId: string) {
  try {
    const refCode = session.metadata?.ref_code;
    let affiliate = null;

    // Method 1: ref_code from session metadata (referral link)
    if (refCode) {
      affiliate = await getAffiliateByCode(refCode);
    }

    // Method 2: Stripe promotion code used at checkout
    if (!affiliate && session.total_details?.breakdown?.discounts) {
      for (const discount of session.total_details.breakdown.discounts) {
        const promoCodeId = typeof discount.discount?.promotion_code === 'string'
          ? discount.discount.promotion_code
          : (discount.discount?.promotion_code as any)?.id;
        if (promoCodeId) {
          affiliate = await getAffiliateByPromotionCode(promoCodeId);
          if (affiliate) break;
        }
      }
    }

    if (!affiliate) {
      // No affiliate attribution for this session
      return;
    }

    // Calculate amounts
    const orderAmount = (session.amount_total || 0) / 100;
    // Net amount = what DCM receives after Stripe discount (not including Stripe fees)
    const netAmount = (session.amount_total || 0) / 100;

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : undefined;

    const tier = session.metadata?.tier || 'unknown';
    const plan = session.metadata?.plan;

    const commissionResult = await createCommission(affiliate.id, {
      referredUserId: userId,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      orderAmount,
      netAmount,
      metadata: {
        tier,
        plan: plan || undefined,
        credits: session.metadata?.credits,
      },
    });

    if (commissionResult.success) {
      if (commissionResult.skipped) {
        console.log(`[Affiliate] Attribution skipped: ${commissionResult.skipped} for session ${session.id}`);
      } else {
        console.log(`[Affiliate] Commission created for session ${session.id}, affiliate ${affiliate.code}`);
      }
    } else {
      console.error(`[Affiliate] Failed to create commission for session ${session.id}:`, commissionResult.error);
    }
  } catch (error) {
    // Don't fail the webhook if affiliate processing fails
    console.error('[Affiliate] Error processing attribution:', error);
  }
}

/**
 * Handle charge.refunded event — reverse affiliate commission
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log('Processing charge.refunded:', charge.id);

  // Get the payment intent to find the checkout session
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.log('No payment intent on refunded charge, skipping affiliate reversal');
    return;
  }

  try {
    // Look up checkout sessions by payment intent
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });

    if (sessions.data.length === 0) {
      return;
    }

    const sessionId = sessions.data[0].id;
    const result = await reverseCommission(sessionId, `Refund on charge ${charge.id}`);

    if (result.success) {
      console.log(`[Affiliate] Commission reversal processed for charge ${charge.id}`);
    } else {
      console.error(`[Affiliate] Failed to reverse commission:`, result.error);
    }
  } catch (error) {
    // Don't fail the webhook if affiliate reversal fails
    console.error('[Affiliate] Error reversing commission on refund:', error);
  }
}
