/**
 * Batch settings for bulk listing — the "across the board" controls.
 *
 * One object, stored on `ebay_bulk_batches.settings`, carrying exactly what
 * the single-card modal keeps in component state: the shipping form, returns,
 * Best Offer, the listing format, the price rule, and (Phase 3) the seller's
 * business-policy IDs.
 *
 * Validation reuses the shipping validators the saved-defaults route already
 * enforces, so a batch can never hold a shipping value that `PUT
 * /api/ebay/listing-defaults` would have rejected.
 */

import {
  DOMESTIC_SHIPPING_SERVICES,
  INTERNATIONAL_SHIPPING_SERVICES,
  DEFAULT_DOMESTIC_SHIPPING_SERVICE,
  normalizeDomesticService,
} from '@/lib/ebay/tradingApi';
import { buildShippingSummary, buildPolicyShippingSummary } from '@/lib/ebay/listingDescription';
import { cleanPolicyId } from '@/lib/ebay/businessPolicies';
import { resolveCardValue, type CardForPricing } from '@/lib/pricing/resolveCardValue';

export interface BulkShippingForm {
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED';
  domesticShippingService: string;
  flatRateAmount: number;
  handlingDays: number;
  postalCode: string;
  packageWeightOz: number;
  packageLengthIn: number;
  packageWidthIn: number;
  packageDepthIn: number;
  offerInternational: boolean;
  internationalShippingType: 'FLAT_RATE' | 'CALCULATED';
  internationalShippingService: string;
  internationalFlatRateCost: number;
  internationalShipToLocations: string[];
  domesticReturnsAccepted: boolean;
  domesticReturnPeriodDays: number;
  domesticReturnShippingPaidBy: 'BUYER' | 'SELLER';
  internationalReturnsAccepted: boolean;
  internationalReturnPeriodDays: number;
  internationalReturnShippingPaidBy: 'BUYER' | 'SELLER';
}

export type BulkPriceRule =
  /** Seed each row from the shared value resolver (DCM estimate chain). */
  | { mode: 'estimate' }
  /** Estimate × percent, e.g. 110 for "list 10% above the estimate". */
  | { mode: 'estimate_pct'; percent: number }
  /** The same asking price on every row. */
  | { mode: 'fixed'; amount: number }
  /** Leave every price blank for the seller to fill in per row. */
  | { mode: 'blank' };

export interface BulkBatchSettings {
  shipping: BulkShippingForm;
  bestOfferEnabled: boolean;
  listingFormat: 'FIXED_PRICE';
  /** Fixed price is always GTC on eBay; kept explicit for the publish payload. */
  duration: 'GTC';
  priceRule: BulkPriceRule;
  /** Enterprise title label ("Kings Kards"); null = the built-in "DCM". */
  gradeLabel: string | null;
  /**
   * eBay business policies (Phase 3), batch-wide like everything else here.
   *
   * `useBusinessPolicies` mirrors the seller's account-level opt-in and is
   * resolved SERVER-side (like `gradeLabel`) — a client cannot switch a batch
   * onto policies by sending it, because that would let any seller publish
   * against an account that is not in eBay's policy program.
   *
   * The names are carried alongside the ids purely so the description's
   * shipping paragraph can be rendered at draft time without a second eBay
   * call per row at drain time.
   */
  policies: {
    useBusinessPolicies: boolean;
    shippingPolicyId: string | null;
    returnPolicyId: string | null;
    paymentPolicyId: string | null;
    shippingPolicyName: string | null;
    returnPolicyName: string | null;
  };
}

export const DEFAULT_BULK_SHIPPING: BulkShippingForm = {
  shippingType: 'CALCULATED',
  domesticShippingService: DEFAULT_DOMESTIC_SHIPPING_SERVICE,
  flatRateAmount: 5,
  handlingDays: 1,
  postalCode: '',
  packageWeightOz: 4,
  packageLengthIn: 10,
  packageWidthIn: 6,
  packageDepthIn: 1,
  offerInternational: false,
  internationalShippingType: 'CALCULATED',
  internationalShippingService: 'USPSPriorityMailInternational',
  internationalFlatRateCost: 15,
  internationalShipToLocations: ['Worldwide'],
  domesticReturnsAccepted: false,
  domesticReturnPeriodDays: 30,
  domesticReturnShippingPaidBy: 'BUYER',
  internationalReturnsAccepted: false,
  internationalReturnPeriodDays: 30,
  internationalReturnShippingPaidBy: 'BUYER',
};

export const DEFAULT_BULK_SETTINGS: BulkBatchSettings = {
  shipping: DEFAULT_BULK_SHIPPING,
  bestOfferEnabled: true,
  listingFormat: 'FIXED_PRICE',
  duration: 'GTC',
  priceRule: { mode: 'estimate' },
  gradeLabel: null,
  policies: {
    useBusinessPolicies: false,
    shippingPolicyId: null,
    returnPolicyId: null,
    paymentPolicyId: null,
    shippingPolicyName: null,
    returnPolicyName: null,
  },
};

