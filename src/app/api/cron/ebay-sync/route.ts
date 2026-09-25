/**
 * eBay Listings Sync Cron
 *
 * Runs hourly (vercel.json). For each user with active eBay listings,
 * reconciles ebay_listings against the live state of their eBay account
 * via the shared syncUser helper in src/lib/ebay/sync.ts.
 *
 * Budget allocation:
 *   - TOTAL_CAP GetItem fallback calls per cron run.
 *   - PER_USER_CAP GetItem calls per user per cron run.
 *
 * Per-user cap matters because a single power-user with hundreds of stale
 * orphans would otherwise consume the entire run's budget and starve
 * every other user.
 *
 * Users are picked in stalest-first order so the longest-broken data
 * heals first.
 *
 * Sept 25 2026 call budget: eBay caps the Trading API calls the whole DCM
 * app may make per day (error 518), shared with customers LISTING cards. At
 * every 15 minutes with 50 users and 200 GetItem calls per run, this sync
 * alone could spend 5,000-24,000 calls a day, and listings failed with eBay's
 * "exceeded usage limit" text. Now: hourly, 30 users, 40 GetItem calls (15 per
 * user), users with active listings only except one daily run that includes
 * everyone (Pass 0b revives wrongly-ended rows), and the run stops at the
 * first 518. Worst case ~70 calls/run, ~1,700/day.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` —
 * matches the pattern in /api/cron/send-scheduled-emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncUser } from '@/lib/ebay/sync';
import { EbayQuotaError } from '@/lib/ebay/tradingApi';
import { requireCron } from '@/lib/cronAuth';

const MAX_USERS_PER_RUN = 30;
const TOTAL_CAP = 40;
const PER_USER_CAP = 15;
/** UTC hour of the one daily run that also syncs users with no active listings. */
const FULL_SWEEP_HOUR_UTC = 9;

export async function GET(request: NextRequest) {
  try {
    const auth = requireCron(request, 'ebay-sync');
    if (!auth.ok) return auth.response;

    console.log('[ebay-sync] Starting cron run');

    const fullSweep = new Date().getUTCHours() === FULL_SWEEP_HOUR_UTC;
    const userIds = await pickUsersToSync(MAX_USERS_PER_RUN, fullSweep);
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
    let quotaReached = false;

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
        if (err instanceof EbayQuotaError) {
          // Every further call would fail and still count against the app's
          // daily allowance, which customers need for listing. Stop.
          quotaReached = true;
          console.error('[ebay-sync] eBay call limit reached (518); stopping this run');
          break;
        }
        userFailures++;
        console.error(`[ebay-sync] User ${userId} failed:`, err.message || err);
      }
      // Pacing between users to be polite to the Trading API.
      await new Promise(r => setTimeout(r, 250));
    }

    console.log(`[ebay-sync] Done: ${usersProcessed} users, ${listingsUpdated} updated, ` +
                `${listingsMarkedSold} sold, ${listingsMarkedEnded} ended, ` +
                `${getItemCallsUsed} GetItem calls, ${userFailures} failures` +
                (quotaReached ? ', STOPPED at eBay call limit' : ''));

    return NextResponse.json({
      success: true,
      usersProcessed,
      listingsUpdated,
      listingsMarkedSold,
      listingsMarkedEnded,
      getItemCallsUsed,
      userFailures,
      quotaReached,
      fullSweep,
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
async function pickUsersToSync(limit: number, includeInactive: boolean): Promise<string[]> {
  let query = supabaseAdmin
    .from('ebay_listings')
    .select('user_id, last_synced_at');
  // Hourly runs only need sellers with something live; the daily sweep keeps
  // the all-status behaviour described above.
  if (!includeInactive) query = query.eq('status', 'active');
  const { data, error } = await query
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
