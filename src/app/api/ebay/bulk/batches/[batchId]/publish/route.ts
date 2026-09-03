/**
 * POST /api/ebay/bulk/batches/:id/publish — commit a reviewed batch.
 *
 * Phase 2: this is now the real thing. It moves every `ready` row to `queued`,
 * flips the batch to `running`, and kicks the drain once so the first cards go
 * out in seconds rather than at the next minute's cron. Publishing itself
 * happens in `/api/ebay/bulk/drain` — this route never calls eBay, which is
 * what lets the seller close the tab the moment it returns.
 *
 * EBAY_BULK_PUBLISH_ENABLED stays as a separate flag from EBAY_BULK_ENABLED:
 * turning the review UI on for real sellers must not turn publishing on with
 * it.
 *
 * The readiness gate is enforced here rather than trusted from the client. A
 * row that is not `ready` has an unmet requirement recorded on it — no price,
 * a missing required specific, photos that never rendered — and queueing it
 * would spend an eBay call to learn what we already knew.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadOwnedBatch,
  loadListingDefaults,
  refreshBatchCounts,
  bulkPublishEnabled,
  kickBulkDrain,
  type ServerClient,
} from '@/lib/ebay/bulkService';
import { computeBatchReadiness } from '@/lib/ebay/bulkReadiness';
import { withSellerPolicyDefaults } from '@/lib/ebay/bulkSettings';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string }> };

/** Statuses a row may hold and still not block the publish. */
const NOT_BLOCKING = new Set(['ready', 'queued', 'skipped', 'blocked', 'live']);

interface OffenderRow {
  id: string;
  card_id: string;
  status: string;
  readiness: { code: string; label: string }[] | null;
}

/**
 * Rows that are neither ready nor already accounted for. Returned to the
 * client with their unmet requirements so the review page can point at them
 * instead of saying "something is not ready".
 */
async function findOffenders(supabase: ServerClient, batchId: string): Promise<OffenderRow[]> {
  const { data } = await supabase
    .from('ebay_bulk_items')
    .select('id, card_id, status, readiness')
    .eq('batch_id', batchId)
    .order('position', { ascending: true });
  return ((data ?? []) as unknown as OffenderRow[]).filter(r => !NOT_BLOCKING.has(r.status));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { batchId } = await params;
  if (!isUuid(batchId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!bulkPublishEnabled()) {
    return NextResponse.json(
      {
        error: 'not_enabled',
        message:
          'Bulk publishing is not switched on yet. Your batch is saved — you can keep editing it and publish once it ships.',
      },
      { status: 501 }
    );
  }

  // `paused` is accepted so the publish button doubles as resume for a batch
  // that stopped on a disclaimer or a reconnect; anything else is already
  // running or finished.
  if (batch.status !== 'draft' && batch.status !== 'paused') {
    return NextResponse.json(
      { error: 'This batch has already been submitted.' },
      { status: 409 }
    );
  }

  // Re-stamp the seller's business-policy opt-in onto the batch before
  // anything is queued.
  //
  // The settings were stamped when the batch was created or last patched, and
  // a draft can sit for days. A seller who turns policies ON in the meantime
  // would otherwise publish a batch of inline listings; one who turns them
  // OFF would send policy ids `publishCardListing` now refuses, failing every
  // row with `policies_not_enabled`. Either way the batch is stale, and the
  // publish click is the last moment we can fix it.
  //
  // Personal row only — the policies live on this user's own eBay account.
  const listingDefaults = await loadListingDefaults(supabase, userId);
  const settings = {
    ...batch.settings,
    policies: withSellerPolicyDefaults(batch.settings.policies, listingDefaults.personal),
  };

  const policiesChanged =
    JSON.stringify(settings.policies) !== JSON.stringify(batch.settings.policies);
  if (policiesChanged) {
    const { error: stampError } = await supabase
      .from('ebay_bulk_batches')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', batchId);
    if (stampError) {
      console.error('[ebay/bulk] policy re-stamp failed:', stampError.message);
      return NextResponse.json(
        { error: 'Could not confirm your eBay shipping settings. Please try again.' },
        { status: 500 }
      );
    }
    // The drain reads settings off the row, so the persisted copy is the one
    // that matters; keeping the local object in step is just for the gate.
    batch.settings = settings;
  }

  // Batch-level gate on the RE-STAMPED settings: an unchosen business policy
  // blocks every row, so reporting it once beats reporting it a hundred times
  // against cards that are individually fine.
  const batchIssues = computeBatchReadiness(settings);
  if (batchIssues.length > 0) {
    return NextResponse.json(
      { error: batchIssues[0].label, batchNotReady: batchIssues },
      { status: 400 }
    );
  }

  const offenders = await findOffenders(supabase, batchId);
  if (offenders.length > 0) {
    return NextResponse.json(
      {
        error: `${offenders.length} card${offenders.length === 1 ? ' is' : 's are'} not ready yet.`,
        notReady: offenders.map(o => ({
          itemId: o.id,
          cardId: o.card_id,
          status: o.status,
          issues: (o.readiness ?? []).map(r => r.label),
        })),
      },
      { status: 400 }
    );
  }

  const { data: readyRows, error: queueError } = await supabase
    .from('ebay_bulk_items')
    .update({ status: 'queued', locked_at: null, updated_at: new Date().toISOString() })
    .eq('batch_id', batchId)
    .eq('status', 'ready')
    .select('id');

  if (queueError) {
    console.error('[ebay/bulk] enqueue failed:', queueError.message);
    return NextResponse.json({ error: 'Failed to queue this batch' }, { status: 500 });
  }

  // Resuming a paused batch normally enqueues nothing — its rows are already
  // `queued` — so the count that matters is everything outstanding, not just
  // what this call moved.
  const { data: outstandingRows } = await supabase
    .from('ebay_bulk_items')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'queued');
  const queued = (outstandingRows ?? []).length;

  if (queued === 0) {
    return NextResponse.json({ error: 'No rows are ready to publish yet.' }, { status: 400 });
  }

  const { error: batchError } = await supabase
    .from('ebay_bulk_batches')
    .update({
      status: 'running',
      // Preserved across a pause/resume: started_at is when the batch first ran.
      started_at: (batch.started_at as string | null) ?? new Date().toISOString(),
      completed_at: null,
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', batchId)
    .eq('user_id', userId)
    .in('status', ['draft', 'paused']);

  if (batchError) {
    console.error('[ebay/bulk] batch start failed:', batchError.message);
    return NextResponse.json({ error: 'Failed to start this batch' }, { status: 500 });
  }

  await refreshBatchCounts(supabase, batchId);
  // Fire-and-forget. The per-minute cron is the durable driver; this is only
  // so the seller does not watch a still list for up to a minute.
  kickBulkDrain(request, batchId);

  const refreshed = await loadOwnedBatch(supabase, batchId, userId);
  return NextResponse.json({ success: true, queued, batch: refreshed });
}
