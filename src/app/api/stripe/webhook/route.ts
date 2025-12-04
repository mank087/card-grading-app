/**
 * Stripe Webhook Handler
 * Processes payment events and credits user accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { addCredits, updateStripeCustomerId } from '@/lib/credits';
import Stripe from 'stripe';

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
  const isFirstPurchase = session.metadata?.isFirstPurchase === 'true';

  if (!userId || !credits) {
    console.error('Missing required metadata:', { userId, credits });
    return;
  }

  console.log('Adding credits:', {
    userId,
    tier,
    credits,
    isFirstPurchase,
    sessionId: session.id,
    paymentIntentId: session.payment_intent,
  });

  // Update Stripe customer ID if we have it
  if (session.customer && typeof session.customer === 'string') {
    await updateStripeCustomerId(userId, session.customer);
  }

  // Add credits to user account
  const result = await addCredits(userId, credits, {
    stripeSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : undefined,
    description: `Purchased ${tier} package (${credits} credits)`,
    isFirstPurchase,
  });

  if (result.success) {
    console.log('Credits added successfully:', {
      userId,
      newBalance: result.newBalance,
      bonusAdded: result.bonusAdded,
    });
  } else {
    console.error('Failed to add credits:', { userId, result });
  }
}
