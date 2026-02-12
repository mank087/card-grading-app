/**
 * Subscription Status API
 * Returns current Card Lovers subscription status
 * Includes reconciliation: if DB is out of sync with Stripe, auto-fixes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, CARD_LOVERS_SUBSCRIPTION, CARD_LOVERS_LOYALTY_BONUSES } from '@/lib/stripe';
import { activateCardLoverSubscription } from '@/lib/credits';

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

export async function GET(request: NextRequest) {
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
      .select(`
        is_card_lover,
        card_lover_subscribed_at,
        card_lover_current_period_end,
        card_lover_subscription_id,
        card_lover_plan,
        card_lover_months_active,
        show_card_lover_badge,
        preferred_label_emblem,
        is_founder,
        show_founder_badge,
        stripe_customer_id
      `)
      .eq('user_id', user.id)
      .single();

    if (creditsError || !userCredits) {
      return NextResponse.json({
        isActive: false,
        plan: null,
        monthsActive: 0,
        currentPeriodEnd: null,
        subscriptionId: null,
        nextLoyaltyBonus: null,
        showBadge: false,
        labelEmblem: 'auto',
      });
    }

    // Check if subscription is active
    let isActive = userCredits.is_card_lover &&
      userCredits.card_lover_current_period_end &&
      new Date(userCredits.card_lover_current_period_end) > new Date();

    // RECONCILIATION: If DB shows no active subscription but user has a Stripe customer,
    // check Stripe for active Card Lovers subscriptions that the webhook may have missed
    if (!isActive && userCredits.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: userCredits.stripe_customer_id,
          status: 'active',
          limit: 10,
        });

        const cardLoversSub = subscriptions.data.find(sub => {
          const priceId = sub.items.data[0]?.price.id;
          return priceId === CARD_LOVERS_SUBSCRIPTION.monthly.priceId ||
                 priceId === CARD_LOVERS_SUBSCRIPTION.annual.priceId;
        });

        if (cardLoversSub) {
          const priceId = cardLoversSub.items.data[0]?.price.id;
          const plan = priceId === CARD_LOVERS_SUBSCRIPTION.annual.priceId ? 'annual' : 'monthly';

          console.log(`[Reconciliation] Found active Stripe Card Lovers subscription ${cardLoversSub.id} for user ${user.id} — activating in DB`);

          // Ensure subscription has userId in metadata for future webhooks
          if (!cardLoversSub.metadata?.userId) {
            await stripe.subscriptions.update(cardLoversSub.id, {
              metadata: { userId: user.id, plan },
            });
          }

          // Activate in our DB
          const periodEnd = (cardLoversSub as any).current_period_end;
          const result = await activateCardLoverSubscription(user.id, {
            plan,
            subscriptionId: cardLoversSub.id,
            currentPeriodEnd: new Date(periodEnd * 1000),
          });

          if (result.success) {
            console.log(`[Reconciliation] Card Lovers activated for user ${user.id}: ${result.creditsAdded} credits added`);
            // Update local variables so the response reflects the new state
            isActive = true;
            userCredits.is_card_lover = true;
            userCredits.card_lover_plan = plan;
            userCredits.card_lover_subscription_id = cardLoversSub.id;
            userCredits.card_lover_current_period_end = new Date(periodEnd * 1000).toISOString();
            userCredits.card_lover_months_active = plan === 'annual' ? 12 : 1;
            userCredits.show_card_lover_badge = true;
          } else {
            console.error(`[Reconciliation] Failed to activate Card Lovers for user ${user.id}:`, result.error);
          }
        }
      } catch (reconcileError) {
        // Don't fail the status check if reconciliation fails
        console.error('[Reconciliation] Error checking Stripe subscriptions:', reconcileError);
      }
    }

    // Check if subscription has a pending cancellation (cancel_at_period_end)
    let cancelAtPeriodEnd = false;
    let cancelAt: string | null = null;
    if (isActive && userCredits.card_lover_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(userCredits.card_lover_subscription_id);
        const subData = subscription as any;
        if (subData.cancel_at_period_end) {
          cancelAtPeriodEnd = true;
          cancelAt = new Date(subData.current_period_end * 1000).toISOString();
        }
      } catch (stripeError) {
        // Don't fail status check if Stripe lookup fails
        console.error('[SubscriptionStatus] Error checking Stripe subscription:', stripeError);
      }
    }

    // Calculate next loyalty bonus for monthly subscribers
    let nextLoyaltyBonus = null;
    if (isActive && userCredits.card_lover_plan === 'monthly') {
      const monthsActive = userCredits.card_lover_months_active || 0;
      const milestones = Object.keys(CARD_LOVERS_LOYALTY_BONUSES)
        .map(Number)
        .sort((a, b) => a - b);

      for (const milestone of milestones) {
        if (monthsActive < milestone) {
          nextLoyaltyBonus = {
            atMonth: milestone,
            credits: CARD_LOVERS_LOYALTY_BONUSES[milestone],
            monthsUntil: milestone - monthsActive,
          };
          break;
        }
      }
    }

    return NextResponse.json({
      isActive,
      plan: userCredits.card_lover_plan,
      monthsActive: userCredits.card_lover_months_active || 0,
      subscribedAt: userCredits.card_lover_subscribed_at,
      currentPeriodEnd: userCredits.card_lover_current_period_end,
      subscriptionId: userCredits.card_lover_subscription_id,
      cancelAtPeriodEnd,
      cancelAt,
      nextLoyaltyBonus,
      showBadge: userCredits.show_card_lover_badge ?? true,
      labelEmblem: userCredits.preferred_label_emblem || 'auto',
      isFounder: userCredits.is_founder,
      showFounderBadge: userCredits.show_founder_badge ?? true,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}
