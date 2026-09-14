/**
 * Referral Partner (affiliate) self-service API
 * GET: returns the caller's own affiliate row, headline stats, and recent rewards.
 * Returns { affiliate: null } when the caller is not an approved partner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Rewards that count as a referred customer (a reversed row does not).
const COUNTED_STATUSES = ['pending', 'approved', 'paid'];

// Defaults if the affiliate row predates the per-partner override columns.
const DEFAULT_DISCOUNT_PERCENT = 15;
const DEFAULT_REWARD_CREDITS = 20;

interface RewardRow {
  created_at: string | null;
  status: string | null;
  reward_credits: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = authResult.user.id;

    const { data: affiliate, error: affiliateError } = await supabaseAdmin
      .from('affiliates')
      .select('id, code, status, discount_percent, reward_credits')
      .eq('user_id', userId)
      .neq('status', 'deactivated')
      .limit(1)
      .maybeSingle();

    if (affiliateError) {
      console.error('Error fetching affiliate for user:', affiliateError);
      return NextResponse.json({ error: 'Failed to load partner details' }, { status: 500 });
    }

    if (!affiliate) {
      return NextResponse.json({ affiliate: null });
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [clicksResult, referralsResult, rewardsResult] = await Promise.all([
      supabaseAdmin
        .from('affiliate_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliate.id)
        .gte('created_at', since.toISOString()),
      supabaseAdmin
        .from('affiliate_commissions')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliate.id)
        .in('status', COUNTED_STATUSES),
      supabaseAdmin
        .from('affiliate_commissions')
        .select('created_at, status, reward_credits')
        .eq('affiliate_id', affiliate.id)
        .in('status', COUNTED_STATUSES)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const rewards = (rewardsResult.data || []) as RewardRow[];

    let creditsEarned = 0;
    let pendingCredits = 0;
    for (const row of rewards) {
      const credits = row.reward_credits || 0;
      if (row.status === 'paid') creditsEarned += credits;
      else if (row.status === 'pending') pendingCredits += credits;
    }

    const recent = rewards.slice(0, 10).map((row) => ({
      createdAt: row.created_at,
      rewardCredits: row.reward_credits || 0,
      status: row.status,
    }));

    return NextResponse.json({
      affiliate: {
        code: affiliate.code,
        status: affiliate.status,
        discountPercent: affiliate.discount_percent ?? DEFAULT_DISCOUNT_PERCENT,
        rewardCredits: affiliate.reward_credits ?? DEFAULT_REWARD_CREDITS,
        link: `https://dcmgrading.com/?ref=${affiliate.code}`,
      },
      stats: {
        clicks30d: clicksResult.count || 0,
        referrals: referralsResult.count || 0,
        creditsEarned,
        pendingCredits,
        lastReferralAt: rewards[0]?.created_at || null,
      },
      recent,
    });
  } catch (error) {
    console.error('Affiliate self-service error:', error);
    return NextResponse.json({ error: 'Failed to load partner details' }, { status: 500 });
  }
}
