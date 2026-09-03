/**
 * Readiness rules for a bulk listing row — the single definition of "this
 * card is safe to send to eBay".
 *
 * Every route that touches an item (create, settings PATCH, item PATCH,
 * regenerate, publish) recomputes readiness through here, so the pill the
 * reviewer sees and the gate the publish button honours can never drift
 * apart. Nothing in this module reads the network or the database.
 */

import { containsBlockedGrader, findBlockedGrader } from '@/lib/ebay/gradingCompanyBlocklist';
import { containsLinkOrUrl } from '@/lib/ebay/listingDescription';

/** eBay's hard title limit. */
export const EBAY_TITLE_MAX = 80;

/** Cards per batch. Matches submissions; see plan 2E. */
export const MAX_BULK_ITEMS = 100;

export type BulkItemStatus =
  | 'draft'
  | 'ready'
  | 'queued'
  | 'uploading'
  | 'publishing'
  | 'live'
  | 'failed'
  | 'skipped'
  | 'blocked';

export type BulkBatchStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled';

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
  | 'postal_code_missing';

export interface ReadinessIssue {
  code: ReadinessCode;
  /** Short line the review table shows in the row's status pill / tooltip. */
  label: string;
}

/* ------------------------------------------------------------------ */
/* Batch-level readiness                                               */
/* ------------------------------------------------------------------ */

export type BatchReadinessCode = 'policies_incomplete';

export interface BatchReadinessIssue {
  code: BatchReadinessCode;
  label: string;
}

/** The settings fields batch readiness depends on. */
export interface BatchReadinessInput {
  policies: {
    useBusinessPolicies: boolean;
    shippingPolicyId: string | null;
    returnPolicyId: string | null;
    paymentPolicyId: string | null;
  };
}

/**
 * Everything standing between the BATCH (as opposed to a row) and eBay.
 *
 * Only business policies live here so far, and deliberately: an unchosen
 * policy is not a property of any one card, so failing it per row would show
 * the same message 100 times and let a seller "fix" it by editing a row that
 * was never wrong. Checked once, at the top, where the fix is.
 */
export function computeBatchReadiness(settings: BatchReadinessInput): BatchReadinessIssue[] {
  const p = settings.policies;
  if (!p.useBusinessPolicies) return [];

  const missing: string[] = [];
  if (!p.shippingPolicyId) missing.push('shipping');
  if (!p.returnPolicyId) missing.push('returns');
  if (!p.paymentPolicyId) missing.push('payment');
  if (missing.length === 0) return [];

  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return [
    {
      code: 'policies_incomplete',
      label: `Choose a ${list} policy in Batch settings — eBay needs all three.`,
    },
  ];
}

/**
 * The batch's format, for the copy that differs between the two. Declared
 * here rather than imported from bulkSettings so this module stays free of
 * the settings module's shipping/pricing imports.
 */
export type ListingFormat = 'FIXED_PRICE' | 'AUCTION';

/** The subset of an item row readiness depends on. */
export interface ReadinessInput {
  title?: string | null;
  price?: number | string | null;
  description_html?: string | null;
  item_specifics?: unknown;
  image_urls?: unknown;
  image_status?: string | null;
}

interface SpecificRow {
  name?: unknown;
  value?: unknown;
  required?: unknown;
}

function specificRows(raw: unknown): SpecificRow[] {
  return Array.isArray(raw) ? (raw as SpecificRow[]) : [];
}

function valueIsFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(v => typeof v === 'string' && v.trim().length > 0);
  return typeof value === 'string' && value.trim().length > 0;
}

/** How many required / recommended specifics carry a real value. */
export function specificsTally(raw: unknown): {
  requiredTotal: number;
  requiredFilled: number;
  recommendedTotal: number;
  recommendedFilled: number;
  missingRequired: string[];
} {
  let requiredTotal = 0;
  let requiredFilled = 0;
  let recommendedTotal = 0;
  let recommendedFilled = 0;
  const missingRequired: string[] = [];

  for (const row of specificRows(raw)) {
    const filled = valueIsFilled(row.value);
    if (row.required === true) {
      requiredTotal++;
      if (filled) requiredFilled++;
      else if (typeof row.name === 'string') missingRequired.push(row.name);
    } else {
      recommendedTotal++;
      if (filled) recommendedFilled++;
    }
  }

  return { requiredTotal, requiredFilled, recommendedTotal, recommendedFilled, missingRequired };
}

