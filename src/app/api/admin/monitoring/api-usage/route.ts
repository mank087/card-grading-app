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
    const service = searchParams.get('service') || 'all' // all, openai, supabase, etc.

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('api_usage_log')
      .select('*', { count: 'exact' })

    // Apply service filter
    if (service !== 'all') {
      query = query.eq('service', service)
    }

    // Apply sorting (most recent first)
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: apiLogs, error, count } = await query

    if (error) {
      throw error
    }

    // Get user emails if user_id is present
    const userIds = apiLogs?.map(log => log.user_id).filter(Boolean) || []
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds)

    const userMap: Record<string, string> = {}
    users?.forEach(user => {
      userMap[user.id] = user.email
    })

    // Enrich API log data
    const enrichedLogs = apiLogs?.map(log => ({
      ...log,
      user_email: log.user_id ? userMap[log.user_id] : null
    }))

    // Calculate API usage statistics
    const last24Hours = new Date()
    last24Hours.setHours(last24Hours.getHours() - 24)

    const logsLast24h = apiLogs?.filter(log =>
      new Date(log.created_at) >= last24Hours
    ) || []

    const callsLast24h = logsLast24h.length
    const costLast24h = logsLast24h.reduce((sum, log) => sum + (log.cost_usd || 0), 0)

    const usageByService: Record<string, { calls: number; cost: number }> = {}
    apiLogs?.forEach(log => {
      const svc = log.service || 'unknown'
      if (!usageByService[svc]) {
        usageByService[svc] = { calls: 0, cost: 0 }
      }
      usageByService[svc].calls++
      usageByService[svc].cost += log.cost_usd || 0
    })

    return NextResponse.json({
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      },
      statistics: {
        calls_last_24h: callsLast24h,
        cost_last_24h: Math.round(costLast24h * 100) / 100,
        by_service: Object.keys(usageByService).map(service => ({
          service,
          calls: usageByService[service].calls,
          cost: Math.round(usageByService[service].cost * 100) / 100
        })).sort((a, b) => b.cost - a.cost)
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching API usage logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
