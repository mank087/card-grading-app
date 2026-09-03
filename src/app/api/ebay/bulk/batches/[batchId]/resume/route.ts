/**
 * POST /api/ebay/bulk/batches/:id/resume — carry on where the batch stopped.
 *
 * Queued rows are untouched: a pause never moved them, so resume is just the
 * batch flag going back to `running` plus a kick so the drain picks it up now
 * rather than at the next minute.
 *
 * Rows that were HELD by an eBay selling limit (`blocked`) are re-queued here,
 * because that is the one hold whose cause is expected to have changed by the
 * time the seller resumes — they went and asked eBay for a higher limit. A
 * `failed` row is not re-queued: it failed for its own reason and needs the
 * per-row Retry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadOwnedBatch,
  refreshBatchCounts,
  kickBulkDrain,
} from '@/lib/ebay/bulkService';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { batchId } = await params;
  if (!isUuid(batchId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (batch.status !== 'paused') {
    return NextResponse.json(
      { error: `This batch is ${batch.status} — there is nothing to resume.` },
      { status: 409 }
    );
  }

  // Rows held by the selling limit go back in the queue; the seller resumed
  // precisely because that limit is expected to have moved.
  await supabase
    .from('ebay_bulk_items')
    .update({
      status: 'queued',
      locked_at: null,
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('batch_id', batchId)
    .eq('status', 'blocked')
    .eq('error_code', 'listing_limit');

  const { data: queuedRows } = await supabase
    .from('ebay_bulk_items')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'queued');
  const queued = (queuedRows ?? []).length;

  const { error } = await supabase
    .from('ebay_bulk_batches')
    .update({
      status: 'running',
      last_error: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('user_id', userId)
    .eq('status', 'paused');

  if (error) {
    console.error('[ebay/bulk] resume failed:', error.message);
    return NextResponse.json({ error: 'Failed to resume this batch' }, { status: 500 });
  }

  await refreshBatchCounts(supabase, batchId);
  kickBulkDrain(request, batchId);

  const refreshed = await loadOwnedBatch(supabase, batchId, userId);
  return NextResponse.json({ success: true, queued, batch: refreshed });
}
