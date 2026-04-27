/**
 * Create Payment Intent for Mobile App
 *
 * Used by the React Native Stripe SDK (PaymentSheet) for in-app purchases.
 * Creates a PaymentIntent with the same metadata as the web checkout so the
 * existing webhook handles credit provisioning.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth } from '@/lib/serverAuth';
import { STRIPE_PRICES, CARD_LOVERS_DISCOUNT, FOUNDER_DISCOUNT } from '@/lib/stripe';
import { getUserCredits, isFirstPurchase } from '@/lib/credits';
import { isActiveCardLover, hasFounderDiscount } from '@/lib/credits';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as any,
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = auth.user.id;
    const userEmail = auth.user.email;
    const body = await request.json();
    const { tier } = body;

    if (!tier || !STRIPE_PRICES[tier as keyof typeof STRIPE_PRICES]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const priceConfig = STRIPE_PRICES[tier as keyof typeof STRIPE_PRICES];
    const isFoundersPackage = tier === 'founders';
    const isVipPackage = tier === 'vip';

    // Bonus credits
    const bonusCreditsMap: Record<string, number> = {
      basic: 1, pro: 3, elite: 5, founders: 0, vip: 0,
    };
    const bonusCredits = bonusCreditsMap[tier] || 0;

    // First purchase check
    const firstPurchase = (isFoundersPackage || isVipPackage) ? false : await isFirstPurchase(userId);

    // Discount check (same logic as checkout route)
    const isDiscountEligibleTier = !isFoundersPackage;
    const hasCardLoverDiscount = isDiscountEligibleTier && await isActiveCardLover(userId);
    const hasFounderDiscountEligible = isDiscountEligibleTier && !hasCardLoverDiscount && await hasFounderDiscount(userId);

    const discountRate = hasCardLoverDiscount ? CARD_LOVERS_DISCOUNT :
                         hasFounderDiscountEligible ? FOUNDER_DISCOUNT : 0;
    const discountLabel = hasCardLoverDiscount ? 'Card Lovers 20% Off' :
                          hasFounderDiscountEligible ? 'Founder 20% Off' : null;

    // Calculate amount in cents
    const amountCents = discountRate > 0
      ? Math.round(priceConfig.price * (1 - discountRate) * 100)
      : Math.round(priceConfig.price * 100);

    // Get or create Stripe customer
    const userCredits = await getUserCredits(userId);
    let stripeCustomerId = userCredits?.stripe_customer_id;

    if (!stripeCustomerId) {
      const existingCustomers = await stripe.customers.list({ email: userEmail!, limit: 1 });
      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
      }
    }

    // Build metadata (same as checkout route so webhook works identically)
    const metadata: Record<string, string> = {
      userId,
      tier,
      credits: priceConfig.credits.toString(),
      bonusCredits: bonusCredits.toString(),
      isFirstPurchase: firstPurchase.toString(),
      isFoundersPackage: isFoundersPackage.toString(),
      isVipPackage: isVipPackage.toString(),
      source: 'mobile_app',
    };

    // Create ephemeral key for the customer (needed by PaymentSheet)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: stripeCustomerId! },
      { apiVersion: '2025-01-27.acacia' as any }
    );

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId!,
      payment_method_types: ['card'],
      metadata,
      description: discountLabel
        ? `${priceConfig.name} (${discountLabel})`
        : priceConfig.name,
    });

    const displayPrice = amountCents / 100;

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customerId: stripeCustomerId,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      // Info for the app to display
      tier,
      credits: priceConfig.credits,
      bonusCredits: firstPurchase ? bonusCredits : 0,
      totalCredits: firstPurchase ? priceConfig.credits + bonusCredits : priceConfig.credits,
      price: displayPrice,
      originalPrice: discountRate > 0 ? priceConfig.price : undefined,
      discountLabel,
      hasDiscount: discountRate > 0,
    });
  } catch (error: any) {
    console.error('[PaymentIntent] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create payment' }, { status: 500 });
  }
}
