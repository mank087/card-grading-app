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
  /** Cards moved out of the owner's active collection because their listing sold. */
  cardsMarkedSold: number;
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
    return { updated: 0, sold: 0, ended: 0, getItemCalls: 0, cardsMarkedSold: 0 };
  }

  const accessToken = await getValidAccessToken(userId);
  const apiConfig = { accessToken, sandbox: useSandbox };
  const ebayState = await getMyEbaySelling(
    apiConfig,
    { activeEntries: 200, soldEntries: 200, unsoldEntries: 200 }
  );

  const { data: dbRows } = await supabaseAdmin
    .from('ebay_listings')
    // sold_at + quantity_sold feed the Pass 0c evidence check below
    .select('id, listing_id, status, last_synced_at, sold_at, quantity_sold')
    .eq('user_id', userId);

  const dbByListingId = new Map<string, { id: string; status: string; last_synced_at: string | null; sold_at: string | null; quantity_sold: number | null }>();
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

  // -------- Pass 0c: re-open UNVERIFIED sold rows --------
  // A row can claim status 'sold' while carrying no evidence of a sale: no
  // sold_at and quantity_sold 0. Every path that legitimately marks a sale
  // writes both. Nine such rows were found in production across five users,
  // and seven cards had been dragged into their owners' Sold category — where
  // the sold-lock then blocked editing and deleting them.
  //
  // They were unreachable: Pass 1 only walks 'active' rows, and Passes 0/0b
  // only see listings eBay still returns (a 60-day window). Anything wrongly
  // terminal and older than that was stuck permanently.
  //
  // Demoting them to orphan status here hands the question to eBay via GetItem
  // rather than trusting an unverified claim forever.
  for (const [listingId, dbRow] of dbByListingId.entries()) {
    if (dbRow.status !== 'sold') continue;
    if (dbRow.sold_at || (dbRow.quantity_sold ?? 0) > 0) continue;
    if (activeByListingId.has(listingId) || soldByListingId.has(listingId) || unsoldByListingId.has(listingId)) {
      continue; // one of the passes above will settle it with real data
    }
    console.warn(`[ebay-sync] listing ${listingId} claims sold with no sale evidence — re-resolving`);
    orphans.push({ id: dbRow.id, listing_id: listingId, last_synced_at: dbRow.last_synced_at });
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

  const cardsMarkedSold = await reconcileSoldCards(userId);

  return { updated, sold, ended, getItemCalls, cardsMarkedSold };
}

/**
 * Move cards whose eBay listing has SOLD out of the owner's active collection.
 *
 * Written as a reconciliation over current state rather than as a hook on each
 * status transition, because several passes above can flip a row to 'sold'.
 * Reconciling once at the end is idempotent, and it self-heals cards that sold
 * before this feature existed.
 *
 * The card is NOT deleted — the printed slab's QR points at /verify/<serial>,
 * so the row has to outlive the sale for the buyer. It just stops appearing in
 * the owner's collection and in the "list a card" picker.
 *
 * Respects a manual override: if the owner said "Still mine" (a cancelled or
 * returned sale) we leave it alone unless a NEWER sale post-dates that call.
 */
export interface EbaySoldCandidate {
  cardId: string;
  serial: string | null;
  soldAt: string | null;
  price: number | null;
}

/**
 * Cards whose eBay listing has SOLD but which are still sitting in the owner's
 * collection — i.e. the ones an auto-move (or the collection prompt) would act
 * on. Shared by the sync and /api/cards/sold-pending so both agree on the set.
 *
 * Respects a manual override: if the owner said "Still mine" (a cancelled or
 * returned sale) the card is skipped unless a NEWER sale post-dates that call.
 */
