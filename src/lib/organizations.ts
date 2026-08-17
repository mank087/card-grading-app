/**
 * Enterprise organizations: store-branded grading with a shared two-bucket
 * grade-credit pool.
 *
 * Billing model (Scenario D, Aug 2026):
 * - monthly_credits: SET to monthly_allotment on every paid invoice — the
 *   allotment resets each billing cycle, it does not roll over.
 * - overage_credits: one-time overage packs, refunds, and admin grants; rolls
 *   over indefinitely and is never touched by the monthly reset.
 * - grade_credits: DB-generated total (monthly + overage), read-only.
 * Grades draw monthly first, then overage (enforced in the org_deduct_credit
 * RPC, which reports which bucket paid).
 */

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  logo_path: string | null;
  logo_white_path: string | null;
  logo_black_path: string | null;
  brand_color: string | null;
  /** 1–5 hex colors, [0] = primary accent. Seeded from the logo; admin-editable. */
  brand_colors?: string[] | null;
  serial_prefix?: string | null;
  org_serial_seq?: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  /** Resets to monthly_allotment each billing cycle. */
  monthly_credits: number;
  /** Overage packs / refunds / admin grants; rolls over. */
  overage_credits: number;
  /** Generated column: monthly_credits + overage_credits (read-only). */
  grade_credits: number;
  monthly_allotment: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
}

/**
 * The organization a user belongs to (v1: at most one), or null.
 *
 * PENDING orgs are invisible by default: an applicant sees no org UI anywhere
 * (no workspace switcher, badges, billing, or settings) until DCM approves —
 * they get a confirmation screen + email instead, and DCM reaches out.
 * Pass includePending only for surfaces that explicitly handle applications.
 */
export async function getOrgForUser(
  userId: string,
  options: { includePending?: boolean } = {}
): Promise<{ org: Organization; role: 'owner' | 'member' } | null> {
  if (!userId) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Table may not exist yet in an environment where the migration hasn't
    // been applied — treat as "no org" so personal credits keep working.
    console.error('[getOrgForUser] error:', error.message);
    return null;
  }
  const org = (data?.organizations ?? null) as Organization | null;
  if (!org) return null;
  if (org.status === 'pending' && !options.includePending) return null;
  return { org, role: (data!.role as 'owner' | 'member') || 'member' };
}

export async function getOrgById(orgId: string): Promise<Organization | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();
  if (error) {
    console.error('[getOrgById] error:', error.message);
    return null;
  }
  return data as Organization | null;
}

export interface OrgDeductResult {
  /** Which bucket paid for this grade. */
  bucket: 'monthly' | 'overage';
  monthly: number;
  overage: number;
  /** Remaining total across both buckets. */
  total: number;
}

/**
 * Atomically take 1 credit from the org pool (monthly bucket first, then
 * overage). Returns which bucket paid + remaining balances, or null when both
 * buckets are empty / org inactive (caller falls back to personal credits).
 * Race-safe: the RPC's guarded UPDATEs mean two concurrent grades can never
 * both take the last credit.
 */
