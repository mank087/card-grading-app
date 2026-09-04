/**
 * POST /api/ebay/bulk/batches — start a bulk listing batch.
 *
 * Takes the card ids the seller ticked in the picker and writes a draft
 * batch: one `ebay_bulk_batches` row plus one `ebay_bulk_items` row per card,
 * each already carrying its generated title, description, item specifics and
 * seeded price. Nothing is sent to eBay here; the review page edits these
 * rows and Phase 2's drain publishes them.
 *
 * The active/pending/sold dedupe that `publishCardListing` does per card runs
 * ONCE for the whole selection — those rows land as `skipped` with a reason
 * rather than failing the batch or silently double-listing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadDraftCards,
  loadListingDefaults,
  loadBrandingByOrg,
  loadAspectsByCategory,
  ebayCategoryForCard,
  newItemRow,
  refreshBatchCounts,
  BATCH_COLUMNS,
  type DraftContext,
} from '@/lib/ebay/bulkService';
import {
  reapStaleClaims,
  isStaleClaim,
  BLOCKING_LISTING_STATUSES,
  EXISTING_LISTING_COLUMNS,
  type ExistingListingRow,
} from '@/lib/ebay/publishCardListing';
import {
  normalizeBulkSettings,
  normalizeBulkShipping,
  withSellerPolicyDefaults,
  DEFAULT_BULK_SETTINGS,
  type BulkBatchSettings,
} from '@/lib/ebay/bulkSettings';
import { MAX_BULK_ITEMS } from '@/lib/ebay/bulkReadiness';
import { resolveActiveDefaults } from '@/lib/ebay/listingDraft';
import { getOrgForUser } from '@/lib/organizations';

export const runtime = 'nodejs';

const ITEM_INSERT_CHUNK = 25;

function parseCardIds(raw: unknown): string[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'cardIds must be a non-empty array' };
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string' || !isUuid(value)) return { error: 'cardIds must be card UUIDs' };
    if (seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }
  if (ids.length > MAX_BULK_ITEMS) {
    return { error: `A batch holds at most ${MAX_BULK_ITEMS} cards.` };
  }
  return ids;
}

/**
 * GET /api/ebay/bulk/batches — the caller's batches that still need them.
 *
 * Small and narrow on purpose: it exists so the List tab can show "you have a
 * batch running" and get the seller back to it. Counts come off the batch
 * columns the drain maintains, so this never touches the item rows.
 *
 * A batch is a drafting tool. Once it has finished and nothing failed, every
 * card in it is an ordinary listing under "My Listings", so the batch drops
 * out of the strip. Drafts, running and paused batches stay; so does a
 * finished batch that still has failed rows, because retrying those happens
 * on the batch page. Cancelled batches never show here.
 */