export async function findEbaySoldCandidates(userId: string): Promise<EbaySoldCandidate[]> {
  const { data: soldRows, error: listErr } = await supabaseAdmin
    .from('ebay_listings')
    .select('card_id, sold_at, price')
    .eq('user_id', userId)
    .eq('status', 'sold')
    .not('card_id', 'is', null);

  if (listErr || !soldRows?.length) return [];

  // Most-recent sale wins if a card somehow has several sold rows.
  const byCard = new Map<string, { sold_at: string | null; price: number | null }>();
  for (const row of soldRows) {
    const prev = byCard.get(row.card_id);
    if (!prev || (row.sold_at && prev.sold_at && row.sold_at > prev.sold_at) || !prev.sold_at) {
      byCard.set(row.card_id, { sold_at: row.sold_at, price: row.price });
    }
  }

  const { data: candidates, error: cardErr } = await supabaseAdmin
    .from('cards')
    .select('id, serial, ownership_status, ownership_overridden_at')
    .eq('user_id', userId)
    .in('id', [...byCard.keys()])
    .eq('ownership_status', 'owned');

  if (cardErr) {
    // Migration window: columns not applied yet. Listings still sync correctly;
    // cards just aren't stamped until the migration lands.
    if ((cardErr as any).code === '42703') {
      console.warn('[ebay-sync] ownership columns missing — skipping card reconciliation.');
      return [];
    }
    console.error('[ebay-sync] card reconciliation query failed:', cardErr.message);
    return [];
  }
  if (!candidates?.length) return [];

  const out: EbaySoldCandidate[] = [];
  for (const card of candidates) {
    const sale = byCard.get(card.id);
    if (!sale) continue;

    // Manual override wins unless this sale is newer than the override.
    if (card.ownership_overridden_at) {
      const overriddenAt = new Date(card.ownership_overridden_at).getTime();
      const soldAt = sale.sold_at ? new Date(sale.sold_at).getTime() : 0;
      if (soldAt <= overriddenAt) continue;
    }
    out.push({ cardId: card.id, serial: card.serial, soldAt: sale.sold_at, price: sale.price });
  }
  return out;
}

/**
 * Move the given eBay-sold cards into the Sold category.
 *
 * Cards are NOT deleted — the printed slab's QR points at /verify/<serial>, so
 * the row has to outlive the sale for the buyer. They just leave the owner's
 * collection and the "list a card" picker.
 */
export async function markCardsSoldFromEbay(
  userId: string,
  candidates: EbaySoldCandidate[]
): Promise<number> {
  let marked = 0;
  for (const sale of candidates) {
    const { error: updErr } = await supabaseAdmin
      .from('cards')
      .update({
        ownership_status: 'sold',
        sold_at: sale.soldAt ?? new Date().toISOString(),
        // ebay_listings.price holds the FINAL sale price once sold — see
        // finalSalePrice() above, not the original ask.
        sold_price: sale.price ?? null,
        sold_channel: 'ebay',
        // A sold card must stay viewable or the buyer's QR resolves to nothing.
        visibility: 'public',
      })
      .eq('id', sale.cardId)
      .eq('user_id', userId)
      // Guard against a concurrent manual change between read and write.
      .eq('ownership_status', 'owned');

    if (updErr) {
      console.error(`[ebay-sync] failed to mark card ${sale.serial} sold:`, updErr.message);
      continue;
    }
    marked++;
    console.log(`[ebay-sync] card ${sale.serial} → sold (eBay${sale.price ? `, $${sale.price}` : ''})`);
  }

  return marked;
}

/**
 * Sync-time hook: auto-move eBay-sold cards, but only if the owner has said
 * that's what they want.
 *
 *   NULL   never asked — stand down; the collection prompts instead
 *   TRUE   move them
 *   FALSE  they opted out; they mark by hand
 */
async function reconcileSoldCards(userId: string): Promise<number> {
  const { data: prefRow, error: prefErr } = await supabaseAdmin
    .from('user_credits')
    .select('ebay_auto_mark_sold')
    .eq('user_id', userId)
    .maybeSingle();

  if (prefErr && (prefErr as any).code !== '42703') {
    console.error('[ebay-sync] could not read auto-mark preference:', prefErr.message);
    return 0;
  }
  // Pre-migration (42703): behave as "not asked" and leave cards alone.
  const autoMark = prefErr ? null : prefRow?.ebay_auto_mark_sold ?? null;
  if (autoMark !== true) return 0;

  const candidates = await findEbaySoldCandidates(userId);
  if (!candidates.length) return 0;
  return markCardsSoldFromEbay(userId, candidates);
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