export async function takeOrgCredit(orgId: string): Promise<OrgDeductResult | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('org_deduct_credit', { p_org_id: orgId });
  if (error) {
    console.error('[takeOrgCredit] rpc error:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || (row.bucket !== 'monthly' && row.bucket !== 'overage')) return null;
  const monthly = Number(row.monthly_credits) || 0;
  const overage = Number(row.overage_credits) || 0;
  return { bucket: row.bucket, monthly, overage, total: monthly + overage };
}

/**
 * The prefix used on org serial displays (e.g. MAN442921): the admin-set
 * serial_prefix, or the first three letters of the org name by default.
 */
export function orgSerialPrefix(org: Pick<Organization, 'name' | 'serial_prefix'>): string {
  const set = (org.serial_prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (set) return set.slice(0, 6);
  const letters = org.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (letters || 'ORG').slice(0, 3);
}

/** Format an org serial for display: MAN442921 (prefix + random 6 digits). */
export function formatOrgSerial(prefix: string, n: number): string {
  return `${prefix}${n}`;
}

/**
 * Assign a random, per-org-unique serial to a card (once; regrades never
 * renumber). Random 6-digit numbers instead of a sequence so early cards
 * don't read as 000001; the (org_id, org_serial) unique index arbitrates
 * collisions and we retry. Best-effort: on persistent failure the card
 * simply keeps only its DCM serial.
 */
export async function assignOrgSerial(
  cardId: string,
  org: Pick<Organization, 'id' | 'name' | 'serial_prefix'>
): Promise<string | null> {
  const supabase = getServiceClient();
  const prefix = orgSerialPrefix(org);
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = 100000 + Math.floor(Math.random() * 900000);
    const { error } = await supabase
      .from('cards')
      .update({ org_serial: n, org_serial_display: formatOrgSerial(prefix, n) })
      .eq('id', cardId)
      .is('org_serial', null);
    if (!error) return formatOrgSerial(prefix, n);
    if (error.code !== '23505') {
      // Missing columns (migration not applied) or anything non-collision:
      // don't spin, the card grades fine without an org serial.
      console.error('[assignOrgSerial] error:', error.message);
      return null;
    }
    // 23505 = random number already taken for this org — roll again.
  }
  console.error('[assignOrgSerial] gave up after repeated serial collisions for org', org.id);
  return null;
}

/**
 * Return credits to the org pool (refunds, duplicate-charge unwind, top-ups,
 * admin grants). Defaults to the durable overage bucket; pass 'monthly' only
 * when unwinding a charge that drew from the monthly bucket. Returns the new
 * TOTAL (monthly + overage).
 */
export async function returnOrgCredits(
  orgId: string,
  amount: number,
  bucket: 'monthly' | 'overage' = 'overage'
): Promise<number | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('org_add_credits', {
    p_org_id: orgId,
    p_amount: amount,
    p_bucket: bucket,
  });
  if (error) {
    console.error('[returnOrgCredits] rpc error:', error.message);
    return null;
  }
  if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) return null;
  return Array.isArray(data) ? Number(data[0]) : Number(data);
}

/**
 * Deposit credits into the org's OVERAGE bucket (overage top-up packs; these
 * roll over and are never wiped by the monthly reset). Subscription cycles use
 * resetOrgMonthlyCredits instead. Idempotent on dedupeKey (a Stripe invoice id
 * or checkout session id): the deposit is skipped when a credit_transactions
 * row for this org already carries that key.
 */
