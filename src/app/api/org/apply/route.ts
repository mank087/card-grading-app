/**
 * POST /api/org/apply — self-serve enterprise application.
 *
 * An authenticated user submits their store details + logo in one multipart
 * request. Creates the org in 'pending' status (invisible publicly; can't
 * grade or subscribe) with the caller as owner, then notifies admin. An admin
 * approves from /admin/organizations, which flips status to 'active' and
 * unlocks self-serve subscription on /store/billing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { processAndStoreOrgLogo } from '@/lib/orgLogo'
import { SLUG_RE, RESERVED_SLUGS, escapeHtml } from '@/lib/orgSlugs'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
}

/**
 * GET — the caller's application state. Pending orgs are hidden from every
 * other org surface, so the apply page uses this to show the "application
 * received" screen instead of the form on revisit.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('org_id, organizations(name, status)')
    .eq('user_id', authResult.user.id)
    .maybeSingle()
  const org = (membership as any)?.organizations
  if (!org) return NextResponse.json({ applied: false })
  return NextResponse.json({ applied: true, name: org.name, status: org.status })
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: 'Please sign in to apply' }, { status: 401 })
  }
  const userId = authResult.user.id

  // v1: one org per user — covers "already applied" and "already a member".
  const { data: existingMembership } = await supabaseAdmin
    .from('organization_members')
    .select('org_id, organizations(status)')
    .eq('user_id', userId)
    .maybeSingle()
  if (existingMembership) {
    const status = (existingMembership as any)?.organizations?.status
    return NextResponse.json(
      {
        error: status === 'pending'
          ? 'Your application is already in review. We will reach out to finalize the process.'
          : 'This account already has an enterprise account.',
      },
      { status: 409 }
    )
  }

  const formData = await request.formData()
  const storeName = String(formData.get('storeName') || '').trim().slice(0, 120)
  const rawSlug = String(formData.get('slug') || '').trim().toLowerCase()
  const phone = String(formData.get('phone') || '').trim().slice(0, 40)
  const website = String(formData.get('website') || '').trim().slice(0, 200)
  const monthlyVolume = String(formData.get('monthlyVolume') || '').trim().slice(0, 100)
  const tierIntent = String(formData.get('tierIntent') || '').trim().slice(0, 40)
  const tagline = String(formData.get('tagline') || '').trim().slice(0, 140)
  const description = String(formData.get('description') || '').trim().slice(0, 1000)
  const tosAccepted = formData.get('tosAccepted') === 'true'
  const logo = formData.get('logo')

  if (!storeName) {
    return NextResponse.json({ error: 'Brand or business name is required' }, { status: 400 })
  }
  if (!tosAccepted) {
    return NextResponse.json({ error: 'You must accept the Enterprise terms to apply' }, { status: 400 })
  }

  const slug = rawSlug || slugify(storeName)
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: 'Branded URL must be up to 32 lowercase letters, numbers, and hyphens' },
      { status: 400 }
    )
  }
  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'That store URL is reserved — please pick another' }, { status: 400 })
  }

  const { data: org, error: createError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: storeName,
      slug,
      owner_user_id: userId,
      status: 'pending',
      tos_accepted_at: new Date().toISOString(),
      application: {
        phone: phone || null,
        website: website || null,
        monthly_volume: monthlyVolume || null,
        tier_intent: tierIntent || null,
        applicant_email: authResult.user.email || null,
      },
      storefront: (tagline || description)
        ? { tagline: tagline || undefined, description: description || undefined }
        : null,
    })
    .select()
    .single()
  if (createError) {
    if (createError.code === '23505') {
      return NextResponse.json({ error: 'That store URL is already taken — please pick another' }, { status: 409 })
    }
    console.error('[org/apply] create error:', createError)
    return NextResponse.json({ error: 'Failed to submit application — please try again' }, { status: 500 })
  }

  const { error: memberError } = await supabaseAdmin
    .from('organization_members')
    .insert({ org_id: org.id, user_id: userId, role: 'owner' })
  if (memberError) {
    console.error('[org/apply] owner membership error:', memberError)
    await supabaseAdmin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: 'Failed to submit application — please try again' }, { status: 500 })
  }

  // Logo is optional at apply time; a failed upload must not lose the
  // application. Admin review shows whether one landed.
  let logoWarning: string | null = null
  if (logo instanceof File && logo.size > 0) {
    const result = await processAndStoreOrgLogo(org.id, logo, null)
    if (!result.success) logoWarning = result.error
  }

  // Confirmation to the applicant: received, in review, we'll reach out.
  // Fire-and-forget; the pending org row is the source of truth.
  if (authResult.user.email) {
    try {
      await resend.emails.send({
        from: 'DCM Grading <noreply@dcmgrading.com>',
        to: [authResult.user.email],
        replyTo: 'admin@dcmgrading.com',
        subject: `We received your DCM Enterprise application for ${storeName}`,
        html: `
          <h2>Application received</h2>
          <p>Thanks for applying to DCM Enterprise with <strong>${escapeHtml(storeName)}</strong>.</p>
          <p>Our team reviews every application, and we&#39;ll reach out to finalize the
          process &mdash; usually within one business day. There&#39;s nothing you need to do
          in the meantime, and no payment is due until your account is approved and you
          choose a plan.</p>
          <p>In the meantime, your personal DCM account works as always at
          <a href="https://dcmgrading.com">dcmgrading.com</a>.</p>
          <p>Questions? Just reply to this email.</p>
        `,
      })
    } catch (emailErr) {
      console.error('[org/apply] applicant confirmation email failed (application saved):', emailErr)
    }
  }

  // Notify admin (fire-and-forget; the pending org row is the source of truth)
  try {
    await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: ['admin@dcmgrading.com'],
      replyTo: authResult.user.email || undefined,
      subject: `Enterprise application: ${storeName}`,
      html: `
        <h2>New enterprise application (pending approval)</h2>
        <p><strong>Store:</strong> ${escapeHtml(storeName)} (/${escapeHtml(slug)})</p>
        <p><strong>Applicant:</strong> ${escapeHtml(authResult.user.email || userId)}</p>
        <p><strong>Volume estimate:</strong> ${escapeHtml(monthlyVolume) || '—'}</p>
        <p><strong>Tier interest:</strong> ${escapeHtml(tierIntent) || '—'}</p>
        <p><strong>Website:</strong> ${escapeHtml(website) || '—'}</p>
        <p><strong>Logo uploaded:</strong> ${logo instanceof File && logo.size > 0 ? (logoWarning ? `failed (${escapeHtml(logoWarning)})` : 'yes') : 'no'}</p>
        <p>Review and approve in the admin panel → Organizations.</p>
      `,
    })
  } catch (emailErr) {
    console.error('[org/apply] notification email failed (application saved):', emailErr)
  }

  return NextResponse.json({ success: true, orgId: org.id, slug, logoWarning })
}
