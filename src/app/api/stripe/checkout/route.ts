/**
 * Stripe Checkout Session API
 * Creates a checkout session for purchasing credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICES, StripePriceTier } from '@/lib/stripe';
import { getUserCredits, isFirstPurchase, isFounder, getFounderDiscountMultiplier } from '@/lib/credits';
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
        { error: 'Invalid tier. Must be one of: basic, pro, elite, founders' },
        { status: 400 }
      );
    }

    // Special handling for founders package
    const isFoundersPackage = tier === 'founders';

    if (isFoundersPackage) {
      // Check if user is already a founder
      const alreadyFounder = await isFounder(userId);
      if (alreadyFounder) {
        return NextResponse.json(
          { error: 'You are already a DCM Founder!' },
          { status: 400 }
        );
      }

      // Check if founders program has expired (Feb 1, 2026)
      const expirationDate = new Date('2026-02-01T23:59:59-05:00');
      if (new Date() > expirationDate) {
        return NextResponse.json(
          { error: 'The Founders Package program has ended.' },
          { status: 400 }
        );
      }
    }

    const priceConfig = STRIPE_PRICES[tier];

    // Tier-specific bonus credits for DCM Launch Special (not applicable to founders)
    const bonusCreditsMap: Record<string, number> = {
      basic: 1,
      pro: 3,
      elite: 5,
      founders: 0, // Founders don't get additional bonus - it's already a great deal
    };
    const bonusCredits = bonusCreditsMap[tier] || 0;

    // Check if this is first purchase (for bonus credit) - not applicable to founders
    const firstPurchase = isFoundersPackage ? false : await isFirstPurchase(userId);

    // Check if user is a founder (for discount on regular packages)
    const userIsFounder = isFoundersPackage ? false : await isFounder(userId);

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

    // Set success and cancel URLs based on package type
    const successUrl = isFoundersPackage
      ? `${origin}/founders/success?session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/credits/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}&value=${priceConfig.price}&credits=${priceConfig.credits}`;
    const cancelUrl = isFoundersPackage
      ? `${origin}/founders?canceled=true`
      : `${origin}/credits?canceled=true`;

    // Build checkout session options
    const checkoutOptions: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: 'payment',
      allow_promotion_codes: true, // Enable promo code input on checkout page
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId,
        tier: tier,
        credits: priceConfig.credits.toString(),
        bonusCredits: bonusCredits.toString(),
        isFirstPurchase: firstPurchase.toString(),
        isFoundersPackage: isFoundersPackage.toString(),
      },
      payment_intent_data: {
        metadata: {
          userId: userId,
          tier: tier,
          credits: priceConfig.credits.toString(),
          bonusCredits: bonusCredits.toString(),
          isFirstPurchase: firstPurchase.toString(),
          isFoundersPackage: isFoundersPackage.toString(),
        },
      },
    };

    // Handle line items based on tier and founder status
    if (userIsFounder && !isFoundersPackage) {
      // Founders get 20% off regular packages - use dynamic pricing
      const discountedPrice = Math.round(priceConfig.price * getFounderDiscountMultiplier() * 100); // in cents
      checkoutOptions.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${priceConfig.name} (Founder Discount)`,
              description: `${priceConfig.description} - 20% Founder Discount Applied`,
            },
            unit_amount: discountedPrice,
          },
          quantity: 1,
        },
      ];
    } else {
      // Standard pricing
      checkoutOptions.line_items = [
        {
          price: priceConfig.priceId,
          quantity: 1,
        },
      ];
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(checkoutOptions);

    // Calculate what user will receive
    const creditsToReceive = firstPurchase
      ? priceConfig.credits + bonusCredits
      : priceConfig.credits;

    // Calculate actual price paid (with founder discount if applicable)
    const actualPrice = userIsFounder && !isFoundersPackage
      ? priceConfig.price * getFounderDiscountMultiplier()
      : priceConfig.price;

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      tier: tier,
      credits: priceConfig.credits,
      bonusCredits: firstPurchase ? bonusCredits : 0,
      totalCredits: creditsToReceive,
      price: actualPrice,
      originalPrice: priceConfig.price,
      founderDiscount: userIsFounder && !isFoundersPackage,
      isFoundersPackage: isFoundersPackage,
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
