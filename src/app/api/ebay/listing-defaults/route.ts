/**
 * Saved eBay listing defaults & templates.
 *
 * GET  — the caller's personal template row and (when an org member) the
 *        org's row. The client uses the org row when listing an org-graded
 *        card, else personal.
 * PUT  — upsert. Body: { scope: 'personal' | 'org', descriptionTemplate?,
 *        shippingDefaults?, titleGradeLabel? }. A null descriptionTemplate
 *        clears back to the standard generated layout; a null titleGradeLabel
 *        clears back to "DCM". Org scope requires the org owner.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrgForUser } from '@/lib/organizations'
import { cleanShippingDefaults } from '@/lib/ebay/shippingDefaults'
import { containsBlockedGrader, findBlockedGrader } from '@/lib/ebay/gradingCompanyBlocklist'
import { isMissingColumnError } from '@/lib/cards/ownership'
import { POLICY_COLUMNS, prefsFromRow, cleanPolicyId } from '@/lib/ebay/businessPolicies'

export const runtime = 'nodejs'

const TEMPLATE_MAX = 20000

/**
 * Words that appear in almost every store's legal name and identify nobody on
 * their own. They are never accepted as a grade label, even though they are a
 * whole-word part of the brand.
 */
const GENERIC_BRAND_WORDS = new Set([
  'grading', 'graded', 'grader', 'graders', 'grades',
  'card', 'cards', 'trading', 'collectible', 'collectibles', 'collection',
  'sports', 'sport', 'hobby', 'shop', 'store', 'company', 'co', 'group',
  'holdings', 'llc', 'inc', 'ltd', 'the', 'and', 'authentication',
  'authenticator', 'authentic', 'services', 'service', 'gem', 'mint',
])

/**
 * Validate a title grade label. It replaces "DCM" in every title this account
 * generates, so it has to be short, printable, and truthful:
 *   - 2-20 characters, letters/digits/spaces only (eBay titles are keyword
 *     real estate; punctuation and emoji are noise)
 *   - never a rival grading company (eBay keyword-spamming policy)
 *   - for ORG scope it must match the org's own brand name, because that is
 *     the name we print on the slab label in the listing photos. A title that
 *     claims a different grader than the photo is the exact thing eBay's
 *     graded-card rules exist to stop.
 * Returns the cleaned label, or an error message.
 */
function validateTitleGradeLabel(
  raw: unknown,
  orgName: string | null
): { value: string } | { error: string } {
  if (typeof raw !== 'string') return { error: 'titleGradeLabel must be a string' }
  const value = raw.replace(/\s+/g, ' ').trim()
  if (value.length < 2 || value.length > 20) {
    return { error: 'Grade label must be 2 to 20 characters' }
  }
  if (!/^[A-Za-z0-9 ]+$/.test(value)) {
    return { error: 'Grade label may contain only letters, numbers and spaces' }
  }
  // BOTH tiers are checked case-insensitively here. A grade label is not card
  // vocabulary — nobody's store is called "Ace" by coincidence in a field
  // whose only job is to name the grader — so the caps-only tier's leniency
  // (which exists so a Pokemon "Ace Spec" card keeps its name in a TITLE) must
  // not apply: 'ace' and 'Ace' are refused exactly like 'ACE'.
  const blocked = findBlockedGrader(value) || findBlockedGrader(value.toUpperCase())
  if (blocked) {
    return { error: `Grade label may not name another grading company ("${blocked}")` }
  }
  if (orgName !== null) {
    // Accept the brand name, or a whole-word part of it: "Kings Kards" is a
    // truthful label for "Kings Kards Grading", and 20 characters does not fit
    // every legal name. Substring alone would let "Kards" through as "K", so
    // the match is anchored on word boundaries.
    //
    // The GENERIC words in a legal name are excluded from that exemption. Every
    // store name ends in one, so "Grading" or "Collectibles" as a grade label
    // identifies no one — it just reads as a second grading company's mark on
    // the slab in the photo.
    const brand = orgName.replace(/\s+/g, ' ').trim().toLowerCase()
    const label = value.toLowerCase()
    const wholeWordPart =
      !GENERIC_BRAND_WORDS.has(label) &&
      new RegExp(`(^|\\s)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(brand)
    if (label !== brand && !wholeWordPart) {
      return { error: `Your store's grade label must match your brand name ("${orgName}")` }
    }
  }
  return { value }
}

