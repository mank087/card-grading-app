/**
 * POST /api/ebay/bulk/batches/:id/items/:itemId/recheck
 *
 * Re-run the duplicate check for one skipped row. A card is skipped at batch
 * creation because it had an active or pending eBay listing; that can stop
 * being true while the seller is still reviewing (they ended the listing on
 * eBay, or the blocking row was an abandoned claim that has since aged out).
 * Without this the only way back was to delete the batch and start over.
 *
 * Uses `findActiveOrPendingListing` — the very function the publish path
 * calls — so a row this route un-skips is a row publish will accept.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadOwnedBatch,
  refreshBatchCounts,
  ITEM_COLUMNS,
} from '@/lib/ebay/bulkService';
import { findActiveOrPendingListing } from '@/lib/ebay/publishCardListing';
import { readinessPatch } from '@/lib/ebay/bulkReadiness';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string; itemId: string }> };

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
  if (batch.status !== 'draft') {
    return NextResponse.json({ error: 'This batch is no longer editable.' }, { status: 409 });
  }

  const { data: itemData } = await supabase
    .from('ebay_bulk_items')
    .select(ITEM_COLUMNS)
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .maybeSingle();
  const item = itemData as any;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (item.status !== 'skipped') {
    return NextResponse.json({ success: true, item, changed: false });
  }

  // The card is scoped by the batch's owner, and the helper filters on
  // user_id as well, so this can only ever see the caller's own listings.
  const conflict = await findActiveOrPendingListing(supabase, item.card_id, userId);
  if (conflict) {
    return NextResponse.json({ success: true, item, changed: false, stillListed: true });
  }

  // Readiness is computed as if this row had never been skipped.
  const { readiness, status } = readinessPatch({ ...item, status: 'draft' });
  const { data: updated, error } = await supabase
    .from('ebay_bulk_items')
    .update({
      status,
      readiness,
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .select(ITEM_COLUMNS)
    .single();

  if (error) {
    console.error('[ebay/bulk] recheck failed:', error.message);
    return NextResponse.json({ error: 'Could not re-check this card' }, { status: 500 });
  }

  await refreshBatchCounts(supabase, batchId);
  return NextResponse.json({ success: true, item: updated, changed: true });
}
