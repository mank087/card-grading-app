/**
 * GET /api/cron/sync-costs  (Vercel cron, daily at 02:00 UTC)
 *
 * Single nightly entry point that hits both cost-sync endpoints for
 * "yesterday UTC" and includes an anomaly-detection step for OpenAI spend
 * (Phase 4 — see compareToRollingAverage + sendAnomalyAlert below).
 *
 * Auth: Vercel cron sends Authorization: Bearer ${CRON_SECRET}. The two
 * downstream sync endpoints expect the same header, so we pass it through.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const maxDuration = 180

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function yesterdayUTC(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function runSubSync(host: string, path: string, secret: string) {
  const url = `${host}${path}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, body: json }
  } catch (err: any) {
    return { ok: false, status: 0, body: { error: err?.message || 'network failed' } }
  }
}

/**
 * Phase 4: if yesterday's OpenAI cost is ≥ 2x the rolling 30-day average,
 * email the admin. Skips alerting if there's less than 7 days of history
 * (not enough signal to be meaningful).
 */
async function checkOpenAIAnomaly(): Promise<{ alert: boolean; yesterday?: number; rolling_avg?: number; ratio?: number }> {
  const yesterday = yesterdayUTC()
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - 31)
  const startKey = start.toISOString().slice(0, 10)

  const { data } = await supabaseAdmin
    .from('openai_daily_costs')
    .select('date, cost_usd')
    .gte('date', startKey)
    .lt('date', yesterday)
  if (!data || data.length < 7) return { alert: false }

  const sum = data.reduce((s, r: any) => s + Number(r.cost_usd || 0), 0)
  const avg = sum / data.length

  const { data: ydayRow } = await supabaseAdmin
    .from('openai_daily_costs')
    .select('cost_usd')
    .eq('date', yesterday)
    .maybeSingle()
  const ydayCost = Number(ydayRow?.cost_usd || 0)

  if (avg <= 0) return { alert: false }
  const ratio = ydayCost / avg
  return { alert: ratio >= 2.0 && ydayCost >= 5, yesterday: ydayCost, rolling_avg: avg, ratio }
}

async function sendAnomalyAlert(detail: { yesterday: number; rolling_avg: number; ratio: number }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[cron/sync-costs] anomaly detected but RESEND_API_KEY missing — skipping email')
    return
  }
  const body = {
    from: 'DCM Alerts <alerts@dcmgrading.com>',
    to: ['admin@dcmgrading.com'],
    subject: `[DCM] OpenAI cost spike: $${detail.yesterday.toFixed(2)} (${detail.ratio.toFixed(1)}× avg)`,
    html: `
      <p>Yesterday's OpenAI spend was <strong>$${detail.yesterday.toFixed(2)}</strong>,
      which is <strong>${detail.ratio.toFixed(1)}×</strong> the 30-day rolling
      average of <strong>$${detail.rolling_avg.toFixed(2)}</strong>.</p>
      <p>This may be normal volume or it may indicate a runaway grading loop /
      prompt regression. Investigate at
      <a href="https://dcmgrading.com/admin/costs">/admin/costs</a>.</p>
    `,
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    console.warn('[cron/sync-costs] anomaly email failed:', err?.message)
  }
}

async function run(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  // Allow Vercel cron (Bearer match) OR an admin who hits this manually for testing
  // (admin auth check is duplicated inside each downstream sync — we just check
  // we have something here so we can pass it through).
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized()
  }

  const host = request.nextUrl.origin

  const [openaiResult, stripeResult] = await Promise.all([
    runSubSync(host, '/api/admin/costs/openai/sync', cronSecret),
    runSubSync(host, '/api/admin/costs/stripe/sync', cronSecret),
  ])

  // Anomaly check runs AFTER the openai sync so it sees yesterday's row.
  let anomaly = { alert: false } as Awaited<ReturnType<typeof checkOpenAIAnomaly>>
  if (openaiResult.ok) {
    anomaly = await checkOpenAIAnomaly()
    if (anomaly.alert) {
      await sendAnomalyAlert({
        yesterday: anomaly.yesterday!,
        rolling_avg: anomaly.rolling_avg!,
        ratio: anomaly.ratio!,
      })
    }
  }

  return NextResponse.json({
    openai: openaiResult,
    stripe: stripeResult,
    anomaly,
  })
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