function toNumber(price: unknown): number | null {
  if (typeof price === 'number') return Number.isFinite(price) ? price : null;
  if (typeof price === 'string' && price.trim()) {
    const n = Number(price);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Everything standing between this row and eBay. An empty array means ready.
 *
 * The blocklist and links checks run here as well as in the item PATCH: a row
 * created before a rule existed, or edited by an older client, still has to
 * fail the gate rather than reach `publishCardListing` and 400 mid-batch.
 */
export function computeReadiness(
  item: ReadinessInput,
  listingFormat: ListingFormat = 'FIXED_PRICE',
  postalCode?: string | null
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  // Batch-level, but failed per row on purpose: eBay rejects an AddItem with
  // no ships-from location, and the publish gate is all-or-nothing — a row
  // that says "ready" while the batch cannot send it is the worse lie. The
  // fix is one field in Batch settings, which the label names.
  // `undefined` means the caller has no settings in hand (a bare recompute);
  // only an explicitly empty ZIP fails.
  if (postalCode !== undefined && !(postalCode ?? '').trim()) {
    issues.push({ code: 'postal_code_missing', label: 'Add the ZIP you ship from' });
  }

  const title = (item.title ?? '').trim();
  if (!title) {
    issues.push({ code: 'title_missing', label: 'Needs a title' });
  } else {
    if (title.length > EBAY_TITLE_MAX) {
      issues.push({ code: 'title_too_long', label: `Title is ${title.length}/${EBAY_TITLE_MAX}` });
    }
    if (containsBlockedGrader(title)) {
      issues.push({
        code: 'title_blocked_grader',
        label: `Title names "${findBlockedGrader(title)}"`,
      });
    }
    if (containsLinkOrUrl(title)) {
      issues.push({ code: 'title_link', label: 'Title contains a link' });
    }
  }

  const price = toNumber(item.price);
  if (price === null || price <= 0) {
    // Same gate either way — an auction's price column is its starting bid.
    issues.push({
      code: 'price_missing',
      label: listingFormat === 'AUCTION' ? 'Needs a starting price' : 'Needs a price',
    });
  }

  const description = (item.description_html ?? '').trim();
  if (!description) {
    issues.push({ code: 'description_missing', label: 'Needs a description' });
  } else {
    if (containsLinkOrUrl(description)) {
      issues.push({ code: 'description_link', label: 'Description contains a link' });
    }
    if (containsBlockedGrader(description)) {
      issues.push({
        code: 'description_blocked_grader',
        label: `Description names "${findBlockedGrader(description)}"`,
      });
    }
  }

  const tally = specificsTally(item.item_specifics);
  if (tally.missingRequired.length > 0) {
    issues.push({
      code: 'specifics_required',
      label: `Needs ${tally.missingRequired.slice(0, 2).join(', ')}${
        tally.missingRequired.length > 2 ? ` +${tally.missingRequired.length - 2}` : ''
      }`,
    });
  }

  const urls = Array.isArray(item.image_urls) ? item.image_urls.filter(u => typeof u === 'string') : [];
  if (item.image_status === 'failed') {
    issues.push({ code: 'images_failed', label: 'Photos failed to prepare' });
  } else if (item.image_status !== 'ready') {
    issues.push({ code: 'images_pending', label: 'Preparing photos' });
  } else if (urls.length === 0) {
    issues.push({ code: 'images_missing', label: 'Needs at least one photo' });
  }

  return issues;
}

/**
 * Statuses readiness must not touch. `skipped` (already listed) and `blocked`
 * (eBay selling limit) are decisions, not derived state, and everything from
 * `queued` on belongs to the Phase 2 drain.
 */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'skipped',
  'blocked',
  'queued',
  'uploading',
  'publishing',
  'live',
  'failed',
]);

export function isReadinessManaged(status: string | null | undefined): boolean {
  return !TERMINAL_STATUSES.has(status ?? '');
}

/** The status an editable row should hold, given its readiness. */
export function statusForReadiness(
  currentStatus: string | null | undefined,
  issues: ReadinessIssue[]
): BulkItemStatus {
  if (!isReadinessManaged(currentStatus)) return (currentStatus as BulkItemStatus) ?? 'draft';
  return issues.length === 0 ? 'ready' : 'draft';
}

/** The `readiness` + `status` columns for one item, in one call. */
export function readinessPatch(
  item: ReadinessInput & { status?: string | null },
  listingFormat: ListingFormat = 'FIXED_PRICE',
  postalCode?: string | null
): { readiness: ReadinessIssue[]; status: BulkItemStatus } {
  const readiness = computeReadiness(item, listingFormat, postalCode);
  return { readiness, status: statusForReadiness(item.status, readiness) };
}
