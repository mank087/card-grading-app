import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SLUG_RE, RESERVED_SLUGS, escapeIlike } from '@/lib/orgSlugs'

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgs, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[admin/organizations] list error:', error)
    return NextResponse.json({ error: 'Failed to load organizations' }, { status: 500 })
  }

  // Member counts + graded-card counts in two grouped queries
  const ids = (orgs || []).map(o => o.id)
  const memberCounts: Record<string, number> = {}
  const cardCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: members } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .in('org_id', ids)
    for (const m of members || []) memberCounts[m.org_id] = (memberCounts[m.org_id] || 0) + 1
    const { data: cards } = await supabaseAdmin
      .from('cards')
      .select('org_id')
      .in('org_id', ids)
    for (const c of cards || []) {
      if (c.org_id) cardCounts[c.org_id] = (cardCounts[c.org_id] || 0) + 1
    }
  }

  return NextResponse.json({
    organizations: (orgs || []).map(o => ({
      ...o,
      member_count: memberCounts[o.id] || 0,
      card_count: cardCounts[o.id] || 0,
    })),
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = String(body.name || '').trim()
  const slug = String(body.slug || '').trim().toLowerCase()
  const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase()
  const brandColor = String(body.brandColor || '#7C3AED').trim()

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Slug must be lowercase letters, numbers, and hyphens (up to 32 chars)' }, { status: 400 })
  }
  // Same reserved list as self-serve — an admin-created org colliding with an
  // app route or grader brand is a footgun, not a feature.
  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'That slug is reserved (app route, subdomain, or grader brand)' }, { status: 400 })
  }
  if (!ownerEmail) return NextResponse.json({ error: 'Owner email is required' }, { status: 400 })
  if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    return NextResponse.json({ error: 'Brand color must be a hex color like #7C3AED' }, { status: 400 })
  }

  // Resolve owner by email
  const { data: owner } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .ilike('email', escapeIlike(ownerEmail))
    .maybeSingle()
  if (!owner) {
    return NextResponse.json({ error: `No user found with email ${ownerEmail} — they must sign up first` }, { status: 404 })
  }

  // v1: one org per user
  const { data: existingMembership } = await supabaseAdmin
    .from('organization_members')
    .select('org_id')
    .eq('user_id', owner.id)
    .maybeSingle()
  if (existingMembership) {
    return NextResponse.json({ error: 'That user already belongs to an organization' }, { status: 409 })
  }

  const { data: org, error: createError } = await supabaseAdmin
    .from('organizations')
    .insert({ name, slug, owner_user_id: owner.id, brand_color: brandColor })
    .select()
    .single()
  if (createError) {
    if (createError.code === '23505') {
      return NextResponse.json({ error: 'That slug is already taken' }, { status: 409 })
    }
    console.error('[admin/organizations] create error:', createError)
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  }

  const { error: memberError } = await supabaseAdmin
    .from('organization_members')
    .insert({ org_id: org.id, user_id: owner.id, role: 'owner' })
  if (memberError) {
    console.error('[admin/organizations] owner membership error:', memberError)
    // Roll back the orphaned org so a retry can succeed cleanly
    await supabaseAdmin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: 'Failed to link owner to organization' }, { status: 500 })
  }

  return NextResponse.json({ organization: org, owner: { id: owner.id, email: owner.email } })
}
