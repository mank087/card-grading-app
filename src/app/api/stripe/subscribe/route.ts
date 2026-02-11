/**
 * Card Lovers Subscription API
 * Creates a Stripe checkout session for subscription purchases
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, CARD_LOVERS_SUBSCRIPTION, CardLoversPlan } from '@/lib/stripe';
import { getAffiliateByCode } from '@/lib/affiliates';
import Stripe from 'stripe';

// Create Supabase client for auth
function getSupabaseClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);
    const supabase = getSupabaseClient(accessToken);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { plan, ref_code } = body as { plan: CardLoversPlan; ref_code?: string };

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "monthly" or "annual"' },
        { status: 400 }
      );
    }

    const subscriptionPlan = CARD_LOVERS_SUBSCRIPTION[plan];

    // Check if user already has an active subscription
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userCredits } = await serviceClient
      .from('user_credits')
      .select('is_card_lover, card_lover_current_period_end, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (userCredits?.is_card_lover && userCredits?.card_lover_current_period_end) {
      const periodEnd = new Date(userCredits.card_lover_current_period_end);
      if (periodEnd > new Date()) {
        return NextResponse.json(
          { error: 'You already have an active Card Lovers subscription' },
          { status: 400 }
        );
      }
    }

    // Determine URLs with origin validation (same pattern as checkout route)
    const allowedOrigins = [
      'https://dcmgrading.com',
      'https://www.dcmgrading.com',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
    ];
    const requestOrigin = request.headers.get('origin');
    const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : 'https://www.dcmgrading.com';

    // Look up affiliate if ref_code provided
    let affiliateCode: string | undefined;
    if (ref_code) {
      const affiliate = await getAffiliateByCode(ref_code);
      if (affiliate && affiliate.status === 'active') {
        affiliateCode = affiliate.code;
      }
    }

    // Build session metadata
    const sessionMetadata: Record<string, string> = {
      userId: user.id,
      plan,
    };
    if (affiliateCode) {
      sessionMetadata.ref_code = affiliateCode;
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: subscriptionPlan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/card-lovers/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/card-lovers`,
      metadata: sessionMetadata,
      subscription_data: {
        metadata: sessionMetadata,
      },
    };

    // Use existing Stripe customer if available
    if (userCredits?.stripe_customer_id) {
      sessionParams.customer = userCredits.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: unknown) {
    console.error('Error creating subscription checkout:', error);

    // Return more specific error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    );
  }
}