const DOMESTIC_SERVICE_VALUES = DOMESTIC_SHIPPING_SERVICES.map(s => s.value);
const INTERNATIONAL_SERVICE_VALUES = INTERNATIONAL_SHIPPING_SERVICES.map(s => s.value);

function pickEnum<T extends string>(v: unknown, values: readonly string[], fallback: T): T {
  return typeof v === 'string' && values.includes(v) ? (v as T) : fallback;
}
function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function pickNum(v: unknown, fallback: number, min = 0, max = 1_000_000): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

/**
 * Coerce anything (a request body, a stored row, a saved shipping default)
 * into a complete, valid shipping form. Invalid values fall back to the
 * default rather than 400 — same posture as the saved-defaults route, which
 * silently drops bad keys because the client merges over its own defaults.
 */
export function normalizeBulkShipping(raw: unknown): BulkShippingForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_BULK_SHIPPING;
  return {
    shippingType: pickEnum(r.shippingType, ['FREE', 'FLAT_RATE', 'CALCULATED'], d.shippingType),
    // Saved defaults can still carry retired tokens (e.g. USPSFirstClass).
    domesticShippingService: pickEnum(
      typeof r.domesticShippingService === 'string'
        ? normalizeDomesticService(r.domesticShippingService)
        : undefined,
      DOMESTIC_SERVICE_VALUES,
      d.domesticShippingService
    ),
    flatRateAmount: pickNum(r.flatRateAmount, d.flatRateAmount),
    handlingDays: pickNum(r.handlingDays, d.handlingDays, 0, 30),
    postalCode: typeof r.postalCode === 'string' ? r.postalCode.slice(0, 20) : d.postalCode,
    packageWeightOz: pickNum(r.packageWeightOz, d.packageWeightOz),
    packageLengthIn: pickNum(r.packageLengthIn, d.packageLengthIn),
    packageWidthIn: pickNum(r.packageWidthIn, d.packageWidthIn),
    packageDepthIn: pickNum(r.packageDepthIn, d.packageDepthIn),
    offerInternational: pickBool(r.offerInternational, d.offerInternational),
    internationalShippingType: pickEnum(
      r.internationalShippingType,
      ['FLAT_RATE', 'CALCULATED'],
      d.internationalShippingType
    ),
    internationalShippingService: pickEnum(
      r.internationalShippingService,
      INTERNATIONAL_SERVICE_VALUES,
      d.internationalShippingService
    ),
    internationalFlatRateCost: pickNum(r.internationalFlatRateCost, d.internationalFlatRateCost),
    internationalShipToLocations:
      Array.isArray(r.internationalShipToLocations) &&
      r.internationalShipToLocations.every(x => typeof x === 'string')
        ? (r.internationalShipToLocations as string[]).slice(0, 40).map(x => x.slice(0, 100))
        : d.internationalShipToLocations,
    domesticReturnsAccepted: pickBool(r.domesticReturnsAccepted, d.domesticReturnsAccepted),
    domesticReturnPeriodDays: pickNum(r.domesticReturnPeriodDays, d.domesticReturnPeriodDays, 0, 365),
    domesticReturnShippingPaidBy: pickEnum(
      r.domesticReturnShippingPaidBy,
      ['BUYER', 'SELLER'],
      d.domesticReturnShippingPaidBy
    ),
    internationalReturnsAccepted: pickBool(r.internationalReturnsAccepted, d.internationalReturnsAccepted),
    internationalReturnPeriodDays: pickNum(
      r.internationalReturnPeriodDays,
      d.internationalReturnPeriodDays,
      0,
      365
    ),
    internationalReturnShippingPaidBy: pickEnum(
      r.internationalReturnShippingPaidBy,
      ['BUYER', 'SELLER'],
      d.internationalReturnShippingPaidBy
    ),
  };
}

function normalizePriceRule(raw: unknown, fallback: BulkPriceRule): BulkPriceRule {
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!r) return fallback;
  switch (r.mode) {
    case 'estimate':
      return { mode: 'estimate' };
    case 'estimate_pct':
      // 1–1000%: below 1 is a free card, above 1000 is a typo.
      return { mode: 'estimate_pct', percent: pickNum(r.percent, 100, 1, 1000) };
    case 'fixed':
      return { mode: 'fixed', amount: pickNum(r.amount, 0, 0, 1_000_000) };
    case 'blank':
      return { mode: 'blank' };
    default:
      return fallback;
  }
}

/**
 * Coerce a settings object (a request body or a stored row) into a complete
 * settings object, layered over `base` — the batch's CURRENT settings when
 * patching, the defaults when creating. A partial `shipping` object merges
 * over the base's shipping rather than snapping the untouched keys back to
 * the built-in defaults (a panel that sends only `handlingDays` must not
 * silently reset the seller's ZIP code).
 *
 * `gradeLabel` is deliberately NOT read from the input: it is the enterprise
 * store's brand name, resolved server-side from listing_templates. Letting a
 * client set it would let any seller title their cards with any label.
 */
