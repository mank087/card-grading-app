/**
 * Bulk publish: turning one reviewed `ebay_bulk_items` row into the exact
 * payload the single-card path sends to eBay.
 *
 * This module is deliberately pure — no database, no network, no clock beyond
 * the SKU stamp — so `scripts/ebay-bulk-input-snapshot.ts` can print what a
 * batch would send without touching eBay, and so the mapping can be read in
 * one place rather than inferred from the drain's control flow.
 *
 * The one rule worth stating out loud: the drain must never invent listing
 * content. Title, price, description, specifics and photos all come off the
 * item row the seller reviewed; everything else (shipping, returns, Best
 * Offer, format) comes off the batch's settings; and only the grade and the
 * category are re-derived from the card, through the SAME resolver the title
 * was built from, so the title's "DCM 9" and eBay's grade descriptor can never
 * disagree.
 */

import type { PublishCardListingInput, ItemSpecific } from '@/lib/ebay/publishCardListing';
import type { BulkBatchSettings } from '@/lib/ebay/bulkSettings';
import { resolveListingFields, cleanFieldValue } from '@/lib/ebay/listingFields';

/** The item columns the publish input is built from (a subset of ITEM_COLUMNS). */
export interface BulkPublishItem {
  id: string;
  card_id: string;
  title: string | null;
  price: number | string | null;
  description_html: string | null;
  item_specifics: unknown;
  image_urls: unknown;
}

export interface BulkPublishBatch {
  id: string;
  user_id: string;
  settings: BulkBatchSettings;
}

/**
 * SKU for a bulk-published listing: `DCM-B-{batch8}-{card8}-{base36 stamp}`.
 *
 * The `B` marks it as batch-created at a glance in Seller Hub, and the batch
 * and card fragments make a stray eBay listing traceable back to the row that
 * created it without a database round trip. The timestamp keeps a retry after
 * a failed publish from colliding with the SKU eBay may already have seen.
 */
export function bulkSku(batchId: string, cardId: string, now: number = Date.now()): string {
  const short = (id: string) => id.replace(/-/g, '').slice(0, 8);
  return `DCM-B-${short(batchId)}-${short(cardId)}-${now.toString(36)}`.toUpperCase();
}

/**
 * Item specifics as eBay wants them: name/value only, and only the ones that
 * carry a value.
 *
 * Two transforms, both load-bearing. `required` / `editable` are OUR review-UI
 * metadata (they drive the readiness gate and the drawer) and are not part of
 * eBay's NameValueList — sending them is at best ignored and at worst a schema
 * complaint. And an empty aspect is worse than an absent one: eBay treats a
 * blank value as "filled", which drops the listing out of the buyer's filter
 * for that aspect and stops eBay ever prompting the seller to complete it.
 *
 * "Empty" is `cleanFieldValue`'s definition, not `''` — the same one the
 * single-card modal and the description resolver use. A row can carry "N/A",
 * "Unknown" or "None" (the model writes them, and a seller reading the drawer
 * hint too late can type them), and those are placeholders, not answers: eBay
 * files them as a real value and the card drops out of that filter just as if
 * it were blank. Dropping them here means a bulk listing and a hand-made one
 * send the same aspects for the same card.
 */
export function cleanItemSpecifics(raw: unknown): ItemSpecific[] {
  if (!Array.isArray(raw)) return [];
  const out: ItemSpecific[] = [];
  for (const entry of raw as any[]) {
    if (!entry || typeof entry !== 'object') continue;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) continue;
    if (Array.isArray(entry.value)) {
      const values = entry.value
        .map((v: unknown) => cleanFieldValue(v))
        .filter((v: string) => v.length > 0);
      if (values.length > 0) out.push({ name, value: values });
    } else {
      const value = cleanFieldValue(entry.value);
      if (value) out.push({ name, value });
    }
  }
  return out;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build the publish payload for one bulk item.
 *
 * Throws only for the two conditions the readiness gate is supposed to have
 * caught already (no title, no price, no photos) — the drain turns that into a
 * failed row with the message rather than an eBay call that would 400.
 */
