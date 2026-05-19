/**
 * POST /api/admin/costs/openai/sync
 *
 * Fetches OpenAI daily cost data from the Admin Costs API and upserts into
 * openai_daily_costs. Idempotent on date — re-running for the same range
 * just refreshes the cached values.
 *
 * Auth: either an admin session (admin_token cookie) OR a CRON_SECRET match.
 * Vercel cron jobs include `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Request body / query:
 *   ?from=YYYY-MM-DD  (default: yesterday UTC)
 *   ?to=YYYY-MM-DD    (default: yesterday UTC)
 *
 * Response:
 *   { synced: <count>, dates: [...], skipped: <count> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchOpenAICostRange } from '@/lib/costs/openaiAdmin'

export const maxDuration = 120 // backfills can take a minute

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Vercel Cron: Authorization: Bearer ${CRON_SECRET}
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

export async function POST(request: NextRequest) {
  return runSync(request)
}

// Also support GET so cron services that POST/GET both work and so the
// endpoint is testable from a browser when logged in as admin.
export async function GET(request: NextRequest) {
  return runSync(request)
}

async function runSync(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.OPENAI_ADMIN_API_KEY) {
    return NextResponse.json({
      error: 'OPENAI_ADMIN_API_KEY is not set',
      hint: 'Create an admin key in OpenAI Dashboard → Settings → Admin keys, then add to Vercel env.',
    }, { status: 500 })
  }

  const sp = request.nextUrl.searchParams
  const from = sp.get('from') || yesterdayUTC()
  const to = sp.get('to') || from

  // Parse dates as UTC midnight. End is inclusive of the chosen day, so add 1.
  const start = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + 1)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'Invalid from/to range' }, { status: 400 })
  }

  try {
    const buckets = await fetchOpenAICostRange(start, end)

    if (!buckets.length) {
      return NextResponse.json({ synced: 0, dates: [], skipped: 0, note: 'No buckets returned' })
    }

    // Upsert each bucket. ON CONFLICT (date) DO UPDATE because we keep
    // re-pulling the same day on the daily cron (in case OpenAI revises
    // the bill or new charges land late).
    const rows = buckets.map((b) => ({
      date: b.date,
      cost_usd: b.cost_usd,
      raw_payload: b.raw_payload,
      fetched_at: new Date().toISOString(),
    }))

    const { error } = await supabaseAdmin
      .from('openai_daily_costs')
      .upsert(rows, { onConflict: 'date' })

    if (error) {
      return NextResponse.json({ error: 'Upsert failed', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      synced: rows.length,
      dates: rows.map((r) => r.date).sort(),
      total_usd: Math.round(rows.reduce((s, r) => s + r.cost_usd, 0) * 100) / 100,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Sync failed' }, { status: 500 })
  }
}
