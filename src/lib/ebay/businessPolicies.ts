/**
 * eBay business policies — the seller-account side of InstaList Phase 3.
 *
 * Two ways exist to tell eBay how an item ships and returns:
 *   1. INLINE, on every listing (`ShippingDetails` / `ReturnPolicy` /
 *      `DispatchTimeMax` in the Trading API call). This is what DCM has always
 *      done, and it is what a seller who never opts in keeps doing.
 *   2. BUSINESS POLICIES — named, reusable policies saved on the eBay account,
 *      referenced by id from `Item.SellerProfiles`.
 *
 * Opting in is account-wide on eBay's side (the SELLING_POLICY_MANAGEMENT
 * program), which is why the toggle is off by default and gated behind an
 * explicit confirmation: it changes how the seller's whole eBay account
 * behaves, not just the listings DCM creates. Existing listings are untouched.
 *
 * This module owns the Account API calls (fetch + create) and the seller's
 * stored preference, so the routes stay thin and the publish path has ONE
 * definition of "does this seller use policies, and which ones".
 */

import { EBAY_API_URLS, MARKETPLACES } from '@/lib/ebay/constants';
import { isMissingColumnError } from '@/lib/cards/ownership';

/** Only EBAY_US is wired through the listing path today. */
export const POLICY_MARKETPLACE: string = MARKETPLACES.US;

/**
 * Our vocabulary vs eBay's. eBay calls the shipping one a "fulfillment"
 * policy; sellers (and every screen in Seller Hub) call it shipping. The
 * client speaks `shipping` / `returns` / `payment`; the wire speaks
 * `fulfillment` / `return` / `payment`.
 */
export type PolicyKind = 'shipping' | 'returns' | 'payment';

const EBAY_POLICY_PATH: Record<PolicyKind, 'fulfillment' | 'return' | 'payment'> = {
  shipping: 'fulfillment',
  returns: 'return',
  payment: 'payment',
};

export interface PolicySummary {
  id: string;
  name: string;
  /** One line describing what the policy does, for the dropdown's helper text. */
  summary: string;
}

export interface PolicyLists {
  shipping: PolicySummary[];
  returns: PolicySummary[];
  payment: PolicySummary[];
}

/* ------------------------------------------------------------------ */
/* Account API plumbing                                                */
/* ------------------------------------------------------------------ */

function apiBase(sandbox: boolean): string {
  return sandbox ? EBAY_API_URLS.sandbox.api : EBAY_API_URLS.production.api;
}

/**
 * eBay error payloads, flattened to one sentence. Same shape the legacy
 * /api/ebay/policies/create route parses; kept here so both the fetch and the
 * create paths report failures the same way.
 */
export function parseEbayApiError(errorText: string, status: number): string {
  try {
    const json = JSON.parse(errorText);
    const first = Array.isArray(json.errors) ? json.errors[0] : null;
    if (first) {
      const message = first.longMessage || first.message || `Error ${first.errorId || status}`;
      const params = Array.isArray(first.parameters) && first.parameters.length
        ? ` (${first.parameters.map((p: any) => `${p.name}: ${p.value}`).join(', ')})`
        : '';
      return `${message}${params}`;
    }
    if (json.error) return json.error.message || json.error.description || `Error ${status}`;
    if (json.error_description) return json.error_description;
  } catch {
    /* not JSON — fall through */
  }
  return errorText ? `Status ${status}: ${errorText.slice(0, 150)}` : `HTTP ${status} error`;
}

