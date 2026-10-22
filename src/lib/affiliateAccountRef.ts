/**
 * Referral code saved on the ACCOUNT, not only in the browser (Oct 2026).
 *
 * WHY. A referral link stores its code in localStorage (ReferralTracker.tsx),
 * and checkout sends whatever that browser holds. A friend who opens the link
 * in one browser and signs up, confirms or pays in another (the confirmation
 * email opening in a different app is the common case) reaches checkout with
 * no code: no 15% fan discount and no reward for the affiliate. That happened
 * to affiliate WILLIEJ's first referral on Oct 22, 2026.
 *
 * WHAT. The code is attached to the account in two ways:
 *  - at email sign-up, as user_metadata.ref_code (directAuth.signUp);
 *  - after any sign-in in a browser that holds a code, as
 *    app_metadata.referral = { code, at } via POST /api/affiliate/bind
 *    (server-only metadata, so the user cannot rewrite it).
 * Checkout and subscribe fall back to it when the request carries no code.
 * Attribution stays inside the program's 30-day window; the webhook still
 * rewards only a first paid purchase and blocks self-referrals.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAffiliateByCode } from '@/lib/affiliates';
import { isFirstPurchase } from '@/lib/credits';

export const ACCOUNT_REF_WINDOW_DAYS = 30;
const WINDOW_MS = ACCOUNT_REF_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Z0-9_-]{2,32}$/;

export function normalizeRefCode(raw: unknown): string | null {
  const code = String(raw ?? '').trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export interface AccountRefUser {
  created_at?: string | null;
  app_metadata?: Record<string, any> | null;
  user_metadata?: Record<string, any> | null;
}

/** The account's referral code, if it is still inside the attribution window. */
export function accountRefCode(user: AccountRefUser | null | undefined, now = Date.now()): string | null {
  if (!user) return null;
  const bound = user.app_metadata?.referral;
  if (bound && typeof bound === 'object') {
    const code = normalizeRefCode(bound.code);
    const at = Date.parse(String(bound.at ?? ''));
    if (code && Number.isFinite(at) && now - at <= WINDOW_MS) return code;
  }
  const signup = normalizeRefCode(user.user_metadata?.ref_code);
  const created = Date.parse(String(user.created_at ?? ''));
  if (signup && Number.isFinite(created) && now - created <= WINDOW_MS) return signup;
  return null;
}

/** Server-side lookup for checkout: the account's code, or null. Never throws. */
export async function getAccountRefCode(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    return accountRefCode(data.user as AccountRefUser);
  } catch {
    return null;
  }
}

export type BindResult =
  | { bound: true; code: string }
  | { bound: false; reason: 'invalid_code' | 'inactive_affiliate' | 'self_referral' | 'already_bound' | 'not_first_purchase' | 'no_user' | 'error' };

/**
 * Attach a referral code to the account in app_metadata. First code wins: an
 * account that already carries one keeps it. Refused for an inactive code, a
 * self-referral, or an account that has already made a paid purchase (the
 * reward is for a referred customer's first purchase).
 */
export async function bindAccountReferral(userId: string, rawCode: unknown): Promise<BindResult> {
  const code = normalizeRefCode(rawCode);
  if (!code) return { bound: false, reason: 'invalid_code' };
  try {
    const affiliate = await getAffiliateByCode(code);
    if (!affiliate || affiliate.status !== 'active') return { bound: false, reason: 'inactive_affiliate' };

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return { bound: false, reason: 'no_user' };
    const user = data.user;

    if (affiliate.user_id === userId) return { bound: false, reason: 'self_referral' };
    if (affiliate.email && user.email && affiliate.email.toLowerCase() === user.email.toLowerCase()) {
      return { bound: false, reason: 'self_referral' };
    }
    if (user.app_metadata?.referral?.code) return { bound: false, reason: 'already_bound' };
    if (!(await isFirstPurchase(userId))) return { bound: false, reason: 'not_first_purchase' };

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(user.app_metadata || {}), referral: { code: affiliate.code, at: new Date().toISOString() } },
    });
    if (updateError) return { bound: false, reason: 'error' };
    return { bound: true, code: affiliate.code };
  } catch {
    return { bound: false, reason: 'error' };
  }
}