/**
 * eBay's links policy forbids links AND bare web addresses, even
 * non-clickable ones, anywhere in a listing. A store template is hand-written
 * HTML, so it is rejected outright rather than silently repaired — the owner
 * should see why their template was refused.
 */
function templateLinkError(template: string): string | null {
  if (/<a\b/i.test(template)) return 'Templates cannot contain links (<a> tags)'
  if (/\bhttps?:\/\//i.test(template) || /\bwww\./i.test(template)) {
    return 'Templates cannot contain web addresses — eBay removes listings that carry them'
  }
  return null
}

// Widest first. Each fallback drops the columns of one hand-applied migration
// so a schema that is one migration behind still returns the seller's row
// instead of an empty one.
const COLUMN_SETS = [
  `description_template, shipping_defaults, title_grade_label, ${POLICY_COLUMNS}`,
  'description_template, shipping_defaults, title_grade_label',
  'description_template, shipping_defaults',
]

async function rowFor(filter: { user_id?: string; org_id?: string }) {
  // Business policies are a property of the eBay ACCOUNT, and eBay
  // connections are per user. An org row can never carry them (the PUT below
  // refuses to write them at org scope), so they are not read back on the org
  // scope either — a client that saw them there would offer a store member
  // the owner's policy ids, which do not exist on the member's eBay account.
  const isOrgScope = !!filter.org_id
  const select = (columns: string) => {
    let q = supabaseAdmin.from('listing_templates').select(columns)
    if (filter.org_id) q = q.eq('org_id', filter.org_id)
    else q = q.eq('user_id', filter.user_id!).is('org_id', null)
    return q.maybeSingle()
  }

  let data: unknown = null
  for (const columns of COLUMN_SETS) {
    const result = await select(columns)
    if (!result.error) {
      data = result.data
      break
    }
    if (!isMissingColumnError(result.error)) return null
    console.warn(
      `[listing-defaults] columns missing for "${columns}" — apply the pending ` +
      'supabase/migrations/20260902_* listing_templates migrations.'
    )
  }

  const row = data as {
    description_template: string | null
    shipping_defaults: Record<string, unknown> | null
    title_grade_label?: string | null
  } | null
  if (!row) return null
  const policies = prefsFromRow(row as unknown as Record<string, unknown>)
  return {
    descriptionTemplate: row.description_template,
    shippingDefaults: row.shipping_defaults,
    titleGradeLabel: row.title_grade_label ?? null,
    // Business policies (Phase 3), personal scope only. Absent columns — and
    // the org scope — read as "not opted in".
    useBusinessPolicies: isOrgScope ? false : policies.useBusinessPolicies,
    defaultShippingPolicyId: isOrgScope ? null : policies.shippingPolicyId,
    defaultReturnPolicyId: isOrgScope ? null : policies.returnPolicyId,
    defaultPaymentPolicyId: isOrgScope ? null : policies.paymentPolicyId,
  }
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
  let orgName: string | null = null
  if (scope === 'org') {
    const membership = await getOrgForUser(auth.user.id)
    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 })
    if (membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the account owner can edit org listing defaults' }, { status: 403 })
    }
    orgId = membership.org.id
    orgName = membership.org.name || null
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.titleGradeLabel !== undefined) {
    if (body.titleGradeLabel === null || body.titleGradeLabel === '') {
      updates.title_grade_label = null // back to the built-in "DCM"
    } else {
      const result = validateTitleGradeLabel(body.titleGradeLabel, orgName)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
      updates.title_grade_label = result.value
    }
  }
  if (body.descriptionTemplate !== undefined) {
    if (body.descriptionTemplate === null || body.descriptionTemplate === '') {
      updates.description_template = null
    } else if (typeof body.descriptionTemplate === 'string' && body.descriptionTemplate.length <= TEMPLATE_MAX) {
      const linkError = templateLinkError(body.descriptionTemplate)
      if (linkError) return NextResponse.json({ error: linkError }, { status: 400 })
      if (containsBlockedGrader(body.descriptionTemplate)) {
        return NextResponse.json(
          { error: `Templates may not name another grading company ("${findBlockedGrader(body.descriptionTemplate)}")` },
          { status: 400 }
        )
      }
      updates.description_template = body.descriptionTemplate
    } else {
      return NextResponse.json({ error: `Template must be a string under ${TEMPLATE_MAX} characters` }, { status: 400 })
    }
  }
  if (body.shippingDefaults !== undefined) {
    if (body.shippingDefaults === null) {
      updates.shipping_defaults = null
    } else if (typeof body.shippingDefaults === 'object' && !Array.isArray(body.shippingDefaults)) {
      // Shape mirrors EbayListingModal's shippingForm (+ bestOfferEnabled);
      // unknown keys and invalid values are dropped, never 400'd.
      updates.shipping_defaults = cleanShippingDefaults(body.shippingDefaults)
    } else {
      return NextResponse.json({ error: 'shippingDefaults must be an object' }, { status: 400 })
    }
  }
  // ------------------------------------------------ business policies ----
  // The flag itself is written only AFTER the client has called
  // /api/ebay/opt-in and confirmed the account-wide change; this route does
  // not opt anyone in, it records the choice. Turning it back OFF is just the
  // flag — eBay has no opt-out call, and a seller who stops using policies
  // here simply goes back to inline shipping on new listings.
  const POLICY_ID_FIELDS: Record<string, string> = {
    defaultShippingPolicyId: 'default_shipping_policy_id',
    defaultReturnPolicyId: 'default_return_policy_id',
    defaultPaymentPolicyId: 'default_payment_policy_id',
  }

  // ORG SCOPE CANNOT CARRY THESE. A business policy lives on one eBay
  // account, and eBay connections are per user — the owner's policy ids
  // simply do not exist on a store member's account, so an org-wide default
  // would make every listing that member publishes fail at eBay. Refused
  // loudly rather than dropped, so an owner who tries it learns why.
  const touchesPolicies =
    body.useBusinessPolicies !== undefined ||
    Object.keys(POLICY_ID_FIELDS).some(k => body[k] !== undefined)
  if (scope === 'org' && touchesPolicies) {
    return NextResponse.json(
      {
        error:
          'eBay business policies are per seller, not per store — each member sets their own ' +
          'in InstaList settings, because the policies live on their own eBay account.',
      },
      { status: 400 }
    )
  }

  if (body.useBusinessPolicies !== undefined) {
    if (typeof body.useBusinessPolicies !== 'boolean') {
      return NextResponse.json({ error: 'useBusinessPolicies must be a boolean' }, { status: 400 })
    }
    updates.use_business_policies = body.useBusinessPolicies
  }
  for (const [key, column] of Object.entries(POLICY_ID_FIELDS)) {
    if (body[key] === undefined) continue
    const raw = body[key]
    if (raw === null || raw === '') {
      updates[column] = null
      continue
    }
    // eBay policy ids are numeric strings. Anything else is a client bug, and
    // storing it would only surface as an opaque Trading API error at publish.
    const cleaned = cleanPolicyId(raw)
    if (cleaned === null) {
      return NextResponse.json({ error: `${key} must be a numeric eBay policy id` }, { status: 400 })
    }
    updates[column] = cleaned
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
    if (isMissingColumnError(error) && 'title_grade_label' in updates) {
      return NextResponse.json(
        { error: 'Grade labels are not enabled yet — apply the 20260902 listing_templates migration.' },
        { status: 503 }
      )
    }
    if (isMissingColumnError(error) && 'use_business_policies' in updates) {
      return NextResponse.json(
        { error: 'Business policies are not enabled yet — apply supabase/migrations/20260902_ebay_business_policies.sql.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Failed to save defaults' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