async function accountApi(
  path: string,
  accessToken: string,
  sandbox: boolean,
  init: { method?: string; body?: object } = {}
): Promise<Response> {
  return fetch(`${apiBase(sandbox)}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // Required on every Account API write; harmless on reads.
      'Content-Language': 'en-US',
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Reading the seller's policies                                       */
/* ------------------------------------------------------------------ */

/** Cost / handling / service, in one line. */
function summarizeFulfillment(p: any): string {
  const parts: string[] = [];
  const option = (p.shippingOptions ?? []).find((o: any) => o.optionType === 'DOMESTIC')
    ?? (p.shippingOptions ?? [])[0];
  const service = option?.shippingServices?.[0];
  if (service?.freeShipping) {
    parts.push('Free shipping');
  } else if (service?.shippingCost?.value !== undefined) {
    parts.push(`$${Number(service.shippingCost.value).toFixed(2)} shipping`);
  } else if (option?.costType === 'CALCULATED') {
    parts.push('Calculated at checkout');
  }
  if (p.handlingTime?.value !== undefined) {
    const n = Number(p.handlingTime.value);
    parts.push(n <= 0 ? 'same-day handling' : `${n}-day handling`);
  }
  if (p.globalShipping) parts.push('global shipping');
  return parts.join(' · ') || 'Shipping policy';
}

function summarizeReturn(p: any): string {
  if (!p.returnsAccepted) return 'No returns accepted';
  const days = p.returnPeriod?.value;
  const payer = p.returnShippingCostPayer === 'SELLER' ? 'seller pays return shipping' : 'buyer pays return shipping';
  return `${days ? `${days}-day returns` : 'Returns accepted'} · ${payer}`;
}

function summarizePayment(p: any): string {
  return p.immediatePay ? 'Immediate payment required' : 'Standard managed payments';
}

/**
 * Every policy of one kind on the seller's US account.
 *
 * A failure is thrown rather than swallowed: the dropdowns this feeds are the
 * ONLY way to pick a policy, and an empty list that silently means "eBay said
 * no" reads to the seller as "you have no policies" and sends them off to
 * create duplicates on eBay.
 */
async function fetchPolicyKind(
  kind: PolicyKind,
  accessToken: string,
  sandbox: boolean
): Promise<PolicySummary[]> {
  const wire = EBAY_POLICY_PATH[kind];
  const response = await accountApi(
    `/sell/account/v1/${wire}_policy?marketplace_id=${POLICY_MARKETPLACE}`,
    accessToken,
    sandbox
  );

  if (!response.ok) {
    const text = await response.text();
    throw new PolicyApiError(parseEbayApiError(text, response.status), response.status);
  }

  const data = await response.json();
  const rows: any[] = data[`${wire}Policies`] ?? [];
  return rows.map(p => ({
    id: String(p[`${wire}PolicyId`] ?? p.policyId ?? ''),
    name: String(p.name ?? 'Untitled policy'),
    summary:
      kind === 'shipping' ? summarizeFulfillment(p)
      : kind === 'returns' ? summarizeReturn(p)
      : summarizePayment(p),
  })).filter(p => p.id);
}

export class PolicyApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PolicyApiError';
  }
}

export async function fetchAllPolicies(accessToken: string, sandbox: boolean): Promise<PolicyLists> {
  const [shipping, returns, payment] = await Promise.all([
    fetchPolicyKind('shipping', accessToken, sandbox),
    fetchPolicyKind('returns', accessToken, sandbox),
    fetchPolicyKind('payment', accessToken, sandbox),
  ]);
  return { shipping, returns, payment };
}

/* ------------------------------------------------------------------ */
/* Creating a policy                                                   */
/* ------------------------------------------------------------------ */

export interface CreateShippingPolicyInput {
  kind: 'shipping';
  name: string;
  /** A DOMESTIC_SHIPPING_SERVICES value, e.g. USPSGroundAdvantage. */
  service: string;
  /** Ignored when `freeShipping` is true. */
  cost: number;
  handlingDays: number;
  freeShipping: boolean;
}

export interface CreateReturnPolicyInput {
  kind: 'returns';
  name: string;
  returnsAccepted: boolean;
  /** 14 / 30 / 60. Ignored when returns are refused. */
  days: number;
  paidBy: 'BUYER' | 'SELLER';
}

export type CreatePolicyInput = CreateShippingPolicyInput | CreateReturnPolicyInput;

/**
 * eBay wants a carrier code alongside the service code on a fulfillment
 * policy. Every service we offer is USPS or UPS/FedEx by prefix, so the code
 * is derivable rather than another field on the form.
 */
function carrierFor(service: string): string {
  if (/^UPS/i.test(service)) return 'UPS';
  if (/^FedEx/i.test(service)) return 'FedEx';
  return 'USPS';
}

/**
 * Create one policy on the seller's account and return its id + name.
 *
 * PAYMENT policies are deliberately not creatable here. Under eBay managed
 * payments a payment policy carries almost nothing a card seller would choose
 * (the payment methods are eBay's), every account already has a usable
 * default, and a half-configured one is a support ticket rather than a
 * feature. The dropdown lists them; creating one stays on eBay.
 */
export async function createPolicy(
  input: CreatePolicyInput,
  accessToken: string,
  sandbox: boolean
): Promise<PolicySummary> {
  const categoryTypes = [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }];

  if (input.kind === 'shipping') {
    const body = {
      name: input.name,
      marketplaceId: POLICY_MARKETPLACE,
      categoryTypes,
      handlingTime: { value: input.handlingDays, unit: 'DAY' },
      shippingOptions: [
        {
          optionType: 'DOMESTIC',
          costType: 'FLAT_RATE',
          shippingServices: [
            {
              sortOrder: 1,
              shippingCarrierCode: carrierFor(input.service),
              shippingServiceCode: input.service,
              shippingCost: {
                currency: 'USD',
                value: (input.freeShipping ? 0 : input.cost).toFixed(2),
              },
              freeShipping: input.freeShipping,
            },
          ],
        },
      ],
    };
    const res = await accountApi('/sell/account/v1/fulfillment_policy', accessToken, sandbox, {
      method: 'POST',
      body,
    });
    if (!res.ok) {
      throw new PolicyApiError(parseEbayApiError(await res.text(), res.status), res.status);
    }
    const data = await res.json();
    return {
      id: String(data.fulfillmentPolicyId),
      name: input.name,
      summary: summarizeFulfillment(body),
    };
  }

  const body: Record<string, unknown> = {
    name: input.name,
    marketplaceId: POLICY_MARKETPLACE,
    categoryTypes,
    returnsAccepted: input.returnsAccepted,
  };
  if (input.returnsAccepted) {
    body.returnPeriod = { value: input.days, unit: 'DAY' };
    body.returnShippingCostPayer = input.paidBy;
    body.refundMethod = 'MONEY_BACK';
  } else {
    body.description = 'This item is not eligible for return.';
  }

  const res = await accountApi('/sell/account/v1/return_policy', accessToken, sandbox, {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    throw new PolicyApiError(parseEbayApiError(await res.text(), res.status), res.status);
  }
  const data = await res.json();
  return {
    id: String(data.returnPolicyId),
    name: input.name,
    summary: summarizeReturn(body),
  };
}

/* ------------------------------------------------------------------ */
/* The seller's stored preference                                      */
/* ------------------------------------------------------------------ */

export interface BusinessPolicyPrefs {
  useBusinessPolicies: boolean;
  shippingPolicyId: string | null;
  returnPolicyId: string | null;
  paymentPolicyId: string | null;
}

export const NO_BUSINESS_POLICIES: BusinessPolicyPrefs = {
  useBusinessPolicies: false,
  shippingPolicyId: null,
  returnPolicyId: null,
  paymentPolicyId: null,
};

/** The listing_templates columns this feature adds. */
export const POLICY_COLUMNS =
  'use_business_policies, default_shipping_policy_id, default_return_policy_id, default_payment_policy_id';

export function prefsFromRow(row: Record<string, unknown> | null | undefined): BusinessPolicyPrefs {
  if (!row) return NO_BUSINESS_POLICIES;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    useBusinessPolicies: row.use_business_policies === true,
    shippingPolicyId: str(row.default_shipping_policy_id),
    returnPolicyId: str(row.default_return_policy_id),
    paymentPolicyId: str(row.default_payment_policy_id),
  };
}

/**
 * The policy preference that governs THIS seller's listings.
 *
 * PERSONAL ROW ONLY, deliberately, and unlike every other listing default.
 *
 * Templates and grade labels describe the CARD (who graded it, whose brand is
 * on the slab), so they resolve org-first. A business policy describes the
 * eBay ACCOUNT the listing is created on — and eBay connections are per user,
 * never per org. A store member listing with their own connection cannot use
 * the owner's policy ids: those ids do not exist on the member's account, so
 * eBay rejects every listing that references them. Falling back to the org row
 * turned one member's bulk batch into a hundred identical eBay failures.
 *
 * So there is no org fallback here, and `PUT /api/ebay/listing-defaults`
 * refuses to write these columns at org scope at all.
 *
 * Narrow select on four small columns; safe to call on the publish path.
 */
export async function loadBusinessPolicyPrefs(
  supabase: { from: (t: string) => any },
  userId: string
): Promise<BusinessPolicyPrefs> {
  const { data, error } = await supabase
    .from('listing_templates')
    .select(POLICY_COLUMNS)
    .eq('user_id', userId)
    .is('org_id', null)
    .maybeSingle();

  if (error) {
    // Migration window: 20260902_ebay_business_policies.sql is applied by
    // hand, so a schema without the columns must read as "not opted in"
    // rather than blowing up the publish path.
    if (isMissingColumnError(error)) {
      console.warn(
        '[ebay/policies] business-policy columns missing — apply ' +
        'supabase/migrations/20260902_ebay_business_policies.sql.'
      );
    }
    return NO_BUSINESS_POLICIES;
  }

  return prefsFromRow(data as Record<string, unknown> | null);
}

/* ------------------------------------------------------------------ */
/* Validation shared by the publish paths                              */
/* ------------------------------------------------------------------ */

export interface ListingPolicyIds {
  shippingPolicyId: string;
  returnPolicyId: string;
  paymentPolicyId: string;
}

/**
 * What an eBay business-policy id looks like: digits, nothing else.
 *
 * Every id the Account API has ever returned is a numeric string (they are
 * around 12 digits today). Pinning the shape here rather than accepting any
 * short string keeps a stray template token, a pasted URL or a name from
 * reaching the Trading API — where it would come back as an opaque schema
 * complaint mid-batch rather than a message the seller can act on. 40 digits
 * is far past anything eBay issues and still nowhere near a text field.
 */
export const POLICY_ID_RE = /^\d{1,40}$/;

/** The id if it is well-formed, else null. Trims first; never throws. */
export function cleanPolicyId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return POLICY_ID_RE.test(value) ? value : null;
}

/** Which of the three ids a caller left out. Empty means complete. */
export function missingPolicyIds(
  policies: Partial<ListingPolicyIds> | null | undefined
): Array<'shipping' | 'returns' | 'payment'> {
  const missing: Array<'shipping' | 'returns' | 'payment'> = [];
  if (!policies?.shippingPolicyId) missing.push('shipping');
  if (!policies?.returnPolicyId) missing.push('returns');
  if (!policies?.paymentPolicyId) missing.push('payment');
  return missing;
}

/** "shipping and returns" / "shipping, returns and payment" — for error copy. */
export function describeMissing(missing: string[]): string {
  if (missing.length <= 1) return missing[0] ?? '';
  return `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
}
