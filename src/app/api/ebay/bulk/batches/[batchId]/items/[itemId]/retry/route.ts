/**
 * POST /api/ebay/bulk/batches/:id/items/:itemId/retry — put one failed or
 * held row back in the queue.
 *
 * The only path by which a failed row is ever published again. The drain
 * deliberately does not retry rejections on a timer: eBay rejected the listing
 * for a reason that will not change on its own, and re-sending it every minute
 * spends the account's API budget on the same error. A person deciding to try
 * again — usually after editing the row in the drawer — is the signal.
 *
 * Three gates before it goes back:
 *   1. readiness is recomputed, so a row edited into an invalid state cannot
 *      be queued by pressing Retry;
 *   2. the shared duplicate check runs, so a card that DID get listed (the
 *      classic case: eBay accepted the listing and our bookkeeping failed) is
 *      marked skipped rather than listed twice;
 *   3. a `complete` batch is reopened to `running`, otherwise the drain would
 *      never look at the row we just queued.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadOwnedBatch,
  refreshBatchCounts,
  kickBulkDrain,
  ITEM_COLUMNS,
} from '@/lib/ebay/bulkService';
import { readinessPatch } from '@/lib/ebay/bulkReadiness';
import { findActiveOrPendingListing } from '@/lib/ebay/publishCardListing';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string; itemId: string }> };

/** Batch states from which a row may be retried. */
const RETRYABLE_BATCH = new Set(['running', 'paused', 'complete', 'failed']);
/**
 * Row states a retry may act on.
 *
 * `skipped` is here as well as `failed`/`blocked`: a card is skipped because
 * something else was live or claimed on it at the time, and that is the most
 * temporary of all the reasons — the seller ended the eBay listing, or the
 * blocker was an abandoned pending claim that has since aged out. Without this
 * the progress view's Retry was a dead end for exactly the rows most likely to
 * become listable, and the draft-only Re-check could not reach them.
 */
const RETRYABLE_ITEM = new Set(['failed', 'blocked', 'skipped']);

export async function POST(request: NextRequest, { params }: Params) {
  const { batchId, itemId } = await params;
  if (!isUuid(batchId) || !isUuid(itemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!RETRYABLE_BATCH.has(batch.status)) {
    return NextResponse.json(
      { error: `This batch is ${batch.status} — nothing can be retried.` },
      { status: 409 }
    );
  }

  const { data: itemData } = await supabase
    .from('ebay_bulk_items')
    .select(ITEM_COLUMNS)
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .maybeSingle();
  const item = itemData as any;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!RETRYABLE_ITEM.has(item.status)) {
    return NextResponse.json({ success: true, item, changed: false });
  }

  // ---- never publish twice ----
  // A row that already produced a listing, or whose card picked one up in the
  // meantime, is settled rather than requeued.
  //
  // A `skipped` row is the exception: its listing_row_id points at somebody
  // else's blocking row, not at a listing THIS row created, and that row is
  // exactly what may have gone away. Skip the shortcut and let the live
  // duplicate check below decide.
  if (item.listing_row_id && item.status !== 'skipped') {
    const { data: updated } = await supabase
      .from('ebay_bulk_items')
      .update({ status: 'live', locked_at: null, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select(ITEM_COLUMNS)
      .single();
    await refreshBatchCounts(supabase, batchId);
    return NextResponse.json({ success: true, item: updated, changed: true, alreadyLive: true });
  }

  const conflict = await findActiveOrPendingListing(supabase, item.card_id, userId);
  if (conflict) {
    const { data: updated } = await supabase
      .from('ebay_bulk_items')
      .update({
        status: 'skipped',
        locked_at: null,
        listing_row_id: conflict.id,
        error_code: 'already_listed',
        error_message: 'This card already has an active eBay listing.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select(ITEM_COLUMNS)
      .single();
    await refreshBatchCounts(supabase, batchId);
    return NextResponse.json({ success: true, item: updated, changed: true, skipped: true });
  }

  // ---- readiness, recomputed as if this row had never been published ----
  const { readiness, status } = readinessPatch({ ...item, status: 'draft' });
  if (status !== 'ready') {
    // Kept as `failed`, with the reason on the row — NOT flipped to `draft`.
    //
    // A draft row inside a running/finished batch is stranded: the drain only
    // looks at `queued`, and the publish route refuses any batch that is not
    // draft or paused, so nothing could ever pick it up again and the seller
    // would be left with a row that looks editable and goes nowhere. Leaving
    // it failed keeps it in the progress view's retry set, where the drawer
    // can repair it and Retry can be pressed again.
    const message = `Not ready: ${readiness.map(r => r.label).join(', ')}`;
    const { data: updated } = await supabase
      .from('ebay_bulk_items')
      .update({
        status: 'failed',
        readiness,
        locked_at: null,
        error_code: 'not_ready',
        error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select(ITEM_COLUMNS)
      .single();
    await refreshBatchCounts(supabase, batchId);
    return NextResponse.json({
      success: true,
      item: updated,
      changed: true,
      notReady: readiness.map(r => r.label),
    });
  }

  const { data: updated, error } = await supabase
    .from('ebay_bulk_items')
    .update({
      status: 'queued',
      readiness,
      locked_at: null,
      // A skipped row's listing_row_id pointed at the blocker that has just
      // been confirmed gone. Anything left here would send the next retry
      // (and the drain's first guard) straight back to "already live".
      listing_row_id: null,
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .select(ITEM_COLUMNS)
    .single();

  if (error) {
    console.error('[ebay/bulk] retry failed:', error.message);
    return NextResponse.json({ error: 'Could not retry this card' }, { status: 500 });
  }

  // A finished batch has to reopen, or the drain will never see the row.
  if (batch.status === 'complete' || batch.status === 'failed') {
    await supabase
      .from('ebay_bulk_batches')
      .update({
        status: 'running',
        completed_at: null,
        last_error: null,
        // Cleared so the NEXT completion notifies again — this batch really
        // does finish a second time, with a different result.
        completion_email_sent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId)
      .eq('user_id', userId)
      .in('status', ['complete', 'failed']);
  }

  await refreshBatchCounts(supabase, batchId);
  if (batch.status !== 'paused') kickBulkDrain(request, batchId);

  const refreshed = await loadOwnedBatch(supabase, batchId, userId);
  return NextResponse.json({ success: true, item: updated, changed: true, batch: refreshed });
}
