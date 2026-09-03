/**
 * POST|GET /api/ebay/bulk/drain — the one place a bulk batch's queue moves.
 *
 * Same two-driver shape as the submissions drain: a per-minute Vercel cron
 * sweeps every running batch, and the publish / resume / retry routes kick a
 * single batch immediately by self-fetching this route so the seller does not
 * wait up to 60 seconds to see the first card go live. Both callers carry the
 * cron bearer token, so there is exactly one authorization path and no route
 * that a browser can drive.
 *
 * Closing the tab does not stop a batch: nothing here reads client state, and
 * the cron alone will finish any batch left running.
 *
 * Per claimed item:
 *   1. re-run the shared duplicate check (a card listed since the batch was
 *      queued is skipped, never double-listed)
 *   2. build the payload with buildPublishInputFromBulkItem
 *   3. call publishCardListing — the SAME function the single-card modal
 *      drives, so a bulk listing and a hand-made one are byte-identical to
 *      eBay
 *   4. map the outcome: live / skipped / failed, or a batch-level pause
 *
 * Failures that belong to the ACCOUNT rather than the card (disclaimer not
 * accepted, token dead, selling limit reached) pause the batch and leave every
 * remaining row untouched. Failing 80 cards because eBay stopped accepting the
 * token would destroy 80 reviewed drafts to report one problem.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { requireCron } from '@/lib/cronAuth';
import { isUuid } from '@/lib/uuid';
import {
  publishCardListing,
  findActiveOrPendingListing,
  reapStaleClaims,
  STALE_CLAIM_MS,
} from '@/lib/ebay/publishCardListing';
import { readinessPatch } from '@/lib/ebay/bulkReadiness';
import {
  buildPublishInputFromBulkItem,
  classifyEbayErrors,
  LISTING_LIMIT_MESSAGE,
  type BulkPublishItem,
} from '@/lib/ebay/bulkPublish';
import { settleBatch, loadBatchTally } from '@/lib/ebay/bulkCompletion';
import { DRAFT_CARD_COLUMNS, type ServerClient } from '@/lib/ebay/bulkService';
import { batchListingFormat, batchPostalCode, type BulkBatchSettings } from '@/lib/ebay/bulkSettings';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOG = '[ebay/bulk/drain]';

/** Stop starting new listings at 45s, leaving 15s of the 60s budget to settle. */
const WALL_CLOCK_MS = 45_000;
/** Hard ceiling per invocation regardless of the clock. */
const MAX_ITEMS_PER_RUN = 20;
/** eBay listing calls in flight for one seller. */
const MAX_IN_FLIGHT_PER_USER = 2;
/** Minimum gap between two AddFixedPriceItem calls for the same seller. */
const MIN_CALL_GAP_MS = 1_000;
/** Batches served by one tick — a 100-card batch takes several ticks anyway. */
const MAX_BATCHES_PER_TICK = 3;
/**
 * A publishing row whose function died.
 *
 * Must sit BEHIND `publishCardListing`'s pending-claim window, not in front of
 * it. `publishCardListing` inserts a `pending` ebay_listings row before it
 * calls eBay and only reaps abandoned ones after STALE_CLAIM_MS. If the drain
 * requeued a dead publish first, the retry's duplicate check would find that
 * very claim — the row's OWN abandoned claim — and report the card as
 * "already listed", stamping a listing_row_id that the claim reaper then
 * deletes out from under it. Derived from the exported constant rather than
 * re-typed, so the two windows cannot drift apart.
 */
const STALE_LOCK_MS = STALE_CLAIM_MS + 60_000;
/** Reaped-and-requeued this many times, a row is failed rather than looped. */
const MAX_ATTEMPTS = 3;

function drainEnabled(): boolean {
  // Default ON, like the submissions drain: only the literal string 'false'
  // disables it, so a typo'd env var cannot silently stall every batch.
  return (process.env.EBAY_BULK_DRAIN_ENABLED || '').toLowerCase() !== 'false';
}

/* ------------------------------------------------------------------ */
/* Pacing                                                              */
/* ------------------------------------------------------------------ */

