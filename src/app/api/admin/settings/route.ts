/**
 * Tiny K/V endpoint for admin_settings.
 *
 *   GET  /api/admin/settings?key=<key>  → { key, value }
 *   POST /api/admin/settings            → upsert { key, value }
 *
 * Used by the runway widget on /admin/costs to store cash_on_hand. Keep it
 * generic so future one-off admin toggles can reuse the same table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = request.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('admin_settings')
    .select('key, value, updated_at')
    .eq('key', key)
    .maybeSingle()

  return NextResponse.json({ key, value: data?.value ?? null, updated_at: data?.updated_at ?? null })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { key, value } = body
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('admin_settings')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ key, value })
}
