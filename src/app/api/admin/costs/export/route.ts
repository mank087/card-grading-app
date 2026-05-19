/**
 * GET /api/admin/costs/export?month=YYYY-MM
 *
 * Streams a CSV monthly P&L breakdown for the accountant. Same data the
 * /admin/costs page computes via /api/admin/costs/summary, just flattened
 * into rows with section headers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return new NextResponse('Unauthorized', { status: 401 })
  const admin = await verifyAdminSession(token)
  if (!admin) return new NextResponse('Unauthorized', { status: 401 })

  const month = request.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new NextResponse('month must be YYYY-MM', { status: 400 })
  }

  // Re-use the summary endpoint internally so the CSV exactly matches the dashboard.
  // Inline the cookie header so the auth check passes.
  const cookieHeader = request.headers.get('cookie') || ''
  const summaryRes = await fetch(
    new URL(`/api/admin/costs/summary?month=${month}`, request.nextUrl.origin),
    { headers: { cookie: cookieHeader } },
  )
  if (!summaryRes.ok) {
    return new NextResponse('Failed to compute summary', { status: 500 })
  }
  const data = await summaryRes.json()
  const s = data.selected

  const rows: string[][] = []
  rows.push(['DCM Grading — Monthly P&L', month])
  rows.push([])
  rows.push(['Revenue', '', 'USD'])
  rows.push(['Stripe credit packs', '', s.revenue_stripe_credits.toFixed(2)])
  rows.push(['Stripe Card Lovers', '', s.revenue_stripe_subscription.toFixed(2)])
  rows.push(['Apple IAP', '', s.revenue_apple_iap.toFixed(2)])
  rows.push(['Google IAP', '', s.revenue_google_iap.toFixed(2)])
  rows.push(['Total revenue', '', s.revenue_total.toFixed(2)])
  rows.push([])
  rows.push(['Variable costs', 'Source', 'USD'])
  rows.push(['OpenAI grading', s.openai_source, s.openai_cost.toFixed(2)])
  rows.push(['Stripe processing fees', s.stripe_fees_source, s.stripe_fees.toFixed(2)])
  rows.push(['Apple IAP fee', `${data.iap_fee_rate_pct}% of Apple revenue`, s.apple_iap_fee.toFixed(2)])
  rows.push(['Google IAP fee', `${data.iap_fee_rate_pct}% of Google revenue`, s.google_iap_fee.toFixed(2)])
  rows.push(['Total variable cost', '', s.variable_cost_total.toFixed(2)])
  rows.push([])
  rows.push(['Fixed costs', 'Vendor', 'USD'])
  for (const r of data.fixed_rows || []) {
    rows.push([r.category, r.vendor, Number(r.amount_usd).toFixed(2)])
  }
  rows.push(['Total fixed cost', '', s.fixed_cost_total.toFixed(2)])
  rows.push([])
  rows.push(['Margins'])
  rows.push(['Gross margin', '', s.gross_margin.toFixed(2)])
  rows.push(['Gross margin %', '', s.gross_margin_pct.toFixed(1) + '%'])
  rows.push(['Net margin', '', s.net_margin.toFixed(2)])
  rows.push(['Net margin %', '', s.net_margin_pct.toFixed(1) + '%'])
  rows.push([])
  rows.push(['Volume'])
  rows.push(['Cards graded', '', String(s.card_count)])

  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dcm-pnl-${month}.csv"`,
    },
  })
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}
