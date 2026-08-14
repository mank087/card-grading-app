import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/uuid'

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status')
  let query = supabaseAdmin
    .from('enterprise_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status && ['new', 'contacted', 'converted', 'closed'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    console.error('[admin/enterprise-leads] list error:', error)
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })
  }
  return NextResponse.json({ leads: data || [] })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const id = body.id
  const status = body.status
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
  if (!['new', 'contacted', 'converted', 'closed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('enterprise_leads')
    .update({ status })
    .eq('id', id)
  if (error) {
    console.error('[admin/enterprise-leads] update error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