export async function depositOrgCredits(
  orgId: string,
  amount: number,
  options: {
    dedupeKey: string;
    description: string;
    source: 'subscription' | 'topup' | 'admin';
    stripeSessionId?: string;
  }
): Promise<{ success: boolean; newBalance: number; alreadyProcessed?: boolean; error?: string }> {
  const supabase = getServiceClient();

  const org = await getOrgById(orgId);
  if (!org) {
    return { success: false, newBalance: 0, error: `Organization ${orgId} not found` };
  }

  if (options.dedupeKey) {
    const { data: prior, error: dedupeError } = await supabase
      .from('credit_transactions')
      .select('id, metadata')
      .eq('org_id', orgId)
      .eq('metadata->>org_dedupe_key', options.dedupeKey)
      .limit(1);
    if (dedupeError) {
      // FAIL CLOSED: if we can't verify the dedupe key, do NOT grant. A missed
      // grant surfaces on the next Stripe retry (or manually); a double grant
      // is unrecoverable silent revenue loss (see the July 2026 duplicate-
      // charge incident). Return an error so the webhook 500s and Stripe
      // retries the delivery.
      console.error('[depositOrgCredits] CRITICAL: dedupe check failed — refusing to deposit', {
        orgId, dedupeKey: options.dedupeKey, error: dedupeError.message,
      });
      return { success: false, newBalance: 0, error: `Dedupe check failed: ${dedupeError.message}` };
    }
    if (prior && prior.length > 0) {
      if (!(prior[0].metadata as Record<string, unknown> | null)?.org_grant_completed) {
        // The claim exists but was never marked completed: either a concurrent
        // delivery is mid-flight (benign), or a crash landed between the claim
        // and the increment and this deposit was LOST. Can't safely re-credit
        // (the increment may have run without the marker), so surface it.
        console.error('[depositOrgCredits] CRITICAL: prior claim has no completion marker — verify this deposit actually landed:', {
          orgId, dedupeKey: options.dedupeKey, txId: prior[0].id,
        });
      } else {
        console.log(`[depositOrgCredits] Deposit ${options.dedupeKey} already processed — skipping`);
      }
      return { success: true, newBalance: org.grade_credits ?? 0, alreadyProcessed: true };
    }
  }

  // ORDERING (do not reorder): insert the transaction row FIRST — it is the
  // atomic idempotency claim via the partial unique index on
  // (metadata->>'org_dedupe_key') — and increment the balance only after the
  // claim succeeds. Under concurrent webhook redelivery exactly one insert
  // wins; the loser gets 23505 and never touches the balance, so a double
  // credit is impossible. The reverse order (increment first, unwind on
  // conflict) lets both deliveries increment before one detects the conflict,
  // and a failed unwind leaves a permanent double credit. The failure mode of
  // claim-first (crash between claim and increment) is a MISSED increment
  // with an audit row pointing at it — loud, and recoverable by hand.
  const expectedBalance = (org.monthly_credits || 0) + (org.overage_credits || 0) + amount;
  const { data: txRow, error: txError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: org.owner_user_id,
      org_id: orgId,
      type: 'purchase',
      amount,
      // Expected post-increment total (the increment hasn't run yet).
      balance_after: expectedBalance,
      description: options.description,
      stripe_session_id: options.stripeSessionId,
      metadata: {
        org_credit: true,
        org_dedupe_key: options.dedupeKey,
        source: options.source,
        org_bucket: 'overage',
      },
    })
    .select('id')
    .single();
  if (txError) {
    if (txError.code === '23505') {
      // Concurrent delivery won the claim — already processed, not an error.
      console.log(`[depositOrgCredits] Deposit ${options.dedupeKey} claimed concurrently — skipping`);
      return { success: true, newBalance: org.grade_credits ?? 0, alreadyProcessed: true };
    }
    console.error('[depositOrgCredits] Failed to claim deposit transaction — nothing credited:', txError.message);
    return { success: false, newBalance: 0, error: txError.message };
  }

  const newBalance = await returnOrgCredits(orgId, amount);
  if (newBalance === null) {
    // Increment failed after the claim: unwind the claim so a Stripe retry can
    // re-attempt cleanly. If the unwind also fails, the audit row exists with
    // no matching credit — log CRITICAL for manual recovery.
    const { error: unwindError } = await supabase
      .from('credit_transactions')
      .delete()
      .eq('id', txRow.id);
    if (unwindError) {
      console.error('[depositOrgCredits] CRITICAL: increment failed AND claim unwind failed — org has an audit row but NO credit. Manual fix needed:', {
        orgId, dedupeKey: options.dedupeKey, amount, txId: txRow.id, unwindError: unwindError.message,
      });
    } else {
      console.error('[depositOrgCredits] Increment failed after claim; claim unwound — deposit will retry:', {
        orgId, dedupeKey: options.dedupeKey, amount,
      });
    }
    return { success: false, newBalance: 0, error: 'Balance increment failed' };
  }

  // Mark the claim completed so a later replay can tell "already credited"
  // from "claimed but crashed before the increment". Best-effort — a missing
  // marker on a completed grant only produces a false-alarm CRITICAL log.
  const { error: markError } = await supabase
    .from('credit_transactions')
    .update({
      balance_after: newBalance,
      metadata: {
        org_credit: true,
        org_dedupe_key: options.dedupeKey,
        source: options.source,
        org_bucket: 'overage',
        org_grant_completed: true,
      },
    })
    .eq('id', txRow.id);
  if (markError) {
    console.warn('[depositOrgCredits] Failed to mark claim completed (deposit itself succeeded):', markError.message);
  }

  return { success: true, newBalance };
}

/**
 * Billing-cycle deposit: SET the monthly bucket to the plan allotment (the
 * allotment does not roll over; the overage bucket is untouched). Idempotent
 * on dedupeKey (the Stripe invoice id / checkout session id) so a webhook
 * replay can't re-fill a partially-used cycle.
 */
