/**
 * Saved eBay listing defaults & templates.
 *
 * GET  — the caller's personal template row and (when an org member) the
 *        org's row. The client uses the org row when listing an org-graded
 *        card, else personal.
 * PUT  — upsert. Body: { scope: 'personal' | 'org', descriptionTemplate?,
 *        shippingDefaults?, includeTrustSlide? }. A null descriptionTemplate
 *        clears back to the standard generated layout. Org scope requires
 *        the org owner.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrgForUser } from '@/lib/organizations'

export const runtime = 'nodejs'

const TEMPLATE_MAX = 20000
// Mirrors EbayListingModal's shippingForm shape (+ bestOfferEnabled).
const SHIPPING_KEYS = new Set([
  'shippingType', 'domesticShippingService', 'flatRateAmount', 'handlingDays', 'postalCode',
  'packageWeightOz', 'packageLengthIn', 'packageWidthIn', 'packageDepthIn',
  'offerInternational', 'internationalShippingType', 'internationalShippingService',
  'internationalFlatRateCost', 'internationalShipToLocations',
  'domesticReturnsAccepted', 'domesticReturnPeriodDays', 'domesticReturnShippingPaidBy',
  'internationalReturnsAccepted', 'internationalReturnPeriodDays', 'internationalReturnShippingPaidBy',
  'bestOfferEnabled',
])

async function rowFor(filter: { user_id?: string; org_id?: string }) {
  let q = supabaseAdmin.from('listing_templates').select('description_template, shipping_defaults, include_trust_slide')
  if (filter.org_id) q = q.eq('org_id', filter.org_id)
  else q = q.eq('user_id', filter.user_id!).is('org_id', null)
  const { data } = await q.maybeSingle()
  return data
    ? {
        descriptionTemplate: data.description_template,
        shippingDefaults: data.shipping_defaults,
        includeTrustSlide: Boolean(data.include_trust_slide),
      }
    : null
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const membership = await getOrgForUser(auth.user.id)
  const [personal, org] = await Promise.all([
    rowFor({ user_id: auth.user.id }),
    membership ? rowFor({ org_id: membership.org.id }) : Promise.resolve(null),
  ])
  return NextResponse.json({ personal, org, orgRole: membership?.role ?? null })
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const body = await request.json()
  const scope = body.scope === 'org' ? 'org' : 'personal'

  let orgId: string | null = null
  if (scope === 'org') {
    const membership = await getOrgForUser(auth.user.id)
    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 })
    if (membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the account owner can edit org listing defaults' }, { status: 403 })
    }
    orgId = membership.org.id
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.descriptionTemplate !== undefined) {
    if (body.descriptionTemplate === null || body.descriptionTemplate === '') {
      updates.description_template = null
    } else if (typeof body.descriptionTemplate === 'string' && body.descriptionTemplate.length <= TEMPLATE_MAX) {
      updates.description_template = body.descriptionTemplate
    } else {
      return NextResponse.json({ error: `Template must be a string under ${TEMPLATE_MAX} characters` }, { status: 400 })
    }
  }
  if (body.shippingDefaults !== undefined) {
    if (body.shippingDefaults === null) {
      updates.shipping_defaults = null
    } else if (typeof body.shippingDefaults === 'object' && !Array.isArray(body.shippingDefaults)) {
      const clean: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(body.shippingDefaults)) {
        if (!SHIPPING_KEYS.has(k)) continue
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          clean[k] = typeof v === 'string' ? v.slice(0, 200) : v
        } else if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
          clean[k] = v.slice(0, 40).map(x => x.slice(0, 100))
        }
      }
      updates.shipping_defaults = clean
    } else {
      return NextResponse.json({ error: 'shippingDefaults must be an object' }, { status: 400 })
    }
  }
  if (body.includeTrustSlide !== undefined) {
    updates.include_trust_slide = Boolean(body.includeTrustSlide)
  }

  const key = scope === 'org' ? { org_id: orgId } : { user_id: auth.user.id, org_id: null }
  const { data: existing } = await supabaseAdmin
    .from('listing_templates')
    .select('id')
    .match(scope === 'org' ? { org_id: orgId } : { user_id: auth.user.id })
    .is(scope === 'org' ? 'user_id' : 'org_id', null)
    .maybeSingle()

  const { error } = existing
    ? await supabaseAdmin.from('listing_templates').update(updates).eq('id', existing.id)
    : await supabaseAdmin.from('listing_templates').insert({ ...key, ...updates })
  if (error) {
    console.error('[listing-defaults] save error:', error)
    return NextResponse.json({ error: 'Failed to save defaults' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
