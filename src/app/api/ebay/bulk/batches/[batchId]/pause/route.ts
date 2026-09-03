/**
 * POST /api/ebay/bulk/batches/:id/pause — stop starting new listings.
 *
 * Queued rows are left exactly as they are. The drain only ever looks at
 * batches whose status is `running`, so flipping the batch is the whole
 * mechanism — there is no per-row bookkeeping to undo, and resume is
 * therefore lossless.
 *
 * Anything already in flight (a `publishing` row mid-eBay-call) finishes.
 * Cancelling an AddFixedPriceItem that eBay has already accepted is not
 * possible, so pretending we can would risk a listing we never recorded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import { guardBulkRoute, loadOwnedBatch, refreshBatchCounts } from '@/lib/ebay/bulkService';

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
  if (batch.status !== 'running') {
    return NextResponse.json(
      { error: `This batch is ${batch.status} — there is nothing to pause.` },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('ebay_bulk_batches')
    .update({
      status: 'paused',
      last_error: 'paused_by_seller',
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('user_id', userId)
    .eq('status', 'running');

  if (error) {
    console.error('[ebay/bulk] pause failed:', error.message);
    return NextResponse.json({ error: 'Failed to pause this batch' }, { status: 500 });
  }

  await refreshBatchCounts(supabase, batchId);
  const refreshed = await loadOwnedBatch(supabase, batchId, userId);
  return NextResponse.json({ success: true, batch: refreshed });
}
