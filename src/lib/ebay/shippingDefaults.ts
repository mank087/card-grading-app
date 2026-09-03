/**
 * Saved shipping defaults — the JSON in listing_templates.shipping_defaults.
 *
 * The shape mirrors EbayListingModal's shippingForm (+ bestOfferEnabled), and
 * it is also exactly the shipping slice of CreateListingRequest, which is what
 * lets a successful publish remember what the seller used without any client
 * cooperation (see rememberShippingDefaults).
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrgForUser } from '@/lib/organizations'
import { DOMESTIC_SHIPPING_SERVICES, INTERNATIONAL_SHIPPING_SERVICES } from '@/lib/ebay/tradingApi'

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

export const SHIPPING_VALIDATORS: Record<string, ShippingValidator> = {
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

/** Keep only known keys with valid values; unknown keys and bad values drop. */
export function cleanShippingDefaults(raw: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const validate = SHIPPING_VALIDATORS[k]
    if (!validate) continue
    const cleaned = validate(v)
    if (cleaned !== undefined) clean[k] = cleaned
  }
  return clean
}

/**
 * Remember the shipping terms a seller just listed with, as their defaults for
 * the next listing. Last used wins.
 *
 * Before this, defaults only changed when someone pressed "Save as my shipping
 * defaults" — which nobody did (three rows in the whole table), so every
 * listing after a page reload, on a fresh screen in the app, or in a new bulk
 * batch came up with the stock 4 oz / Priority values and the seller retyped
 * weight, package and service every time.
 *
 * Runs after a SUCCESSFUL publish only, so a rejected form is never remembered.
 * Business-policy listings carry no inline terms and are skipped. The row
 * written is the one the next open will read (see resolveActiveDefaults): the
 * org row when the seller owns the org that graded the card, else personal.
 * Only shipping_defaults is touched — templates, grade labels and policy
 * columns are left alone. Best-effort: a failure here is logged, never
 * surfaced, because the listing already exists on eBay.
 */
export async function rememberShippingDefaults(args: {
  userId: string
  cardOrgId: string | null | undefined
  shipping: Record<string, unknown>
}): Promise<void> {
  const clean = cleanShippingDefaults(args.shipping)
  if (Object.keys(clean).length === 0) return

  let orgId: string | null = null
  if (args.cardOrgId) {
    const membership = await getOrgForUser(args.userId)
    if (membership && membership.org.id === args.cardOrgId && membership.role === 'owner') {
      orgId = membership.org.id
    }
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('listing_templates')
    .select('id')
    .match(orgId ? { org_id: orgId } : { user_id: args.userId })
    .is(orgId ? 'user_id' : 'org_id', null)
    .maybeSingle()
  if (lookupError) {
    console.error('[shippingDefaults] lookup failed:', lookupError.message)
    return
  }

  const updates = { shipping_defaults: clean, updated_at: new Date().toISOString() }
  const { error } = existing
    ? await supabaseAdmin.from('listing_templates').update(updates).eq('id', existing.id)
    : await supabaseAdmin
        .from('listing_templates')
        .insert(orgId ? { org_id: orgId, ...updates } : { user_id: args.userId, org_id: null, ...updates })
  if (error) console.error('[shippingDefaults] save failed:', error.message)
}
