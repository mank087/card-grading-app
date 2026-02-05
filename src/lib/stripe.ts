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
