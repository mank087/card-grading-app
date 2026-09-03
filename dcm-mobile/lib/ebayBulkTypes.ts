/**
 * Bulk eBay listing — the shapes the native bulk screens read off
 * /api/ebay/bulk/**.
 *
 * Hand-maintained twin of three web modules (Metro can't reach into src/):
 *   - src/app/instalist-marketplace/bulk/types.ts   — row/batch payloads
 *   - src/lib/ebay/bulkReadiness.ts                 — statuses + readiness
 *   - src/lib/ebay/bulkSettings.ts                  — settings + defaults
 *   - src/lib/ebay/bulkPublish.ts                   — PAUSE_REASONS copy
 *   - .../components/BulkBatchesStrip.tsx           — status chip labels
 * The value-carrying halves (DEFAULT_BULK_SHIPPING, DEFAULT_BULK_SETTINGS,
 * PAUSE_REASONS, BATCH_STATUS_LABEL) are registered in
 * scripts/check-twin-drift.ts; run `npm run check:twin-drift` after editing
 * either side. The interfaces are not machine-checked — keep them in step by
 * hand.
 *
 * snake_case is deliberate throughout: these rows go straight back up as PATCH
 * bodies, so renaming them here would mean translating in both directions.
 */

import { DEFAULT_SHIPPING_SERVICE } from './ebayApi'

/* ─── Readiness + statuses (twin: src/lib/ebay/bulkReadiness.ts) ─────────── */

/** eBay's hard title limit. */
export const EBAY_TITLE_MAX = 80

/** Cards per batch. The create route rejects anything above this. */
export const MAX_BULK_ITEMS = 100

export type BulkItemStatus =
  | 'draft'
  | 'ready'
  | 'queued'
  | 'uploading'
  | 'publishing'
  | 'live'
  | 'failed'
  | 'skipped'
  | 'blocked'

export type BulkBatchStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled'

export type ReadinessCode =
  | 'title_missing'
  | 'title_too_long'
  | 'title_blocked_grader'
  | 'title_link'
  | 'price_missing'
  | 'description_missing'
  | 'description_link'
  | 'description_blocked_grader'
  | 'specifics_required'
  | 'images_pending'
  | 'images_failed'
  | 'images_missing'

export interface ReadinessIssue {
  code: ReadinessCode
  /** Short line the row shows in its readiness chip. Server-authored. */
  label: string
}

export type BatchReadinessCode = 'policies_incomplete'

export interface BatchReadinessIssue {
  code: BatchReadinessCode
  label: string
}

/* ─── Settings (twin: src/lib/ebay/bulkSettings.ts) ──────────────────────── */

export interface BulkShippingForm {
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED'
  domesticShippingService: string
  flatRateAmount: number
  handlingDays: number
  postalCode: string
  packageWeightOz: number
  packageLengthIn: number
  packageWidthIn: number
  packageDepthIn: number
  offerInternational: boolean
  internationalShippingType: 'FLAT_RATE' | 'CALCULATED'
  internationalShippingService: string
  internationalFlatRateCost: number
  internationalShipToLocations: string[]
  domesticReturnsAccepted: boolean
  domesticReturnPeriodDays: number
  domesticReturnShippingPaidBy: 'BUYER' | 'SELLER'
  internationalReturnsAccepted: boolean
  internationalReturnPeriodDays: number
  internationalReturnShippingPaidBy: 'BUYER' | 'SELLER'
}

export type BulkPriceRule =
  /** Seed each row from the shared value resolver (DCM estimate chain). */
  | { mode: 'estimate' }
  /** Estimate × percent, e.g. 110 for "list 10% above the estimate". */
  | { mode: 'estimate_pct'; percent: number }
  /** The same asking price on every row. */
  | { mode: 'fixed'; amount: number }
  /** Leave every price blank for the seller to fill in per row. */
  | { mode: 'blank' }

export interface BulkBatchSettings {
  shipping: BulkShippingForm
  bestOfferEnabled: boolean
  listingFormat: 'FIXED_PRICE'
  duration: 'GTC'
  priceRule: BulkPriceRule
  /**
   * Enterprise title label ("Kings Kards"); null = the built-in "DCM".
   * Server-resolved — sending it from here is ignored.
   */
  gradeLabel: string | null
  /**
   * eBay business policies. `useBusinessPolicies` mirrors the seller's
   * account-level opt-in and is server-resolved like `gradeLabel`.
   */
  policies: {
    useBusinessPolicies: boolean
    shippingPolicyId: string | null
    returnPolicyId: string | null
    paymentPolicyId: string | null
    shippingPolicyName: string | null
    returnPolicyName: string | null
  }
}

