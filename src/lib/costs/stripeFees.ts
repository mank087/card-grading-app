/**
 * Wrapper for Stripe's Balance Transactions API.
 *
 *   stripe.balanceTransactions.list({ type: 'charge', created: { gte, lt } })
 *
 * Returns every charge that landed in the date range with the fee Stripe
 * extracted. Summed per-day, this gives the actual processing-fee burn we
 * pay rather than estimating with the 2.9% + $0.30 formula.
 *
 * Uses the standard STRIPE_SECRET_KEY (no special admin key needed).
 */

import { stripe } from '@/lib/stripe'

export interface StripeDailyFee {
  /** YYYY-MM-DD (UTC) */
  date: string
  /** Sum of bt.fee for charges that day, in USD */
  fee_usd: number
  /** Number of successful charges that day */
  charge_count: number
  /** Sum of charge gross amounts that day (pre-fee) */
  gross_revenue_usd: number
  /** Number of refund balance transactions that day */
  refund_count: number
  /** Sum of refund amounts (negative numbers from Stripe) — positive total here */
  refund_usd: number
}

function unixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000)
}

function utcDayKey(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10)
}

/**
 * Fetch + aggregate Stripe balance transactions for a date range.
 * Returns one row per UTC day with charges or refunds. Days with no
 * activity are omitted.
 */
export async function fetchStripeFeesRange(start: Date, end: Date): Promise<StripeDailyFee[]> {
  const startSec = unixSeconds(start)
  const endSec = unixSeconds(end)

  // Aggregator keyed by UTC date string
  const daily: Record<string, StripeDailyFee> = {}
  const get = (key: string): StripeDailyFee => {
    if (!daily[key]) {
      daily[key] = {
        date: key,
        fee_usd: 0,
        charge_count: 0,
        gross_revenue_usd: 0,
        refund_count: 0,
        refund_usd: 0,
      }
    }
    return daily[key]
  }

  // Paginate through charges in the window
  for await (const bt of stripe.balanceTransactions.list({
    type: 'charge',
    created: { gte: startSec, lt: endSec },
    limit: 100,
  })) {
    const key = utcDayKey(bt.created)
    const row = get(key)
    row.fee_usd += (bt.fee || 0) / 100
    row.charge_count += 1
    row.gross_revenue_usd += (bt.amount || 0) / 100
  }

  // Refunds reduce the net but are tracked separately so we can show them.
  for await (const bt of stripe.balanceTransactions.list({
    type: 'refund',
    created: { gte: startSec, lt: endSec },
    limit: 100,
  })) {
    const key = utcDayKey(bt.created)
    const row = get(key)
    row.refund_count += 1
    row.refund_usd += Math.abs(bt.amount || 0) / 100
  }

  // Round to 4dp and return sorted oldest → newest
  return Object.values(daily)
    .map((r) => ({
      ...r,
      fee_usd: Math.round(r.fee_usd * 10000) / 10000,
      gross_revenue_usd: Math.round(r.gross_revenue_usd * 10000) / 10000,
      refund_usd: Math.round(r.refund_usd * 10000) / 10000,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}
