/**
 * Per-user eBay listing sync.
 *
 * Used by:
 *   - /api/cron/ebay-sync       (scheduled, 15-min cadence, all users)
 *   - /api/ebay/sync-me         (on-demand, single user, larger budget)
 *
 * The function reconciles a user's local ebay_listings rows against
 * the current truth from eBay's Trading API:
 *
 *   Pass 1 — GetMyeBaySelling (bulk, cheap): bucket each DB-active row as
 *     still active, sold, unsold, or orphan based on which list it appears
 *     in. Refreshes view/watch counts on still-active rows. Orphans are
 *     listings that ended outside eBay's 60-day GetMyeBaySelling window or
 *     were never returned by the bulk call.
 *
 *   Pass 2 — GetItem (per-listing, expensive): resolves orphans up to a
 *     caller-provided budget. Each GetItem call costs ~500ms + an eBay
 *     rate-limit slot, so we cap aggressively.
 *
 * GetItem-null is treated as ENDED, not "unknown" — eBay only returns null
 * when the listing has been archived long enough that it can't possibly
 * still be live for sale. Keeping such rows flagged active forever was the
 * original v1 bug; null → ended is the corrected default.
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEbayConnection, getValidAccessToken } from '@/lib/ebay/auth';
import { getMyEbaySelling, getItemDetail, type EbaySellingItem } from '@/lib/ebay/sellApi';

/**
 * Final sale price for a sold listing, or null when eBay didn't expose one.
 *
 * ebay_listings.price holds the seller's ask while a listing is live; once
 * the row transitions to 'sold' it is terminal, so we deliberately repurpose
 * the SAME column to hold the FINAL SALE PRICE (auction winning bid,
 * accepted Best Offer amount, or the fixed price) — no schema migration.
 * Without this, /api/ebay/stats and SoldTab computed "revenue" from the
 * stored ask: auctions reported their $0.99 start price and accepted Best
 * Offers reported the original ask.
 *
 * Sources: GetMyeBaySelling SoldList entries carry TransactionPrice and
 * GetItem exposes SellingStatus.CurrentPrice on ended listings; sellApi
 * normalizes both into `currentPrice`. Best-effort by design: when eBay
 * doesn't return a usable positive price we leave the stored price
 * unchanged rather than degrade it.
 */
function finalSalePrice(item: { currentPrice?: number }): number | null {
  const p = item.currentPrice;
  return typeof p === 'number' && isFinite(p) && p > 0 ? p : null;
}

export interface SyncUserResult {
  updated: number;
  sold: number;
  ended: number;
  getItemCalls: number;
}

export interface SyncUserOptions {
  /** Max number of GetItem fallback calls allowed for this user during this run. */
  getItemBudget: number;
  /** Whether to use the eBay sandbox endpoint. Defaults to EBAY_USE_SANDBOX env var. */
  useSandbox?: boolean;
  /** Sleep between GetItem calls in ms. Defaults to 100. */
  perCallSleepMs?: number;
}

