/**
 * POST /api/ebay/bulk/batches/:id/cancel — stop the batch for good.
 *
 * What cancelling does NOT do is undo anything on eBay. Cards already listed
 * stay listed; a row mid-call finishes and records its listing, because an
 * AddFixedPriceItem that eBay has accepted cannot be recalled and pretending
 * otherwise would leave a live listing with no row behind it.
 *
 * What it does do is empty the queue: every `queued` row goes back to being an
 * editable draft with its readiness recomputed, so the seller keeps everything
 * they typed and can start a fresh batch from the same cards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadOwnedBatch,
  refreshBatchCounts,
  ITEM_COLUMNS,
} from '@/lib/ebay/bulkService';
import { readinessPatch } from '@/lib/ebay/bulkReadiness';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string }> };

const UPDATE_CHUNK = 20;

export async function POST(request: NextRequest, { params }: Params) {
  const { batchId } = await params;
  if (!isUuid(batchId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (batch.status !== 'running' && batch.status !== 'paused') {
    return NextResponse.json(
      { error: `This batch is ${batch.status} — there is nothing to cancel.` },
      { status: 409 }
    );
  }

  // Flip the batch FIRST, and bail if that write fails.
  //
  // Ordering is the whole safety property here. The drain re-reads this status
  // before every wave AND again immediately after every claim, so once this
  // UPDATE lands no further card can reach eBay under this batch. Resetting
  // rows first would leave a window in which the drain claims a row that this
  // request is about to rewrite, and publishes it into a cancelled batch.
  const { error } = await supabase
    .from('ebay_bulk_batches')
    .update({
      status: 'cancelled',
      last_error: 'cancelled_by_seller',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('user_id', userId)
    .in('status', ['running', 'paused']);

  if (error) {
    console.error('[ebay/bulk] cancel failed:', error.message);
    return NextResponse.json({ error: 'Failed to cancel this batch' }, { status: 500 });
  }

  // Queued and held rows become drafts again, with readiness recomputed from
  // scratch so a row that is still complete shows as ready rather than
  // stranded in a queue nothing will drain.
  const { data } = await supabase
    .from('ebay_bulk_items')
    .select(ITEM_COLUMNS)
    .eq('batch_id', batchId)
    .in('status', ['queued', 'blocked']);

  const rows = (data ?? []) as unknown as any[];
  for (let i = 0; i < rows.length; i += UPDATE_CHUNK) {
    await Promise.all(
      rows.slice(i, i + UPDATE_CHUNK).map(row => {
        const { readiness, status } = readinessPatch({ ...row, status: 'draft' });
        return supabase
          .from('ebay_bulk_items')
          .update({
            status,
            readiness,
            locked_at: null,
            error_code: null,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .in('status', ['queued', 'blocked']);
      })
    );
  }

  await refreshBatchCounts(supabase, batchId);
  const refreshed = await loadOwnedBatch(supabase, batchId, userId);
  return NextResponse.json({ success: true, released: rows.length, batch: refreshed });
}