export function normalizeBulkSettings(
  raw: unknown,
  base: BulkBatchSettings = DEFAULT_BULK_SETTINGS
): BulkBatchSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const policies = (r.policies && typeof r.policies === 'object' ? r.policies : {}) as Record<string, unknown>;
  const str = (v: unknown, fallback: string | null) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : fallback;
  const rawShipping = (r.shipping && typeof r.shipping === 'object' ? r.shipping : {}) as Record<string, unknown>;
  return {
    shipping: normalizeBulkShipping({ ...base.shipping, ...rawShipping }),
    bestOfferEnabled: pickBool(r.bestOfferEnabled, base.bestOfferEnabled),
    // Phase 1 is fixed-price GTC only; auctions stay in the single-card modal.
    listingFormat: 'FIXED_PRICE',
    duration: 'GTC',
    priceRule: normalizePriceRule(r.priceRule, base.priceRule),
    gradeLabel: base.gradeLabel,
    policies: {
      // Server-resolved, exactly like gradeLabel — see the interface.
      useBusinessPolicies: base.policies.useBusinessPolicies,
      // Ids are shape-checked, not just trimmed: a malformed one would reach
      // the Trading API as an opaque schema complaint mid-drain. An invalid
      // id falls back to the batch's current one, same posture as every other
      // field here — and the batch-level readiness gate catches a still-empty
      // slot before anything is queued.
      shippingPolicyId: cleanPolicyId(policies.shippingPolicyId) ?? base.policies.shippingPolicyId,
      returnPolicyId: cleanPolicyId(policies.returnPolicyId) ?? base.policies.returnPolicyId,
      paymentPolicyId: cleanPolicyId(policies.paymentPolicyId) ?? base.policies.paymentPolicyId,
      shippingPolicyName: str(policies.shippingPolicyName, base.policies.shippingPolicyName),
      returnPolicyName: str(policies.returnPolicyName, base.policies.returnPolicyName),
    },
  };
}

/**
 * Stamp the seller's account-level business-policy state onto a batch.
 *
 * Called by the routes that create or patch a batch, never by the client:
 * `useBusinessPolicies` follows the seller's opt-in and the three ids seed
 * from their saved defaults, so a batch created the moment after opting in
 * already has the right policies selected. Ids the batch already carries win
 * — the panel's dropdowns are per-batch overrides of the account default.
 */
export function withSellerPolicyDefaults(
  policies: BulkBatchSettings['policies'],
  defaults: {
    useBusinessPolicies?: boolean;
    defaultShippingPolicyId?: string | null;
    defaultReturnPolicyId?: string | null;
    defaultPaymentPolicyId?: string | null;
  } | null | undefined
): BulkBatchSettings['policies'] {
  const on = defaults?.useBusinessPolicies === true;
  return {
    ...policies,
    useBusinessPolicies: on,
    // Only seed while the seller is opted in: leaving stale ids on an opted-out
    // batch would resurrect them if they ever switched back on.
    shippingPolicyId: on ? policies.shippingPolicyId ?? cleanPolicyId(defaults?.defaultShippingPolicyId) : null,
    returnPolicyId: on ? policies.returnPolicyId ?? cleanPolicyId(defaults?.defaultReturnPolicyId) : null,
    paymentPolicyId: on ? policies.paymentPolicyId ?? cleanPolicyId(defaults?.defaultPaymentPolicyId) : null,
    shippingPolicyName: on ? policies.shippingPolicyName : null,
    returnPolicyName: on ? policies.returnPolicyName : null,
  };
}

/** Human label for the chosen domestic carrier service. */
export function domesticServiceLabel(service: string): string | undefined {
  return DOMESTIC_SHIPPING_SERVICES.find(s => s.value === service)?.label;
}

/**
 * The shipping/returns paragraph the description embeds, for these settings.
 *
 * A business-policy batch names the policies instead of restating terms it no
 * longer owns — the numbers live on eBay's side, and a description that
 * disagrees with the shipping block eBay renders is the failure mode.
 */
export function shippingSummaryFor(settings: BulkBatchSettings): string {
  if (settings.policies.useBusinessPolicies) {
    return buildPolicyShippingSummary(
      settings.policies.shippingPolicyName,
      settings.policies.returnPolicyName
    );
  }
  return buildShippingSummary(
    settings.shipping,
    domesticServiceLabel(settings.shipping.domesticShippingService)
  );
}

/**
 * The asking price this batch's rule produces for one card, or null when the
 * rule leaves it to the seller (or the card has no value on file).
 *
 * Reads only the price columns `/api/ebay/eligible-cards` already exposes, so
 * the batch never has to widen its card select.
 */
export function priceForCard(card: CardForPricing, rule: BulkPriceRule): number | null {
  const round = (n: number) => (n > 0 ? Math.round(n * 100) / 100 : null);
  switch (rule.mode) {
    case 'blank':
      return null;
    case 'fixed':
      return round(rule.amount);
    case 'estimate_pct':
      return round(resolveCardValue(card).value * (rule.percent / 100));
    case 'estimate':
    default:
      return round(resolveCardValue(card).value);
  }
}
