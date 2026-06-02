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
import { getMyEbaySelling, getItemDetail, type EbaySellingItem } from '@/lib/ebay/sellApi';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_USERS_PER_RUN = 50;
// Hard cap on per-listing GetItem fallback calls per cron invocation.
// Each GetItem takes ~500ms; 200 calls × 500ms ≈ 100s, well under Vercel Pro's
// 300s cron timeout. Big enough that even users with hundreds of stale
// listings converge in 2-3 cron runs.
const MAX_GET_ITEM_CALLS_PER_RUN = 200;
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
    let getItemCallsUsed = 0;
    let userFailures = 0;

    for (const userId of userIds) {
      try {
        const result = await syncUser(userId, MAX_GET_ITEM_CALLS_PER_RUN - getItemCallsUsed);
        usersProcessed++;
        listingsUpdated += result.updated;
        listingsMarkedSold += result.sold;
        listingsMarkedEnded += result.ended;
        getItemCallsUsed += result.getItemCalls;
      } catch (err: any) {
        userFailures++;
        console.error(`[ebay-sync] User ${userId} failed:`, err.message || err);
      }
      // Light pacing between users to be polite to the Trading API.
      // 250ms × 50 users = 12.5s — well under Vercel's cron timeout.
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
async function syncUser(
  userId: string,
  getItemBudget: number
): Promise<{ updated: number; sold: number; ended: number; getItemCalls: number }> {
  const connection = await getEbayConnection(userId);
  if (!connection) {
    // User disconnected since we picked them — mark their listings synced
    // so we don't keep retrying.
    await supabaseAdmin
      .from('ebay_listings')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');
    return { updated: 0, sold: 0, ended: 0, getItemCalls: 0 };
  }

  const accessToken = await getValidAccessToken(userId);
  const apiConfig = { accessToken, sandbox: USE_SANDBOX };
  const ebayState = await getMyEbaySelling(
    apiConfig,
    { activeEntries: 200, soldEntries: 200, unsoldEntries: 200 }
  );

  // Pull this user's current DB rows so we can diff against eBay. Include
  // listing_id and listing_format so we know what was already 'active' vs.
  // already terminal, and so the GetItem fallback can disambiguate sold
  // (quantitySold > 0) from ended (quantitySold = 0).
  const { data: dbRows } = await supabaseAdmin
    .from('ebay_listings')
    .select('id, listing_id, status, last_synced_at')
    .eq('user_id', userId);

  const dbByListingId = new Map<string, { id: string; status: string; last_synced_at: string | null }>();
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
  let getItemCalls = 0;

  // Orphan rows = DB-active rows we couldn't match against any of the three
  // GetMyeBaySelling lists. We resolve these with per-listing GetItem calls
  // below, after the bulk pass, so we know the real budget left.
  const orphans: { id: string; listing_id: string; last_synced_at: string | null }[] = [];

  // ---------------- First pass: bulk-categorise via GetMyeBaySelling ----------------
  for (const [listingId, dbRow] of dbByListingId.entries()) {
    if (dbRow.status !== 'active') continue;

    if (activeByListingId.has(listingId)) {
      const item = activeByListingId.get(listingId)!;
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          // HitCount isn't returned by GetMyeBaySelling — kept at 0 unless
          // the GetItem fallback (below) refreshes it.
          view_count: item.hitCount ?? undefined,
          watch_count: item.watchCount ?? 0,
          last_synced_at: now,
        })
        .eq('id', dbRow.id);
      updated++;
    } else if (soldByListingId.has(listingId)) {
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
      // Orphan — defer to GetItem pass.
      orphans.push({ id: dbRow.id, listing_id: listingId, last_synced_at: dbRow.last_synced_at });
    }
  }

  // ---------------- Second pass: per-listing GetItem for orphans ----------------
  // Resolve orphans starting from the stalest first (never-synced rows ahead
  // of recently-synced ones) so the longest-broken data heals first.
  orphans.sort((a, b) => {
    if (!a.last_synced_at && b.last_synced_at) return -1;
    if (a.last_synced_at && !b.last_synced_at) return 1;
    if (!a.last_synced_at && !b.last_synced_at) return 0;
    return (a.last_synced_at as string).localeCompare(b.last_synced_at as string);
  });

  for (const orphan of orphans) {
    if (getItemCalls >= getItemBudget) break;
    const detail = await getItemDetail(apiConfig, orphan.listing_id);
    getItemCalls++;

    if (!detail) {
      // GetItem returned null — eBay couldn't find the item. This happens
      // when:
      //   - The listing ended so long ago that eBay archived it (most common
      //     for fixed-duration listings older than ~60–120 days)
      //   - The seller manually deleted it on eBay
      //   - The itemId in our DB is stale or wrong
      //
      // None of those scenarios are "still actively live for sale," so we
      // promote the row to 'ended'. If a future ground-truth disagrees,
      // user can refresh or we can correct via a follow-up. Keeping it
      // 'active' was the worse default — it kept stale rows on the My
      // Listings tab forever.
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          status: 'ended',
          ended_at: now,
          last_synced_at: now,
        })
        .eq('id', orphan.id);
      ended++;
      continue;
    }

    if (detail.listingStatus === 'Active') {
      // Truly still active — eBay's bulk list just truncated. Refresh counts.
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          view_count: detail.hitCount ?? undefined,
          watch_count: detail.watchCount ?? 0,
          last_synced_at: now,
        })
        .eq('id', orphan.id);
      updated++;
    } else if (detail.listingStatus === 'Completed' && detail.quantitySold > 0) {
      // Ended with at least one sale.
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          status: 'sold',
          quantity_sold: detail.quantitySold,
          sold_at: detail.endTime ?? now,
          last_synced_at: now,
        })
        .eq('id', orphan.id);
      sold++;
    } else {
      // Completed without a sale, Ended (manually), Custom — treat as ended.
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          status: 'ended',
          ended_at: detail.endTime ?? now,
          last_synced_at: now,
        })
        .eq('id', orphan.id);
      ended++;
    }

    // Light pacing between GetItem calls.
    await new Promise(r => setTimeout(r, 100));
  }

  return { updated, sold, ended, getItemCalls };
}

// POST is identical to GET — supports manual triggers from /admin
// without requiring CORS preflight or method-aware tooling.
export async function POST(request: NextRequest) {
  return GET(request);
}
