/**
 * Stripe Webhook Handler
 * Processes payment events and credits user accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, CARD_LOVERS_SUBSCRIPTION } from '@/lib/stripe';
import {
  addCredits,
  updateStripeCustomerId,
  setFounderStatus,
  setVipStatus,
  activateCardLoverSubscription,
  processCardLoverRenewal,
  cancelCardLoverSubscription,
  getUserCredits,
} from '@/lib/credits';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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
    periodEnd: new Date(subscription.current_period_end * 1000),
  });

  // Activate the subscription
  const result = await activateCardLoverSubscription(userId, {
    plan,
    subscriptionId,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  });

  if (result.success) {
    console.log('Card Lovers subscription activated:', {
      userId,
      creditsAdded: result.creditsAdded,
    });
  } else {
    console.error('Failed to activate Card Lovers subscription:', result.error);
  }
}

/**
 * Handle invoice.paid event - processes subscription renewals
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log('Processing invoice.paid:', invoice.id);

  // Skip if not a subscription invoice
  if (!invoice.subscription) {
    console.log('Not a subscription invoice, skipping');
    return;
  }

  // Get the subscription to check if it's Card Lovers
  const subscription = await stripe.subscriptions.retrieve(
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
  );

  // Check if this is a Card Lovers subscription by checking price ID
  const priceId = subscription.items.data[0]?.price.id;
  const isCardLoversMonthly = priceId === CARD_LOVERS_SUBSCRIPTION.monthly.priceId;
  const isCardLoversAnnual = priceId === CARD_LOVERS_SUBSCRIPTION.annual.priceId;

  if (!isCardLoversMonthly && !isCardLoversAnnual) {
    console.log('Not a Card Lovers subscription, skipping');
    return;
  }

  // Get user ID from subscription metadata
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('Missing userId in subscription metadata:', subscription.id);
    return;
  }

  // Skip initial subscription invoice (handled by checkout.session.completed)
  if (invoice.billing_reason === 'subscription_create') {
    console.log('Initial subscription invoice, skipping (handled by checkout)');
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
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });

    if (result.success) {
      console.log('Card Lovers renewal processed:', {
        userId,
        creditsAdded: result.creditsAdded,
        bonusCredits: result.bonusCredits,
      });
    } else {
      console.error('Failed to process Card Lovers renewal:', result.error);
    }
  }
}

/**
 * Handle subscription updated - checks for plan upgrades
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing subscription.updated:', subscription.id);

  // Get user ID from metadata
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('Missing userId in subscription metadata');
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

  // Update period end if changed
  const newPeriodEnd = new Date(subscription.current_period_end * 1000);
  const currentPeriodEnd = userCredits.card_lover_current_period_end
    ? new Date(userCredits.card_lover_current_period_end)
    : null;

  if (!currentPeriodEnd || newPeriodEnd.getTime() !== currentPeriodEnd.getTime()) {
    console.log('Updating subscription period end:', {
      userId,
      oldPeriodEnd: currentPeriodEnd,
      newPeriodEnd,
    });
  }
}

/**
 * Handle subscription deleted - cancellation complete
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription.deleted:', subscription.id);

  // Get user ID from metadata
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('Missing userId in subscription metadata');
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