export async function syncUser(
  userId: string,
  options: SyncUserOptions
): Promise<SyncUserResult> {
  const useSandbox = options.useSandbox ?? (process.env.EBAY_USE_SANDBOX === 'true');
  const perCallSleepMs = options.perCallSleepMs ?? 100;
  const { getItemBudget } = options;

  const connection = await getEbayConnection(userId);
  if (!connection) {
    // User disconnected since we picked them — stamp synced so we don't
    // keep retrying their orphans every 15 minutes.
    await supabaseAdmin
      .from('ebay_listings')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');
    return { updated: 0, sold: 0, ended: 0, getItemCalls: 0 };
  }

  const accessToken = await getValidAccessToken(userId);
  const apiConfig = { accessToken, sandbox: useSandbox };
  const ebayState = await getMyEbaySelling(
    apiConfig,
    { activeEntries: 200, soldEntries: 200, unsoldEntries: 200 }
  );

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

  const orphans: { id: string; listing_id: string; last_synced_at: string | null }[] = [];

  // -------- Pass 0: reconcile mistakenly-terminal rows --------
  // Walk eBay's SoldList and UnsoldList directly so any DB row whose status
  // disagrees with eBay's current truth gets healed — most commonly, rows
  // we previously marked 'ended' (because GetItem returned null for a long-
  // archived listing) that are actually visible in eBay's 60-day SoldList.
  // This was the root cause of "I sold this through InstaList but DCM shows
  // it as ended" reports.
  for (const item of ebayState.sold) {
    const dbRow = dbByListingId.get(item.itemId);
    if (!dbRow) continue;
    if (dbRow.status === 'sold') {
      // Already marked sold — but eBay's truth might disagree with what we
      // stored. Refresh quantity_sold and sold_at (only when eBay returned
      // a real endTime; never overwrite a real timestamp with `now`).
      const refresh: Record<string, any> = {
        quantity_sold: item.quantitySold ?? 1,
        last_synced_at: now,
      };
      if (item.endTime) refresh.sold_at = item.endTime;
      // Refresh price → final sale price (see finalSalePrice); heals rows
      // sold before final-price capture existed.
      const refreshSalePrice = finalSalePrice(item);
      if (refreshSalePrice !== null) refresh.price = refreshSalePrice;
      await supabaseAdmin
        .from('ebay_listings')
        .update(refresh)
        .eq('id', dbRow.id);
      continue;
    }
    const soldUpdate: Record<string, any> = {
      status: 'sold',
      quantity_sold: item.quantitySold ?? 1,
      sold_at: item.endTime ?? now,
      last_synced_at: now,
    };
    // price → final sale price on the terminal sold row (see finalSalePrice).
    const salePrice = finalSalePrice(item);
    if (salePrice !== null) soldUpdate.price = salePrice;
    await supabaseAdmin
      .from('ebay_listings')
      .update(soldUpdate)
      .eq('id', dbRow.id);
    sold++;
    // Update our in-memory state so the orphan pass doesn't re-touch this row.
    dbByListingId.set(item.itemId, { ...dbRow, status: 'sold' });
  }
  for (const item of ebayState.unsold) {
    const dbRow = dbByListingId.get(item.itemId);
    if (!dbRow) continue;
    // Don't downgrade sold → ended even if eBay lists it; sold takes precedence.
    if (dbRow.status === 'sold' || dbRow.status === 'ended') continue;
    await supabaseAdmin
      .from('ebay_listings')
      .update({
        status: 'ended',
        ended_at: item.endTime ?? now,
        last_synced_at: now,
      })
      .eq('id', dbRow.id);
    ended++;
    dbByListingId.set(item.itemId, { ...dbRow, status: 'ended' });
  }

  // -------- Pass 0b: revive rows that are LIVE on eBay but stuck on a
  // terminal status in our DB. Without this, once a row was marked
  // 'ended' (most often by Pass 2 GetItem returning null during a
  // transient eBay state), Pass 1 never re-evaluated it because Pass 1
  // only walks rows where dbRow.status === 'active'. Result: dashboards
  // under-counted active listings forever. This walk closes that loop.
  // View/watch refresh is left to Pass 1 in the same run since we put
  // the now-active row back into dbByListingId.
  for (const item of ebayState.active) {
    const dbRow = dbByListingId.get(item.itemId);
    if (!dbRow) continue;
    if (dbRow.status === 'active') continue;
    await supabaseAdmin
      .from('ebay_listings')
      .update({
        status: 'active',
        ended_at: null,
        sold_at: null,
        last_synced_at: now,
      })
      .eq('id', dbRow.id);
    updated++;
    dbByListingId.set(item.itemId, { ...dbRow, status: 'active' });
  }

  // -------- Pass 1: bulk reconciliation --------
  for (const [listingId, dbRow] of dbByListingId.entries()) {
    if (dbRow.status !== 'active') continue;

    if (activeByListingId.has(listingId)) {
      const item = activeByListingId.get(listingId)!;
      await supabaseAdmin
        .from('ebay_listings')
        .update({
          view_count: item.hitCount ?? undefined,
          watch_count: item.watchCount ?? 0,
          last_synced_at: now,
        })
        .eq('id', dbRow.id);
      updated++;
    } else if (soldByListingId.has(listingId)) {
      const item = soldByListingId.get(listingId)!;
      const soldUpdate: Record<string, any> = {
        status: 'sold',
        quantity_sold: item.quantitySold ?? 1,
        sold_at: item.endTime ?? now,
        last_synced_at: now,
      };
      // price → final sale price on the terminal sold row (see finalSalePrice).
      const salePrice = finalSalePrice(item);
      if (salePrice !== null) soldUpdate.price = salePrice;
      await supabaseAdmin
        .from('ebay_listings')
        .update(soldUpdate)
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
      orphans.push({ id: dbRow.id, listing_id: listingId, last_synced_at: dbRow.last_synced_at });
    }
  }

  // -------- Pass 2: GetItem fallback for orphans, stalest first --------
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
      // eBay can't find the listing — archived, deleted, or stale ID.
      // Never the "still live for sale" case, so promote to ended.
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
      const soldUpdate: Record<string, any> = {
        status: 'sold',
        quantity_sold: detail.quantitySold,
        sold_at: detail.endTime ?? now,
        last_synced_at: now,
      };
      // price → final sale price on the terminal sold row (see finalSalePrice).
      // GetItem's SellingStatus.CurrentPrice on an ended auction is the
      // winning bid.
      const salePrice = finalSalePrice(detail);
      if (salePrice !== null) soldUpdate.price = salePrice;
      await supabaseAdmin
        .from('ebay_listings')
        .update(soldUpdate)
        .eq('id', orphan.id);
      sold++;
    } else {
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

    if (perCallSleepMs > 0) {
      await new Promise(r => setTimeout(r, perCallSleepMs));
    }
  }

  return { updated, sold, ended, getItemCalls };
}

/**
 * Get a snapshot of when a user's most-recent listing was synced.
 * Used by /api/ebay/sync-me for rate limiting.
 */
export async function getLastSyncedAtForUser(userId: string): Promise<Date | null> {
  const { data } = await supabaseAdmin
    .from('ebay_listings')
    .select('last_synced_at')
    .eq('user_id', userId)
    .not('last_synced_at', 'is', null)
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.last_synced_at ? new Date(data.last_synced_at) : null;
}

/**
 * Count active orphan rows for a user — rows we expect to need GetItem
 * to resolve. The /api/ebay/sync-me endpoint surfaces this so the UI
 * can show "Syncing N listings..." accurately.
 */
export async function countActiveListingsForUser(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('ebay_listings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  return count ?? 0;
}
