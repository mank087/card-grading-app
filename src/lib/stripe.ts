/**
 * Stripe client configuration for DCM Grading
 */

import Stripe from 'stripe';

// Server-side Stripe client (only use in API routes)
// Using SDK default API version (v20 uses 2025-09-30.clover)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// One-time purchase price configuration
export const STRIPE_PRICES = {
  basic: {
    priceId: process.env.STRIPE_PRICE_BASIC!,
    credits: 1,
    price: 2.99,
    name: 'Basic',
    description: '1 Card Grade',
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO!,
    credits: 5,
    price: 9.99,
    name: 'Pro',
    description: '5 Card Grades',
  },
  elite: {
    priceId: process.env.STRIPE_PRICE_ELITE!,
    credits: 20,
    price: 19.99,
    name: 'Elite',
    description: '20 Card Grades',
  },
  founders: {
    priceId: process.env.STRIPE_PRICE_FOUNDERS!,
    credits: 150,
    price: 99,
    name: 'Founders Package',
    description: '150 Card Grades + Lifetime Benefits',
  },
  vip: {
    priceId: process.env.STRIPE_PRICE_VIP!,
    credits: 150,
    price: 99,
    name: 'VIP',
    description: '150 Card Grades + VIP Emblem',
  },
} as const;

export type StripePriceTier = keyof typeof STRIPE_PRICES;

// Card Lovers subscription configuration
export const CARD_LOVERS_SUBSCRIPTION = {
  monthly: {
    priceId: process.env.STRIPE_PRICE_CARD_LOVERS_MONTHLY!,
    credits: 70,
    price: 49.99,
    interval: 'month' as const,
    name: 'Card Lovers Monthly',
    description: '70 credits/month + exclusive perks',
  },
  annual: {
    priceId: process.env.STRIPE_PRICE_CARD_LOVERS_ANNUAL!,
    credits: 840, // Base credits (70 x 12)
    bonusCredits: 60, // Annual bonus
    totalCredits: 900, // 840 + 60
    price: 449,
    interval: 'year' as const,
    name: 'Card Lovers Annual',
    description: '900 credits/year + exclusive perks (save $150)',
  },
} as const;

export type CardLoversPlan = keyof typeof CARD_LOVERS_SUBSCRIPTION;

/**
 * True if a Stripe price id is one of the Card Lovers subscription prices
 * (monthly or annual). Used to identify a customer's Card Lovers sub when
 * we only have a customer id (e.g. our DB lost the subscription id).
 */
export function isCardLoversPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return (
    priceId === CARD_LOVERS_SUBSCRIPTION.monthly.priceId ||
    priceId === CARD_LOVERS_SUBSCRIPTION.annual.priceId
  );
}

/**
 * Find a customer's current Card Lovers subscription directly from Stripe,
 * preferring a still-billable one. Returns null if the customer has none.
 *
 * "Billable" = Stripe still considers the sub real and a cancel/resume is
 * meaningful: active, past_due, trialing, or unpaid. This is the source of
 * truth when our DB is out of sync (missed webhook, lapsed period) — Stripe
 * may still be charging a sub our DB has forgotten.
 */
export async function findCardLoversSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
  });
  const cardLovers = subs.data.filter((s) =>
    isCardLoversPriceId(s.items.data[0]?.price?.id)
  );
  const MANAGEABLE = ['active', 'past_due', 'trialing', 'unpaid'];
  return (
    cardLovers.find((s) => MANAGEABLE.includes(s.status)) ||
    cardLovers[0] ||
    null
  );
}

// Loyalty bonus milestones for monthly subscribers
export const CARD_LOVERS_LOYALTY_BONUSES: Record<number, number> = {
  3: 5,   // Month 3: +5 credits
  6: 10,  // Month 6: +10 credits
  9: 15,  // Month 9: +15 credits
  12: 20, // Month 12: +20 credits
};

// Card Lovers discount on credit purchases (20%)
export const CARD_LOVERS_DISCOUNT = 0.20;

// Founder discount on credit purchases (20%) - same rate as Card Lovers
export const FOUNDER_DISCOUNT = 0.20;

// Get credits for a price ID
export function getCreditsForPrice(priceId: string): number {
  for (const tier of Object.values(STRIPE_PRICES)) {
    if (tier.priceId === priceId) {
      return tier.credits;
    }
  }
  return 0;
}

// Get tier info by price ID
export function getTierByPriceId(priceId: string) {
  for (const [key, tier] of Object.entries(STRIPE_PRICES)) {
    if (tier.priceId === priceId) {
      return { key: key as StripePriceTier, ...tier };
    }
  }
  return null;
}

/**
 * Read a subscription's current period end. Stripe's API moved this field
 * from `subscription.current_period_end` (top-level, deprecated) to
 * `subscription.items.data[0].current_period_end`. The deprecated field
 * returns undefined on newer accounts/products — code that fell through
 * to a `Date.now() + 30 days` fallback was setting wrong period_end values
 * (notably broke annual subscriptions, which expired after a month
 * instead of a year). This helper checks both locations and falls back
 * gracefully with a warning if neither is set.
 */
export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date {
  const item: any = subscription.items?.data?.[0];
  const itemTs: number | undefined = item?.current_period_end;
  const topLevelTs: number | undefined = (subscription as any).current_period_end;
  if (typeof itemTs === 'number' && itemTs > 0 && isFinite(itemTs)) {
    return new Date(itemTs * 1000);
  }
  if (typeof topLevelTs === 'number' && topLevelTs > 0 && isFinite(topLevelTs)) {
    return new Date(topLevelTs * 1000);
  }
  console.warn('[getSubscriptionPeriodEnd] No valid current_period_end on subscription', subscription.id, '— falling back to 30 days from now');
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}
