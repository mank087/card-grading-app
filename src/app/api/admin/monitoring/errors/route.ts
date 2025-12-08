import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabase } from '@/lib/supabaseClient'

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
    let query = supabase
      .from('error_log')
      .select('id, error_type, error_message, severity, user_id, card_id, created_at', { count: 'exact' })

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
    const { data: users } = await supabase
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

    // Calculate error statistics
    const last24Hours = new Date()
    last24Hours.setHours(last24Hours.getHours() - 24)

    const errorsLast24h = errors?.filter(e =>
      new Date(e.created_at) >= last24Hours
    ).length || 0

    const errorsByType: Record<string, number> = {}
    errors?.forEach(error => {
      const type = error.error_type || 'unknown'
      errorsByType[type] = (errorsByType[type] || 0) + 1
    })

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
