/**
 * Admin Affiliate Detail API
 * GET: Full affiliate details + commission history
 * PUT: Update affiliate settings
 * DELETE: Deactivate affiliate
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { getAffiliateStats, getCommissionHistory } from '@/lib/affiliates';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { describeStripeError } from '@/lib/affiliateStripe';

/**
 * Keep the affiliate's Stripe promotion code in step with its status: only an
 * active affiliate's code should be redeemable. Never throws; returns an error
 * string for the response so a Stripe failure doesn't block the status change.
 */
async function syncPromotionCodeActive(
  promotionCodeId: string | null | undefined,
  active: boolean
): Promise<string | null> {
  if (!promotionCodeId) return null;
  try {
    await stripe.promotionCodes.update(promotionCodeId, { active });
    return null;
  } catch (err) {
    const message = describeStripeError(err);
    console.error(`[Affiliate] Could not set promotion code ${promotionCodeId} active=${active}:`, message);
    return `Status saved, but Stripe could not ${active ? 'reactivate' : 'deactivate'} the promo code: ${message}`;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const stats = await getAffiliateStats(id);
    if (!stats) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }

    const { commissions, total: totalCommissions } = await getCommissionHistory(id, { limit: 50 });

    // Credits model: sum reward_credits by status (paid = granted, pending =
    // owed), paging so the totals aren't capped at 1000 rows.
    let rewardCreditsGranted = 0;
    let rewardCreditsPending = 0;
    const BATCH = 1000;
    for (let i = 0; i < 100; i++) {
      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('affiliate_commissions')
        .select('status, reward_credits')
        .eq('affiliate_id', id)
        .gt('reward_credits', 0)
        .order('id', { ascending: true })
        .range(i * BATCH, i * BATCH + BATCH - 1);
      if (rowsError) {
        console.error('Error summing affiliate reward credits:', rowsError);
        break;
      }
      for (const row of rows || []) {
        const credits = Number(row.reward_credits) || 0;
        if (row.status === 'paid') rewardCreditsGranted += credits;
        else if (row.status === 'pending' || row.status === 'approved') rewardCreditsPending += credits;
      }
      if (!rows || rows.length < BATCH) break;
    }

    return NextResponse.json({
      ...stats,
      commissions,
      totalCommissions,
      rewardCreditsGranted,
      rewardCreditsPending,
    });
  } catch (error) {
    console.error('Error fetching affiliate details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      'name', 'email', 'status', 'commission_rate', 'commission_type',
      'flat_commission_amount', 'payout_method', 'payout_details',
      'minimum_payout', 'attribution_window_days', 'notes',
      // Credits reward model: how many credits the affiliate earns, how much
      // the fan saves, and which account the credits land in.
      'reward_credits', 'discount_percent', 'user_id',
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: before } = await supabaseAdmin
      .from('affiliates')
      .select('discount_percent, stripe_promotion_code_id')
      .eq('id', id)
      .maybeSingle();

    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating affiliate:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }

    // Pausing/deactivating turns the Stripe promo code off; resuming turns it back on.
    let stripeError: string | null = null;
    if (body.status !== undefined) {
      stripeError = await syncPromotionCodeActive(affiliate.stripe_promotion_code_id, affiliate.status === 'active');
    }

    // A Stripe coupon's percent_off is immutable, so editing discount_percent
    // only changes the stored value; the live code keeps its old discount.
    let stripeNote: string | null = null;
    if (
      body.discount_percent !== undefined &&
      before?.stripe_promotion_code_id &&
      Number(body.discount_percent) !== Number(before.discount_percent)
    ) {
      stripeNote =
        'Discount percent saved, but the live Stripe promo code still applies the old discount. Changing the percent requires a new Stripe code.';
    }

    return NextResponse.json({ affiliate, stripe_error: stripeError, stripe_note: stripeNote });
  } catch (error) {
    console.error('Error updating affiliate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Soft delete — set status to deactivated
    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliates')
      .update({
        status: 'deactivated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deactivating affiliate:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }

    const stripeError = await syncPromotionCodeActive(affiliate.stripe_promotion_code_id, false);

    return NextResponse.json({ affiliate, message: 'Affiliate deactivated', stripe_error: stripeError });
  } catch (error) {
    console.error('Error deactivating affiliate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