export async function GET(request: NextRequest) {
  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const url = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 8));

  const { data, error } = await supabase
    .from('ebay_bulk_batches')
    .select(
      'id, status, total_count, ready_count, live_count, failed_count, ' +
      'created_at, updated_at, started_at, completed_at, last_error'
    )
    .eq('user_id', userId)
    // Anything not terminal, plus finished batches that still have rows to retry.
    .or('status.in.(draft,running,paused,failed),and(status.eq.complete,failed_count.gt.0)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[ebay/bulk] batch list failed:', error.message);
    return NextResponse.json({ error: 'Failed to load your batches' }, { status: 500 });
  }
  return NextResponse.json({ batches: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseCardIds(body?.cardIds);
  if (!Array.isArray(parsed)) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const cardIds = parsed;

  try {
    // ---------------------------------------------------- settings ----
    // Saved shipping defaults are the seed, exactly as in the single-card
    // modal; anything the batch panel sent overrides them.
    const listingDefaults = await loadListingDefaults(supabase, userId);
    const membership = await getOrgForUser(userId);
    const savedRow = listingDefaults.org ?? listingDefaults.personal;
    const saved = (savedRow?.shippingDefaults ?? {}) as Record<string, unknown>;
    const { bestOfferEnabled: savedBestOffer, ...savedShipping } = saved;

    const base: BulkBatchSettings = {
      ...DEFAULT_BULK_SETTINGS,
      shipping: normalizeBulkShipping({ ...DEFAULT_BULK_SETTINGS.shipping, ...savedShipping }),
      bestOfferEnabled:
        typeof savedBestOffer === 'boolean' ? savedBestOffer : DEFAULT_BULK_SETTINGS.bestOfferEnabled,
    };
    const settings = normalizeBulkSettings(body?.settings ?? base, base);

    // ------------------------------------------------------- cards ----
    const cards = await loadDraftCards(supabase, cardIds, userId);
    if (cards.length === 0) {
      return NextResponse.json({ error: 'None of those cards are yours' }, { status: 404 });
    }
    const byId = new Map(cards.map(c => [c.id as string, c]));

    // --------------------------------------------------- deduping -----
    // EXACTLY the check publishCardListing runs, batched: reap abandoned
    // pending claims once over the whole selection, then one IN query over
    // the shared blocking-status set. Deliberately the same statuses the
    // publish path refuses on — no more (a card the publish path would
    // accept must not be skipped here) and no fewer (or the batch queues a
    // card that will 409 mid-run).
    await reapStaleClaims(supabase, userId, cardIds);
    const { data: conflicts } = await supabase
      .from('ebay_listings')
      .select(`card_id, ${EXISTING_LISTING_COLUMNS}`)
      .eq('user_id', userId)
      .in('card_id', cardIds)
      .in('status', BLOCKING_LISTING_STATUSES as unknown as string[]);

    const conflictByCard = new Map<string, ExistingListingRow>();
    for (const row of (conflicts ?? []) as unknown as (ExistingListingRow & { card_id: string | null })[]) {
      // A claim the reaper just missed (raced) is still not a conflict.
      if (!row.card_id || isStaleClaim(row)) continue;
      conflictByCard.set(row.card_id, row);
    }

    // ------------------------------------------------------ drafts ----
    const brandingByOrg = await loadBrandingByOrg(
      cards.map(c => c.org_id).filter((id): id is string => typeof id === 'string')
    );
    // eBay's own required aspects, once per distinct category (≤3 in
    // practice), so an unfilled required specific fails readiness up front.
    const aspectsByCategory = await loadAspectsByCategory(
      userId,
      cards.map(c => ebayCategoryForCard(c))
    );
    const ctx: DraftContext = { settings, listingDefaults, brandingByOrg, aspectsByCategory };

    // The batch's own grade label: whichever the caller's active defaults
    // resolve to for their own account. Per-CARD labels still come from
    // resolveActiveDefaults inside the draft builder (cross-org guard).
    const callerDefaults = resolveActiveDefaults(
      { org_id: listingDefaults.orgId },
      listingDefaults
    );
    settings.gradeLabel = settings.gradeLabel ?? callerDefaults?.titleGradeLabel ?? null;
    // Business policies are server-resolved like the grade label, but from
    // the PERSONAL row only — not `callerDefaults`, which resolves org-first.
    // The policies live on this user's own eBay account; a store member who
    // inherited the owner's ids would fail every row at eBay.
    settings.policies = withSellerPolicyDefaults(settings.policies, listingDefaults.personal);

    // supabase-js can't statically parse a runtime-joined column string, so
    // the inserted row is typed explicitly (it's a plain batch record).
    const { data: batchData, error: batchError } = await supabase
      .from('ebay_bulk_batches')
      .insert({
        user_id: userId,
        org_id: membership?.org.id ?? null,
        status: 'draft',
        settings,
        total_count: 0,
      })
      .select(BATCH_COLUMNS)
      .single();

    const batch = batchData as unknown as { id: string } | null;
    if (batchError || !batch) {
      console.error('[ebay/bulk] batch insert failed:', batchError?.message);
      return NextResponse.json({ error: 'Failed to create the batch' }, { status: 500 });
    }

    const rows: Record<string, unknown>[] = [];
    let position = 0;
    for (const cardId of cardIds) {
      const card = byId.get(cardId);
      if (!card) continue; // not the caller's card — silently dropped
      const row = newItemRow(batch.id, card, position++, ctx);
      const conflict = conflictByCard.get(cardId);
      if (conflict) {
        row.status = 'skipped';
        row.error_code = 'already_listed';
        row.error_message = 'This card already has an active eBay listing.';
      }
      rows.push(row);
    }

    for (let i = 0; i < rows.length; i += ITEM_INSERT_CHUNK) {
      const { error } = await supabase
        .from('ebay_bulk_items')
        .insert(rows.slice(i, i + ITEM_INSERT_CHUNK));
      if (error) {
        console.error('[ebay/bulk] item insert failed:', error.message);
        // Roll the batch back rather than leaving a half-filled review list.
        await supabase.from('ebay_bulk_batches').delete().eq('id', batch.id);
        return NextResponse.json({ error: 'Failed to prepare the batch' }, { status: 500 });
      }
    }

    await refreshBatchCounts(supabase, batch.id);

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      itemCount: rows.length,
      skippedCount: conflictByCard.size,
      missingCount: cardIds.length - rows.length,
    });
  } catch (err: any) {
    console.error('[ebay/bulk] create failed:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to create the batch' }, { status: 500 });
  }
}
