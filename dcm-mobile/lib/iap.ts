/**
 * In-App Purchase (IAP) helpers for StoreKit (iOS) and Google Play Billing
 * (Android) via react-native-iap v15.
 *
 * The screen uses the `useIAP` hook directly for connection + listener
 * management (it's the supported pattern in v15's Nitro architecture and
 * survives screen remounts without dropping events). This file exposes:
 *
 *   - product/pack metadata (CREDIT_PACKS, tier visuals)
 *   - the backend verify-receipt POST + finishTransaction sequencing
 *   - small display helpers
 *
 * Card Lovers subscriptions are intentionally NOT in v1. Credit packs only.
 */

import { finishTransaction, type Product, type Purchase } from 'react-native-iap'
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

/**
 * Canonical credit pack product IDs — must match what's configured in
 * App Store Connect and Google Play Console.
 */
export const IAP_PRODUCT_IDS = [
  'dcm.credits.basic',
  'dcm.credits.pro',
  'dcm.credits.elite',
  'dcm.credits.vip',
] as const

export type IAPProductId = (typeof IAP_PRODUCT_IDS)[number]

export interface CreditPack {
  productId: IAPProductId
  /** Tier id, matches web /credits page */
  id: 'basic' | 'pro' | 'elite' | 'vip'
  name: string
  credits: number
  /** First-purchase bonus, web-only for now (server applies it). Display only. */
  bonusCredits: number
  description: string
  popular?: boolean
  bestValue?: boolean
  /** Emoji glyph shown in the header */
  icon: string
  /** Tier accent colors — header gradient + price accents */
  colorKey: 'blue' | 'purple' | 'amber' | 'silver'
  headerGradient: [string, string]
  /** Savings vs Basic, displayed top-right of the header */
  savingsPercent?: number
  /** Per-credit cost, displayed in the per-grade box */
  perGradeCost: number
}

// Order matches the web /credits page: VIP first as a value anchor, then
// Basic → Pro → Elite ascending. Pro sits in the visual middle so its
// "Most Popular" highlight lands at the natural eye-stop on the page.
export const CREDIT_PACKS: CreditPack[] = [
  {
    productId: 'dcm.credits.vip',
    id: 'vip',
    name: 'VIP',
    credits: 150,
    bonusCredits: 0,
    description: '150 credits + VIP emblem',
    bestValue: true,
    icon: '◆',
    colorKey: 'silver',
    headerGradient: ['#9ca3af', '#6b7280'],
    savingsPercent: 78,
    perGradeCost: 0.66,
  },
  {
    productId: 'dcm.credits.basic',
    id: 'basic',
    name: 'Basic',
    credits: 1,
    bonusCredits: 1,
    description: 'Perfect for trying out DCM Grading',
    icon: '⭐',
    colorKey: 'blue',
    headerGradient: ['#3b82f6', '#2563eb'],
    perGradeCost: 2.99,
  },
  {
    productId: 'dcm.credits.pro',
    id: 'pro',
    name: 'Pro',
    credits: 5,
    bonusCredits: 3,
    description: 'Best value for casual collectors',
    popular: true,
    icon: '🚀',
    colorKey: 'purple',
    headerGradient: ['#9333ea', '#4f46e5'],
    savingsPercent: 33,
    perGradeCost: 2.0,
  },
  {
    productId: 'dcm.credits.elite',
    id: 'elite',
    name: 'Elite',
    credits: 20,
    bonusCredits: 5,
    description: 'For serious collectors and dealers',
    icon: '👑',
    colorKey: 'amber',
    headerGradient: ['#f59e0b', '#ea580c'],
    savingsPercent: 67,
    perGradeCost: 1.0,
  },
]

export const BASE_PRICE_PER_CREDIT = 2.99

export function getPackByProductId(productId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.productId === productId)
}

/**
 * v15 Product type uses displayPrice (e.g., "$2.99") — already localized.
 */
export function formatProductPrice(product: Product | undefined): string {
  if (!product) return '—'
  return product.displayPrice || '—'
}

/**
 * Numeric price (in major units) for per-credit calculations.
 */
export function getProductNumericPrice(product: Product | undefined): number {
  if (!product) return 0
  const p = (product as any).price
  if (typeof p === 'number') return p
  if (typeof p === 'string') return parseFloat(p) || 0
  return 0
}

/**
 * POST the verified purchase token to the DCM backend, which re-verifies
 * with Apple/Google, records the transaction (idempotent), and grants
 * credits. On success, finishes the local transaction so the store stops
 * re-delivering it.
 *
 * Returns the number of credits granted (0 if duplicate/already-granted).
 * Throws on any non-2xx response or network error.
 */
export async function verifyAndFinishPurchase(purchase: Purchase): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not signed in')
  }

  // v15 carries a unified `platform` field on the Purchase. Fall back to
  // checking which token shape is present if it's missing for any reason.
  const platform = ((purchase as any).platform as 'ios' | 'android' | undefined) ?? 'ios'
  const isIOS = platform === 'ios'
  const endpoint = isIOS
    ? `${API_BASE}/api/iap/apple/verify`
    : `${API_BASE}/api/iap/google/verify`

  // v15 unified purchaseToken: JWS-signed string on iOS, purchaseToken on Android.
  const receiptToken = purchase.purchaseToken
  if (!receiptToken) {
    throw new Error('No purchase token on receipt')
  }

  const body = isIOS
    ? { signedTransaction: receiptToken }
    : {
        productId: purchase.productId,
        purchaseToken: receiptToken,
        productType: 'consumable' as const,
      }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const result = await response.json().catch(() => ({} as any))
  if (!response.ok || !result.success) {
    throw new Error(result.error || `HTTP ${response.status}`)
  }

  // Finish the local transaction. For consumables, isConsumable=true is
  // required so the SKU can be re-bought. Non-fatal on error (backend
  // verification + grant already happened; idempotency handles re-delivery).
  try {
    await finishTransaction({ purchase, isConsumable: true })
  } catch (err: any) {
    console.warn('[IAP] finishTransaction failed:', err?.message || err)
  }

  return result.creditsGranted ?? 0
}