export const DEFAULT_BULK_SHIPPING: BulkShippingForm = {
  shippingType: 'CALCULATED',
  domesticShippingService: DEFAULT_SHIPPING_SERVICE,
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
}

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
}

/* ─── Rows (twin: src/app/instalist-marketplace/bulk/types.ts) ───────────── */

export interface BulkBatch {
  id: string
  user_id: string
  org_id: string | null
  status: BulkBatchStatus
  settings: BulkBatchSettings
  total_count: number
  ready_count: number
  live_count: number
  failed_count: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  last_error: string | null
}

export interface BulkItemSpecific {
  name: string
  value: string | string[]
  required?: boolean
  editable?: boolean
}

export interface BulkItem {
  id: string
  batch_id: string
  card_id: string
  position: number
  status: BulkItemStatus
  attempts: number
  title: string | null
  /** Postgres numeric arrives as a string often enough to type both. */
  price: number | string | null
  description_html: string | null
  item_specifics: BulkItemSpecific[] | null
  image_urls: string[] | null
  image_status: 'pending' | 'ready' | 'failed'
  readiness: ReadinessIssue[] | null
  price_edited: boolean
  title_edited: boolean
  description_edited: boolean
  listing_row_id: string | null
  error_code: string | null
  error_message: string | null
  updated_at: string
}

/**
 * The eBay listing a published (or skipped) row points at, keyed by
 * `BulkItem.listing_row_id`.
 */
export interface BulkListingRef {
  id: string
  listing_id: string | null
  listing_url: string | null
  status: string
  price: number | null
  published_at: string | null
}

/**
 * The card columns the batch routes select. Same open-index posture as the
 * web `MarketplaceCard`: the fields the screens render are typed, the rest
 * passes through untouched.
 */
export interface BulkCard {
  id: string
  card_name: string | null
  category: string | null
  serial: string | null
  front_path: string | null
  back_path: string | null
  /** Signed for 1h by the batch route. */
  front_url: string | null
  back_url: string | null
  conversational_whole_grade: number | null
  dcm_price_estimate: number | null
  ebay_price_median: number | null
  [key: string]: unknown
}

export interface BulkBatchPayload {
  batch: BulkBatch
  items: BulkItem[]
  listings: BulkListingRef[]
  cards: BulkCard[]
  hasMore: boolean
}

/** One row of GET /api/ebay/bulk/batches — the "get me back to my batch" list. */
export interface BulkBatchSummary {
  id: string
  status: BulkBatchStatus
  total_count: number
  ready_count: number
  live_count: number
  failed_count: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  last_error: string | null
}

/** The seller's remaining eBay allowance. Every field is null when unknown. */
export interface BulkLimits {
  available: number | null
  amountAvailable: number | null
  activeCount: number | null
}

/* ─── Copy ───────────────────────────────────────────────────────────────── */

/** Batch status → chip label. Twin of BulkBatchesStrip.tsx STATUS_LABEL. */
export const BATCH_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  running: 'Publishing',
  paused: 'Paused',
  complete: 'Finished',
  failed: 'Finished with failures',
  cancelled: 'Cancelled',
}

/** The copy a paused batch shows, keyed by `batch.last_error`. */
export const PAUSE_REASONS: Record<string, string> = {
  disclaimer_required:
    'Accept the InstaList seller terms to carry on. Nothing was lost — resume and the rest of the batch continues.',
  ebay_reconnect:
    'eBay stopped accepting our connection to your account. Reconnect and resume; no cards were failed.',
  listing_limit:
    "You have reached your eBay listing allowance, so the remaining cards were held rather than failed. " +
    "Ask eBay to raise your selling limit (Seller Hub → Overview → Monthly limits → Request higher limit), " +
    'then resume this batch.',
}

export const LISTING_LIMIT_MESSAGE =
  'Held: your eBay listing allowance is used up. Request a higher selling limit on eBay, then resume this batch.'

/** The message a batch over the cap gets, shown inline in the picker. */
export const BATCH_CAP_MESSAGE =
  `A batch holds at most ${MAX_BULK_ITEMS} cards. Publish this batch, then start another.`
