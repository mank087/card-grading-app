/**
 * Stripe Webhook Handler
 * Processes payment events and credits user accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { addCredits, updateStripeCustomerId, setFounderStatus } from '@/lib/credits';
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

  // Extract metadata
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;
  const credits = parseInt(session.metadata?.credits || '0', 10);
  const bonusCredits = parseInt(session.metadata?.bonusCredits || '1', 10); // Default to 1 for backwards compatibility
  const isFirstPurchase = session.metadata?.isFirstPurchase === 'true';
  const isFoundersPackage = session.metadata?.isFoundersPackage === 'true';

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
