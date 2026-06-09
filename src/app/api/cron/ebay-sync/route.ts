/**
 * eBay Listings Sync Cron
 *
 * Runs every 15 minutes. For each user with active eBay listings,
 * reconciles ebay_listings against the live state of their eBay account
 * via the shared syncUser helper in src/lib/ebay/sync.ts.
 *
 * Budget allocation:
 *   - TOTAL_CAP = 200 GetItem fallback calls per cron run (Vercel Pro
 *     timeout = 300s; 200 × 500ms = 100s with headroom).
 *   - PER_USER_CAP = 60 GetItem calls per user per cron run.
 *
 * Per-user cap matters because a single power-user with hundreds of stale
 * orphans would otherwise consume the entire run's budget and starve
 * every other user. With 60 each and 200 total, we comfortably handle
 * 3-4 power-users per cron OR many lighter users sharing fairly.
 *
 * Users are picked in stalest-first order so the longest-broken data
 * heals first.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` —
 * matches the pattern in /api/cron/send-scheduled-emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncUser } from '@/lib/ebay/sync';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_USERS_PER_RUN = 50;
const TOTAL_CAP = 200;
const PER_USER_CAP = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ebay-sync] Starting cron run');

    const userIds = await pickUsersToSync(MAX_USERS_PER_RUN);
    if (userIds.length === 0) {
      console.log('[ebay-sync] No users with active listings to sync');
      return NextResponse.json({ success: true, usersProcessed: 0 });
    }
    console.log(`[ebay-sync] Syncing ${userIds.length} user(s)`);

    let usersProcessed = 0;
    let listingsUpdated = 0;
    let listingsMarkedSold = 0;
    let listingsMarkedEnded = 0;
    let getItemCallsUsed = 0;
    let userFailures = 0;

    for (const userId of userIds) {
      const remainingBudget = TOTAL_CAP - getItemCallsUsed;
      if (remainingBudget <= 0) {
        console.log('[ebay-sync] Total budget exhausted, deferring remaining users to next run');
        break;
      }
      const perUserBudget = Math.min(PER_USER_CAP, remainingBudget);

      try {
        const result = await syncUser(userId, { getItemBudget: perUserBudget });
        usersProcessed++;
        listingsUpdated += result.updated;
        listingsMarkedSold += result.sold;
        listingsMarkedEnded += result.ended;
        getItemCallsUsed += result.getItemCalls;
      } catch (err: any) {
        userFailures++;
        console.error(`[ebay-sync] User ${userId} failed:`, err.message || err);
      }
      // Pacing between users to be polite to the Trading API.
      await new Promise(r => setTimeout(r, 250));
    }

    console.log(`[ebay-sync] Done: ${usersProcessed} users, ${listingsUpdated} updated, ` +
                `${listingsMarkedSold} sold, ${listingsMarkedEnded} ended, ` +
                `${getItemCallsUsed} GetItem calls, ${userFailures} failures`);

    return NextResponse.json({
      success: true,
      usersProcessed,
      listingsUpdated,
      listingsMarkedSold,
      listingsMarkedEnded,
      getItemCallsUsed,
      userFailures,
    });
  } catch (err: any) {
    console.error('[ebay-sync] Job failed:', err);
    return NextResponse.json(
      { error: 'Cron job failed', message: err.message },
      { status: 500 }
    );
  }
}

/**
 * Pick the N users whose listings are most overdue for a sync.
 *
 * Distinct user_ids from ebay_listings across ALL statuses (not just
 * 'active'), ordered so never-synced rows come first, then oldest
 * last_synced_at. The earlier version filtered to status='active' rows
 * only, which meant a user whose listings were all incorrectly marked
 * 'ended' (by the now-fixed Pass 0b gap) was never picked for sync
 * again and stayed stuck. Considering all rows lets sync.ts heal those
 * stuck users on the next cron tick.
 *
 * The TOTAL_CAP + PER_USER_CAP budgets in the caller still protect us
 * against expensive runs.
 */
async function pickUsersToSync(limit: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('ebay_listings')
    .select('user_id, last_synced_at')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit * 20);

  if (error) {
    console.error('[ebay-sync] pickUsersToSync error:', error);
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.user_id)) {
      seen.add(row.user_id);
      result.push(row.user_id);
      if (result.length >= limit) break;
    }
  }
  return result;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
