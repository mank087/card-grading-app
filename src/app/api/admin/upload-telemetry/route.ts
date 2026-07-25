import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Admin summary of client-side upload failures (upload_telemetry).
 * GET /api/admin/upload-telemetry?days=7
 * Returns counts by event/reason plus the most recent raw events.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const days = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get('days')) || 7))
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString()

    const { data: rows, error } = await supabaseAdmin
      .from('upload_telemetry')
      .select('created_at, user_id, event, side, reason, image_width, image_height, file_type, file_size_bytes, page')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const byEvent: Record<string, number> = {}
    const byReason: Record<string, number> = {}
    const affectedUsers = new Set<string>()
    for (const r of rows || []) {
      byEvent[r.event] = (byEvent[r.event] || 0) + 1
      const reasonKey = `${r.event}: ${(r.reason || '-').slice(0, 120)}`
      byReason[reasonKey] = (byReason[reasonKey] || 0) + 1
      if (r.user_id) affectedUsers.add(r.user_id)
    }

    return NextResponse.json({
      days,
      total: rows?.length || 0,
      affected_users: affectedUsers.size,
      by_event: Object.fromEntries(Object.entries(byEvent).sort((a, b) => b[1] - a[1])),
      by_reason: Object.fromEntries(Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 40)),
      recent: (rows || []).slice(0, 100),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