export async function resetOrgMonthlyCredits(
  orgId: string,
  amount: number,
  options: { dedupeKey: string; description: string }
): Promise<{ success: boolean; newBalance: number; alreadyProcessed?: boolean; error?: string }> {
  const supabase = getServiceClient();

  const org = await getOrgById(orgId);
  if (!org) {
    return { success: false, newBalance: 0, error: `Organization ${orgId} not found` };
  }

  if (options.dedupeKey) {
    const { data: prior, error: dedupeError } = await supabase
      .from('credit_transactions')
      .select('id, metadata')
      .eq('org_id', orgId)
      .eq('metadata->>org_dedupe_key', options.dedupeKey)
      .limit(1);
    if (dedupeError) {
      // FAIL CLOSED (same policy as depositOrgCredits): a replayed reset would
      // re-fill a partially-used cycle. Error out so the webhook 500s and
      // Stripe retries the delivery instead of guessing.
      console.error('[resetOrgMonthlyCredits] CRITICAL: dedupe check failed — refusing to reset', {
        orgId, dedupeKey: options.dedupeKey, error: dedupeError.message,
      });
      return { success: false, newBalance: 0, error: `Dedupe check failed: ${dedupeError.message}` };
    }
    if (prior && prior.length > 0) {
      if (!(prior[0].metadata as Record<string, unknown> | null)?.org_grant_completed) {
        // Claim exists without a completion marker: a crash may have landed
        // between the claim and the SET. Unlike the deposit increment, the
        // reset RPC is an idempotent SET, so re-running it is always safe —
        // recover instead of just logging.
        console.warn('[resetOrgMonthlyCredits] Prior claim has no completion marker — re-running the idempotent reset:', {
          orgId, dedupeKey: options.dedupeKey, txId: prior[0].id,
        });
        const { data: redo, error: redoError } = await supabase.rpc('org_reset_monthly_credits', {
          p_org_id: orgId,
          p_amount: amount,
        });
        const redoBalance = Array.isArray(redo) ? Number(redo?.[0]) : Number(redo);
        if (!redoError && Number.isFinite(redoBalance)) {
          await markOrgClaimCompleted(supabase, prior[0].id, prior[0].metadata, redoBalance);
          return { success: true, newBalance: redoBalance, alreadyProcessed: true };
        }
        console.error('[resetOrgMonthlyCredits] CRITICAL: recovery reset failed — verify this cycle was filled:', {
          orgId, dedupeKey: options.dedupeKey, error: redoError?.message,
        });
      } else {
        console.log(`[resetOrgMonthlyCredits] Cycle ${options.dedupeKey} already processed — skipping`);
      }
      return { success: true, newBalance: org.grade_credits ?? 0, alreadyProcessed: true };
    }
  }

  // Same claim-first ordering as depositOrgCredits: the tx insert is the
  // atomic idempotency claim (unique index on metadata->>'org_dedupe_key');
  // the SET runs only after the claim succeeds, so concurrent redeliveries
  // cannot both re-fill a partially-used cycle.
  const expectedBalance = amount + (org.overage_credits || 0);
  const { data: txRow, error: txError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: org.owner_user_id,
      org_id: orgId,
      type: 'purchase',
      amount,
      // Expected post-reset total (monthly set to `amount` + untouched overage).
      balance_after: expectedBalance,
      description: options.description,
      metadata: {
        org_credit: true,
        org_dedupe_key: options.dedupeKey,
        source: 'subscription',
        org_bucket: 'monthly',
        monthly_reset: true,
      },
    })
    .select('id')
    .single();
  if (txError) {
    if (txError.code === '23505') {
      console.log(`[resetOrgMonthlyCredits] Cycle ${options.dedupeKey} claimed concurrently — skipping`);
      return { success: true, newBalance: org.grade_credits ?? 0, alreadyProcessed: true };
    }
    console.error('[resetOrgMonthlyCredits] Failed to claim cycle transaction — nothing reset:', txError.message);
    return { success: false, newBalance: 0, error: txError.message };
  }

  const { data, error } = await supabase.rpc('org_reset_monthly_credits', {
    p_org_id: orgId,
    p_amount: amount,
  });
  const newBalance = Array.isArray(data) ? Number(data?.[0]) : Number(data);
  if (error || !Number.isFinite(newBalance)) {
    const reason = error ? error.message : `no row updated for org ${orgId}`;
    // Reset failed after the claim: unwind the claim so a Stripe retry can
    // re-attempt cleanly.
    const { error: unwindError } = await supabase
      .from('credit_transactions')
      .delete()
      .eq('id', txRow.id);
    if (unwindError) {
      console.error('[resetOrgMonthlyCredits] CRITICAL: reset failed AND claim unwind failed — audit row exists with no reset. Manual fix needed:', {
        orgId, dedupeKey: options.dedupeKey, amount, txId: txRow.id, reason, unwindError: unwindError.message,
      });
    } else {
      console.error('[resetOrgMonthlyCredits] Reset failed after claim; claim unwound — will retry:', {
        orgId, dedupeKey: options.dedupeKey, amount, reason,
      });
    }
    return { success: false, newBalance: 0, error: reason };
  }

  // Mark the claim completed (see depositOrgCredits) — best-effort.
  await markOrgClaimCompleted(supabase, txRow.id, {
    org_credit: true,
    org_dedupe_key: options.dedupeKey,
    source: 'subscription',
    org_bucket: 'monthly',
    monthly_reset: true,
  }, newBalance);

  return { success: true, newBalance };
}

