/**
 * Stripe Checkout Session API
 * Creates a checkout session for purchasing credits
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe, STRIPE_PRICES, StripePriceTier, CARD_LOVERS_DISCOUNT, FOUNDER_DISCOUNT } from '@/lib/stripe';
import { getUserCredits, isFirstPurchase, isActiveCardLover, hasFounderDiscount } from '@/lib/credits';
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
        { error: 'Invalid tier. Must be one of: basic, pro, elite, founders, vip' },
        { status: 400 }
      );
    }

    // Special handling for founders and VIP packages
    const isFoundersPackage = tier === 'founders';
    const isVipPackage = tier === 'vip';

    const priceConfig = STRIPE_PRICES[tier];

    // Tier-specific bonus credits for DCM Launch Special (not applicable to founders/vip)
    const bonusCreditsMap: Record<string, number> = {
      basic: 1,
      pro: 3,
      elite: 5,
      founders: 0, // Founders don't get additional bonus - it's already a great deal
      vip: 0, // VIP doesn't get additional bonus - it's already a great deal
    };
    const bonusCredits = bonusCreditsMap[tier] || 0;

    // Check if this is first purchase (for bonus credit) - not applicable to founders/vip
    const firstPurchase = (isFoundersPackage || isVipPackage) ? false : await isFirstPurchase(userId);

    // Check if user is eligible for discount (20% for Card Lovers or Founders)
    // Card Lover discount takes precedence, but they're the same rate
    // Discounts don't apply to founders or vip packages
    const isDiscountEligibleTier = !isFoundersPackage && !isVipPackage;
    const hasCardLoverDiscount = isDiscountEligibleTier && await isActiveCardLover(userId);
    const hasFounderDiscountEligible = isDiscountEligibleTier && !hasCardLoverDiscount && await hasFounderDiscount(userId);

    // Determine discount rate and label
    const discountRate = hasCardLoverDiscount ? CARD_LOVERS_DISCOUNT :
                         hasFounderDiscountEligible ? FOUNDER_DISCOUNT : 0;
    const discountLabel = hasCardLoverDiscount ? 'Card Lovers 20% Off' :
                          hasFounderDiscountEligible ? 'Founder 20% Off' : null;

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
    // VIP uses credits success page (not founders success page)
    const successUrl = isFoundersPackage
      ? `${origin}/founders/success?session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/credits/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}&value=${priceConfig.price}&credits=${priceConfig.credits}`;
    const cancelUrl = isFoundersPackage
      ? `${origin}/founders?canceled=true`
      : `${origin}/credits?canceled=true`;

    // Build checkout session options
    const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
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
        isVipPackage: isVipPackage.toString(),
      },
      payment_intent_data: {
        metadata: {
          userId: userId,
          tier: tier,
          credits: priceConfig.credits.toString(),
          bonusCredits: bonusCredits.toString(),
          isFirstPurchase: firstPurchase.toString(),
          isFoundersPackage: isFoundersPackage.toString(),
          isVipPackage: isVipPackage.toString(),
        },
      },
    };

    // Apply 20% discount using custom pricing (for Card Lovers or Founders), or use standard price
    if (discountRate > 0 && discountLabel) {
      // Calculate discounted price in cents (Stripe uses smallest currency unit)
      const discountedPriceCents = Math.round(priceConfig.price * (1 - discountRate) * 100);

      checkoutOptions.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${priceConfig.name} (${discountLabel})`,
              description: priceConfig.description,
            },
            unit_amount: discountedPriceCents,
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

    // Calculate discounted price if applicable
    const discountedPrice = discountRate > 0
      ? priceConfig.price * (1 - discountRate)
      : priceConfig.price;

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      tier: tier,
      credits: priceConfig.credits,
      bonusCredits: firstPurchase ? bonusCredits : 0,
      totalCredits: creditsToReceive,
      price: priceConfig.price,
      discountedPrice: discountRate > 0 ? discountedPrice : undefined,
      hasCardLoverDiscount,
      hasFounderDiscount: hasFounderDiscountEligible,
      discountLabel,
      isFoundersPackage: isFoundersPackage,
      isVipPackage: isVipPackage,
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
