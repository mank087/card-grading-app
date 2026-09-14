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
import { stripe } from '@/lib/stripe';

/**
 * Find the auth user id for an email so referral credits have somewhere to
 * land. Uses the same supabaseAdmin.auth.admin.listUsers() pattern as
 * src/app/api/auth/facebook-deletion/route.ts. Returns null when the person
 * has not signed up yet (an admin can link the account later).
 */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  try {
    let page = 1;
    // Cap the sweep so a large user table cannot stall affiliate creation.
    while (page <= 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error('Error listing users for affiliate link:', error);
        return null;
      }
      const users = data?.users || [];
      const match = users.find((u) => (u.email || '').toLowerCase() === target);
      if (match) return match.id;
      if (users.length < 1000) return null;
      page += 1;
    }
  } catch (err) {
    console.error('Error resolving affiliate user by email:', err);
  }
  return null;
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

    const affiliates = await listAffiliates(status);

    return NextResponse.json({ affiliates });
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

    // Create Stripe coupon + promotion code for the buyer discount
    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;

    try {
      // Create a coupon: percent off, once
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: 'once',
        name: `Affiliate: ${normalizedCode} (${discountPercent}% off first purchase)`,
        metadata: { affiliate_code: normalizedCode },
      });
      stripeCouponId = coupon.id;

      // Create a promotion code linked to that coupon, restricted to customers
      // who have never paid us before, so the fan discount is new-customer only
      const promoCode = await stripe.promotionCodes.create({
        promotion: { coupon: coupon.id, type: 'coupon' },
        code: normalizedCode,
        restrictions: { first_time_transaction: true },
        metadata: { affiliate_code: normalizedCode },
      });
      stripePromotionCodeId = promoCode.id;
    } catch (stripeError: any) {
      console.error('Error creating Stripe promo code:', stripeError);
      // Don't fail the whole creation — affiliate can work without Stripe promo
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

    return NextResponse.json({ affiliate }, { status: 201 });
  } catch (error) {
    console.error('Error creating affiliate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
