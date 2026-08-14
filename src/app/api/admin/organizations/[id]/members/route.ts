import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/uuid'

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const email = String(body.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle()
  if (!user) {
    return NextResponse.json({ error: `No user found with email ${email} — they must sign up first` }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('organization_members')
    .insert({ org_id: params.id, user_id: user.id, role: 'member' })
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That user already belongs to an organization' }, { status: 409 })
    }
    console.error('[admin/organizations/members] add error:', error)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }

  return NextResponse.json({ member: { user_id: user.id, email: user.email, role: 'member' } })
}

export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId || !isUuid(userId)) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // The owner can't be removed — reassign ownership first (v2) or cancel the org.
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('owner_user_id')
    .eq('id', params.id)
    .maybeSingle()
  if (org?.owner_user_id === userId) {
    return NextResponse.json({ error: 'The owner cannot be removed from the organization' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('organization_members')
    .delete()
    .eq('org_id', params.id)
    .eq('user_id', userId)
  if (error) {
    console.error('[admin/organizations/members] remove error:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }

  return NextResponse.json({ removed: true })
}
