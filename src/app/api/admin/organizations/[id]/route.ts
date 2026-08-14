import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { returnOrgCredits, getOrgBranding } from '@/lib/organizations'
import { isUuid } from '@/lib/uuid'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dcmgrading.com'

/**
 * Approval email to the store owner when a pending application goes active.
 * Fire-and-forget: the status change is the source of truth.
 */
async function sendApprovalEmail(orgId: string, orgName: string, ownerUserId: string) {
  try {
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', ownerUserId)
      .maybeSingle()
    if (!owner?.email) {
      console.warn('[admin/organizations] approval email skipped — no owner email for org', orgId)
      return
    }
    await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: [owner.email],
      subject: `${orgName} is approved on DCM Enterprise 🎉`,
      html: `
        <h2>Your store is live</h2>
        <p>${orgName} has been approved for DCM Enterprise.</p>
        <p>Next step: pick your plan and activate your monthly grades.</p>
        <p><a href="${SITE_URL}/store/billing">Choose your plan →</a></p>
        <p>Your branding is already set up — the moment your plan is active, every
        grade your store submits carries your logo on labels, reports, and card pages.</p>
        <p>Then grab your <a href="${SITE_URL}/enterprise/launch-kit">Store Launch Kit</a> —
        printable counter signage personalized with your branding, a staff pitch sheet,
        and ready-to-post social captions for announcing in-store grading.</p>
        <p>Questions? Just reply to this email.</p>
      `,
      replyTo: 'admin@dcmgrading.com',
    })
  } catch (err) {
    console.error('[admin/organizations] approval email failed:', err)
  }
}

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  if (error || !org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, created_at')
    .eq('org_id', params.id)
    .order('created_at')

  // Resolve member emails
  const memberIds = (members || []).map(m => m.user_id)
  const emails: Record<string, string> = {}
  if (memberIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', memberIds)
    for (const u of users || []) emails[u.id] = u.email
  }

  const { data: transactions } = await supabaseAdmin
    .from('credit_transactions')
    .select('id, type, amount, balance_after, description, created_at')
    .eq('org_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Signed preview URLs for logos already on file — without these the admin
  // panel only ever showed the previews returned by the upload call itself,
  // so reopening the panel made saved logos look like they had vanished.
  let previews: { color: string | null; white: string | null; black: string | null } | null = null
  if (org.logo_path) {
    const b = await getOrgBranding(org)
    previews = { color: b.logoUrl, white: b.logoWhiteUrl, black: b.logoBlackUrl }
  }

  // Signed URLs for storefront photos so the admin panel can show the grid
  // (org.storefront only holds storage paths in the private org-assets bucket).
  const storefrontPhotoPreviews: { path: string; url: string }[] = []
  const storefrontPhotos: string[] = (org.storefront?.photos || []).slice(0, 8)
  for (const path of storefrontPhotos) {
    const { data } = await supabaseAdmin.storage.from('org-assets').createSignedUrl(path, 3600)
    if (data?.signedUrl) storefrontPhotoPreviews.push({ path, url: data.signedUrl })
  }

  return NextResponse.json({
    organization: org,
    members: (members || []).map(m => ({ ...m, email: emails[m.user_id] || null })),
    transactions: transactions || [],
    previews,
    storefrontPhotoPreviews,
  })
}

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
  if (typeof body.status === 'string' && ['pending', 'active', 'suspended', 'cancelled'].includes(body.status)) {
    updates.status = body.status
  }
  if (typeof body.plan === 'string') updates.plan = body.plan.trim() || null
  if (typeof body.brandColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.brandColor)) {
    updates.brand_color = body.brandColor
  }
  if (body.brandColors !== undefined) {
    if (
      !Array.isArray(body.brandColors) ||
      body.brandColors.length < 1 ||
      body.brandColors.length > 5 ||
      body.brandColors.some((c: unknown) => typeof c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c))
    ) {
      return NextResponse.json({ error: 'brandColors must be 1–5 #rrggbb hex strings' }, { status: 400 })
    }
    updates.brand_colors = body.brandColors
    // Legacy consumers still read the single brand_color — keep it in sync
    updates.brand_color = body.brandColors[0]
  }
  if (body.serialPrefix !== undefined) {
    if (typeof body.serialPrefix !== 'string') {
      return NextResponse.json({ error: 'serialPrefix must be a string' }, { status: 400 })
    }
    // Empty clears the override (serials fall back to name-derived initials)
    const normalized = body.serialPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (normalized === '') {
      updates.serial_prefix = null
    } else if (/^[A-Z0-9]{2,6}$/.test(normalized)) {
      updates.serial_prefix = normalized
    } else {
      return NextResponse.json({ error: 'Serial prefix must be 2–6 characters (A–Z, 0–9)' }, { status: 400 })
    }
  }
  if (Number.isInteger(body.monthlyAllotment) && body.monthlyAllotment >= 0) {
    updates.monthly_allotment = body.monthlyAllotment
  }

  // Manual balance adjustment (admin grant/correction) goes through the
  // atomic RPC + audit trail, never a raw column write. Adjustments hit the
  // OVERAGE bucket — the durable one, never wiped by the monthly reset.
  if (Number.isInteger(body.adjustCredits) && body.adjustCredits !== 0) {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, name, overage_credits, owner_user_id')
      .eq('id', params.id)
      .maybeSingle()
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    if (body.adjustCredits < 0 && org.overage_credits + body.adjustCredits < 0) {
      return NextResponse.json({ error: 'Adjustment would make the overage balance negative' }, { status: 400 })
    }
    const newBalance = await returnOrgCredits(params.id, body.adjustCredits, 'overage')
    if (newBalance === null) {
      return NextResponse.json({ error: 'Balance adjustment failed' }, { status: 500 })
    }
    await supabaseAdmin.from('credit_transactions').insert({
      user_id: org.owner_user_id,
      org_id: params.id,
      type: 'admin_adjustment',
      amount: body.adjustCredits,
      balance_after: newBalance,
      description: String(body.adjustReason || `Admin adjustment by ${admin.email}`).slice(0, 250),
      metadata: { org_credit: true, org_bucket: 'overage', admin_email: admin.email },
    })
  }

  if (Object.keys(updates).length > 0) {
    // Approval detection: transition pending → active triggers the owner email.
    let approving: { name: string; owner_user_id: string } | null = null
    if (updates.status === 'active') {
      const { data: prior } = await supabaseAdmin
        .from('organizations')
        .select('status, name, owner_user_id')
        .eq('id', params.id)
        .maybeSingle()
      if (prior?.status === 'pending') {
        approving = { name: prior.name, owner_user_id: prior.owner_user_id }
      }
    }

    updates.updated_at = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', params.id)
    if (error) {
      console.error('[admin/organizations] update error:', error)
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
    }

    if (approving) {
      await sendApprovalEmail(params.id, approving.name, approving.owner_user_id)
    }
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  return NextResponse.json({ organization: org })
}
