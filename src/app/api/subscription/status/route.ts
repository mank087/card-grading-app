/**
 * Subscription Status API
 * Returns current Card Lovers subscription status
 * Includes reconciliation: if DB is out of sync with Stripe, auto-fixes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, CARD_LOVERS_SUBSCRIPTION, CARD_LOVERS_LOYALTY_BONUSES, getSubscriptionPeriodEnd } from '@/lib/stripe';
import { activateCardLoverSubscription, processCardLoverRenewal } from '@/lib/credits';

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

          // Use the helper to read period_end so annual subs don't fall
          // through to the "now + 30 days" fallback (the bug that broke
          // Toby Smart's annual sub before commit bb6d022).
          const periodEnd = getSubscriptionPeriodEnd(cardLoversSub);

          // Decide whether any CREDITS are owed, and grant them only through
          // the normal idempotent paths. The old code called
          // activateCardLoverSubscription unconditionally, which (a) granted
          // a fresh 70/900 every time reconciliation fired — including the
          // routine renewal-day window where period_end has rolled but the
          // renewal invoice hasn't settled yet, after which invoice.paid
          // granted AGAIN — and (b) reset months_active/subscribed_at,
          // wiping loyalty progress for long-tenured monthly members.
          const hadSubBefore = !!(userCredits.card_lover_subscription_id || userCredits.card_lover_plan);
          let granted = false;

          // Restore the flags FIRST (regains access immediately, and makes
          // processCardLoverRenewal below read the correct current plan).
          // Balance, months_active, subscribed_at, and badge preference are
          // deliberately untouched here.
          await serviceClient
            .from('user_credits')
            .update({
              is_card_lover: true,
              card_lover_plan: plan,
              card_lover_subscription_id: cardLoversSub.id,
              card_lover_current_period_end: periodEnd.toISOString(),
            })
            .eq('user_id', user.id);

          if (!hadSubBefore) {
            // Never activated in our DB → the checkout webhook was missed.
            // Full activation (grant + flags) is correct here.
            const result = await activateCardLoverSubscription(user.id, {
              plan,
              subscriptionId: cardLoversSub.id,
              currentPeriodEnd: periodEnd,
            });
            if (result.success) {
              console.log(`[Reconciliation] Missed activation repaired for user ${user.id}: ${result.creditsAdded} credits added`);
              granted = true;
              userCredits.card_lover_months_active = plan === 'annual' ? 12 : 1;
            } else {
              console.error(`[Reconciliation] Failed to activate Card Lovers for user ${user.id}:`, result.error);
            }
          } else {
            // Existing member whose DB lapsed → check whether the current
            // period's invoice is actually PAID. If it is and we never
            // credited it, the invoice.paid webhook was missed — grant via
            // processCardLoverRenewal, whose stripe_invoice_id idempotency
            // makes this safe against the webhook later arriving/replaying.
            // If the invoice isn't paid yet (renewal-day window), grant
            // nothing — the webhook will credit it when it settles.
            const latestInvoiceId = typeof cardLoversSub.latest_invoice === 'string'
              ? cardLoversSub.latest_invoice
              : cardLoversSub.latest_invoice?.id;
            if (latestInvoiceId) {
              const invoice = await stripe.invoices.retrieve(latestInvoiceId);
              if (invoice.status === 'paid' && invoice.billing_reason === 'subscription_cycle') {
                const result = await processCardLoverRenewal(user.id, {
                  stripeInvoiceId: invoice.id ?? latestInvoiceId,
                  subscriptionId: cardLoversSub.id,
                  currentPeriodEnd: periodEnd,
                });
                if (result.success && result.creditsAdded > 0) {
                  console.log(`[Reconciliation] Missed renewal repaired for user ${user.id}: ${result.creditsAdded} credits added`);
                  granted = true;
                  userCredits.card_lover_months_active = (userCredits.card_lover_months_active || 0) + 1;
                }
              } else if (invoice.status === 'paid' && invoice.billing_reason === 'subscription_create') {
                // A NEW subscription our DB never activated (resubscribe
                // after a past cancellation, with the checkout webhook
                // missed — old card_lover_* fields made hadSubBefore true).
                // Only grant if no grant event exists for THIS subscription.
                const { data: prior } = await serviceClient
                  .from('subscription_events')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('stripe_subscription_id', cardLoversSub.id)
                  .in('event_type', ['subscribed', 'renewed'])
                  .limit(1);
                if (!prior || prior.length === 0) {
                  const result = await activateCardLoverSubscription(user.id, {
                    plan,
                    subscriptionId: cardLoversSub.id,
                    currentPeriodEnd: periodEnd,
                  });
                  if (result.success) {
                    console.log(`[Reconciliation] Missed resubscription repaired for user ${user.id}: ${result.creditsAdded} credits added`);
                    granted = true;
                    userCredits.card_lover_months_active = plan === 'annual' ? 12 : 1;
                  }
                }
              }
            }
          }

          await serviceClient.from('subscription_events').insert({
            user_id: user.id,
            event_type: 'reconciled',
            plan,
            credits_added: 0,
            bonus_credits: 0,
            stripe_subscription_id: cardLoversSub.id,
            metadata: { granted_credits: granted, restored_flags: true },
          });

          console.log(`[Reconciliation] Flags restored for user ${user.id} (credits granted: ${granted})`);
          // Update local variables so the response reflects the new state
          isActive = true;
          userCredits.is_card_lover = true;
          userCredits.card_lover_plan = plan;
          userCredits.card_lover_subscription_id = cardLoversSub.id;
          userCredits.card_lover_current_period_end = periodEnd.toISOString();
        }
      } catch (reconcileError) {
        // Don't fail the status check if reconciliation fails
        console.error('[Reconciliation] Error checking Stripe subscriptions:', reconcileError);
      }
    }

    // Inspect the live Stripe subscription whenever we have one on file —
    // NOT just when isActive. A past-due / lapsed member (renewal failed,
    // period end in the past → isActive false) still has a real Stripe
    // subscription they must be able to cancel. Gating this on isActive hid
    // the cancel button from exactly the people most likely to need it.
    let cancelAtPeriodEnd = false;
    let cancelAt: string | null = null;
    let subscriptionStatus: string | null = null;
    let hasManageableSubscription = false;
    if (userCredits.card_lover_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(userCredits.card_lover_subscription_id);
        subscriptionStatus = subscription.status;
        cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
        if (cancelAtPeriodEnd) {
          // Use the helper — top-level current_period_end is deprecated;
          // reading from there returned undefined → wrong cancelAt date
          // shown on the account page after pending cancellation.
          cancelAt = getSubscriptionPeriodEnd(subscription).toISOString();
        }
        // Manageable = a live subscription that isn't already gone. These
        // are the states where Stripe still considers the sub real and a
        // cancel (or resume) is meaningful.
        hasManageableSubscription = ['active', 'past_due', 'trialing', 'unpaid'].includes(subscription.status);
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
      // Whether there's a Stripe subscription the user can still cancel/manage,
      // independent of isActive (benefit gating). Drives the cancel button so
      // past-due / lapsed members can still self-cancel.
      hasManageableSubscription,
      subscriptionStatus,
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
