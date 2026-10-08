/**
 * Admin Affiliates API
 * GET: List all affiliates with stats
 * POST: Create new affiliate (auto-creates Stripe promo code)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { listAffiliates, DEFAULT_REWARD_CREDITS, DEFAULT_DISCOUNT_PERCENT } from '@/lib/affiliates';
import { sendAffiliateWelcomeEmail } from '@/lib/affiliateEmails';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureAffiliateStripeCode, describeStripeError } from '@/lib/affiliateStripe';

/**
 * Find the user id for an email so referral credits have somewhere to land.
 * Looks the email up in public.users (case-insensitive exact match, with
 * LIKE wildcards escaped) instead of paging auth.admin.listUsers. Returns
 * null when the person has not signed up yet (an admin can link the account
 * later).
 */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  try {
    const escaped = target.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .ilike('email', escaped)
      .limit(5);
    if (error) {
      console.error('Error looking up user for affiliate link:', error);
      return null;
    }
    const match = (data || []).find((u) => (u.email || '').toLowerCase() === target);
    return match?.id ?? null;
  } catch (err) {
    console.error('Error resolving affiliate user by email:', err);
  }
  return null;
}

type RewardTotals = { granted: number; pending: number; reversed: number };

/**
 * Sum reward_credits by status per affiliate (credits model). 'paid' rows are
 * credits already granted; 'pending' rows are credits owed (usually because
 * the affiliate has no linked account yet). Pages narrow rows in batches of
 * 1000 so the totals are not capped.
 */
async function rewardTotalsByAffiliate(): Promise<Record<string, RewardTotals>> {
  const totals: Record<string, RewardTotals> = {};
  const BATCH = 1000;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await supabaseAdmin
      .from('affiliate_commissions')
      .select('affiliate_id, status, reward_credits')
      .gt('reward_credits', 0)
      .order('id', { ascending: true })
      .range(i * BATCH, i * BATCH + BATCH - 1);
    if (error) {
      console.error('Error summing affiliate reward credits:', error);
      break;
    }
    for (const row of data || []) {
      const t = (totals[row.affiliate_id] ||= { granted: 0, pending: 0, reversed: 0 });
      const credits = Number(row.reward_credits) || 0;
      if (row.status === 'paid') t.granted += credits;
      else if (row.status === 'pending' || row.status === 'approved') t.pending += credits;
      else if (row.status === 'reversed') t.reversed += credits;
    }
    if (!data || data.length < BATCH) break;
  }
  return totals;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const [affiliates, rewardTotals] = await Promise.all([
      listAffiliates(status),
      rewardTotalsByAffiliate(),
    ]);

    const withRewards = affiliates.map((a) => ({
      ...a,
      reward_credits_granted: rewardTotals[a.id]?.granted ?? 0,
      reward_credits_pending: rewardTotals[a.id]?.pending ?? 0,
    }));
    const totals = withRewards.reduce(
      (acc, a) => ({
        reward_credits_granted: acc.reward_credits_granted + a.reward_credits_granted,
        reward_credits_pending: acc.reward_credits_pending + a.reward_credits_pending,
      }),
      { reward_credits_granted: 0, reward_credits_pending: 0 }
    );

    return NextResponse.json({ affiliates: withRewards, totals });
  } catch (error) {
    console.error('Error listing affiliates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      email,
      code,
      user_id,
      commission_rate,
      commission_type,
      flat_commission_amount,
      payout_method,
      payout_details,
      minimum_payout,
      attribution_window_days,
      notes,
      reward_credits,
      discount_percent,
      application_id,
    } = body;

    if (!name || !email || !code) {
      return NextResponse.json(
        { error: 'name, email, and code are required' },
        { status: 400 }
      );
    }

    // Normalize code to uppercase
    const normalizedCode = code.toUpperCase().trim();

    // Check for duplicate code
    const { data: existing } = await supabaseAdmin
      .from('affiliates')
      .select('id')
      .eq('code', normalizedCode)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Affiliate code "${normalizedCode}" is already in use` },
        { status: 409 }
      );
    }

    // Reward model: the fan code gives a NEW customer a percentage off their
    // first purchase, and the affiliate earns grading credits when that
    // customer pays.
    const discountPercent = Number.isFinite(Number(discount_percent))
      ? Math.round(Number(discount_percent))
      : DEFAULT_DISCOUNT_PERCENT;
    const rewardCredits = Number.isFinite(Number(reward_credits))
      ? Math.round(Number(reward_credits))
      : DEFAULT_REWARD_CREDITS;

    // Create Stripe coupon + promotion code for the buyer discount. A failure
    // is reported back to the admin (stripe_error) instead of being swallowed;
    // the row is still saved so the code can be attached later from the
    // affiliates table ("Create Stripe code").
    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;
    let stripeError: string | null = null;
    try {
      const ids = await ensureAffiliateStripeCode({ code: normalizedCode, discountPercent });
      stripeCouponId = ids.couponId;
      stripePromotionCodeId = ids.promotionCodeId;
    } catch (err) {
      stripeError = describeStripeError(err);
      console.error(`[Affiliate] Stripe code creation failed for ${normalizedCode}:`, stripeError);
    }

    // Referral credits need an account to land in. If the admin did not pass a
    // user_id, try to resolve one from the affiliate's email.
    let resolvedUserId: string | null = user_id || null;
    if (!resolvedUserId) {
      resolvedUserId = await findUserIdByEmail(email);
      if (!resolvedUserId) {
        console.warn(
          `[Affiliate] No DCM account found for ${email}; rewards for ${normalizedCode} will sit pending until an admin links one.`
        );
      }
    }

    // Insert affiliate
    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliates')
      .insert({
        name,
        email,
        code: normalizedCode,
        user_id: resolvedUserId,
        stripe_coupon_id: stripeCouponId,
        stripe_promotion_code_id: stripePromotionCodeId,
        commission_rate: commission_rate ?? 0.20,
        commission_type: commission_type ?? 'percentage',
        flat_commission_amount: flat_commission_amount ?? null,
        payout_method: payout_method ?? 'manual',
        payout_details: payout_details ?? null,
        minimum_payout: minimum_payout ?? 20.00,
        attribution_window_days: attribution_window_days ?? 30,
        notes: notes ?? null,
        reward_credits: rewardCredits,
        discount_percent: discountPercent,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating affiliate:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark the originating application approved, when this came from one
    if (application_id) {
      const { error: appError } = await supabaseAdmin
        .from('affiliate_applications')
        .update({
          status: 'approved',
          affiliate_id: affiliate.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', application_id);
      if (appError) {
        console.error('Error marking affiliate application approved:', appError);
      }
    }

    // Welcome email is best effort: a mail failure must never lose the affiliate
    try {
      await sendAffiliateWelcomeEmail({
        name,
        email,
        code: normalizedCode,
        discountPercent,
        rewardCredits,
      });
    } catch (emailError) {
      console.error('Error sending affiliate welcome email:', emailError);
    }

    return NextResponse.json({ affiliate, stripe_error: stripeError }, { status: 201 });
  } catch (error) {
    console.error('Error creating affiliate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
