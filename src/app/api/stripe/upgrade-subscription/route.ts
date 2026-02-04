/**
 * Upgrade Card Lovers Subscription API
 * Upgrades from monthly to annual plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, CARD_LOVERS_SUBSCRIPTION } from '@/lib/stripe';
import { upgradeCardLoverToAnnual } from '@/lib/credits';

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
      .select('card_lover_subscription_id, card_lover_plan, is_card_lover, card_lover_months_active')
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

    if (userCredits.card_lover_plan === 'annual') {
      return NextResponse.json(
        { error: 'Already on annual plan' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(
      userCredits.card_lover_subscription_id
    );

    // Calculate credits already given this cycle (70 per month)
    const creditsAlreadyGiven = 70 * (userCredits.card_lover_months_active || 1);

    // Update subscription to annual plan
    // Stripe will handle proration of the payment
    const updatedSubscription = await stripe.subscriptions.update(
      userCredits.card_lover_subscription_id,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: CARD_LOVERS_SUBSCRIPTION.annual.priceId,
          },
        ],
        proration_behavior: 'create_prorations',
      }
    );

    // Access period_end from subscription object
    const periodEnd = (updatedSubscription as unknown as { current_period_end: number }).current_period_end;

    // Update our database
    const result = await upgradeCardLoverToAnnual(user.id, {
      subscriptionId: updatedSubscription.id,
      currentPeriodEnd: new Date(periodEnd * 1000),
      creditsAlreadyGivenThisCycle: creditsAlreadyGiven,
    });

    if (!result.success) {
      console.error('Failed to update database for upgrade:', result.error);
      // Note: Stripe subscription was already updated, so we don't roll back
      // The webhook will eventually sync the state
    }

    return NextResponse.json({
      success: true,
      message: 'Upgraded to annual plan',
      creditsAdded: result.creditsAdded,
      newPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
}
