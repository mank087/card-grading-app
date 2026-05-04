/**
 * Cancel Card Lovers Subscription API
 * Cancels a subscription at the end of the current billing period
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, getSubscriptionPeriodEnd } from '@/lib/stripe';

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

    // Get user's subscription info
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userCredits, error: creditsError } = await serviceClient
      .from('user_credits')
      .select('card_lover_subscription_id, is_card_lover')
      .eq('user_id', user.id)
      .single();

    if (creditsError || !userCredits) {
      return NextResponse.json(
        { error: 'User credits not found' },
        { status: 404 }
      );
    }

    if (!userCredits.is_card_lover || !userCredits.card_lover_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Cancel subscription at period end (not immediately)
    const subscription = await stripe.subscriptions.update(
      userCredits.card_lover_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    // Read period_end via the helper — Stripe deprecated subscription.
    // current_period_end at the top level (returns undefined on newer
    // accounts); the helper reads from items.data[0] with fallback.
    const cancelAt = getSubscriptionPeriodEnd(subscription);

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period',
      cancelAt: cancelAt.toISOString(),
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
