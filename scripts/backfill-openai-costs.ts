/**
 * Backfill openai_daily_costs from the OpenAI Admin Costs API.
 *
 * Walks from a start date (default 2025-07-01 — DCM's earliest OpenAI testing)
 * forward to today, fetching ~30 days at a time and upserting daily rows.
 *
 * Resumable: re-running is safe because the upsert is keyed on `date`.
 * If a chunk fails (rate limit, network), re-run from the same start date.
 *
 * Usage:
 *   npx tsx scripts/backfill-openai-costs.ts                  # 2025-07-01 → today
 *   npx tsx scripts/backfill-openai-costs.ts --from 2026-01-01
 *   npx tsx scripts/backfill-openai-costs.ts --from 2026-01-01 --to 2026-03-31
 *
 * Requires OPENAI_ADMIN_API_KEY (sk-admin-…) in .env.local.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fetchOpenAICostRange } from '../src/lib/costs/openaiAdmin'

dotenv.config({ path: '.env.local' })

const DEFAULT_START = '2025-07-01'
const CHUNK_DAYS = 30

function parseArgs(): { from: string; to: string } {
  const args = process.argv.slice(2)
  let from = DEFAULT_START
  let to = new Date().toISOString().slice(0, 10)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) { from = args[i + 1]; i++; continue }
    if (args[i] === '--to' && args[i + 1]) { to = args[i + 1]; i++; continue }
  }
  return { from, to }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function main() {
  if (!process.env.OPENAI_ADMIN_API_KEY) {
    console.error('OPENAI_ADMIN_API_KEY not set in .env.local')
    console.error('Create an admin key: OpenAI Dashboard → Settings → Admin keys → Create new admin key')
    console.error('Scope it to api.usage.read only.')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { from, to } = parseArgs()
  console.log(`Backfilling openai_daily_costs from ${from} through ${to}`)
  console.log(`Chunk size: ${CHUNK_DAYS} days`)
  console.log('')

  let cursor = from
  let totalRows = 0
  let totalUsd = 0

  while (cursor <= to) {
    const chunkEnd = addDays(cursor, CHUNK_DAYS - 1)
    const cappedEnd = chunkEnd > to ? to : chunkEnd

    const startD = new Date(cursor + 'T00:00:00Z')
    const endD = new Date(cappedEnd + 'T00:00:00Z')
    endD.setUTCDate(endD.getUTCDate() + 1) // exclusive

    process.stdout.write(`  ${cursor} → ${cappedEnd}: fetching…`)

    try {
      const buckets = await fetchOpenAICostRange(startD, endD)
      if (buckets.length === 0) {
        console.log(' no data')
      } else {
        const rows = buckets.map((b) => ({
          date: b.date,
          cost_usd: b.cost_usd,
          raw_payload: b.raw_payload,
          fetched_at: new Date().toISOString(),
        }))
        const chunkUsd = rows.reduce((s, r) => s + r.cost_usd, 0)
        const { error } = await supabase
          .from('openai_daily_costs')
          .upsert(rows, { onConflict: 'date' })
        if (error) {
          console.log(' UPSERT FAILED:', error.message)
          process.exit(1)
        }
        totalRows += rows.length
        totalUsd += chunkUsd
        console.log(` ${rows.length} rows, $${chunkUsd.toFixed(2)}`)
      }
    } catch (err: any) {
      console.log(' FAILED:', err.message)
      console.log('Re-run with --from', cursor, 'to resume.')
      process.exit(1)
    }

    cursor = addDays(cappedEnd, 1)
    // Tiny pause between chunks to be nice to the API
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log('')
  console.log('═'.repeat(60))
  console.log(`Done. Total days backfilled: ${totalRows}`)
  console.log(`Total OpenAI spend across range: $${totalUsd.toFixed(2)}`)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