/** Stamp org_grant_completed on a claim row after its balance change landed. */
async function markOrgClaimCompleted(
  supabase: ReturnType<typeof getServiceClient>,
  txId: string,
  metadata: unknown,
  balanceAfter: number
) {
  const { error } = await supabase
    .from('credit_transactions')
    .update({
      balance_after: balanceAfter,
      metadata: { ...(metadata as Record<string, unknown> | null ?? {}), org_grant_completed: true },
    })
    .eq('id', txId);
  if (error) {
    console.warn('[markOrgClaimCompleted] Failed to mark claim completed (the balance change itself succeeded):', error.message);
  }
}

/**
 * Public branding shape consumed by label/report/detail-page surfaces.
 * Logo URLs are short-lived signed URLs into the private org-assets bucket.
 */
export interface OrgBranding {
  orgId: string;
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
  logoBlackUrl: string | null;
  /** Label mark settings from Brand Setup — which variant, and how big. */
  logoVariant: 'color' | 'black' | 'white';
  logoScale: number;
}

/**
 * Label mark settings live in the storefront JSON (Brand Setup writes them).
 * Read through helpers so every branding consumer — labels, reports, card
 * images, the public org page — gets the same resolved values.
 */
function slabLogoVariant(org: Organization): 'color' | 'black' | 'white' {
  const v = ((org as any).storefront?.slab?.logo_variant) as string | undefined;
  return v === 'black' || v === 'white' ? v : 'color';
}

function slabLogoScale(org: Organization): number {
  const n = Number((org as any).storefront?.slab?.logo_scale);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — surfaces convert to data URLs immediately

export async function getOrgBranding(org: Organization): Promise<OrgBranding> {
  const supabase = getServiceClient();
  const sign = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from('org-assets')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.error('[getOrgBranding] sign failed for', path, error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  };
  const [logoUrl, logoWhiteUrl, logoBlackUrl] = await Promise.all([
    sign(org.logo_path),
    sign(org.logo_white_path),
    sign(org.logo_black_path),
  ]);
  return {
    orgId: org.id,
    name: org.name,
    slug: org.slug,
    brandColor: org.brand_color || '#7C3AED',
    logoUrl,
    logoWhiteUrl,
    logoBlackUrl,
    logoVariant: slabLogoVariant(org),
    logoScale: slabLogoScale(org),
  };
}

/** Branding for the org that graded a card, or null for regular DCM cards. */
export async function getBrandingForCard(cardId: string): Promise<OrgBranding | null> {
  const supabase = getServiceClient();
  const { data: card, error } = await supabase
    .from('cards')
    .select('org_id')
    .eq('id', cardId)
    .maybeSingle();
  if (error || !card?.org_id) return null;
  const org = await getOrgById(card.org_id);
  if (!org || org.status === 'cancelled') return null;
  return getOrgBranding(org);
}
