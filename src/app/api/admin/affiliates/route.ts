/**
 * Admin Affiliates API
 * GET: List all affiliates with stats
 * POST: Create new affiliate (auto-creates Stripe promo code)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { listAffiliates } from '@/lib/affiliates';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

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

    // Create Stripe coupon + promotion code for 10% buyer discount
    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;

    try {
      // Create a coupon: 10% off, once
      const coupon = await stripe.coupons.create({
        percent_off: 10,
        duration: 'once',
        name: `Affiliate: ${normalizedCode} (10% off)`,
        metadata: { affiliate_code: normalizedCode },
      });
      stripeCouponId = coupon.id;

      // Create a promotion code linked to that coupon
      const promoCode = await stripe.promotionCodes.create({
        promotion: { coupon: coupon.id, type: 'coupon' },
        code: normalizedCode,
        metadata: { affiliate_code: normalizedCode },
      });
      stripePromotionCodeId = promoCode.id;
    } catch (stripeError: any) {
      console.error('Error creating Stripe promo code:', stripeError);
      // Don't fail the whole creation — affiliate can work without Stripe promo
    }

    // Insert affiliate
    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliates')
      .insert({
        name,
        email,
        code: normalizedCode,
        user_id: user_id || null,
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
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating affiliate:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ affiliate }, { status: 201 });
  } catch (error) {
    console.error('Error creating affiliate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
