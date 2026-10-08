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