/** Spaces this seller's eBay calls at least MIN_CALL_GAP_MS apart. */
class Pacer {
  private nextAt = 0;
  async gate(): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.nextAt);
    this.nextAt = at + MIN_CALL_GAP_MS;
    const delay = at - now;
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/* ------------------------------------------------------------------ */
/* Stale locks                                                         */
/* ------------------------------------------------------------------ */

/**
 * A row left `publishing` by a function that died mid-call.
 *
 * Requeued rather than failed, up to MAX_ATTEMPTS — the common cause is a cold
 * start or a timeout, not a bad listing. This is the ONLY automatic retry in
 * the drain: a row that eBay actually rejected stays failed until the seller
 * presses Retry, because retrying a rejected listing on a timer just burns the
 * account's API budget against the same error.
 */
async function reapStaleLocks(supabase: ServerClient): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data } = await supabase
    .from('ebay_bulk_items')
    .select('id, attempts, card_id, batch_id')
    .in('status', ['uploading', 'publishing'])
    .lt('locked_at', cutoff)
    .limit(100);

  const rows = (data ?? []) as {
    id: string;
    attempts: number;
    card_id: string;
    batch_id: string;
  }[];
  if (rows.length === 0) return 0;

  // Belt and braces on top of the window above: clear each card's abandoned
  // pending claim BEFORE the row goes back in the queue, so the retry's
  // duplicate check cannot mistake this row's own dead claim for a real
  // listing. Grouped by owner because reapStaleClaims is user-scoped.
  const { data: batchRows } = await supabase
    .from('ebay_bulk_batches')
    .select('id, user_id')
    .in('id', Array.from(new Set(rows.map(r => r.batch_id))));
  const ownerByBatch = new Map(
    ((batchRows ?? []) as { id: string; user_id: string }[]).map(b => [b.id, b.user_id])
  );

  const cardsByOwner = new Map<string, string[]>();
  for (const row of rows) {
    const owner = ownerByBatch.get(row.batch_id);
    if (!owner) continue;
    const list = cardsByOwner.get(owner) ?? [];
    list.push(row.card_id);
    cardsByOwner.set(owner, list);
  }
  for (const [owner, cardIds] of cardsByOwner) {
    try {
      await reapStaleClaims(supabase, owner, cardIds);
    } catch (err: any) {
      console.error(`${LOG} claim reap failed for ${owner}:`, err?.message ?? err);
    }
  }

  for (const row of rows) {
    const attempts = (row.attempts ?? 0) + 1;
    const giveUp = attempts >= MAX_ATTEMPTS;
    await supabase
      .from('ebay_bulk_items')
      .update({
        status: giveUp ? 'failed' : 'queued',
        attempts,
        locked_at: null,
        error_code: giveUp ? 'stale_lock' : null,
        error_message: giveUp
          ? 'This card was left mid-publish too many times. Check eBay before retrying — it may already be listed.'
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .in('status', ['uploading', 'publishing']);
  }
  if (rows.length > 0) console.warn(`${LOG} reaped ${rows.length} stale lock(s)`);
  return rows.length;
}

/* ------------------------------------------------------------------ */
/* Claiming                                                            */
/* ------------------------------------------------------------------ */

const CLAIM_COLUMNS =
  'id, batch_id, card_id, position, attempts, title, price, description_html, ' +
  'item_specifics, image_urls, image_status, listing_row_id';

interface ClaimedItem extends BulkPublishItem {
  batch_id: string;
  position: number;
  attempts: number;
  image_status: string | null;
  listing_row_id: string | null;
}

/**
 * The batch's status, right now. One narrow column.
 *
 * Called before every wave and again after every claim, because Pause and
 * Cancel are decisions made by a person against a batch this function is
 * already halfway through. The old code read the status once, when the tick
 * started, and then published for up to 45 seconds and 20 cards against a
 * batch that had been paused — or cancelled — in between.
 */
async function loadBatchStatus(
  supabase: ServerClient,
  batchId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('ebay_bulk_batches')
    .select('status')
    .eq('id', batchId)
    .maybeSingle();
  return (data as { status: string } | null)?.status ?? null;
}

/**
 * Undo a claim the batch turned out not to want.
 *
 * Where the row goes depends on why we are letting go. A PAUSED batch still
 * owns its queue, so the row goes back to `queued` and resume picks it up
 * untouched. A CANCELLED (or otherwise finished) batch has no queue any more —
 * cancel puts every queued row back to an editable draft — so a row released
 * into one has to land the same way, with its readiness recomputed, or it sits
 * as a `queued` row inside a batch nothing will ever drain.
 */
async function releaseClaim(
  supabase: ServerClient,
  item: ClaimedItem,
  batchStatus: string | null,
  listingFormat: BulkBatchSettings['listingFormat'],
  postalCode: string
): Promise<void> {
  if (batchStatus === 'paused') {
    await setItem(supabase, item.id, { status: 'queued', locked_at: null });
    return;
  }
  const { readiness, status } = readinessPatch(
    { ...(item as any), status: 'draft' },
    listingFormat,
    postalCode
  );
  await setItem(supabase, item.id, { status, readiness, locked_at: null });
}

/**
 * Claim up to `limit` queued rows by compare-and-swap.
 *
 * `.eq('status','queued')` is part of the UPDATE's WHERE clause, so Postgres
 * evaluates it under the row lock: two concurrent drains cannot both claim the
 * same row, and the loser simply gets nothing back. Rows are claimed ONE AT A
 * TIME rather than with a single `in(ids)` update, because a multi-row update
 * that partially races would hand back a set we could not attribute.
 *
 * The status re-read afterwards closes the Pause/Cancel window: a person can
 * press Cancel between the candidate select and the claim, and without this a
 * card would go to eBay inside a cancelled batch. Cancel flips the batch
 * status BEFORE it rewrites its rows precisely so that this one read is
 * enough to see it.
 */
async function claimItems(
  supabase: ServerClient,
  batchId: string,
  limit: number,
  listingFormat: BulkBatchSettings['listingFormat'],
  postalCode: string
): Promise<{ items: ClaimedItem[]; batchStatus: string | null }> {
  if (limit <= 0) return { items: [], batchStatus: 'running' };
  const { data: candidates } = await supabase
    .from('ebay_bulk_items')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'queued')
    .order('position', { ascending: true })
    .limit(limit * 2);

  const claimed: ClaimedItem[] = [];
  for (const row of (candidates ?? []) as { id: string }[]) {
    if (claimed.length >= limit) break;
    const { data } = await supabase
      .from('ebay_bulk_items')
      .update({ status: 'publishing', locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'queued')
      .select(CLAIM_COLUMNS);
    const got = (data ?? []) as unknown as ClaimedItem[];
    if (got.length > 0) claimed.push(got[0]);
  }

  if (claimed.length === 0) return { items: [], batchStatus: 'running' };

  const batchStatus = await loadBatchStatus(supabase, batchId);
  if (batchStatus !== 'running') {
    console.warn(
      `${LOG} ${batchId} became ${batchStatus} mid-claim — releasing ${claimed.length} row(s)`
    );
    for (const item of claimed) {
      await releaseClaim(supabase, item, batchStatus, listingFormat, postalCode);
    }
    return { items: [], batchStatus };
  }
  return { items: claimed, batchStatus };
}

async function setItem(
  supabase: ServerClient,
  itemId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('ebay_bulk_items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) console.error(`${LOG} item update failed for ${itemId}:`, error.message);
}

/** Put a claim back exactly as it was — used for every batch-level pause. */
async function requeue(supabase: ServerClient, itemId: string): Promise<void> {
  await setItem(supabase, itemId, { status: 'queued', locked_at: null });
}

async function pauseBatch(
  supabase: ServerClient,
  batchId: string,
  reason: string
): Promise<void> {
  await supabase
    .from('ebay_bulk_batches')
    .update({ status: 'paused', last_error: reason, updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('status', 'running');
}

/* ------------------------------------------------------------------ */
/* One item                                                            */
/* ------------------------------------------------------------------ */

type ItemOutcome =
  | { kind: 'live' }
  | { kind: 'skipped' }
  | { kind: 'failed' }
  /** Stop the batch: the problem is the account, not this card. */
  | { kind: 'pause'; reason: 'disclaimer_required' | 'ebay_reconnect' | 'listing_limit' };

async function publishOne(
  supabase: ServerClient,
  batch: { id: string; user_id: string; settings: BulkBatchSettings },
  item: ClaimedItem,
  card: any,
  pacer: Pacer
): Promise<ItemOutcome> {
  // ---- double-publish guard 1: this row already produced a listing ----
  // A retry, a duplicated cron tick, or a reaped lock whose call actually
  // succeeded all land here. Never publish a second time.
  if (item.listing_row_id) {
    await setItem(supabase, item.id, { status: 'live', locked_at: null, error_code: null, error_message: null });
    return { kind: 'live' };
  }

  // ---- double-publish guard 2: the card is live or claimed elsewhere ----
  // The very function publishCardListing calls, so a row this check clears is
  // a row publishCardListing will accept — and one it stops is one that would
  // have come back 409 after an eBay round trip.
  const conflict = await findActiveOrPendingListing(supabase, item.card_id, batch.user_id);
  if (conflict) {
    await setItem(supabase, item.id, {
      status: 'skipped',
      locked_at: null,
      listing_row_id: conflict.id,
      error_code: 'already_listed',
      error_message: 'This card already has an active eBay listing.',
    });
    return { kind: 'skipped' };
  }

  if (!card) {
    await setItem(supabase, item.id, {
      status: 'failed',
      locked_at: null,
      attempts: (item.attempts ?? 0) + 1,
      error_code: 'card_not_found',
      error_message: 'This card is no longer in your collection.',
    });
    return { kind: 'failed' };
  }

  let input;
  try {
    input = buildPublishInputFromBulkItem(item, batch, card);
  } catch (err: any) {
    await setItem(supabase, item.id, {
      status: 'failed',
      locked_at: null,
      attempts: (item.attempts ?? 0) + 1,
      error_code: 'incomplete_row',
      error_message: err?.message ?? 'This row is missing something eBay needs.',
    });
    return { kind: 'failed' };
  }

  await pacer.gate();
  const result = await publishCardListing(input, { supabase });

  if (result.ok) {
    // The listing row publishCardListing wrote, found by the SKU we minted.
    // Cheaper and more certain than re-scanning the card's listings: the SKU
    // is unique to this attempt.
    const { data: rows } = await supabase
      .from('ebay_listings')
      .select('id')
      .eq('user_id', batch.user_id)
      .eq('sku', result.listing.sku)
      .limit(1);
    const listingRowId = ((rows ?? []) as { id: string }[])[0]?.id ?? null;

    if (listingRowId) {
      await supabase
        .from('ebay_listings')
        .update({ bulk_item_id: item.id })
        .eq('id', listingRowId);
    }

    await setItem(supabase, item.id, {
      status: 'live',
      locked_at: null,
      listing_row_id: listingRowId,
      error_code: null,
      error_message: null,
    });
    return { kind: 'live' };
  }

  // -------------------------------------------------- failure mapping --
  switch (result.code) {
    case 'already_listed': {
      // publishCardListing's own 409. A skip, never a failure: the card IS
      // listed, which is what the seller wanted.
      const existing = (result.details?.existingListing ?? {}) as {
        listingId?: string | null;
        listingUrl?: string | null;
      };
      await setItem(supabase, item.id, {
        status: 'skipped',
        locked_at: null,
        error_code: 'already_listed',
        error_message: existing.listingId
          ? `Already listed on eBay (item ${existing.listingId}).`
          : 'This card already has an active eBay listing.',
      });
      return { kind: 'skipped' };
    }

    case 'disclaimer_required':
      await requeue(supabase, item.id);
      return { kind: 'pause', reason: 'disclaimer_required' };

    case 'no_connection':
    case 'token_refresh_failed':
      await requeue(supabase, item.id);
      return { kind: 'pause', reason: 'ebay_reconnect' };

    case 'ebay_error': {
      const errors = (result.details?.errors ?? []) as Array<{ code?: string; message?: string }>;
      const kind = classifyEbayErrors(errors);
      if (kind === 'listing_limit') {
        await setItem(supabase, item.id, {
          status: 'blocked',
          locked_at: null,
          error_code: 'listing_limit',
          error_message: LISTING_LIMIT_MESSAGE,
        });
        return { kind: 'pause', reason: 'listing_limit' };
      }
      if (kind === 'ebay_reconnect') {
        await requeue(supabase, item.id);
        return { kind: 'pause', reason: 'ebay_reconnect' };
      }
      break;
    }

    default:
      break;
  }

  // This row's own problem. No automatic retry — the seller fixes it in the
  // drawer and presses Retry, which is the only thing that can change the
  // outcome.
  await setItem(supabase, item.id, {
    status: 'failed',
    locked_at: null,
    attempts: (item.attempts ?? 0) + 1,
    error_code: result.code,
    error_message: (result.message || 'eBay rejected this listing.').slice(0, 500),
  });
  return { kind: 'failed' };
}

/* ------------------------------------------------------------------ */
/* One batch                                                           */
/* ------------------------------------------------------------------ */

interface BatchRow {
  id: string;
  user_id: string;
  settings: BulkBatchSettings;
  status: string;
}

interface BatchResult {
  batch_id: string;
  claimed: number;
  live: number;
  skipped: number;
  failed: number;
  paused?: string;
  status: string;
}

async function tickBatch(
  supabase: ServerClient,
  batch: BatchRow,
  budget: { remaining: number; deadline: number },
  pacer: Pacer
): Promise<BatchResult> {
  const result: BatchResult = {
    batch_id: batch.id,
    claimed: 0,
    live: 0,
    skipped: 0,
    failed: 0,
    status: 'running',
  };

  // Set when the seller (or a pause) stopped this tick mid-flight, so the
  // settle step below knows not to treat an emptied wave as "finished".
  let stoppedBy: string | null = null;

  while (budget.remaining > 0 && Date.now() < budget.deadline) {
    // Re-read before every wave. `batch.status` was true when the tick began
    // and says nothing about now — a 20-card tick spans up to 45 seconds, and
    // Pause and Cancel both act on the batch row expecting the drain to
    // notice within one wave rather than at the end of the run.
    const current = await loadBatchStatus(supabase, batch.id);
    if (current !== 'running') {
      stoppedBy = current;
      break;
    }

    const wave = Math.min(MAX_IN_FLIGHT_PER_USER, budget.remaining);
    const { items, batchStatus } = await claimItems(
      supabase,
      batch.id,
      wave,
      batchListingFormat(batch.settings),
      batchPostalCode(batch.settings)
    );
    if (batchStatus !== 'running') {
      // The claim helper already put its rows back where the batch's new
      // state wants them.
      stoppedBy = batchStatus;
      break;
    }
    if (items.length === 0) break;
    budget.remaining -= items.length;
    result.claimed += items.length;

    // Narrow card read for the whole wave — `cards` is ~290 columns and
    // several are large JSON blobs, so the drain never selects '*'.
    const { data: cardRows } = await supabase
      .from('cards')
      .select(DRAFT_CARD_COLUMNS)
      .eq('user_id', batch.user_id)
      .in('id', items.map(i => i.card_id));
    const cardById = new Map(
      ((cardRows ?? []) as unknown as any[]).map(c => [c.id as string, c])
    );

    // Two at a time, each still gated to one eBay call per second.
    const outcomes = await Promise.all(
      items.map(item =>
        publishOne(supabase, batch, item, cardById.get(item.card_id), pacer).catch(
          async (err: any): Promise<ItemOutcome> => {
            console.error(`${LOG} item ${item.id} threw:`, err?.message ?? err);
            await setItem(supabase, item.id, {
              status: 'failed',
              locked_at: null,
              attempts: (item.attempts ?? 0) + 1,
              error_code: 'drain_error',
              error_message: 'Something went wrong publishing this card. Retry it.',
            });
            return { kind: 'failed' };
          }
        )
      )
    );

    const pause = outcomes.find((o): o is Extract<ItemOutcome, { kind: 'pause' }> => o.kind === 'pause');
    for (const outcome of outcomes) {
      if (outcome.kind === 'live') result.live++;
      else if (outcome.kind === 'skipped') result.skipped++;
      else if (outcome.kind === 'failed') result.failed++;
    }

    if (pause) {
      // A selling limit applies to every remaining card, not just this one.
      // Holding them as `blocked` keeps the drafts intact and tells the seller
      // exactly why nothing else went out.
      if (pause.reason === 'listing_limit') {
        await supabase
          .from('ebay_bulk_items')
          .update({
            status: 'blocked',
            locked_at: null,
            error_code: 'listing_limit',
            error_message: LISTING_LIMIT_MESSAGE,
            updated_at: new Date().toISOString(),
          })
          .eq('batch_id', batch.id)
          .eq('status', 'queued');
      }
      await pauseBatch(supabase, batch.id, pause.reason);
      result.paused = pause.reason;
      result.status = 'paused';
      break;
    }
  }

  if (stoppedBy) {
    result.status = stoppedBy;
    result.paused = result.paused ?? `stopped: ${stoppedBy}`;
  }

  // A batch that was paused, cancelled or finished out from under this tick is
  // NOT ours to close. `settleBatch` guards its completion on status='running'
  // anyway, but skipping it here also avoids stamping counters over a batch
  // whose rows another request is still rewriting.
  if (result.status !== 'running') {
    const tally = await loadBatchTally(supabase, batch.id);
    await supabase
      .from('ebay_bulk_batches')
      .update({
        total_count: tally.total,
        ready_count: tally.ready,
        live_count: tally.live,
        failed_count: tally.failed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batch.id);
    return result;
  }

  const tally = await settleBatch(supabase, batch);
  result.status = tally.outstanding > 0 ? 'running' : 'finished';
  return result;
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

const BATCH_SELECT = 'id, user_id, settings, status';

export async function POST(request: NextRequest) {
  if (!drainEnabled()) {
    return NextResponse.json({ success: false, disabled: true, error: 'Bulk drain disabled' });
  }

  // One authorization path. The cron carries the bearer token; so do the
  // publish / resume / retry routes when they kick a single batch, because
  // they are server-side and can read CRON_SECRET. No browser can reach this.
  const cron = requireCron(request, 'ebay/bulk/drain');
  if (!cron.ok) return cron.response;

  const supabase = supabaseServer();
  const batchId = new URL(request.url).searchParams.get('batch_id');
  if (batchId && !isUuid(batchId)) {
    return NextResponse.json({ error: 'Invalid batch_id' }, { status: 400 });
  }

  const reaped = await reapStaleLocks(supabase);

  let query = supabase.from('ebay_bulk_batches').select(BATCH_SELECT).eq('status', 'running');
  query = batchId
    ? query.eq('id', batchId)
    : query.order('started_at', { ascending: true }).limit(MAX_BATCHES_PER_TICK);

  const { data, error } = await query;
  if (error) {
    console.error(`${LOG} batch load failed:`, error.message);
    return NextResponse.json({ success: false, error: 'Failed to load batches' }, { status: 500 });
  }
  const batches = (data ?? []) as unknown as BatchRow[];

  const budget = { remaining: MAX_ITEMS_PER_RUN, deadline: Date.now() + WALL_CLOCK_MS };
  // One pacer per seller: two running batches for the same account still
  // share the one-call-per-second budget, because eBay throttles the account.
  const pacers = new Map<string, Pacer>();
  const results: BatchResult[] = [];

  for (const batch of batches) {
    if (budget.remaining <= 0 || Date.now() >= budget.deadline) break;
    let pacer = pacers.get(batch.user_id);
    if (!pacer) {
      pacer = new Pacer();
      pacers.set(batch.user_id, pacer);
    }
    try {
      results.push(await tickBatch(supabase, batch, budget, pacer));
    } catch (err: any) {
      console.error(`${LOG} tick failed for ${batch.id}:`, err?.message ?? err);
      results.push({
        batch_id: batch.id,
        claimed: 0,
        live: 0,
        skipped: 0,
        failed: 0,
        status: 'error',
      });
    }
  }

  return NextResponse.json({
    success: true,
    reaped,
    batches: results.length,
    remainingBudget: budget.remaining,
    results,
  });
}

/** Vercel cron issues GET. Same handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
