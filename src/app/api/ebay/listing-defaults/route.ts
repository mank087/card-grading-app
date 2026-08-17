/**
 * Saved eBay listing defaults & templates.
 *
 * GET  — the caller's personal template row and (when an org member) the
 *        org's row. The client uses the org row when listing an org-graded
 *        card, else personal.
 * PUT  — upsert. Body: { scope: 'personal' | 'org', descriptionTemplate?,
 *        shippingDefaults? }. A null descriptionTemplate clears back to the
 *        standard generated layout. Org scope requires the org owner.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrgForUser } from '@/lib/organizations'
import { DOMESTIC_SHIPPING_SERVICES, INTERNATIONAL_SHIPPING_SERVICES } from '@/lib/ebay/tradingApi'

export const runtime = 'nodejs'

const TEMPLATE_MAX = 20000

// Mirrors EbayListingModal's shippingForm shape (+ bestOfferEnabled).
// Per-key validators: return the cleaned value, or undefined to DROP the key
// (invalid values are dropped, never 400'd — the client merges over its own
// defaults so a dropped key just falls back).
type ShippingValidator = (v: unknown) => unknown | undefined

const enumOf = (values: readonly string[]): ShippingValidator => v =>
  typeof v === 'string' && values.includes(v) ? v : undefined
const boolVal: ShippingValidator = v => (typeof v === 'boolean' ? v : undefined)
const numMin = (min: number, max = 1_000_000): ShippingValidator => v =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined
const shortString = (maxLen: number): ShippingValidator => v =>
  typeof v === 'string' ? v.slice(0, maxLen) : undefined

const DOMESTIC_SERVICE_VALUES = DOMESTIC_SHIPPING_SERVICES.map(s => s.value)
const INTERNATIONAL_SERVICE_VALUES = INTERNATIONAL_SHIPPING_SERVICES.map(s => s.value)

const SHIPPING_VALIDATORS: Record<string, ShippingValidator> = {
  shippingType: enumOf(['FREE', 'FLAT_RATE', 'CALCULATED']),
  domesticShippingService: enumOf(DOMESTIC_SERVICE_VALUES),
  flatRateAmount: numMin(0),
  handlingDays: numMin(0, 30),
  postalCode: shortString(20),
  packageWeightOz: numMin(0),
  packageLengthIn: numMin(0),
  packageWidthIn: numMin(0),
  packageDepthIn: numMin(0),
  offerInternational: boolVal,
  internationalShippingType: enumOf(['FLAT_RATE', 'CALCULATED']),
  internationalShippingService: enumOf(INTERNATIONAL_SERVICE_VALUES),
  internationalFlatRateCost: numMin(0),
  internationalShipToLocations: v =>
    Array.isArray(v) && v.every(x => typeof x === 'string')
      ? v.slice(0, 40).map(x => x.slice(0, 100))
      : undefined,
  domesticReturnsAccepted: boolVal,
  domesticReturnPeriodDays: numMin(0, 365),
  domesticReturnShippingPaidBy: enumOf(['BUYER', 'SELLER']),
  internationalReturnsAccepted: boolVal,
  internationalReturnPeriodDays: numMin(0, 365),
  internationalReturnShippingPaidBy: enumOf(['BUYER', 'SELLER']),
  bestOfferEnabled: boolVal,
}

async function rowFor(filter: { user_id?: string; org_id?: string }) {
  let q = supabaseAdmin.from('listing_templates').select('description_template, shipping_defaults')
  if (filter.org_id) q = q.eq('org_id', filter.org_id)
  else q = q.eq('user_id', filter.user_id!).is('org_id', null)
  const { data } = await q.maybeSingle()
  return data
    ? {
        descriptionTemplate: data.description_template,
        shippingDefaults: data.shipping_defaults,
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
  // orgId lets the client verify the caller's org matches the CARD's org
  // before applying the org template (cross-org guard).
  return NextResponse.json({ personal, org, orgRole: membership?.role ?? null, orgId: membership?.org.id ?? null })
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
        const validate = SHIPPING_VALIDATORS[k]
        if (!validate) continue // unknown key: drop
        const cleaned = validate(v)
        if (cleaned !== undefined) clean[k] = cleaned // invalid value: drop
      }
      updates.shipping_defaults = clean
    } else {
      return NextResponse.json({ error: 'shippingDefaults must be an object' }, { status: 400 })
    }
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
