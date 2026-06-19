/**
 * Cancel Card Lovers Subscription API
 * Cancels a subscription at the end of the current billing period
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, getSubscriptionPeriodEnd, findCardLoversSubscription } from '@/lib/stripe';

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
      .select('card_lover_subscription_id, is_card_lover, card_lover_plan, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (creditsError || !userCredits) {
      return NextResponse.json(
        { error: 'User credits not found' },
        { status: 404 }
      );
    }

    // Resolve which Stripe subscription to cancel. Prefer the id our DB has
    // on file, but fall back to looking it up directly from Stripe by
    // customer id. The DB can be out of sync (missed webhook, lapsed period
    // that flipped is_card_lover off) while Stripe is STILL billing a live
    // subscription — refusing here would trap the user with a sub they
    // can't cancel. Stripe is the source of truth for "is there a sub".
    let subscriptionId = userCredits.card_lover_subscription_id as string | null;
    if (!subscriptionId && userCredits.stripe_customer_id) {
      const found = await findCardLoversSubscription(userCredits.stripe_customer_id);
      if (found) {
        subscriptionId = found.id;
        console.log(`[cancel-subscription] DB had no subscription id for user ${user.id}; resolved ${found.id} from Stripe by customer.`);
      }
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Cancel subscription at period end (not immediately)
    const subscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Read period_end via the helper — Stripe deprecated subscription.
    // current_period_end at the top level (returns undefined on newer
    // accounts); the helper reads from items.data[0] with fallback.
    const cancelAt = getSubscriptionPeriodEnd(subscription);

    // Persist the pending cancellation + log an audit event NOW, at request
    // time — don't wait for the customer.subscription.updated webhook to
    // round-trip (and historically that handler recorded nothing). This
    // gives an immediate, queryable record that the user asked to cancel.
    await serviceClient
      .from('user_credits')
      .update({
        card_lover_subscription_id: subscriptionId,
        card_lover_cancel_at_period_end: true,
        card_lover_cancel_at: cancelAt.toISOString(),
      })
      .eq('user_id', user.id);

    await serviceClient.from('subscription_events').insert({
      user_id: user.id,
      event_type: 'cancellation_requested',
      plan: userCredits.card_lover_plan,
      credits_added: 0,
      bonus_credits: 0,
      stripe_subscription_id: subscriptionId,
      metadata: {
        cancel_at: cancelAt.toISOString(),
        requested_via: 'account_page',
        resolved_from_stripe: !userCredits.card_lover_subscription_id,
      },
    });

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
