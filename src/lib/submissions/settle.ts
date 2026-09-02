import { Resend } from 'resend';
import { supabaseServer } from '@/lib/supabaseServer';
import { recordGradingFailure } from '@/lib/gradingFailure';
import { addCardsToBinder } from '@/lib/binders/service';
import { getSubmissionItems, tallyItems } from './service';
import {
  MAX_ITEM_ATTEMPTS,
  STUCK_GRADE_MS,
  type SubmissionItemRow,
  type SubmissionRow,
} from './types';

/**
 * The cheap half of a drain tick: reconcile item rows against the card rows,
 * file whatever finished into the binder, and close the submission when
 * nothing is outstanding.
 *
 * This lived inside POST /api/submissions/drain, which also claims, charges
 * and dispatches new grades. Those are the slow, expensive, side-effectful
 * parts; this half is a handful of reads and a few narrow updates, it starts
 * nothing new, and it is idempotent — which is exactly what makes it safe for
 * the status poll to await inline (see the self-heal note in
 * api/submissions/[id]/status/route.ts).
 *
 * Split out rather than duplicated: two copies of the reconcile rules would
 * drift, and the refund-on-stuck path is not something to have twice.
 */

const LOG = '[submissions/settle]';
const resend = new Resend(process.env.RESEND_API_KEY);

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://dcmgrading.com';
}

/** A card row is mid-grade exactly when it holds the lock (`processing:<ISO>`). */
export function isProcessing(gradeStatus: string | null | undefined): boolean {
  return typeof gradeStatus === 'string' && gradeStatus.startsWith('processing:');
}

export interface CardState {
  id: string;
  grade_status: string | null;
  user_id: string | null;
  category: string | null;
  error_message: string | null;
}

export async function loadCardStates(cardIds: string[]): Promise<Map<string, CardState>> {
  const byId = new Map<string, CardState>();
  if (!cardIds.length) return byId;

  const supabase = supabaseServer();
  // Narrow select: `cards` is ~290 columns and several are large JSON blobs.
  const { data, error } = await supabase
    .from('cards')
    .select('id, grade_status, user_id, category, error_message')
    .in('id', cardIds);

  if (error) {
    console.error(`${LOG} card state read failed:`, error.message);
    return byId;
  }
  for (const row of data ?? []) byId.set((row as any).id, row as CardState);
  return byId;
}

export async function setItemStatus(
  itemId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = supabaseServer();
  const { error } = await supabase.from('submission_items').update(patch).eq('id', itemId);
  if (error) console.error(`${LOG} item update failed for ${itemId}:`, error.message);
}

// ---------------------------------------------------------------------------
// Binder filing
// ---------------------------------------------------------------------------

/**
 * File graded cards into the destination binder in scan order.
 *
 * Called during reconcile so cards land as they finish — interrupted at card
 * 60 leaves 60 filed cards, not an empty binder and a stuck job. Completion
 * runs it once more to catch stragglers. `addCardsToBinder` skips cards
 * already present, so repeated calls are free.
 */
export async function fileIntoBinder(
  submission: SubmissionRow,
  items: SubmissionItemRow[]
): Promise<number> {
  if (!submission.binder_id) return 0;

  const cardIds = items
    .filter((item) => item.status === 'graded' && item.card_id)
    .sort((a, b) => a.position - b.position)
    .map((item) => item.card_id as string);

  if (!cardIds.length) return 0;

  try {
    return await addCardsToBinder(supabaseServer(), submission.binder_id, cardIds);
  } catch (e: any) {
    console.error(`${LOG} binder filing failed for ${submission.id}:`, e?.message);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

async function sendCompletionEmail(
  submission: SubmissionRow,
  graded: number,
  failed: number
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`${LOG} RESEND_API_KEY missing — skipping completion email`);
    return;
  }

  // Addresses live in auth, not in profiles — same lookup the winback cron
  // uses (src/app/api/cron/send-winback-emails/route.ts).
  const supabase = supabaseServer();
  let to: string | undefined;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(submission.user_id);
    to = authUser?.user?.email;
  } catch (e: any) {
    console.error(`${LOG} email lookup failed for ${submission.user_id}:`, e?.message);
  }

  if (!to) {
    console.warn(`${LOG} no email on file for ${submission.user_id} — skipping completion email`);
    return;
  }

  // The binder (or the collection) is the destination, not the transient
  // progress page — there is no submissions history surface any more.
  const link = submission.binder_id
    ? `${siteUrl()}/collection?binder=${submission.binder_id}`
    : `${siteUrl()}/collection`;
  const label = submission.name?.trim() || 'Your submission';
  const subject =
    failed > 0
      ? `${label}: ${graded} graded, ${failed} need a retry`
      : `${label}: ${graded} card${graded === 1 ? '' : 's'} graded`;

  try {
    const { error } = await resend.emails.send({
      from: 'DCM Grading <admin@dcmgrading.com>',
      to: [to],
      subject,
      html: `
        <p>${label} is finished.</p>
        <p><strong>${graded}</strong> card${graded === 1 ? '' : 's'} graded${
          failed > 0 ? ` &middot; <strong>${failed}</strong> need a retry` : ''
        }.</p>
        <p><a href="${link}">${submission.binder_id ? 'Open your binder' : 'See your cards'}</a></p>
      `,
    });
    if (error) console.error(`${LOG} completion email failed:`, error.message);
  } catch (e: any) {
    console.error(`${LOG} completion email threw:`, e?.message);
  }
}

