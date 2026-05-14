/**
 * In-App Purchase (IAP) service wrapper.
 *
 * Handles StoreKit (iOS) and Google Play Billing (Android) via react-native-iap v15
 * (Nitro module rewrite — uses ProductRequest + RequestPurchasePropsByPlatforms).
 * On a successful purchase, posts the receipt to the DCM backend for
 * verification + credit grant, then finishes the local transaction.
 *
 * Card Lovers subscriptions are intentionally NOT included in v1. The 4
 * credit packs ship first; subscriptions follow in v1.1 after IAP plumbing
 * is proven through App Review.
 */

import {
  initConnection,
  endConnection,
  fetchProducts as iapFetchProducts,
  requestPurchase as iapRequestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  ErrorCode,
  type Product,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap'
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

/**
 * Canonical credit pack product IDs — must match what's configured in
 * App Store Connect and Google Play Console. The labels and credit
 * amounts here are display-only; the server is the source of truth for
 * how many credits each product grants.
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
  credits: number
  /** Internal label only — store-provided localized title is preferred for display. */
  label: string
  /** Highlights the recommended pack in the UI. */
  highlighted?: boolean
}

export const CREDIT_PACKS: CreditPack[] = [
  { productId: 'dcm.credits.basic', credits: 1, label: 'Basic' },
  { productId: 'dcm.credits.pro', credits: 5, label: 'Pro' },
  { productId: 'dcm.credits.elite', credits: 20, label: 'Elite' },
  { productId: 'dcm.credits.vip', credits: 150, label: 'VIP', highlighted: true },
]

let initialized = false
let purchaseUpdateSubscription: { remove: () => void } | null = null
let purchaseErrorSubscription: { remove: () => void } | null = null

/**
 * Connect to the platform store. Call once on screen mount. Idempotent.
 */
export async function connect(): Promise<void> {
  if (initialized) return
  await initConnection()
  initialized = true
}

export async function disconnect(): Promise<void> {
  if (!initialized) return
  purchaseUpdateSubscription?.remove()
  purchaseUpdateSubscription = null
  purchaseErrorSubscription?.remove()
  purchaseErrorSubscription = null
  await endConnection()
  initialized = false
}

/**
 * Fetch product details (localized title, price string) from the store.
 * The store returns whatever subset of our requested SKUs exists in
 * its catalog — products configured but not approved yet may be missing.
 */
export async function fetchProducts(): Promise<Product[]> {
  await connect()
  const result = await iapFetchProducts({
    skus: [...IAP_PRODUCT_IDS],
    type: 'in-app',
  })
  // fetchProducts returns ProductOrSubscription[] | Product[] | null.
  // For 'in-app' query type we get back consumables only.
  const products: Product[] = Array.isArray(result) ? (result as Product[]) : []
  // Sort by our canonical pack order so the UI is predictable.
  const order = new Map<string, number>(IAP_PRODUCT_IDS.map((id, i) => [id, i]))
  return products.sort(
    (a: Product, b: Product) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
  )
}

export interface PurchaseCallbacks {
  onSuccess: (creditsGranted: number) => void
  onError: (error: string) => void
}

/**
 * Attach store listeners. Returns a cleanup function — call on unmount.
 * Only ONE set of listeners should be active at a time.
 */
export function attachPurchaseListeners(callbacks: PurchaseCallbacks): () => void {
  purchaseUpdateSubscription?.remove()
  purchaseErrorSubscription?.remove()

  purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
    try {
      const result = await verifyAndFinish(purchase)
      if (result.success) {
        callbacks.onSuccess(result.creditsGranted ?? 0)
      } else {
        callbacks.onError(result.error || 'Verification failed')
      }
    } catch (err: any) {
      console.error('[IAP] Verify/finish error:', err)
      callbacks.onError(err?.message || 'Purchase verification failed')
    }
  })

  purchaseErrorSubscription = purchaseErrorListener((err: PurchaseError) => {
    console.warn('[IAP] Purchase error:', err.code, err.message)
    if (err.code === ErrorCode.UserCancelled) return
    callbacks.onError(err.message || 'Purchase failed')
  })

  return () => {
    purchaseUpdateSubscription?.remove()
    purchaseUpdateSubscription = null
    purchaseErrorSubscription?.remove()
    purchaseErrorSubscription = null
  }
}