export function buildPublishInputFromBulkItem(
  item: BulkPublishItem,
  batch: BulkPublishBatch,
  card: any,
  options: { now?: number } = {}
): PublishCardListingInput {
  const settings = batch.settings;
  const ship = settings.shipping;

  const title = (item.title ?? '').trim();
  const price = toNumber(item.price);
  const imageUrls = Array.isArray(item.image_urls)
    ? (item.image_urls as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];

  if (!title) throw new Error('This row has no title.');
  if (!(price > 0)) throw new Error('This row has no price.');
  if (imageUrls.length === 0) throw new Error('This row has no photos.');

  // Same resolver the title was rendered from, so the grade in the title and
  // the grade eBay records as the condition descriptor are the same number.
  // null falls through to publishCardListing's own grade chain, which refuses
  // to list rather than inventing a grade.
  const grade = resolveListingFields(card).grade;

  return {
    userId: batch.user_id,
    cardId: item.card_id,
    bulkItemId: item.id,
    sku: bulkSku(batch.id, item.card_id, options.now),

    grade,
    title,
    description: item.description_html ?? undefined,
    price,
    listingFormat: settings.listingFormat,
    quantity: 1,
    bestOfferEnabled: settings.bestOfferEnabled,
    duration: settings.duration,
    imageUrls,
    itemSpecifics: cleanItemSpecifics(item.item_specifics),

    // Business policies, when the seller's account uses them. Sent alongside
    // the inline block rather than instead of it: publishCardListing re-checks
    // the seller's opt-in and drops whichever side does not apply, so the
    // drain never has to decide which shape eBay is going to accept. The
    // package dimensions below stay relevant either way (a calculated
    // shipping policy still needs the parcel's weight).
    ...(settings.policies.useBusinessPolicies
      ? {
          policies: {
            shippingPolicyId: settings.policies.shippingPolicyId ?? undefined,
            returnPolicyId: settings.policies.returnPolicyId ?? undefined,
            paymentPolicyId: settings.policies.paymentPolicyId ?? undefined,
          },
        }
      : {}),

    // Shipping / package — the batch panel IS the "across the board" control,
    // so every row carries the same block (ignored entirely when the batch
    // runs on business policies).
    shippingType: ship.shippingType,
    domesticShippingService: ship.domesticShippingService,
    flatRateAmount: ship.flatRateAmount,
    handlingDays: ship.handlingDays,
    postalCode: ship.postalCode,
    packageWeightOz: ship.packageWeightOz,
    packageLengthIn: ship.packageLengthIn,
    packageWidthIn: ship.packageWidthIn,
    packageDepthIn: ship.packageDepthIn,

    offerInternational: ship.offerInternational,
    internationalShippingType: ship.internationalShippingType,
    internationalShippingService: ship.internationalShippingService,
    internationalFlatRateCost: ship.internationalFlatRateCost,
    internationalShipToLocations: ship.internationalShipToLocations,

    domesticReturnsAccepted: ship.domesticReturnsAccepted,
    domesticReturnPeriodDays: ship.domesticReturnPeriodDays,
    domesticReturnShippingPaidBy: ship.domesticReturnShippingPaidBy,
    internationalReturnsAccepted: ship.internationalReturnsAccepted,
    internationalReturnPeriodDays: ship.internationalReturnPeriodDays,
    internationalReturnShippingPaidBy: ship.internationalReturnShippingPaidBy,
  };
}

/* ------------------------------------------------------------------ */
/* eBay failure classification                                         */
/* ------------------------------------------------------------------ */

export type BulkFailureKind =
  /** The seller's eBay listing allowance is used up. Stops the whole batch. */
  | 'listing_limit'
  /** eBay refused the token. Pause and ask for a reconnect; fail nothing. */
  | 'ebay_reconnect'
  /** This row's own problem (category, aspect, price, photo). Fail the row. */
  | 'item';

/**
 * eBay's selling-limit errors. A seller who hits their allowance mid-batch
 * would otherwise burn one failed row per remaining card, each with an
 * identical message, and every retry would fail the same way — so this is the
 * one failure that stops the batch instead of the row.
 *
 * Codes seen on AddFixedPriceItem: 21919188 ("You have reached your listing
 * limit"), 21919189 (quantity/value variant), 240 (legacy selling limit).
 * Matched by message too, because eBay has more than one code for it and the
 * copy is stable ("selling limit", "listing limit", "limit for this category").
 */
const LISTING_LIMIT_CODES = new Set(['240', '21919188', '21919189', '21916750']);
const LISTING_LIMIT_RE = /(listing|selling|monthly)\s+limit|limit for (this|your)|exceeded your (listing|selling)/i;

/**
 * eBay refusing the TOKEN — not eBay refusing the listing.
 *
 * Deliberately narrow, and deliberately without a "not authorized" phrase
 * match. eBay says "You are not authorized to list in this category" for a
 * category-permission problem, which is a property of the card and can only be
 * fixed by getting approval or listing it elsewhere. Classified as a token
 * problem it would requeue the row and pause the batch, and every Resume would
 * hit the same row and pause again — an unbreakable loop over a listing that
 * was never going to succeed. Category-permission errors belong in `item`, so
 * the row fails with eBay's own message and the seller can act on it.
 */
const TOKEN_RE = /(auth|token).*(invalid|expired|failed)|invalid.*(auth|token)|iaf token|hard expired/i;
const TOKEN_CODES = new Set(['931', '932', '16110', '21916984', '17470']);

export function classifyEbayErrors(
  errors: Array<{ code?: string; message?: string }> | undefined
): BulkFailureKind {
  for (const err of errors ?? []) {
    const code = String(err?.code ?? '');
    const message = err?.message ?? '';
    if (LISTING_LIMIT_CODES.has(code) || LISTING_LIMIT_RE.test(message)) return 'listing_limit';
    if (TOKEN_CODES.has(code) || TOKEN_RE.test(message)) return 'ebay_reconnect';
  }
  return 'item';
}

/** The copy the progress view shows for a paused batch. */
export const PAUSE_REASONS: Record<string, string> = {
  disclaimer_required:
    'Accept the InstaList seller terms to carry on. Nothing was lost — resume and the rest of the batch continues.',
  ebay_reconnect:
    'eBay stopped accepting our connection to your account. Reconnect and resume; no cards were failed.',
  listing_limit:
    "You have reached your eBay listing allowance, so the remaining cards were held rather than failed. " +
    "Ask eBay to raise your selling limit (Seller Hub → Overview → Monthly limits → Request higher limit), " +
    'then resume this batch.',
};

export const LISTING_LIMIT_MESSAGE =
  'Held: your eBay listing allowance is used up. Request a higher selling limit on eBay, then resume this batch.';
