/**
 * POST/GET /api/admin/costs/stripe/sync
 *
 * Fetches Stripe daily processing fees from the Balance Transactions API
 * and upserts into stripe_daily_fees. Same auth + parameter pattern as the
 * OpenAI sync endpoint:
 *
 *   - Auth: admin session OR Authorization: Bearer ${CRON_SECRET}
 *   - ?from=YYYY-MM-DD (default: yesterday UTC)
 *   - ?to=YYYY-MM-DD   (default: yesterday UTC)
 *
 * Idempotent on date.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchStripeFeesRange } from '@/lib/costs/stripeFees'

export const maxDuration = 120

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  const token = request.cookies.get('admin_token')?.value
  if (token) {
    const admin = await verifyAdminSession(token)
    if (admin) return true
  }
  return false
}

function yesterdayUTC(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) { return runSync(request) }
export async function GET(request: NextRequest) { return runSync(request) }

async function runSync(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const from = sp.get('from') || yesterdayUTC()
  const to = sp.get('to') || from

  const start = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + 1)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'Invalid from/to range' }, { status: 400 })
  }

  try {
    const buckets = await fetchStripeFeesRange(start, end)

    if (!buckets.length) {
      // No activity in range — write zero rows for completeness so the
      // dashboard doesn't think "no data, use estimate."
      const dates: string[] = []
      for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10))
      }
      const rows = dates.map((date) => ({
        date,
        fee_usd: 0,
        charge_count: 0,
        gross_revenue_usd: 0,
        refund_count: 0,
        refund_usd: 0,
        fetched_at: new Date().toISOString(),
      }))
      await supabaseAdmin.from('stripe_daily_fees').upsert(rows, { onConflict: 'date' })
      return NextResponse.json({ synced: rows.length, dates, total_fee_usd: 0 })
    }

    const rows = buckets.map((b) => ({
      ...b,
      fetched_at: new Date().toISOString(),
    }))

    const { error } = await supabaseAdmin
      .from('stripe_daily_fees')
      .upsert(rows, { onConflict: 'date' })
    if (error) {
      return NextResponse.json({ error: 'Upsert failed', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      synced: rows.length,
      dates: rows.map((r) => r.date),
      total_fee_usd: Math.round(rows.reduce((s, r) => s + r.fee_usd, 0) * 100) / 100,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Sync failed' }, { status: 500 })
  }
}
