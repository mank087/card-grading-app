/**
 * Upgrade Card Lovers Subscription API
 * Upgrades from monthly to annual plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, CARD_LOVERS_SUBSCRIPTION, getSubscriptionPeriodEnd } from '@/lib/stripe';
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

    // Oct 2026: CHARGE FIRST, CREDIT SECOND. The old call used
    // proration_behavior 'create_prorations', which only queues the price
    // difference as pending invoice items for the NEXT bill, while the credits
    // below were granted immediately (Oct 13: a customer's accidental upgrade
    // added 830 credits and queued $400.75 for a month later; nothing was charged).
    //
    // Now Stripe invoices the prorated difference at once and charges the card
    // on file. With payment_behavior 'error_if_incomplete', a declined card or a
    // payment that needs 3-D Secure makes this call throw and Stripe leaves the
    // subscription unchanged, so nothing is granted. A retry after a database
    // failure finds the subscription already on the annual price and skips the
    // charge (it is never billed twice).
    const annualPriceId = CARD_LOVERS_SUBSCRIPTION.annual.priceId;
    let updatedSubscription = subscription;
    if (subscription.items.data[0]?.price?.id !== annualPriceId) {
      try {
        updatedSubscription = await stripe.subscriptions.update(
          userCredits.card_lover_subscription_id,
          {
            items: [
              {
                id: subscription.items.data[0].id,
                price: annualPriceId,
              },
            ],
            proration_behavior: 'always_invoice',
            payment_behavior: 'error_if_incomplete',
            expand: ['latest_invoice'],
          }
        );
      } catch (stripeError: any) {
        console.warn('[upgrade-subscription] Stripe declined the upgrade charge:', stripeError?.code, stripeError?.message);
        return NextResponse.json(
          {
            error: 'Your card could not be charged for the upgrade, so your plan was not changed. Update your payment method under Manage Subscription and try again.',
            code: stripeError?.code || 'payment_failed',
          },
          { status: 402 }
        );
      }
    }

    // Credits only for a PAID upgrade invoice.
    const latest = (updatedSubscription as any).latest_invoice;
    const invoice = typeof latest === 'string' ? await stripe.invoices.retrieve(latest) : latest;
    if (!invoice || invoice.status !== 'paid') {
      console.error('[upgrade-subscription] Upgrade invoice not paid; no credits granted:', invoice?.id, invoice?.status);
      return NextResponse.json(
        { error: 'The upgrade payment has not completed, so no credits were added. Please contact support if you were charged.', code: 'invoice_not_paid' },
        { status: 402 }
      );
    }

    // Read period_end via the helper — top-level current_period_end is
    // deprecated by Stripe (returns undefined on newer accounts and would
    // cause the upgrade to set a wrong / 30-days-from-now period_end on
    // the user's annual subscription).
    const periodEnd = getSubscriptionPeriodEnd(updatedSubscription);

    // Update our database
    const result = await upgradeCardLoverToAnnual(user.id, {
      subscriptionId: updatedSubscription.id,
      currentPeriodEnd: periodEnd,
      creditsAlreadyGivenThisCycle: creditsAlreadyGiven,
      stripeInvoiceId: invoice.id,
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
      // periodEnd is already a Date — the old `new Date(periodEnd * 1000)`
      // coerced it to an invalid date and .toISOString() threw AFTER the
      // Stripe update + credit grant had succeeded, so every upgrade
      // returned a 500 and the user was told it failed.
      newPeriodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
}
