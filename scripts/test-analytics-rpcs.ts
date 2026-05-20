/**
 * Smoke-tests each analytics RPC by calling it via supabase.rpc and
 * pretty-printing the result. Run AFTER applying
 * migrations/add_admin_analytics_rpcs.sql in Supabase SQL Editor.
 *
 * Usage: npx tsx scripts/test-analytics-rpcs.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const now = new Date()
const from = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
const to = now.toISOString()

async function test(name: string, fn: string, args: Record<string, any>) {
  console.log('\n' + '═'.repeat(70))
  console.log(`  RPC: ${fn}(${Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')})`)
  console.log('═'.repeat(70))
  const start = Date.now()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    console.error(`✗ FAILED in ${Date.now() - start}ms`)
    console.error(error)
    return
  }
  console.log(`✓ OK in ${Date.now() - start}ms`)
  console.log(JSON.stringify(data, null, 2).slice(0, 4000))
}

async function main() {
  await test('Users analytics', 'get_user_analytics', { p_from: from, p_to: to })
  await test('Grading analytics', 'get_grading_analytics', { p_from: from, p_to: to })
  await test('Cards analytics', 'get_card_analytics', { p_from: from, p_to: to })
  await test('Conversion analytics (no range)', 'get_conversion_analytics', { p_start: null, p_end: null })
  await test('Revenue analytics', 'get_revenue_analytics', { p_from: from, p_to: to })

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  await test('Costs summary', 'get_costs_summary', { p_month: monthStart })
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
