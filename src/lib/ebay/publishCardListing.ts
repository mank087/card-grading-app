/**
 * eBay publish (Trading API) — the whole of what POST /api/ebay/listing does
 * once the caller is authenticated and the body is parsed.
 *
 * Lifted verbatim out of the route so a second caller can drive it: the bulk
 * listing drain (Part 2 of the InstaList plan) publishes one card per queue
 * item with no HTTP request of its own. The route is now a thin wrapper —
 * auth → parse → publishCardListing → NextResponse — and every status code and
 * response body it used to produce is carried here on the failure result's
 * `body`, so the web modal and the mobile app see byte-identical payloads.
 */

import { supabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { CURRENT_DISCLAIMER_VERSION } from '@/lib/ebay/disclaimerVersion';
import {
  EBAY_CONDITIONS,
  DCM_GRADER_ID,
  getEbayGradeId,
  getEbayCategoryForDcmCategory,
} from '@/lib/ebay/constants';
import {
  addFixedPriceItem,
  addAuctionItem,
  type TradingApiConfig,
  type ListingDetails,
  type ShippingDetails,
  type ReturnDetails,
  type PackageDimensions,
  DEFAULT_DOMESTIC_SHIPPING_SERVICE,
  normalizeDomesticService,
} from '@/lib/ebay/tradingApi';
import type { EbayListing } from '@/lib/ebay/types';
import {
  resolveListingFields,
  listingDetailRows,
  buildKeywordSentence,
} from '@/lib/ebay/listingFields';
import {
  generateHtmlDescription,
  stripLinks,
  containsLinkOrUrl,
} from '@/lib/ebay/listingDescription';
import { getConditionFromGrade } from '@/lib/conditionAssessment';
import {
  containsBlockedGrader,
  findBlockedGrader,
  stripBlockedGraderSentences,
} from '@/lib/ebay/gradingCompanyBlocklist';
import { loadListingDefaults, loadBrandingByOrg } from '@/lib/ebay/bulkService';
import { resolveActiveDefaults } from '@/lib/ebay/listingDraft';
import {
  loadBusinessPolicyPrefs,
  missingPolicyIds,
  describeMissing,
  cleanPolicyId,
  type ListingPolicyIds,
} from '@/lib/ebay/businessPolicies';

export interface ItemSpecific {
  name: string;
  value: string | string[];
}

export interface CreateListingRequest {
  cardId: string;
  // Grade shown in the listing modal UI — preferred over re-deriving from card data
  grade?: number | null;
  title: string;
  description?: string;
  price: number;
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
  quantity?: number;
  bestOfferEnabled?: boolean;
  duration?: string;
  imageUrls: string[];
  itemSpecifics?: ItemSpecific[];

  // Shipping options
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED';
  domesticShippingService: string;
  flatRateAmount?: number;
  handlingDays: number;
  postalCode: string;

  // Package dimensions
  packageWeightOz: number;
  packageLengthIn: number;
  packageWidthIn: number;
  packageDepthIn: number;

  // International shipping
  offerInternational: boolean;
  internationalShippingType?: 'FLAT_RATE' | 'CALCULATED';
  internationalShippingService?: string;
  internationalFlatRateCost?: number;
  internationalShipToLocations?: string[];

  // Domestic return options
  domesticReturnsAccepted: boolean;
  domesticReturnPeriodDays?: number;
  domesticReturnShippingPaidBy?: 'BUYER' | 'SELLER';

  // International return options
  internationalReturnsAccepted: boolean;
  internationalReturnPeriodDays?: number;
  internationalReturnShippingPaidBy?: 'BUYER' | 'SELLER';

  // Regulatory documents (Certificate of Analysis, etc.)
  regulatoryDocumentIds?: string[];

  /**
   * eBay business policies, for sellers who opted in. Present means the
   * listing references the seller's saved policies and every inline shipping
   * and returns field above is ignored (eBay refuses both at once). Absent
   * means the historical inline path, which is still the default.
   *
   * Validated against the seller's stored opt-in below — a client cannot turn
   * policies on by sending this, and a seller who IS opted in cannot publish
   * without all three ids.
   */
  policies?: Partial<ListingPolicyIds>;
}

export interface ListingResponse {
  success: boolean;
  listingId?: string;
  sku: string;
  listingUrl?: string;
  status: string;
  fees?: Array<{ name: string; amount: number }>;
  warnings?: Array<{ code: string; message: string }>;
  // Set when the eBay listing was created but we failed to record it locally
  warning?: string;
  error?: string;
  errors?: Array<{ code: string; message: string }>;
  userAction?: string;
}

export interface PublishCardListingInput extends CreateListingRequest {
  /** Owner of the card and of the eBay connection the listing is created on. */
  userId: string;
  /**
   * Pre-allocated SKU. The single-card path lets us generate one; the bulk
   * drain will pass the SKU it stamped on the queue row so a retry reuses it.
   */
  sku?: string;
  /** Reserved for the bulk drain's replay guard. Not consulted yet. */
  idempotencyKey?: string;
  /** Reserved: the ebay_bulk_items row this publish belongs to. Not stored yet. */
  bulkItemId?: string;
}

export interface PublishCardListingContext {
  /** Service-role client used for the card, listing and claim rows. */
  supabase: ReturnType<typeof supabaseServer>;
  /** Client used for the disclaimer read; defaults to supabaseAdmin. */
  admin?: typeof supabaseAdmin;
}

export type PublishErrorCode =
  | 'no_connection'
  | 'token_refresh_failed'
  | 'disclaimer_required'
  | 'missing_fields'
  | 'invalid_postal_code'
  | 'card_not_found'
  | 'forbidden'
  | 'already_listed'
  | 'no_grade'
  | 'blocked_grader_title'
  | 'link_in_title'
  | 'link_in_description'
  | 'policies_not_enabled'
  | 'policies_incomplete'
  | 'policies_invalid'
  | 'claim_insert_failed'
  | 'ebay_error';

export type PublishCardListingResult =
  | { ok: true; listing: ListingResponse }
  | {
      ok: false;
      status: number;
      code: PublishErrorCode;
      message: string;
      details?: Record<string, unknown>;
      /**
       * The exact JSON body the HTTP route returns. The web modal and the
       * mobile client both read specific keys off these payloads (`error`,
       * `userAction`, `existingListing`, `errors`), so the shapes are carried
       * whole rather than rebuilt at the route.
       */
      body: Record<string, unknown>;
    };

/** eBay's hard title limit. */
const MAX_TITLE_LENGTH = 80;

/**
 * Trim a client-supplied title to eBay's 80 characters at a WORD boundary —
 * the same rule titleBuilder's overflow path uses, so a truncated title never
 * ends mid-word.
 */
function capTitle(raw: string): string {
  const title = raw.replace(/\s+/g, ' ').trim();
  if (title.length <= MAX_TITLE_LENGTH) return title;
  const cut = title.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Description used when the client sends none (older mobile builds, retries).
 * The standard layout off the shared resolver — same card details, grade block
 * and trust copy the modal produces, minus the shipping summary (the form
 * values live on the request, not the card).
 */
async function buildFallbackDescription(
  card: any,
  grade: number,
  supabase: ReturnType<typeof supabaseServer>,
  userId: string
): Promise<string> {
  const fields = resolveListingFields(card);
  const weighted = card.conversational_weighted_sub_scores || {};
  const sub = card.conversational_sub_scores || {};
  const wholeGrade = Math.round(grade);

  // The seller's own grade label and store banner, resolved exactly as
  // buildListingDraft resolves them — cross-org guard included, so a member of
  // org A listing a card graded by org B gets personal defaults rather than
  // A's brand on B's card. Both loads are narrow single-row reads.
  const defaults = await loadListingDefaults(supabase, userId);
  const gradeLabel = resolveActiveDefaults(card, defaults)?.titleGradeLabel || null;
  const brandedOrgId =
    card.org_id && defaults.orgId === card.org_id ? (card.org_id as string) : null;
  const branding = brandedOrgId
    ? (await loadBrandingByOrg([brandedOrgId])).get(brandedOrgId) ?? null
    : null;

  return generateHtmlDescription({
    primaryName: fields.name,
    setName: fields.setName,
    cardNumber: fields.cardNumber,
    grade: wholeGrade,
    conditionLabel: fields.conditionLabel || getConditionFromGrade(wholeGrade),
    overview: card.conversational_final_grade_summary || '',
    subgrades: {
      centering: Math.round(weighted.centering ?? sub.centering?.weighted ?? 0),
      corners: Math.round(weighted.corners ?? sub.corners?.weighted ?? 0),
      edges: Math.round(weighted.edges ?? sub.edges?.weighted ?? 0),
      surface: Math.round(weighted.surface ?? sub.surface?.weighted ?? 0),
    },
    serial: fields.serial || 'N/A',
    fields,
    details: listingDetailRows(fields),
    keywords: buildKeywordSentence(fields, gradeLabel || 'DCM', wholeGrade),
    ...(gradeLabel ? { gradeLabel } : {}),
  }, branding);
}

/**
 * Map eBay error codes/messages to user-friendly error messages
 * with actionable guidance
 */
export function getEbayErrorDetails(error: { code?: string; message?: string }): {
  userMessage: string;
  userAction?: string;
} {
  const code = error?.code || '';
  const message = error?.message?.toLowerCase() || '';

  // Seller account not set up (code 120)
  if (code === '120' || message.includes('seller') && message.includes('account')) {
    return {
      userMessage: 'Your eBay seller account needs to be set up before you can create listings.',
      userAction: 'Please visit eBay.com → My eBay → Selling to complete your seller account setup. You may need to add a payment method and verify your identity.',
    };
  }

  // Account restrictions/suspensions
  if (message.includes('restriction') || message.includes('suspended') || message.includes('blocked')) {
    return {
      userMessage: 'Your eBay account has restrictions that prevent listing.',
      userAction: 'Please check your eBay account status and resolve any outstanding issues at eBay.com → My eBay → Account.',
    };
  }

  // Payment method issues
  if (message.includes('payment') || message.includes('paypal') || message.includes('managed payments')) {
    return {
      userMessage: 'Your eBay payment method needs to be configured.',
      userAction: 'Please set up or verify your payment method in eBay Seller Hub → Payments.',
    };
  }

  // Category-specific restrictions
  if (message.includes('category') || message.includes('approval') || message.includes('permission')) {
    return {
      userMessage: 'This item category requires special approval on eBay.',
      userAction: 'Some categories require seller approval. Check eBay\'s category requirements or try a different category.',
    };
  }

  // Verification required
  if (message.includes('verify') || message.includes('verification') || message.includes('identity')) {
    return {
      userMessage: 'eBay requires additional verification for your account.',
      userAction: 'Please complete the identity verification process at eBay.com → My eBay → Account.',
    };
  }

  // Default: return original message
  return {
    userMessage: error?.message || 'Failed to create eBay listing.',
    userAction: undefined,
  };
}

/**
 * Generate a unique SKU for the listing
 */
export function generateSku(cardId: string, userId: string): string {
  const timestamp = Date.now().toString(36);
  const shortUserId = userId.slice(0, 8);
  return `DCM-${shortUserId}-${cardId.slice(0, 8)}-${timestamp}`.toUpperCase();
}

/**
 * Get eBay category ID for a card.
 * Case-insensitive lookup against DCM_TO_EBAY_CATEGORY (single source of
 * truth in constants.ts); unknown categories fall back to Non-Sport (183050).
 */
function getEbayCategoryId(category: string): string {
  return getEbayCategoryForDcmCategory(category);
}

/**
 * Map listing duration to Trading API format.
 *
 * Fixed-price listings are ALWAYS coerced to GTC: eBay removed non-GTC
 * durations for fixed-price listings in 2019, so AddFixedPriceItem rejects
 * (or silently converts) 3/5/7/10/30-day values. Only auctions may run
 * 1-10 days; auction durations pass through untouched.
 */
function mapListingDuration(duration: string | undefined, listingFormat: 'FIXED_PRICE' | 'AUCTION'): string {
  if (listingFormat !== 'AUCTION') {
    return 'GTC';
  }
  switch (duration) {
    case 'DAYS_1': return 'Days_1';
    case 'DAYS_3': return 'Days_3';
    case 'DAYS_5': return 'Days_5';
    case 'DAYS_7': return 'Days_7';
    case 'DAYS_10': return 'Days_10';
    case 'DAYS_30': return 'Days_30';
    case 'GTC':
    default:
      return 'GTC';
  }
}

// A 'pending' row with no listing_id is a pre-eBay claim (see publishCardListing
// below). If the request that created it crashed before activating or deleting
// it, the claim would block the card from ever being listed — treat claims
// older than this as abandoned and clean them up.
//
// Exported because the bulk drain's own stale-lock window has to sit BEHIND
// this one: a drain that requeues a dead publish before its pending claim has
// aged out finds its own abandoned claim on the retry and reports the card as
// "already listed".
export const STALE_CLAIM_MS = 15 * 60 * 1000;

/**
 * The statuses that block a card from being listed again. Exported so the
 * bulk batch dedupe cannot quietly widen or narrow the set — a batch that
 * skipped a different set of cards than the publish path would refuse is the
 * bug this constant exists to prevent.
 */
export const BLOCKING_LISTING_STATUSES = ['active', 'pending'] as const;

export interface ExistingListingRow {
  id: string;
  listing_id: string | null;
  listing_url: string | null;
  status: string;
  created_at: string;
}

export const EXISTING_LISTING_COLUMNS = 'id, listing_id, listing_url, status, created_at';

/**
 * A 'pending' row with no listing_id whose request never finished. Left alone
 * it blocks the card from ever being listed again.
 */
export function isStaleClaim(row: ExistingListingRow): boolean {
  return (
    row.status === 'pending' &&
    !row.listing_id &&
    Date.now() - new Date(row.created_at).getTime() > STALE_CLAIM_MS
  );
}

/**
 * Delete abandoned pending claims for these cards. The single-card path calls
 * this implicitly through findActiveOrPendingListing; the bulk batch runs it
 * ONCE over the whole selection before its own dedupe query, so 100 cards
 * cost one reap instead of 100.
 */
export async function reapStaleClaims(
  supabase: ReturnType<typeof supabaseServer>,
  userId: string,
  cardIds: string[]
): Promise<number> {
  if (cardIds.length === 0) return 0;
  const { data: rows } = await supabase
    .from('ebay_listings')
    .select(EXISTING_LISTING_COLUMNS)
    .eq('user_id', userId)
    .in('card_id', cardIds)
    .in('status', BLOCKING_LISTING_STATUSES as unknown as string[]);

  const stale = ((rows ?? []) as ExistingListingRow[]).filter(isStaleClaim);
  if (stale.length === 0) return 0;
  await supabase
    .from('ebay_listings')
    .delete()
    .in('id', stale.map(r => r.id));
  return stale.length;
}

/**
 * Find a live (active/pending) listing row for this card, cleaning up any
 * abandoned pending claims along the way. Returns the blocking row, or null
 * if the card is free to list.
 */
export async function findActiveOrPendingListing(
  supabase: ReturnType<typeof supabaseServer>,
  cardId: string,
  userId: string
): Promise<ExistingListingRow | null> {
  const { data: rows } = await supabase
    .from('ebay_listings')
    .select(EXISTING_LISTING_COLUMNS)
    .eq('card_id', cardId)
    .eq('user_id', userId)
    .in('status', BLOCKING_LISTING_STATUSES as unknown as string[])
    .order('created_at', { ascending: false })
    .limit(10);

  const staleClaims = ((rows ?? []) as ExistingListingRow[]).filter(isStaleClaim);
  if (staleClaims.length > 0) {
    await supabase
      .from('ebay_listings')
      .delete()
      .in('id', staleClaims.map(r => r.id));
  }

  return ((rows ?? []) as ExistingListingRow[]).find(r => !isStaleClaim(r)) ?? null;
}

function conflictFailure(existingListing: ExistingListingRow): PublishCardListingResult {
  const existing = {
    listingId: existingListing.listing_id,
    listingUrl: existingListing.listing_url,
    status: existingListing.status,
  };
  return {
    ok: false,
    status: 409, // Conflict
    code: 'already_listed',
    message: 'This card already has an active eBay listing',
    details: { existingListing: existing },
    body: {
      error: 'This card already has an active eBay listing',
      existingListing: existing,
    },
  };
}

/** Failure with a plain `{ error }` body — the shape most of the gates use. */
function simpleFailure(
  status: number,
  code: PublishErrorCode,
  message: string
): PublishCardListingResult {
  return { ok: false, status, code, message, body: { error: message } };
}

export async function publishCardListing(
  input: PublishCardListingInput,
  ctx: PublishCardListingContext
): Promise<PublishCardListingResult> {
  const supabase = ctx.supabase;
  const admin = ctx.admin ?? supabaseAdmin;
  const userId = input.userId;

  // Get eBay connection and refresh token if needed
  let connection = await getConnectionForUser(userId);
  if (!connection) {
    return simpleFailure(400, 'no_connection', 'No eBay account connected');
  }

  // Refresh token if needed
  connection = await refreshTokenIfNeeded(connection);
  if (!connection) {
    return simpleFailure(
      401,
      'token_refresh_failed',
      'Failed to refresh eBay authorization. Please reconnect your account.'
    );
  }

  // Enforce disclaimer acceptance SERVER-SIDE before any listing is created.
  // Web enforces this client-side and mobile historically didn't at all —
  // this check is the durable gate for both platforms. Reads the same
  // ebay_connections columns that /api/ebay/disclaimer reads/writes.
  const { data: disclaimerRow } = await admin
    .from('ebay_connections')
    .select('disclaimer_accepted_at, disclaimer_version')
    .eq('user_id', userId)
    .maybeSingle();

  const disclaimerAccepted =
    !!disclaimerRow?.disclaimer_accepted_at &&
    disclaimerRow.disclaimer_version === CURRENT_DISCLAIMER_VERSION;

  if (!disclaimerAccepted) {
    const message =
      'You must accept the InstaList seller disclaimer before creating eBay listings.';
    return {
      ok: false,
      status: 412, // Precondition Failed
      code: 'disclaimer_required',
      message,
      body: { error: 'disclaimer_required', message },
    };
  }

  const {
    cardId,
    grade: passedGrade,  // Grade passed from modal (preferred)
    title,
    description: rawDescription,
    price,
    listingFormat = 'FIXED_PRICE',
    quantity = 1,
    bestOfferEnabled = false,
    duration,
    imageUrls,
    itemSpecifics = [],
    // Shipping
    shippingType = 'CALCULATED',
    domesticShippingService = DEFAULT_DOMESTIC_SHIPPING_SERVICE,
    flatRateAmount = 5.00,
    handlingDays = 1,
    postalCode = '10001',
    // Package dimensions (defaults for small bubble mailer)
    packageWeightOz = 4,
    packageLengthIn = 10,
    packageWidthIn = 6,
    packageDepthIn = 1,
    // International shipping
    offerInternational = false,
    internationalShippingType = 'CALCULATED',
    internationalShippingService = 'USPSPriorityMailInternational',
    internationalFlatRateCost = 15.00,
    internationalShipToLocations = ['Worldwide'],
    // Domestic returns
    domesticReturnsAccepted = false,
    domesticReturnPeriodDays = 30,
    domesticReturnShippingPaidBy = 'BUYER',
    // International returns
    internationalReturnsAccepted = false,
    internationalReturnPeriodDays = 30,
    internationalReturnShippingPaidBy = 'BUYER',
    // Regulatory documents
    regulatoryDocumentIds = [],
    // Business policies (opt-in sellers only; validated after the card loads)
    policies: requestedPolicies,
  } = input;

  console.log('[eBay Listing] listingFormat received:', listingFormat, '| raw body listingFormat:', input.listingFormat);

  // Validate required fields
  if (!cardId || !title || !price || !imageUrls?.length) {
    return simpleFailure(
      400,
      'missing_fields',
      'Missing required fields: cardId, title, price, imageUrls'
    );
  }

  // Validate postal code
  if (!postalCode || postalCode.length < 5) {
    return simpleFailure(400, 'invalid_postal_code', 'Valid postal code is required for shipping');
  }

  // Fetch card data
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .single();

  if (cardError || !card) {
    console.error('[eBay Listing] Card not found:', cardId, cardError?.message);
    return simpleFailure(404, 'card_not_found', 'Card not found');
  }

  // Verify card belongs to user
  if (card.user_id !== userId) {
    return simpleFailure(403, 'forbidden', 'Unauthorized to list this card');
  }

  // -------- Business policies: opt-in state is the server's, not the client's
  //
  // Two failure modes, both 400 with a code the caller can act on:
  //   - a client sent policy ids while the seller is NOT opted in. Sending
  //     SellerProfiles for an account outside the SELLING_POLICY_MANAGEMENT
  //     program is rejected by eBay with a message no seller can decode, so it
  //     is refused here with one they can.
  //   - the seller IS opted in but an id is missing. eBay would otherwise
  //     receive a half-filled SellerProfiles block, and a listing published
  //     with no return profile is a listing whose terms nobody chose.
  // Personal row only: the eBay connection is this user's, so the policy ids
  // that exist are this user's. See loadBusinessPolicyPrefs.
  const policyPrefs = await loadBusinessPolicyPrefs(supabase, userId);
  // Client-supplied, so shape-checked before it can reach the XML (escapeXml
  // is the last line of defence, not the first). A malformed id is rejected
  // rather than dropped: silently ignoring it would publish the listing
  // against the seller's SAVED default, which is not what they asked for.
  const sentAny =
    !!requestedPolicies &&
    Object.values(requestedPolicies).some(v => typeof v === 'string' && v.trim());
  const sentPolicies = sentAny;

  if (sentAny) {
    const malformed = (['shippingPolicyId', 'returnPolicyId', 'paymentPolicyId'] as const).filter(
      key => {
        const raw = requestedPolicies?.[key];
        return typeof raw === 'string' && raw.trim() !== '' && cleanPolicyId(raw) === null;
      }
    );
    if (malformed.length > 0) {
      return simpleFailure(
        400,
        'policies_invalid',
        `Not a valid eBay policy id: ${malformed.join(', ')}. ` +
          'Re-pick the policy and try again.'
      );
    }
  }

  if (sentPolicies && !policyPrefs.useBusinessPolicies) {
    return simpleFailure(
      400,
      'policies_not_enabled',
      'This account is not set up to use eBay business policies. ' +
        'Turn them on in InstaList settings first, or list with inline shipping and returns.'
    );
  }

  let policies: ListingPolicyIds | undefined;
  if (policyPrefs.useBusinessPolicies) {
    // Fall back to the seller's saved defaults for anything the caller left
    // out: an older client (mobile) that knows nothing about policies must
    // still produce the listing this seller asked for, not an inline one.
    const resolved = {
      shippingPolicyId: cleanPolicyId(requestedPolicies?.shippingPolicyId) || policyPrefs.shippingPolicyId || '',
      returnPolicyId: cleanPolicyId(requestedPolicies?.returnPolicyId) || policyPrefs.returnPolicyId || '',
      paymentPolicyId: cleanPolicyId(requestedPolicies?.paymentPolicyId) || policyPrefs.paymentPolicyId || '',
    };
    const missing = missingPolicyIds(resolved);
    if (missing.length > 0) {
      return simpleFailure(
        400,
        'policies_incomplete',
        `Choose a ${describeMissing(missing)} policy before listing — ` +
          'eBay needs all three when your account uses business policies.'
      );
    }
    policies = resolved;
  }

  // Check if card already has an active eBay listing.
  // NOTE: deliberately NOT .single() — with multiple matching rows,
  // .single() errors and the (discarded) error made the check silently
  // pass, which is exactly the double-listing case we're guarding against.
  const conflictingListing = await findActiveOrPendingListing(supabase, cardId, userId);
  if (conflictingListing) {
    return conflictFailure(conflictingListing);
  }

  // Generate SKU (the bulk drain may hand us one it already stamped on the row)
  const sku = input.sku || generateSku(cardId, userId);

  // Get eBay category
  const categoryId = getEbayCategoryId(card.category);

  // Get grade for condition descriptors
  // PREFERRED: Use grade passed from modal (same grade shown in UI)
  // FALLBACK: Check multiple sources in the card data
  // REJECT: if no positive grade resolves anywhere, refuse to list rather
  // than fabricating a grade — the old `?? 1` fallback published ungraded
  // cards to eBay as "Grade 1".
  let grade: number | null = null;

  if (passedGrade !== null && passedGrade !== undefined && passedGrade > 0) {
    // Use grade passed from modal - this is the same grade displayed in the UI
    grade = passedGrade;
  } else {
    // Fallback: look up grade from card data
    const dvgGrading = card.ai_grading?.dvg_grading;
    const recommendedGrade = dvgGrading?.recommended_grade;
    const gradeCandidates = [
      card.grade,
      card.conversational_whole_grade,
      card.conversational_decimal_grade,
      card.dvg_whole_grade,
      card.dvg_decimal_grade,
      recommendedGrade?.recommended_whole_grade,
      recommendedGrade?.recommended_decimal_grade,
      card.dcm_grade_whole,
      card.dcm_grade_decimal,
    ];
    for (const candidate of gradeCandidates) {
      const n = Number(candidate);
      if (Number.isFinite(n) && n > 0) {
        grade = n;
        break;
      }
    }
  }

  if (grade === null) {
    return simpleFailure(
      400,
      'no_grade',
      'This card has no grade on file — regrade it or contact support before listing.'
    );
  }

  // Last gate before the listing leaves us. The title and description are
  // client-supplied (web modal, mobile, and any retry that replays an old
  // payload), so the rival-grader rule is enforced HERE as well as in the
  // builders — eBay pulls listings for keyword spamming and a graded-card
  // title naming another grader reads as a grade-equivalence claim.
  if (containsBlockedGrader(title)) {
    return simpleFailure(
      400,
      'blocked_grader_title',
      `Title can't name another grading company ("${findBlockedGrader(title)}"). ` +
        'Remove it and try again.'
    );
  }
  // eBay's links policy forbids links AND bare web addresses anywhere in a
  // listing, and a title is entirely seller-typed — there is nothing to repair
  // in 80 characters, so it is refused with the reason.
  if (containsLinkOrUrl(title)) {
    return simpleFailure(
      400,
      'link_in_title',
      "eBay doesn't allow web addresses, links or email addresses in a listing title. " +
        'Remove it and try again.'
    );
  }
  // eBay rejects a title over 80 characters at AddItem time. The builders keep
  // within it, but a client can send anything — cut at a word boundary, the
  // same way titleBuilder's overflow path does, rather than failing the listing.
  const listingTitle = capTitle(title);

  // The description is repaired rather than rejected where it can be: it is
  // mostly generated text, and dropping the offending sentence (or the URL)
  // loses less than blocking the whole listing over one word in a grade
  // summary. Anything that SURVIVES the repair is seller-typed in a shape we
  // can't safely edit, and that is refused.
  const description = rawDescription
    ? stripLinks(stripBlockedGraderSentences(rawDescription))
    : rawDescription;
  if (description && containsLinkOrUrl(description)) {
    return simpleFailure(
      400,
      'link_in_description',
      "eBay doesn't allow web addresses, links or email addresses in a listing description. " +
        'Remove it and try again.'
    );
  }

  const gradeId = getEbayGradeId(grade);

  // Prepare Trading API config
  const tradingConfig: TradingApiConfig = {
    accessToken: connection.access_token,
    sandbox: connection.is_sandbox,
  };

  // Prepare listing details
  const listingDetails: ListingDetails = {
    title: listingTitle,
    // Fallback description (the client normally sends one). Built from the
    // shared field resolver so even this path carries the card's details
    // rather than a one-line stub.
    description: description || (await buildFallbackDescription(card, grade, supabase, userId)),
    categoryId,
    price,
    listingFormat,
    quantity: listingFormat === 'AUCTION' ? 1 : quantity,
    conditionId: EBAY_CONDITIONS.GRADED,
    imageUrls,
    itemSpecifics: itemSpecifics.map(spec => ({
      name: spec.name,
      value: spec.value,
    })),
    sku,
    // Fixed price is coerced to GTC inside mapListingDuration (eBay requirement)
    listingDuration: mapListingDuration(duration, listingFormat),
    bestOfferEnabled,
    // Graded card specific
    professionalGrader: DCM_GRADER_ID,  // '2750123' = "Other" grader
    grade: gradeId,                      // eBay grade value ID (e.g., '275020' for grade 10)
    // Certification number: DCM serial (REQUIRED by eBay for "Other" grader)
    certificationNumber: (() => {
      const serial = card.serial?.trim();
      const fallback = cardId.replace(/-/g, '').slice(0, 12).toUpperCase();
      return serial && serial.length > 0 ? serial : fallback;
    })(),
    // Regulatory documents (Certificate of Analysis)
    regulatoryDocumentIds: regulatoryDocumentIds.length > 0 ? regulatoryDocumentIds : undefined,
    // Present only for opt-in sellers; suppresses every inline shipping and
    // returns tag in the XML (see buildSellerProfilesXml).
    policies,
  };

  // Prepare package dimensions
  const packageDimensions: PackageDimensions = {
    weightOz: packageWeightOz,
    lengthIn: packageLengthIn,
    widthIn: packageWidthIn,
    depthIn: packageDepthIn,
  };

  // Prepare shipping details
  const shippingDetails: ShippingDetails = {
    shippingType,
    // Saved defaults can still carry retired tokens (e.g. USPSFirstClass) —
    // map them forward rather than sending eBay something it will reject.
    domesticShippingService: normalizeDomesticService(domesticShippingService),
    flatRateCost: flatRateAmount,
    handlingDays,
    postalCode,
    packageDimensions,
    // International shipping
    offerInternational,
    internationalShippingType: offerInternational ? internationalShippingType : undefined,
    internationalShippingService: offerInternational ? internationalShippingService : undefined,
    internationalFlatRateCost: offerInternational && internationalShippingType === 'FLAT_RATE' ? internationalFlatRateCost : undefined,
    internationalShipToLocations: offerInternational ? internationalShipToLocations : undefined,
  };

  // Prepare return details
  const returnDetails: ReturnDetails = {
    domesticReturnsAccepted,
    domesticReturnPeriodDays: domesticReturnsAccepted ? domesticReturnPeriodDays : undefined,
    domesticReturnShippingPaidBy: domesticReturnsAccepted ? domesticReturnShippingPaidBy : undefined,
    internationalReturnsAccepted,
    internationalReturnPeriodDays: internationalReturnsAccepted ? internationalReturnPeriodDays : undefined,
    internationalReturnShippingPaidBy: internationalReturnsAccepted ? internationalReturnShippingPaidBy : undefined,
  };

  // -------- Double-listing race guard (claim flow) --------
  // Re-check for a live row IMMEDIATELY before hitting eBay — the earlier
  // check ran before grade/category/detail prep, and a concurrent request
  // for the same card could have won the race in the meantime.
  const lastMomentConflict = await findActiveOrPendingListing(supabase, cardId, userId);
  if (lastMomentConflict) {
    return conflictFailure(lastMomentConflict);
  }

  // Insert a 'pending' claim row BEFORE calling eBay. Concurrent requests
  // for the same card now see this row in their pre-flight check and 409
  // instead of creating a second eBay listing. The claim is promoted to
  // 'active' with the real item ID once eBay succeeds, or deleted if eBay
  // fails. my-listings/stats already treat 'pending' like 'active', and
  // sync ignores rows without a listing_id, so a short-lived claim is
  // harmless to those consumers; abandoned claims (crashed requests) are
  // reaped after STALE_CLAIM_MS by findActiveOrPendingListing.
  const claimRecord: Partial<EbayListing> = {
    card_id: cardId,
    user_id: userId,
    sku: sku,
    // The row records what we actually sent eBay, capped title included.
    title: listingTitle,
    description: description || null,
    price: price,
    currency: 'USD',
    quantity: quantity,
    listing_format: listingFormat,
    // Persist what we actually sent to eBay: fixed price is always GTC
    duration: listingFormat === 'AUCTION' ? (duration || 'GTC') : 'GTC',
    category_id: categoryId,
    ebay_image_urls: imageUrls,
    // eBay's own column names: the fulfillment policy is the shipping one.
    fulfillment_policy_id: policies?.shippingPolicyId ?? null,
    return_policy_id: policies?.returnPolicyId ?? null,
    payment_policy_id: policies?.paymentPolicyId ?? null,
    status: 'pending',
  };

  const { data: claimRow, error: claimError } = await supabase
    .from('ebay_listings')
    .insert(claimRecord)
    .select('id')
    .single();

  if (claimError || !claimRow) {
    // Nothing exists on eBay yet, so failing fast here is safe.
    console.error('[eBay Listing] Failed to insert pending claim row:', claimError);
    return simpleFailure(
      500,
      'claim_insert_failed',
      'Failed to prepare the listing record. Please try again.'
    );
  }

  // Create listing via Trading API
  const createListing = (ship: ShippingDetails) => listingFormat === 'AUCTION'
    ? addAuctionItem(tradingConfig, listingDetails, ship, returnDetails)
    : addFixedPriceItem(tradingConfig, listingDetails, ship, returnDetails);

  let result = await createListing(shippingDetails);

  // Safety net: if eBay rejects the shipping block while we're sending
  // USPSGroundAdvantage (e.g. an API schema-version mismatch — the exact
  // failure customers hit on Aug 31 2026), retry ONCE with USPSPriority
  // rather than failing the listing over the shipping service choice.
  // Skipped entirely for a business-policy listing: no ShippingDetails was
  // sent, so the service token is not what eBay is complaining about.
  const shippingRejected = !policies && !result.success && (result.errors || []).some(e =>
    /shippingdetails|shipping\s*service/i.test(e.message || ''));
  if (shippingRejected && shippingDetails.domesticShippingService === 'USPSGroundAdvantage') {
    console.warn('[eBay Listing] eBay rejected ShippingDetails with USPSGroundAdvantage — retrying once with USPSPriority', result.errors);
    result = await createListing({ ...shippingDetails, domesticShippingService: 'USPSPriority' });
  }

  if (!result.success) {
    // Release the claim — nothing was created on eBay.
    await supabase.from('ebay_listings').delete().eq('id', claimRow.id);

    console.error('[eBay Listing] Trading API error:', result.errors);

    // Map eBay error to user-friendly message with actionable guidance
    const firstError = result.errors?.[0];
    const errorDetails = getEbayErrorDetails(firstError || {});

    return {
      ok: false,
      status: 400,
      code: 'ebay_error',
      message: errorDetails.userMessage,
      details: {
        userAction: errorDetails.userAction,
        errors: result.errors,
        sku,
      },
      body: {
        success: false,
        error: errorDetails.userMessage,
        userAction: errorDetails.userAction,
        errors: result.errors,
        sku,
        status: 'error',
      },
    };
  }

  // Promote the claim to an active listing with the real eBay identifiers
  const activationUpdate = {
    listing_id: result.itemId,
    listing_url: result.listingUrl,
    status: 'active' as const,
    published_at: new Date().toISOString(),
  };

  let { error: saveError } = await supabase
    .from('ebay_listings')
    .update(activationUpdate)
    .eq('id', claimRow.id);

  if (saveError) {
    // The eBay listing exists — retry once before surfacing to the user.
    console.error('[eBay Listing] Failed to activate listing record (retrying once):', saveError);
    ({ error: saveError } = await supabase
      .from('ebay_listings')
      .update(activationUpdate)
      .eq('id', claimRow.id));
  }

  let warning: string | undefined;
  if (saveError) {
    console.error(
      `[eBay Listing] CRITICAL: eBay item ${result.itemId} was created but could not be recorded in ebay_listings after retry. User ${userId}, card ${cardId}, SKU ${sku}:`,
      saveError
    );
    warning = `Your listing was created on eBay (item ${result.itemId}) but could not be recorded in DCM — please contact support so we can link it to your account.`;
  }

  const listing: ListingResponse = {
    success: true,
    sku,
    listingId: result.itemId,
    listingUrl: result.listingUrl,
    status: 'active',
    fees: result.fees,
    warnings: result.warnings,
    ...(warning ? { warning } : {}),
  };

  return { ok: true, listing };
}
