/**
 * Stripe client configuration for DCM Grading
 */

import Stripe from 'stripe';

// Server-side Stripe client (only use in API routes)
// Using SDK default API version (v20 uses 2025-09-30.clover)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Price configuration
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
} as const;

export type StripePriceTier = keyof typeof STRIPE_PRICES;

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
