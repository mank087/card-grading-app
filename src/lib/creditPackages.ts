/**
 * Credit package definitions — the single source of truth for pack pricing.
 *
 * Lives here rather than inside the credits page so marketing surfaces (blog
 * embeds, landing pages) can show the same numbers the checkout uses. Change
 * a price here and every surface follows.
 */

export interface PricingTier {
  id: 'basic' | 'pro' | 'elite'
  name: string
  price: number
  credits: number
  bonusCredits: number
  description: string
  popular?: boolean
  icon: string
  color: string
  bgGradient: string
  savingsPercent?: number
  perGradeCost: number
}

/** Base price per credit (Basic tier: $2.99/credit) */
export const BASE_PRICE_PER_CREDIT = 2.99

export const pricingTiers: PricingTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 2.99,
    credits: 1,
    bonusCredits: 1,
    description: 'Perfect for trying out DCM Grading',
    icon: '⭐',
    color: 'blue',
    bgGradient: 'from-blue-500 to-blue-600',
    perGradeCost: 2.99,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    credits: 5,
    bonusCredits: 3,
    description: 'Best value for casual collectors',
    popular: true,
    icon: '🚀',
    color: 'purple',
    bgGradient: 'from-purple-600 to-indigo-600',
    savingsPercent: 33,
    perGradeCost: 2.00,
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 19.99,
    credits: 20,
    bonusCredits: 5,
    description: 'For serious collectors and dealers',
    icon: '👑',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-600',
    savingsPercent: 67,
    perGradeCost: 1.00,
  },
]

/** VIP is rendered as its own block on the credits page; display data only. */
export const VIP_PACKAGE = {
  name: 'VIP',
  price: 99,
  credits: 150,
  perGradeCost: 0.66,
  description: 'Lowest cost per grade',
  icon: '◆',
} as const

/** Public subscription values shared by marketing and the server-side Stripe config. */
export const CARD_LOVERS_PLANS = {
  monthly: { credits: 70, price: 49.99, interval: 'month', name: 'Card Lovers Monthly', description: '70 credits/month + exclusive perks' },
  annual: { credits: 840, bonusCredits: 60, totalCredits: 900, price: 449, interval: 'year', name: 'Card Lovers Annual', description: '900 credits/year + exclusive perks (save $150)' },
} as const
