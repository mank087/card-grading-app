/**
 * Backfill stripe_daily_fees from the Stripe Balance Transactions API.
 *
 * Same pattern as backfill-openai-costs.ts — walks 30-day chunks from a
 * start date (default 2025-07-01) to today and upserts daily rows.
 *
 * Usage:
 *   npx tsx scripts/backfill-stripe-fees.ts
 *   npx tsx scripts/backfill-stripe-fees.ts --from 2026-01-01 --to 2026-03-31
 *
 * Requires STRIPE_SECRET_KEY (the live secret key, not test mode).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Stripe import must come after dotenv so the key resolves.
// Use a dynamic import so this script can dotenv-load first.
async function main() {
  const { fetchStripeFeesRange } = await import('../src/lib/costs/stripeFees')

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY not set in .env.local')
    process.exit(1)
  }
  if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    console.warn('⚠️  STRIPE_SECRET_KEY appears to be a TEST key (sk_test_…).')
    console.warn('   Real fees only exist in live mode. Proceeding anyway.')
    console.warn('')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const args = process.argv.slice(2)
  let from = '2025-07-01'
  let to = new Date().toISOString().slice(0, 10)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) { from = args[i + 1]; i++; continue }
    if (args[i] === '--to' && args[i + 1]) { to = args[i + 1]; i++; continue }
  }

  console.log(`Backfilling stripe_daily_fees from ${from} through ${to}`)
  console.log('')

  const CHUNK_DAYS = 30
  const addDays = (iso: string, days: number) => {
    const d = new Date(iso + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  let cursor = from
  let totalRows = 0
  let totalFees = 0

  while (cursor <= to) {
    const chunkEnd = addDays(cursor, CHUNK_DAYS - 1)
    const cappedEnd = chunkEnd > to ? to : chunkEnd

    const startD = new Date(cursor + 'T00:00:00Z')
    const endD = new Date(cappedEnd + 'T00:00:00Z')
    endD.setUTCDate(endD.getUTCDate() + 1)

    process.stdout.write(`  ${cursor} → ${cappedEnd}: fetching…`)

    try {
      const buckets = await fetchStripeFeesRange(startD, endD)
      if (!buckets.length) {
        console.log(' no activity')
      } else {
        const rows = buckets.map((b) => ({ ...b, fetched_at: new Date().toISOString() }))
        const chunkFee = rows.reduce((s, r) => s + r.fee_usd, 0)
        const { error } = await supabase
          .from('stripe_daily_fees')
          .upsert(rows, { onConflict: 'date' })
        if (error) {
          console.log(' UPSERT FAILED:', error.message)
          process.exit(1)
        }
        totalRows += rows.length
        totalFees += chunkFee
        console.log(` ${rows.length} active days, $${chunkFee.toFixed(2)} fees`)
      }
    } catch (err: any) {
      console.log(' FAILED:', err.message)
      console.log('Re-run with --from', cursor, 'to resume.')
      process.exit(1)
    }

    cursor = addDays(cappedEnd, 1)
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log('')
  console.log('═'.repeat(60))
  console.log(`Done. Rows: ${totalRows}, total fees: $${totalFees.toFixed(2)}`)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
