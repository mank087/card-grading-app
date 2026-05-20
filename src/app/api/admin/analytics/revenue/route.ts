/**
 * GET /api/admin/analytics/revenue
 *
 * Thin wrapper over get_revenue_analytics(). See
 * migrations/add_admin_analytics_rpcs.sql for the SQL.
 *
 * Query params:
 *   ?from=YYYY-MM-DD (default: 30 days ago)
 *   ?to=YYYY-MM-DD   (default: today)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } {
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : defaultFrom
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : now
  to.setUTCHours(23, 59, 59, 999)
  return { from, to }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await verifyAdminSession(token)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { from, to } = parseRange(request.nextUrl.searchParams)

    const { data, error } = await supabaseAdmin.rpc('get_revenue_analytics', {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    })
    if (error) {
      console.error('[admin/analytics/revenue] RPC error:', error)
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[admin/analytics/revenue] error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}
