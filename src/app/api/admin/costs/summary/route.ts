/**
 * GET /api/admin/costs/summary
 *
 * Thin wrapper over get_costs_summary(). Returns the selected month's
 * full P&L plus the 12-month trend. Aggregation logic lives in
 * migrations/add_admin_analytics_rpcs.sql so it bypasses the Supabase
 * row cap that was clipping client-side aggregations.
 *
 * Query params:
 *   ?month=YYYY-MM (default: current month)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await verifyAdminSession(token)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const monthParam = request.nextUrl.searchParams.get('month')
    const now = new Date()
    const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const targetMonth = monthParam || defaultMonth

    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
    }

    // Convert to YYYY-MM-01 for the RPC's date param.
    const monthDate = `${targetMonth}-01`

    const { data, error } = await supabaseAdmin.rpc('get_costs_summary', {
      p_month: monthDate,
    })
    if (error) {
      console.error('[admin/costs/summary] RPC error:', error)
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[admin/costs/summary] error:', err)
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 })
  }
}
