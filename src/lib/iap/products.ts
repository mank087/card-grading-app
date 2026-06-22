/**
 * Canonical IAP product catalog — single source of truth shared between
 * Apple and Google verification handlers.
 *
 * Product IDs MUST match exactly what's configured in App Store Connect
 * and Google Play Console. If you change one of these, change the IAP
 * product in both stores too.
 */

export type ProductType = 'consumable' | 'subscription'

export interface IAPProductDefinition {
  /** Apple App Store / Google Play product identifier */
  productId: string
  /** Number of grading credits granted on a successful purchase. For
   *  subscriptions, this is the credit grant per billing period. */
  credits: number
  /** Stable type used in iap_transactions.product_type. */
  type: ProductType
  /** For subscriptions only — used to label the Card Lovers period. */
  subscriptionPeriod?: 'monthly' | 'annual'
  /** True for the VIP package — grants VIP status (is_vip + badge) in
   *  addition to credits, mirroring the web setVipStatus() purchase path. */
  grantsVip?: boolean
  /** Human-readable, used in receipts / logs only. Not user-facing. */
  label: string
}

export const IAP_PRODUCTS: Record<string, IAPProductDefinition> = {
  // Credit packs (consumable)
  'dcm.credits.basic': {
    productId: 'dcm.credits.basic',
    credits: 1,
    type: 'consumable',
    label: 'DCM Grading - 1 Credit',
  },
  'dcm.credits.pro': {
    productId: 'dcm.credits.pro',
    credits: 5,
    type: 'consumable',
    label: 'DCM Grading - 5 Credits',
  },
  'dcm.credits.elite': {
    productId: 'dcm.credits.elite',
    credits: 20,
    type: 'consumable',
    label: 'DCM Grading - 20 Credits',
  },
  'dcm.credits.vip': {
    productId: 'dcm.credits.vip',
    credits: 150,
    type: 'consumable',
    grantsVip: true,
    label: 'DCM Grading - 150 Credits (VIP)',
  },

  // Card Lovers subscriptions
  'dcm.cardlovers.monthly': {
    productId: 'dcm.cardlovers.monthly',
    credits: 70,
    type: 'subscription',
    subscriptionPeriod: 'monthly',
    label: 'Card Lovers - Monthly',
  },
  'dcm.cardlovers.annual': {
    productId: 'dcm.cardlovers.annual',
    credits: 900,
    type: 'subscription',
    subscriptionPeriod: 'annual',
    label: 'Card Lovers - Annual',
  },
}

export function getProduct(productId: string): IAPProductDefinition | null {
  return IAP_PRODUCTS[productId] ?? null
}

export function isSubscription(productId: string): boolean {
  return IAP_PRODUCTS[productId]?.type === 'subscription'
}

export const CARD_LOVERS_PRODUCT_IDS = Object.values(IAP_PRODUCTS)
  .filter((p) => p.type === 'subscription')
  .map((p) => p.productId)
