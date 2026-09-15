/**
 * POST /api/admin/affiliates/[id]/stripe
 *
 * Create (or reattach) the Stripe coupon and promotion code for an affiliate
 * whose row has none, which happens when creation failed at approval time.
 * Idempotent: an existing promotion code with the affiliate's text is reused.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureAffiliateStripeCode, describeStripeError } from '@/lib/affiliateStripe';
import { DEFAULT_DISCOUNT_PERCENT } from '@/lib/affiliates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = await verifyAdminSession(token);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliates')
      .select('id, code, discount_percent, stripe_coupon_id, stripe_promotion_code_id')
      .eq('id', id)
      .single();
    if (error || !affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    if (affiliate.stripe_promotion_code_id && affiliate.stripe_coupon_id) {
      return NextResponse.json({
        success: true,
        alreadySet: true,
        stripe_coupon_id: affiliate.stripe_coupon_id,
        stripe_promotion_code_id: affiliate.stripe_promotion_code_id,
      });
    }

    let ids;
    try {
      ids = await ensureAffiliateStripeCode({
        code: affiliate.code,
        discountPercent: affiliate.discount_percent ?? DEFAULT_DISCOUNT_PERCENT,
      });
    } catch (stripeError) {
      const message = describeStripeError(stripeError);
      console.error(`[Affiliate] Stripe code creation failed for ${affiliate.code}:`, message);
      return NextResponse.json({ error: `Stripe rejected the code: ${message}` }, { status: 502 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('affiliates')
      .update({ stripe_coupon_id: ids.couponId, stripe_promotion_code_id: ids.promotionCodeId })
      .eq('id', id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      reused: ids.reused,
      stripe_coupon_id: ids.couponId,
      stripe_promotion_code_id: ids.promotionCodeId,
    });
  } catch (err) {
    console.error('Error in POST /api/admin/affiliates/[id]/stripe:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
