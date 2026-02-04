/**
 * Subscription Status API
 * Returns current Card Lovers subscription status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CARD_LOVERS_LOYALTY_BONUSES } from '@/lib/stripe';

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
        show_founder_badge
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
    const isActive = userCredits.is_card_lover &&
      userCredits.card_lover_current_period_end &&
      new Date(userCredits.card_lover_current_period_end) > new Date();

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
