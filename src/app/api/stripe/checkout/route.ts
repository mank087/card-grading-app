/**
 * Stripe Checkout Session API
 * Creates a checkout session for purchasing credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICES, StripePriceTier } from '@/lib/stripe';
import { getUserCredits, isFirstPurchase } from '@/lib/credits';
import { verifyAuth } from '@/lib/serverAuth';
import { checkRateLimit, RATE_LIMITS, getRateLimitIdentifier, createRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authResult = await verifyAuth(request);
    console.log('[Checkout] Auth result:', {
      authenticated: authResult.authenticated,
      userId: authResult.userId,
      hasUser: !!authResult.user,
      error: authResult.error
    });

    if (!authResult.authenticated || !authResult.userId) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // Check rate limit for payment endpoints
    const rateLimitId = getRateLimitIdentifier(authResult.userId, request);
    const rateLimitResult = checkRateLimit(rateLimitId, RATE_LIMITS.PAYMENT);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        createRateLimitResponse(rateLimitResult),
        { status: 429 }
      );
    }

    const userId = authResult.userId;
    const userEmail = authResult.user?.email;

    // Get requested tier from body
    const body = await request.json();
    const { tier } = body as { tier: StripePriceTier };

    if (!tier || !STRIPE_PRICES[tier]) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be one of: basic, pro, elite' },
        { status: 400 }
      );
    }

    const priceConfig = STRIPE_PRICES[tier];

    // Tier-specific bonus credits for DCM Launch Special
    const bonusCreditsMap: Record<StripePriceTier, number> = {
      basic: 1,
      pro: 2,
      elite: 5,
    };
    const bonusCredits = bonusCreditsMap[tier];

    // Check if this is first purchase (for bonus credit)
    const firstPurchase = await isFirstPurchase(userId);

    // Get or create user credits record to get Stripe customer ID
    const userCredits = await getUserCredits(userId);
    let stripeCustomerId = userCredits?.stripe_customer_id;

    // Create or retrieve Stripe customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Determine success/cancel URLs with origin validation
    const allowedOrigins = [
      'https://dcmgrading.com',
      'https://www.dcmgrading.com',
      // Allow localhost only in development
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
    ];

    const requestOrigin = request.headers.get('origin');
    // Validate origin against allowlist, default to production domain
    const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : 'https://www.dcmgrading.com';

    const successUrl = `${origin}/credits/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/credits?canceled=true`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceConfig.priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId,
        tier: tier,
        credits: priceConfig.credits.toString(),
        bonusCredits: bonusCredits.toString(),
        isFirstPurchase: firstPurchase.toString(),
      },
      payment_intent_data: {
        metadata: {
          userId: userId,
          tier: tier,
          credits: priceConfig.credits.toString(),
          bonusCredits: bonusCredits.toString(),
          isFirstPurchase: firstPurchase.toString(),
        },
      },
    });

    // Calculate what user will receive
    const creditsToReceive = firstPurchase
      ? priceConfig.credits + bonusCredits
      : priceConfig.credits;

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      tier: tier,
      credits: priceConfig.credits,
      bonusCredits: firstPurchase ? bonusCredits : 0,
      totalCredits: creditsToReceive,
      price: priceConfig.price,
    });
  } catch (error: any) {
    console.error('Checkout session error:', error);

    // Return more specific error message for debugging
    const errorMessage = error?.message || 'Failed to create checkout session';
    const errorType = error?.type || 'unknown';

    return NextResponse.json(
      {
        error: errorMessage,
        type: errorType,
        details: process.env.NODE_ENV === 'development' ? error?.raw?.message : undefined
      },
      { status: 500 }
    );
  }
}
