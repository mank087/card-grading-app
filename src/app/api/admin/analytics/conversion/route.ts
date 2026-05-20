/**
 * GET /api/admin/analytics/conversion
 *
 * Thin wrapper over get_conversion_analytics(). See
 * migrations/add_admin_analytics_rpcs.sql.
 *
 * Accepts ?startDate / ?endDate for the cohort filter (matches the
 * original endpoint's query-param names).
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

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || null
    const endDate = searchParams.get('endDate') || null

    const { data, error } = await supabaseAdmin.rpc('get_conversion_analytics', {
      p_start: startDate ? new Date(startDate).toISOString() : null,
      p_end: endDate ? new Date(endDate).toISOString() : null,
    })
    if (error) {
      console.error('[admin/analytics/conversion] RPC error:', error)
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching conversion analytics:', error)
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}
