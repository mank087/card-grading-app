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
    const service = searchParams.get('service') || 'all' // all, openai, supabase, etc.

    const offset = (page - 1) * limit

    // Build query - OPTIMIZED: select only needed fields to reduce egress
    // Previously used SELECT * which fetched all columns including large response payloads
    let query = supabaseAdmin
      .from('api_usage_log')
      .select('id, service, operation, user_id, card_id, input_tokens, output_tokens, cost_usd, status, created_at', { count: 'exact' })

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
    const { data: users } = await supabaseAdmin
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

    // Calculate API usage statistics for the last 24h across ALL rows (not just
    // the current page): exact head count for calls, and cost/service totals
    // summed by paging narrow rows in batches of 1000.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { count: callsCount } = await supabaseAdmin
      .from('api_usage_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h)

    const usageByService: Record<string, { calls: number; cost: number }> = {}
    let costLast24h = 0
    const BATCH = 1000
    const MAX_BATCHES = 100
    for (let i = 0; i < MAX_BATCHES; i++) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('api_usage_log')
        .select('service, cost_usd')
        .gte('created_at', since24h)
        .order('id', { ascending: true })
        .range(i * BATCH, i * BATCH + BATCH - 1)
      if (batchError) throw batchError
      for (const log of batch || []) {
        const svc = log.service || 'unknown'
        if (!usageByService[svc]) {
          usageByService[svc] = { calls: 0, cost: 0 }
        }
        const cost = Number(log.cost_usd) || 0
        usageByService[svc].calls++
        usageByService[svc].cost += cost
        costLast24h += cost
      }
      if (!batch || batch.length < BATCH) break
    }
    const callsLast24h = callsCount || 0

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
