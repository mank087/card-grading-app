/**
 * GA4 and Google Ads reject a transaction_id longer than 64 characters, and a
 * Stripe Checkout session id ("cs_live_" + ~58 random chars) is longer than
 * that. GA flagged every purchase as "Transaction ID is too long" (Oct 2026),
 * which breaks deduplication. Dropping the cs_live_/cs_test_ marker and
 * capping at 64 keeps the id deterministic per session and still unique (the
 * remainder is random).
 */
export function analyticsTransactionId(sessionId: string | null, prefix = ''): string {
  return `${prefix}${(sessionId ?? '').replace(/^cs_(live|test)_/, '')}`.slice(0, 64)
}

/**
 * Persistent once-per-purchase guard for the checkout success pages. A useRef
 * resets on every reload or revisit of the success URL, so GA4 / Ads / pixels
 * were recording the same Stripe session more than once (Oct 2026: ~25 GA4
 * purchases vs 21 real web purchases). Returns true the first time it is
 * called for a session id in this browser and marks it claimed; false after.
 * If storage is unavailable (private mode, blocked site data) it fails open
 * and returns true, so the caller's per-mount ref still limits it to once.
 */
export function claimPurchaseTracking(sessionId: string | null): boolean {
  if (!sessionId) return false
  const key = `dcm_tracked_purchase_${sessionId}`
  try {
    if (window.localStorage.getItem(key)) return false
    window.localStorage.setItem(key, String(Date.now()))
  } catch {
    // fail open
  }
  return true
}
