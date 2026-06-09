/**
 * POST /api/ebay/sync-me
 *
 * On-demand sync for the calling user only. Fires when a user opens
 * /instalist-marketplace so the dashboard converges in seconds instead
 * of waiting for the next scheduled 15-min cron.
 *
 * Different from the cron in three ways:
 *   1. Single user (the authenticated caller) instead of fair-share rotation
 *   2. Higher GetItem budget (500) since the user is actively waiting
 *   3. Rate-limited to one real sync per RATE_LIMIT_WINDOW_MS per user
 *      (currently 3 minutes). Repeated calls inside the window return
 *      skipped=true without doing work — keeps Resend / eBay rate limits
 *      protected against impatient page refreshes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import {
  syncUser,
  getLastSyncedAtForUser,
  countActiveListingsForUser,
} from '@/lib/ebay/sync';

const PER_USER_GET_ITEM_BUDGET = 500;
const RATE_LIMIT_WINDOW_MS = 3 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = auth.user.id;

    const activeCount = await countActiveListingsForUser(userId);
    // We used to early-exit when activeCount === 0, but that left users
    // whose listings were all stuck on a terminal status (because of the
    // now-patched sync.ts Pass 0b gap) with no way to trigger the heal.
    // Running syncUser on zero-active users is cheap: one GetMyeBaySelling
    // call and a handful of UPDATEs at most. Keep the response shape and
    // pass activeCount through for the client.

    // Rate-limit: most recent last_synced_at must be older than the window.
    // The cron stamps every active row with last_synced_at on every pass,
    // so this naturally throttles both manual refreshes and rapid retries.
    const lastSynced = await getLastSyncedAtForUser(userId);
    if (lastSynced) {
      const msSince = Date.now() - lastSynced.getTime();
      if (msSince < RATE_LIMIT_WINDOW_MS) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'Recently synced',
          lastSyncedAt: lastSynced.toISOString(),
          activeCount,
          retryAfterSec: Math.ceil((RATE_LIMIT_WINDOW_MS - msSince) / 1000),
        });
      }
    }

    const result = await syncUser(userId, {
      getItemBudget: PER_USER_GET_ITEM_BUDGET,
      // Slightly faster pacing — the user is waiting and we're a single user
      // so we don't need to throttle as much as the cron does.
      perCallSleepMs: 50,
    });

    return NextResponse.json({
      success: true,
      activeCount,
      ...result,
    });
  } catch (err: any) {
    console.error('[sync-me] error:', err);
    return NextResponse.json(
      { error: err.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
