/**
 * Google Play Billing verification.
 *
 * Uses the Google Play Developer API (androidpublisher) with the service
 * account JSON to validate purchaseTokens and pull subscription state.
 *
 * Env vars required (Vercel):
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  — full JSON of the service-account
 *                                       credentials. The same credentials
 *                                       you use for `eas submit --android`
 *                                       work here (must have
 *                                       androidpublisher.* scopes).
 *   ANDROID_PACKAGE_NAME              — com.dcmgrading.app
 */

import { google, androidpublisher_v3 } from 'googleapis'

const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || 'com.dcmgrading.app'

let cachedClient: androidpublisher_v3.Androidpublisher | null = null

function getAndroidPublisher(): androidpublisher_v3.Androidpublisher {
  if (cachedClient) return cachedClient
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set')
  }
  const credentials = JSON.parse(raw)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  cachedClient = google.androidpublisher({ version: 'v3', auth })
  return cachedClient
}

/**
 * Verify a consumable (one-time) product purchase. Returns the full
 * Google response — caller decides what to do with it.
 *
 * Important: after verification succeeds, call acknowledgeProductPurchase
 * within 3 days or Google will auto-refund. acknowledgeIfNeeded() below
 * handles that.
 */
export async function getProductPurchase(
  productId: string,
  purchaseToken: string,
): Promise<androidpublisher_v3.Schema$ProductPurchase> {
  const publisher = getAndroidPublisher()
  const { data } = await publisher.purchases.products.get({
    packageName: PACKAGE_NAME,
    productId,
    token: purchaseToken,
  })
  return data
}

/**
 * Verify a subscription purchase. Returns full state including expiry.
 */
export async function getSubscriptionPurchase(
  subscriptionId: string,
  purchaseToken: string,
): Promise<androidpublisher_v3.Schema$SubscriptionPurchase> {
  const publisher = getAndroidPublisher()
  const { data } = await publisher.purchases.subscriptions.get({
    packageName: PACKAGE_NAME,
    subscriptionId,
    token: purchaseToken,
  })
  return data
}

/**
 * Acknowledge a one-time product purchase. Google requires this within
 * 3 days or it refunds automatically. Idempotent — safe to call multiple times.
 */
export async function acknowledgeProductPurchase(
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const publisher = getAndroidPublisher()
  try {
    await publisher.purchases.products.acknowledge({
      packageName: PACKAGE_NAME,
      productId,
      token: purchaseToken,
      requestBody: { developerPayload: '' },
    })
  } catch (err: any) {
    // 409 = already acknowledged — fine.
    if (err?.code !== 409) {
      throw err
    }
  }
}

/**
 * Acknowledge a subscription purchase. Same 3-day rule as products.
 */
export async function acknowledgeSubscriptionPurchase(
  subscriptionId: string,
  purchaseToken: string,
): Promise<void> {
  const publisher = getAndroidPublisher()
  try {
    await publisher.purchases.subscriptions.acknowledge({
      packageName: PACKAGE_NAME,
      subscriptionId,
      token: purchaseToken,
      requestBody: { developerPayload: '' },
    })
  } catch (err: any) {
    if (err?.code !== 409) {
      throw err
    }
  }
}

/**
 * Map the RTDN notificationType enum to our internal status.
 * https://developer.android.com/google/play/billing/rtdn-reference
 */
export const RTDN_TYPES = {
  // Subscriptions
  SUBSCRIPTION_RECOVERED: 1,
  SUBSCRIPTION_RENEWED: 2,
  SUBSCRIPTION_CANCELED: 3,
  SUBSCRIPTION_PURCHASED: 4,
  SUBSCRIPTION_ON_HOLD: 5,
  SUBSCRIPTION_IN_GRACE_PERIOD: 6,
  SUBSCRIPTION_RESTARTED: 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED: 8,
  SUBSCRIPTION_DEFERRED: 9,
  SUBSCRIPTION_PAUSED: 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED: 11,
  SUBSCRIPTION_REVOKED: 12,
  SUBSCRIPTION_EXPIRED: 13,
  // One-time purchases
  ONE_TIME_PRODUCT_PURCHASED: 1,
  ONE_TIME_PRODUCT_CANCELED: 2,
} as const
