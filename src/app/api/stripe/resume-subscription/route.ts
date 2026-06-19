/**
 * Resume Card Lovers Subscription API
 * Undoes a pending cancellation (cancel_at_period_end: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, findCardLoversSubscription } from '@/lib/stripe';

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

    // Resolve the subscription the same way cancel does — prefer the DB id,
    // fall back to Stripe by customer id when our DB is out of sync.
    let subscriptionId = userCredits.card_lover_subscription_id as string | null;
    if (!subscriptionId && userCredits.stripe_customer_id) {
      const found = await findCardLoversSubscription(userCredits.stripe_customer_id);
      if (found) subscriptionId = found.id;
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Resume the subscription by removing cancel_at_period_end
    await stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    // Clear the pending-cancel markers immediately + log the reversal, so the
    // account page reflects it without waiting for the webhook round-trip.
    await serviceClient
      .from('user_credits')
      .update({
        card_lover_subscription_id: subscriptionId,
        card_lover_cancel_at_period_end: false,
        card_lover_cancel_at: null,
      })
      .eq('user_id', user.id);

    await serviceClient.from('subscription_events').insert({
      user_id: user.id,
      event_type: 'resume_requested',
      plan: userCredits.card_lover_plan,
      credits_added: 0,
      bonus_credits: 0,
      stripe_subscription_id: subscriptionId,
      metadata: { requested_via: 'account_page' },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription resumed successfully',
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return NextResponse.json(
      { error: 'Failed to resume subscription' },
      { status: 500 }
    );
  }
}