/**
 * Kick off a purchase. Completion comes through the purchaseUpdatedListener,
 * NOT this promise — the promise resolves when the native dialog dismisses
 * but before verification completes.
 *
 * Apple's appAccountToken / Google's obfuscatedAccountId are both set to
 * the Supabase user id. The backend enforces that a receipt belongs to
 * the authenticated user (anti-replay).
 */
export async function purchaseCreditPack(productId: IAPProductId, userId: string): Promise<void> {
  await connect()
  await iapRequestPurchase({
    request: {
      apple: {
        sku: productId,
        appAccountToken: userId,
        andDangerouslyFinishTransactionAutomatically: false,
      },
      google: {
        skus: [productId],
        obfuscatedAccountId: userId,
      },
    },
    type: 'in-app',
  })
}

/**
 * Verify a completed purchase with the DCM backend and finish the
 * native transaction.
 */
async function verifyAndFinish(
  purchase: Purchase,
): Promise<{ success: boolean; creditsGranted?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { success: false, error: 'Not signed in' }
  }

  const platform = (purchase as any).platform as 'ios' | 'android' | undefined
  const isIOS = platform === 'ios'
  const endpoint = isIOS
    ? `${API_BASE}/api/iap/apple/verify`
    : `${API_BASE}/api/iap/google/verify`

  // v15 unified purchaseToken: JWS-signed string on iOS, purchaseToken on Android.
  const receiptToken = purchase.purchaseToken
  if (!receiptToken) {
    return { success: false, error: 'No purchase token on receipt' }
  }

  const body = isIOS
    ? { signedTransaction: receiptToken }
    : {
        productId: purchase.productId,
        purchaseToken: receiptToken,
        productType: 'consumable' as const,
      }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' }
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.success) {
    return { success: false, error: result.error || `HTTP ${response.status}` }
  }

  // Verification succeeded — credits are granted server-side. Finish the
  // local transaction so the store stops re-delivering. For consumables,
  // isConsumable=true makes the credit pack purchasable again.
  try {
    await finishTransaction({ purchase, isConsumable: true })
  } catch (err: any) {
    // Non-fatal — verification already happened. Worst case the store
    // re-delivers and our backend's idempotency catches the dup.
    console.warn('[IAP] finishTransaction failed:', err?.message || err)
  }

  return {
    success: true,
    creditsGranted: result.creditsGranted ?? 0,
  }
}

/**
 * Apple requires a Restore Purchases path even for apps that only sell
 * consumables. For consumables, "restore" doesn't grant new credits
 * (consumables are gone once consumed) — it just re-verifies any pending
 * unfinished transactions.
 */
export async function restorePurchases(): Promise<{ processed: number }> {
  await connect()
  const purchases = await getAvailablePurchases()
  let processed = 0
  if (Array.isArray(purchases)) {
    for (const purchase of purchases) {
      try {
        const result = await verifyAndFinish(purchase)
        if (result.success) processed++
      } catch (err) {
        console.warn('[IAP] Restore failed for', purchase.productId, err)
      }
    }
  }
  return { processed }
}

/**
 * v15 Product type uses displayPrice (e.g., "$2.99") — already localized.
 */
export function formatProductPrice(product: Product): string {
  return product.displayPrice || '—'
}

/**
 * v15 Product type uses displayName (localized title from the store).
 * Falls back to the internal label if absent.
 */
export function getProductDisplayName(product: Product, fallback: string): string {
  return (product.displayName as string) || fallback
}

/**
 * Numeric price (in major units) for per-credit calculations. v15 keeps
 * the raw numeric price as Product.price.
 */
export function getProductNumericPrice(product: Product): number {
  const p = (product as any).price
  if (typeof p === 'number') return p
  if (typeof p === 'string') return parseFloat(p) || 0
  return 0
}
