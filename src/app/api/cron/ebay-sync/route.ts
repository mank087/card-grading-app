/**
 * eBay Listings Sync Cron
 *
 * Runs every 15 minutes. For each user with active eBay listings:
 *   1. Fetches their full GetMyeBaySelling state (one API call per user)
 *   2. Matches eBay items back to ebay_listings rows by listing_id
 *   3. Updates view_count, watch_count, last_synced_at
 *   4. Promotes status to 'sold' or 'ended' when items leave the ActiveList
 *
 * Throttled to MAX_USERS_PER_RUN users per invocation, prioritizing those
 * with the stalest data (NULL last_synced_at first, then oldest first).
 * That gives a self-balancing sync cadence without hammering eBay's rate
 * limits.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` —
 * matches the pattern in /api/cron/send-scheduled-emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEbayConnection, getValidAccessToken } from '@/lib/ebay/auth';
import { getMyEbaySelling, type EbaySellingItem } from '@/lib/ebay/sellApi';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_USERS_PER_RUN = 50;
const USE_SANDBOX = process.env.EBAY_USE_SANDBOX === 'true';

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
    let userFailures = 0;

    for (const userId of userIds) {
      try {
        const result = await syncUser(userId);
        usersProcessed++;
        listingsUpdated += result.updated;
        listingsMarkedSold += result.sold;
        listingsMarkedEnded += result.ended;
      } catch (err: any) {
        userFailures++;
        console.error(`[ebay-sync] User ${userId} failed:`, err.message || err);
      }
      // Light pacing between users to be polite to the Trading API.
      // 250ms × 50 users = 12.5s — well under Vercel's cron timeout.
      await new Promise(r => setTimeout(r, 250));
    }

    console.log(`[ebay-sync] Done: ${usersProcessed} users, ${listingsUpdated} updated, ` +
                `${listingsMarkedSold} sold, ${listingsMarkedEnded} ended, ${userFailures} failures`);

    return NextResponse.json({
      success: true,
      usersProcessed,
      listingsUpdated,
      listingsMarkedSold,
      listingsMarkedEnded,
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
 * Pick the N users whose active listings are most overdue for a sync.
 * Distinct user_ids from ebay_listings WHERE status='active', ordered so
 * never-synced rows come first, then oldest last_synced_at.
 */
async function pickUsersToSync(limit: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('ebay_listings')
    .select('user_id, last_synced_at')
    .eq('status', 'active')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit * 10); // pull extra to dedupe to N distinct users

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

/**
 * Sync one user's active listings.
 *
 * Trade-off: we ask eBay for ActiveList + SoldList + UnsoldList in one call.
 * For users with 10+ active listings this is cheaper than per-listing
 * GetItem calls and gives us status transitions for free.
 */
async function syncUser(userId: string): Promise<{ updated: number; sold: number; ended: number }> {
  const connection = await getEbayConnection(userId);
  if (!connection) {
    // User disconnected since we picked them — mark their listings synced
    // so we don't keep retrying.
    await supabaseAdmin
      .from('ebay_listings')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');
    return { updated: 0, sold: 0, ended: 0 };
  }

  const accessToken = await getValidAccessToken(userId);
  const ebayState = await getMyEbaySelling(
    { accessToken, sandbox: USE_SANDBOX },
    { activeEntries: 200, soldEntries: 200, unsoldEntries: 200 }
  );

  // Pull this user's current DB rows so we can diff against eBay.
  const { data: dbRows } = await supabaseAdmin
    .from('ebay_listings')
    .select('id, listing_id, status')
    .eq('user_id', userId);

  const dbByListingId = new Map<string, { id: string; status: string }>();
  for (const row of dbRows ?? []) {
    if (row.listing_id) dbByListingId.set(row.listing_id, row);
  }

  const activeByListingId = new Map<string, EbaySellingItem>();
  for (const item of ebayState.active) activeByListingId.set(item.itemId, item);
  const soldByListingId = new Map<string, EbaySellingItem>();
  for (const item of ebayState.sold) soldByListingId.set(item.itemId, item);
  const unsoldByListingId = new Map<string, EbaySellingItem>();
  for (const item of ebayState.unsold) unsoldByListingId.set(item.itemId, item);

  const now = new Date().toISOString();
  let updated = 0;
  let sold = 0;
  let ended = 0;

  // For each DB row that's currently active, decide its new state.
  for (const [listingId, dbRow] of dbByListingId.entries()) {
    if (dbRow.status !== 'active') continue; // Only re-evaluate active rows

    if (activeByListingId.has(listingId)) {
      // Still active on eBay — refresh counters
      const item = activeByListingId.get(listingId)!;
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          view_count: item.hitCount ?? 0,
          watch_count: item.watchCount ?? 0,
          last_synced_at: now,
        })
        .eq('id', dbRow.id);
      updated++;
    } else if (soldByListingId.has(listingId)) {
      // Migrated to SoldList — promote to 'sold'
      const item = soldByListingId.get(listingId)!;
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          status: 'sold',
          quantity_sold: item.quantitySold ?? 1,
          sold_at: item.endTime ?? now,
          last_synced_at: now,
        })
        .eq('id', dbRow.id);
      sold++;
    } else if (unsoldByListingId.has(listingId)) {
      // Migrated to UnsoldList — ended without selling
      const item = unsoldByListingId.get(listingId)!;
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          status: 'ended',
          ended_at: item.endTime ?? now,
          last_synced_at: now,
        })
        .eq('id', dbRow.id);
      ended++;
    } else {
      // Not in any of the three lists — eBay's response truncated
      // (user has more than 200 in some bucket) or the listing was
      // manually deleted on eBay. Just stamp last_synced_at so we
      // try again next run.
      await supabaseAdmin
        .from('ebay_listings')
        .update({ last_synced_at: now })
        .eq('id', dbRow.id);
    }
  }

  return { updated, sold, ended };
}

// POST is identical to GET — supports manual triggers from /admin
// without requiring CORS preflight or method-aware tooling.
export async function POST(request: NextRequest) {
  return GET(request);
}
