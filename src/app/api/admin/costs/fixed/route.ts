/**
 * /api/admin/costs/fixed
 *
 * CRUD for the monthly_costs table — manually-entered fixed/recurring vendor
 * subscriptions (Vercel, Supabase, Resend, Sentry, Apple Developer, etc.) and
 * one-time capital costs. Used by /admin/costs to compute monthly fixed burn.
 *
 * GET    — list all rows (optionally filtered by category and active-only)
 * POST   — create new row
 * PATCH  — update existing row
 * DELETE — delete row
 *
 * Categories enforced by DB CHECK constraint (see add_monthly_costs.sql).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const ALLOWED_CATEGORIES = new Set([
  'hosting', 'database', 'email', 'monitoring', 'dev_tools',
  'legal', 'marketing', 'apple_dev', 'google_dev', 'domain', 'ai_apis', 'other',
])
const ALLOWED_TYPES = new Set(['recurring', 'one_time'])

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const activeOnly = sp.get('active_only') === 'true'
  const category = sp.get('category') || ''

  let query = supabaseAdmin
    .from('monthly_costs')
    .select('*')
    .order('category', { ascending: true })
    .order('vendor', { ascending: true })

  if (category) query = query.eq('category', category)
  if (activeOnly) query = query.or('effective_to.is.null,effective_to.gte.' + new Date().toISOString().slice(0, 10))

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ costs: data || [] })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { vendor, category, amount_usd, cost_type = 'recurring', effective_from, effective_to, notes } = body
  if (!vendor || !category || amount_usd === undefined || !effective_from) {
    return NextResponse.json({ error: 'vendor, category, amount_usd, and effective_from are required' }, { status: 400 })
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category. Must be one of: ${Array.from(ALLOWED_CATEGORIES).join(', ')}` }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(cost_type)) {
    return NextResponse.json({ error: 'cost_type must be recurring or one_time' }, { status: 400 })
  }
  if (typeof amount_usd !== 'number' || amount_usd < 0) {
    return NextResponse.json({ error: 'amount_usd must be a non-negative number' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('monthly_costs')
    .insert({
      vendor: String(vendor).trim(),
      category,
      amount_usd,
      cost_type,
      effective_from,
      effective_to: effective_to || null,
      notes: notes || null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cost: data })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { id, ...patch } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Whitelist editable fields
  const update: Record<string, any> = {}
  for (const key of ['vendor', 'category', 'amount_usd', 'cost_type', 'effective_from', 'effective_to', 'notes']) {
    if (key in patch) update[key] = patch[key]
  }
  if (update.category && !ALLOWED_CATEGORIES.has(update.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (update.cost_type && !ALLOWED_TYPES.has(update.cost_type)) {
    return NextResponse.json({ error: 'Invalid cost_type' }, { status: 400 })
  }
  if ('amount_usd' in update && (typeof update.amount_usd !== 'number' || update.amount_usd < 0)) {
    return NextResponse.json({ error: 'amount_usd must be a non-negative number' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('monthly_costs')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cost: data })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('monthly_costs')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
