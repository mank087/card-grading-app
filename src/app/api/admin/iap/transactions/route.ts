/**
 * GET /api/admin/iap/transactions
 *
 * Filterable, paginated list of iap_transactions rows joined to the user's
 * email. Built for admin support tickets like "I bought credits in the app
 * and they didn't arrive" — surface the row, status, raw receipt, etc.
 * without forcing the admin to SQL the Supabase dashboard.
 *
 * Query params:
 *   ?page         (default 1)
 *   ?limit        (default 25, max 100)
 *   ?platform     'apple' | 'google' | 'all'
 *   ?status       'active' | 'expired' | 'refunded' | 'revoked' | 'pending' | 'cancelled' | 'all'
 *   ?product_id   exact match on product_id
 *   ?email        substring match against users.email (case-insensitive)
 *   ?from / ?to   ISO date range on created_at
 *   ?id           if provided, returns the single full row including raw_receipt
 *                 (otherwise list response omits raw_receipt to keep payloads small)
 *
 * Response shape:
 *   {
 *     transactions: Array<{...row, email}>,
 *     pagination: { page, limit, total, total_pages },
 *     facets: { platforms, statuses, products }   // for filter dropdowns
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const VALID_PLATFORMS = new Set(['apple', 'google'])
const VALID_STATUSES = new Set(['active', 'expired', 'refunded', 'revoked', 'pending', 'cancelled'])

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await verifyAdminSession(token)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const singleId = sp.get('id')

    // ----- Single-row detail mode -----
    if (singleId) {
      const { data, error } = await supabaseAdmin
        .from('iap_transactions')
        .select('*')
        .eq('id', singleId)
        .single()
      if (error || !data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      // Join email
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', data.user_id)
        .single()
      // Also pull any sibling rows in the same subscription lineage (for
      // subscriptions — consumables won't have siblings).
      const { data: lineage } = data.original_transaction_id
        ? await supabaseAdmin
            .from('iap_transactions')
            .select('id, transaction_id, status, credits_granted, subscription_period_start, subscription_period_end, created_at')
            .eq('platform', data.platform)
            .eq('original_transaction_id', data.original_transaction_id)
            .order('created_at', { ascending: true })
        : { data: [] as any[] }
      return NextResponse.json({
        transaction: { ...data, email: userRow?.email || null },
        lineage: lineage || [],
      })
    }

    // ----- List mode -----
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '25', 10)))
    const offset = (page - 1) * limit
    const platform = sp.get('platform') || 'all'
    const status = sp.get('status') || 'all'
    const productId = sp.get('product_id') || ''
    const emailQuery = (sp.get('email') || '').trim().toLowerCase()
    const fromParam = sp.get('from')
    const toParam = sp.get('to')

    // Build base query
    let query = supabaseAdmin
      .from('iap_transactions')
      .select(
        'id, user_id, platform, product_id, product_type, transaction_id, original_transaction_id, credits_granted, subscription_period_start, subscription_period_end, status, environment, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })

    if (platform !== 'all' && VALID_PLATFORMS.has(platform)) {
      query = query.eq('platform', platform)
    }
    if (status !== 'all' && VALID_STATUSES.has(status)) {
      query = query.eq('status', status)
    }
    if (productId) {
      query = query.eq('product_id', productId)
    }
    if (fromParam) {
      query = query.gte('created_at', new Date(fromParam).toISOString())
    }
    if (toParam) {
      const toDate = new Date(toParam)
      toDate.setUTCHours(23, 59, 59, 999)
      query = query.lte('created_at', toDate.toISOString())
    }

    // Email filter: resolve to user_id(s) first, then filter the IAP query.
    // Doing it this way (rather than a join) keeps us within Supabase's
    // PostgREST capabilities without introducing a view.
    if (emailQuery) {
      const { data: matchingUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', `%${emailQuery}%`)
        .limit(1000)
      const ids = matchingUsers?.map((u) => u.id) || []
      if (ids.length === 0) {
        return NextResponse.json({
          transactions: [],
          pagination: { page, limit, total: 0, total_pages: 0 },
          facets: await loadFacets(),
        })
      }
      query = query.in('user_id', ids)
    }

    const { data: rows, count, error } = await query.range(offset, offset + limit - 1)
    if (error) {
      console.error('[admin/iap/transactions] list query error:', error)
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 })
    }

    // Enrich with email
    const userIds = Array.from(new Set((rows || []).map((r) => r.user_id)))
    const emailById: Record<string, string> = {}
    if (userIds.length) {
      const { data: usersRows } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', userIds)
      usersRows?.forEach((u: any) => { emailById[u.id] = u.email })
    }

    const transactions = (rows || []).map((r) => ({
      ...r,
      email: emailById[r.user_id] || null,
    }))

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      facets: await loadFacets(),
    })
  } catch (err: any) {
    console.error('[admin/iap/transactions] error:', err)
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 })
  }
}

async function loadFacets(): Promise<{
  platforms: string[]
  statuses: string[]
  products: Array<{ product_id: string; count: number }>
}> {
  // Distinct values for filter dropdowns. PostgREST doesn't support a real
  // DISTINCT, but pulling a wide projection and de-duping in JS is fine at
  // current row counts.
  const { data } = await supabaseAdmin
    .from('iap_transactions')
    .select('platform, status, product_id')
    .limit(10000)
  const platforms = new Set<string>()
  const statuses = new Set<string>()
  const productCounts: Record<string, number> = {}
  ;(data || []).forEach((r: any) => {
    if (r.platform) platforms.add(r.platform)
    if (r.status) statuses.add(r.status)
    if (r.product_id) productCounts[r.product_id] = (productCounts[r.product_id] || 0) + 1
  })
  return {
    platforms: Array.from(platforms).sort(),
    statuses: Array.from(statuses).sort(),
    products: Object.entries(productCounts)
      .map(([product_id, count]) => ({ product_id, count }))
      .sort((a, b) => b.count - a.count),
  }
}
