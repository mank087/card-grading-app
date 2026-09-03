/**
 * Closing a bulk batch: recomputing its counters, deciding when it is
 * finished, and sending the one completion email.
 *
 * Split out of the drain because the drain is not the only caller — the
 * retry route can finish a batch too (retrying the last failed row of an
 * otherwise-complete batch reopens it, and the drain closes it again), and
 * two copies of "is this batch done?" would drift.
 *
 * Every write here is idempotent and guarded, because two drains can observe
 * the same batch finishing in the same minute:
 *   - completion is claimed with `.eq('status','running')`, so only one drain
 *     flips it;
 *   - the email is claimed separately with `.is('completion_email_sent_at',
 *     null)`, so even a re-run that somehow re-completes a batch cannot send
 *     a second one.
 */

import { Resend } from 'resend';
import type { ServerClient } from '@/lib/ebay/bulkService';

const LOG = '[ebay/bulk/complete]';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://dcmgrading.com').replace(/\/+$/, '');
}

export interface BatchTally {
  total: number;
  draft: number;
  ready: number;
  queued: number;
  inFlight: number;
  live: number;
  failed: number;
  skipped: number;
  blocked: number;
  /** Nothing left for the drain to do. */
  outstanding: number;
}

/** Count an item-status list into the shape both the batch row and the email need. */
export function tallyBulkItems(statuses: string[]): BatchTally {
  const count = (s: string) => statuses.filter(x => x === s).length;
  const inFlight = count('uploading') + count('publishing');
  const queued = count('queued');
  return {
    total: statuses.length,
    draft: count('draft'),
    ready: count('ready'),
    queued,
    inFlight,
    live: count('live'),
    failed: count('failed'),
    skipped: count('skipped'),
    blocked: count('blocked'),
    outstanding: queued + inFlight,
  };
}

export async function loadBatchTally(
  supabase: ServerClient,
  batchId: string
): Promise<BatchTally> {
  const { data } = await supabase
    .from('ebay_bulk_items')
    .select('status')
    .eq('batch_id', batchId);
  return tallyBulkItems(((data ?? []) as { status: string }[]).map(r => r.status));
}

/**
 * Write the batch's counters, and close it when nothing is outstanding.
 *
 * A batch that produced no live listing and at least one failure closes as
 * `failed` rather than `complete` — the seller's summary should not say
 * "finished" over a run where every card was rejected.
 *
 * Returns the terminal status if THIS call was the one that closed the batch
 * (so the caller can send the email), otherwise null.
 */
export async function refreshAndMaybeComplete(
  supabase: ServerClient,
  batchId: string,
  tally?: BatchTally
): Promise<{ tally: BatchTally; closedAs: 'complete' | 'failed' | null }> {
  const counts = tally ?? (await loadBatchTally(supabase, batchId));

  const base = {
    total_count: counts.total,
    ready_count: counts.ready,
    live_count: counts.live,
    failed_count: counts.failed,
    updated_at: new Date().toISOString(),
  };

  if (counts.outstanding > 0) {
    await supabase.from('ebay_bulk_batches').update(base).eq('id', batchId);
    return { tally: counts, closedAs: null };
  }

  const terminal: 'complete' | 'failed' =
    counts.live === 0 && counts.failed > 0 ? 'failed' : 'complete';

  // Guarded on 'running': a paused batch is NOT finished (its queue was
  // emptied back or is waiting on the seller), and only one drain may close a
  // running one.
  const { data } = await supabase
    .from('ebay_bulk_batches')
    .update({ ...base, status: terminal, completed_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('status', 'running')
    .select('id');

  return { tally: counts, closedAs: data && data.length > 0 ? terminal : null };
}

/**
 * One transactional email per finished batch. Not marketing: what happened,
 * how many, and the link back to the batch.
 *
 * The send-once guard is a conditional UPDATE on `completion_email_sent_at`,
 * claimed BEFORE the send. Claiming first can at worst lose an email (if
 * Resend then fails); claiming after would at worst send several, and a
 * seller getting three copies of the same summary is the worse failure.
 */
export async function sendBulkCompletionEmail(
  supabase: ServerClient,
  batch: { id: string; user_id: string },
  tally: BatchTally
): Promise<void> {
  const { data: claimed } = await supabase
    .from('ebay_bulk_batches')
    .update({ completion_email_sent_at: new Date().toISOString() })
    .eq('id', batch.id)
    .is('completion_email_sent_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) return; // already sent

  if (!process.env.RESEND_API_KEY) {
    console.warn(`${LOG} RESEND_API_KEY missing — skipping completion email`);
    return;
  }

  // Addresses live in auth, not profiles — the same lookup the submissions
  // completion email uses.
  let to: string | undefined;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(batch.user_id);
    to = authUser?.user?.email;
  } catch (e: any) {
    console.error(`${LOG} email lookup failed for ${batch.user_id}:`, e?.message);
  }
  if (!to) {
    console.warn(`${LOG} no email on file for ${batch.user_id} — skipping`);
    return;
  }

  const link = `${siteUrl()}/instalist-marketplace/bulk/${batch.id}`;
  const needsAttention = tally.failed + tally.blocked;
  const subject =
    needsAttention > 0
      ? `Your eBay batch: ${tally.live} listed, ${needsAttention} need attention`
      : `Your eBay batch: ${tally.live} card${tally.live === 1 ? '' : 's'} listed`;

  const bits: string[] = [
    `<strong>${tally.live}</strong> card${tally.live === 1 ? '' : 's'} listed on eBay`,
  ];
  if (tally.failed > 0) bits.push(`<strong>${tally.failed}</strong> failed`);
  if (tally.blocked > 0) bits.push(`<strong>${tally.blocked}</strong> held`);
  if (tally.skipped > 0) bits.push(`<strong>${tally.skipped}</strong> skipped (already listed)`);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: 'DCM Grading <admin@dcmgrading.com>',
      to: [to],
      subject,
      html: `
        <p>Your bulk listing batch has finished.</p>
        <p>${bits.join(' &middot; ')}.</p>
        <p><a href="${link}">Open the batch</a></p>
      `,
    });
    if (error) console.error(`${LOG} completion email failed:`, error.message);
  } catch (e: any) {
    console.error(`${LOG} completion email threw:`, e?.message);
  }
}

/** Recompute, close if finished, and notify — the whole end-of-batch step. */
export async function settleBatch(
  supabase: ServerClient,
  batch: { id: string; user_id: string },
  tally?: BatchTally
): Promise<BatchTally> {
  const { tally: counts, closedAs } = await refreshAndMaybeComplete(supabase, batch.id, tally);
  if (closedAs) {
    console.log(`${LOG} ${batch.id} ${closedAs}: ${counts.live} live, ${counts.failed} failed`);
    await sendBulkCompletionEmail(supabase, batch, counts);
  }
  return counts;
}
