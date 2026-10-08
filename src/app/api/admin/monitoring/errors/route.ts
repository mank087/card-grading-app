import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const severity = searchParams.get('severity') || 'all' // all, error, warning, info

    const offset = (page - 1) * limit

    // Build query - OPTIMIZED: select only needed fields to reduce egress
    // Previously used SELECT * which fetched all columns including large stack traces
    let query = supabaseAdmin
      .from('error_log')
      .select('id, error_type, error_message, severity, user_id, route, created_at', { count: 'exact' })

    // Apply severity filter
    if (severity !== 'all') {
      query = query.eq('severity', severity)
    }

    // Apply sorting (most recent first)
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: errors, error, count } = await query

    if (error) {
      throw error
    }

    // Get user emails if user_id is present
    const userIds = errors?.map(e => e.user_id).filter(Boolean) || []
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', userIds)

    const userMap: Record<string, string> = {}
    users?.forEach(user => {
      userMap[user.id] = user.email
    })

    // Enrich error data
    const enrichedErrors = errors?.map(error => ({
      ...error,
      user_email: error.user_id ? userMap[error.user_id] : null
    }))

    // Calculate error statistics for the last 24h across ALL rows (not just
    // the current page)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { count: errorsCount } = await supabaseAdmin
      .from('error_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h)
    const errorsLast24h = errorsCount || 0

    const errorsByType: Record<string, number> = {}
    const BATCH = 1000
    const MAX_BATCHES = 100
    for (let i = 0; i < MAX_BATCHES; i++) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('error_log')
        .select('error_type')
        .gte('created_at', since24h)
        .order('id', { ascending: true })
        .range(i * BATCH, i * BATCH + BATCH - 1)
      if (batchError) throw batchError
      for (const row of batch || []) {
        const type = row.error_type || 'unknown'
        errorsByType[type] = (errorsByType[type] || 0) + 1
      }
      if (!batch || batch.length < BATCH) break
    }

    return NextResponse.json({
      errors: enrichedErrors,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      },
      statistics: {
        errors_last_24h: errorsLast24h,
        by_type: Object.keys(errorsByType).map(type => ({
          type,
          count: errorsByType[type]
        })).sort((a, b) => b.count - a.count)
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching error logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