/** Mark the submission finished, file the last cards, notify once. */
export async function completeSubmission(
  submission: SubmissionRow,
  items: SubmissionItemRow[]
): Promise<void> {
  const supabase = supabaseServer();
  await fileIntoBinder(submission, items);

  // Guarded on status='running' so only one drain wins the completion and
  // therefore only one completion email is ever sent.
  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', submission.id)
    .eq('status', 'running')
    .select('id');

  if (error) {
    console.error(`${LOG} completion write failed for ${submission.id}:`, error.message);
    return;
  }
  if (!data || data.length === 0) return; // another drain already closed it

  const counts = tallyItems(items);
  console.log(`${LOG} ${submission.id} complete: ${counts.graded} graded, ${counts.failed} failed`);
  await sendCompletionEmail(submission, counts.graded, counts.failed);
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

/**
 * Bring item status back in line with the card rows, which are the truth.
 *
 * Drift is normal, not exceptional: the drain hangs up on every dispatch after
 * ~50s, so an item is `dispatched` long after its grade actually landed.
 * Nothing downstream counts anything the drain remembered.
 *
 * Mutates `items` in place as well as writing, so a caller that already has
 * the array can re-tally it without a second read.
 */
export async function reconcile(
  submission: SubmissionRow,
  items: SubmissionItemRow[]
): Promise<void> {
  const inFlightItems = items.filter(
    (item) => (item.status === 'dispatched' || item.status === 'grading') && item.card_id
  );
  if (!inFlightItems.length) return;

  const cards = await loadCardStates(inFlightItems.map((item) => item.card_id as string));
  const now = Date.now();

  for (const item of inFlightItems) {
    const card = cards.get(item.card_id as string);
    if (!card) continue;

    if (card.grade_status === 'complete') {
      item.status = 'graded';
      await setItemStatus(item.id, { status: 'graded', error: null });
      continue;
    }

    if (card.grade_status === 'failed') {
      const attempts = item.attempts + 1;
      const retry = attempts < MAX_ITEM_ATTEMPTS;
      item.status = retry ? 'queued' : 'failed';
      item.attempts = attempts;
      await setItemStatus(item.id, {
        status: item.status,
        attempts,
        claimed_at: null,
        error: (card.error_message || 'Grading failed').slice(0, 500),
      });
      continue;
    }

    if (isProcessing(card.grade_status)) {
      // Still legitimately grading — unless the lease has aged out.
      const claimedAt = item.claimed_at ? Date.parse(item.claimed_at) : NaN;
      const stuck = !Number.isNaN(claimedAt) && now - claimedAt > STUCK_GRADE_MS;
      if (!stuck) {
        if (item.status !== 'grading') {
          item.status = 'grading';
          await setItemStatus(item.id, { status: 'grading' });
        }
        continue;
      }

      // Past the 10-minute threshold the client already uses: the function
      // that held this lock is gone. recordGradingFailure marks the card
      // failed AND refunds the credit, so the retry is on the house.
      console.warn(`${LOG} card ${card.id} stuck processing — failing and refunding`);
      await recordGradingFailure({
        cardId: card.id,
        userId: card.user_id,
        category: card.category || submission.category,
        errorMessage: 'Grading timed out (bulk submission drain)',
      });

      const attempts = item.attempts + 1;
      const retry = attempts < MAX_ITEM_ATTEMPTS;
      item.status = retry ? 'queued' : 'failed';
      item.attempts = attempts;
      await setItemStatus(item.id, {
        status: item.status,
        attempts,
        claimed_at: null,
        error: 'Grading timed out',
      });
      continue;
    }

    // grade_status null: the dispatch never took the lock (the route answered
    // without grading, 404'd, or the fetch never landed). Return it to the
    // queue within its budget.
    const attempts = item.attempts + 1;
    const retry = attempts < MAX_ITEM_ATTEMPTS;
    item.status = retry ? 'queued' : 'failed';
    item.attempts = attempts;

    // Out of retries: refund, the same as the 'failed' and stuck-lease
    // branches above. The credit was taken at dispatch and the card has no
    // grade to show for it, so keeping it would charge for nothing. This
    // branch was the one path out of reconcile that gave up WITHOUT
    // refunding — found 2026-09-02, after a batch left two cards charged and
    // permanently ungraded.
    if (!retry) {
      await recordGradingFailure({
        cardId: card.id,
        userId: card.user_id,
        category: card.category || submission.category,
        errorMessage: 'Grading never started (bulk submission drain)',
      });
    }

    await setItemStatus(item.id, {
      status: item.status,
      attempts,
      claimed_at: null,
      error: retry ? null : 'Grading never started',
    });
  }
}

// ---------------------------------------------------------------------------
// The awaitable settle pass
// ---------------------------------------------------------------------------

export interface SettleResult {
  /** Items whose status changed, or cards newly filed, or the submission closed. */
  changed: boolean;
  filed: number;
  completed: boolean;
  /** The item rows after reconcile — re-tally these, don't re-read. */
  items: SubmissionItemRow[];
}

/**
 * Reconcile → file → complete, and nothing else. No claiming, no charging, no
 * dispatching, so the cost is bounded (2-3 small queries plus at most one
 * update per drifted item) and there is no long-running work to abandon.
 *
 * `items` may be supplied by a caller that already read them; the array is
 * mutated in place and returned.
 */
export async function settleSubmission(
  submission: SubmissionRow,
  items?: SubmissionItemRow[]
): Promise<SettleResult> {
  const rows = items ?? (await getSubmissionItems(submission.id));
  const before = rows.map((item) => item.status).join('|');

  await reconcile(submission, rows);
  const filed = await fileIntoBinder(submission, rows);

  const counts = tallyItems(rows);
  let completed = false;
  if (counts.active === 0 && submission.status === 'running') {
    await completeSubmission(submission, rows);
    completed = true;
  }

  const after = rows.map((item) => item.status).join('|');
  return { changed: before !== after || filed > 0 || completed, filed, completed, items: rows };
}
