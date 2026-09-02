import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { requireCron } from '@/lib/cronAuth';
import { resolveSelfOrigin } from '@/lib/selfOrigin';
import { deductCredit } from '@/lib/credits';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';
import {
  getOwnedSubmission,
  getSubmissionItems,
  listRunningSubmissions,
  tallyItems,
} from '@/lib/submissions/service';
// Reconcile / file / complete live in settle.ts so the status poll can run the
// same code without duplicating the refund-on-stuck rules. Claiming, charging
// and dispatching stay here — they are this route's alone.
import {
  completeSubmission,
  fileIntoBinder,
  isProcessing,
  loadCardStates,
  reconcile,
  setItemStatus,
} from '@/lib/submissions/settle';
import {
  COST_PER_GRADE_USD,
  MAX_IN_FLIGHT,
  SUBMISSION_SPEND_CEILING_USD,
  type SubmissionRow,
} from '@/lib/submissions/types';

/**
 * POST /api/submissions/drain
 *
 * The one place a submission's queue moves. Two drivers call it — the
 * per-minute Vercel cron and the owner's open page ("kick") — running the
 * same code path, so closing the tab pauses progress rather than breaking it.
 *
 * Mechanism (SOW "Grading execution — verified approach"): an internal
 * self-call to the existing per-category GET route. Those 8 routes carry the
 * cross-instance grading lock, the failure/refund path and every per-category
 * divergence; extracting a callable core would be an 8×1,300-line refactor of
 * the most business-critical path with no route test coverage. Rejected there,
 * not revisited here.
 *
 * Each tick, per running submission:
 *   1. count in-flight, skip if at the ceiling
 *   2. claim up to the remaining headroom, charge, dispatch
 *   3. reconcile what finished, failed or got stuck
 *   4. file freshly graded cards into the binder, and close the submission
 *      when nothing is left outstanding
 *
 * The drain is idempotent at every step: it holds no in-memory state, the
 * authoritative in-flight counter is `cards.grade_status`, and a second
 * concurrent drain loses the claim race rather than duplicating work.
 */

export const maxDuration = 60;

const LOG = '[submissions/drain]';

/** ~50s, comfortably inside maxDuration 60 with room to reconcile after. */
const DISPATCH_ABORT_MS = 50_000;

/** Never spin on more submissions than one 60s tick can serve. */
const MAX_SUBMISSIONS_PER_TICK = 3;

function drainEnabled(): boolean {
  // Default ON. Only the explicit string 'false' disables it, so a missing or
  // typo'd env var cannot silently stop every submission on the platform.
  return (process.env.SUBMISSIONS_DRAIN_ENABLED || '').toLowerCase() !== 'false';
}

// ---------------------------------------------------------------------------
// Claiming
// ---------------------------------------------------------------------------

/**
 * Claim one item by compare-and-swap.
 *
 * `.eq('status', 'queued')` is part of the UPDATE's WHERE clause, so Postgres
 * evaluates it under the row lock: exactly one of two concurrent drains
 * flips the row and gets a row back, and the loser's `.select()` returns
 * empty. There is no read-then-write window to lose. `claimed_at` is stamped
 * in the same statement so the reconcile pass can age the lease out.
 */
async function claimItem(itemId: string): Promise<boolean> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('submission_items')
    .update({ status: 'dispatched', claimed_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('status', 'queued')
    .select('id');

  if (error) {
    console.error(`${LOG} claim failed for item ${itemId}:`, error.message);
    return false;
  }
  return !!data && data.length > 0;
}

/** Put a claim back — used when the charge fails, before anything was dispatched. */
async function releaseClaim(itemId: string, errorText: string | null = null): Promise<void> {
  const supabase = supabaseServer();
  const { error } = await supabase
    .from('submission_items')
    .update({ status: 'queued', claimed_at: null, error: errorText })
    .eq('id', itemId)
    .eq('status', 'dispatched');
  if (error) console.error(`${LOG} release failed for item ${itemId}:`, error.message);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Fire the grade and stop waiting after ~50s.
 *
 * Aborting is NOT a failure: the grading route runs in its own function with
 * `maxDuration = 300` and keeps going after we hang up. The card's grading
 * lock is what makes that safe — the next tick sees `processing:<ISO>` and
 * counts it in-flight rather than re-firing it.
 */
async function dispatchGrade(
  origin: string,
  routeSlug: string,
  cardId: string,
  ownerId: string
): Promise<{ dispatched: boolean; completed: boolean; error?: string }> {
  const url = `${origin}/api/${routeSlug}/${cardId}?user_id=${encodeURIComponent(ownerId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_ABORT_MS);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (res.ok) return { dispatched: true, completed: true };
    // A 429 is the route's own lock saying someone else is already grading
    // this card. That is a successful dispatch from our side.
    if (res.status === 429) return { dispatched: true, completed: false };
    return {
      dispatched: true,
      completed: false,
      error: `grading route returned ${res.status}`,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // Expected on nearly every grade: ~90s of work, ~50s of patience.
      return { dispatched: true, completed: false };
    }
    return { dispatched: false, completed: false, error: err?.message || 'dispatch failed' };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Per-submission tick
// ---------------------------------------------------------------------------

interface TickResult {
  submission_id: string;
  in_flight: number;
  claimed: number;
  dispatched: number;
  filed: number;
  status: string;
  note?: string;
}

async function tickSubmission(submission: SubmissionRow, origin: string): Promise<TickResult> {
  let items = await getSubmissionItems(submission.id);

  // 1. Reconcile FIRST. Yesterday's `dispatched` rows are usually finished
  //    grades, and counting them as in-flight would stall the queue forever.
  await reconcile(submission, items);

  const filed = await fileIntoBinder(submission, items);

  const counts = tallyItems(items);

  // 2. Completion.
  if (counts.active === 0) {
    await completeSubmission(submission, items);
    return {
      submission_id: submission.id,
      in_flight: 0,
      claimed: 0,
      dispatched: 0,
      filed,
      status: 'complete',
    };
  }

  // 3. Spend ceiling. A backstop, not a budget: with the 100-card cap a
  //    submission tops out near $16, so this only fires if the item rows have
  //    outrun what the submission declared — i.e. something is looping.
  const chargeable = counts.dispatched + counts.grading + counts.graded;
  const spentSoFar = chargeable * COST_PER_GRADE_USD;
  const legitimateCeiling = (submission.card_count ?? 0) * COST_PER_GRADE_USD;
  if (spentSoFar > SUBMISSION_SPEND_CEILING_USD && spentSoFar > legitimateCeiling) {
    console.error(
      `${LOG} ${submission.id} tripped the spend ceiling: ${chargeable} grades ` +
      `(~$${spentSoFar.toFixed(2)}) against a declared ${submission.card_count} cards — pausing`
    );
    await supabaseServer()
      .from('submissions')
      .update({ status: 'paused' })
      .eq('id', submission.id)
      .eq('status', 'running');
    return {
      submission_id: submission.id,
      in_flight: counts.dispatched + counts.grading,
      claimed: 0,
      dispatched: 0,
      filed,
      status: 'paused',
      note: 'spend ceiling',
    };
  }

  // 4. In-flight, counted from the card rows rather than item status — the
  //    grading lock is the authoritative counter (SOW).
  const maybeInFlight = items.filter(
    (item) => (item.status === 'dispatched' || item.status === 'grading') && item.card_id
  );
  const cards = await loadCardStates(maybeInFlight.map((i) => i.card_id as string));
  const inFlight = maybeInFlight.filter((item) =>
    isProcessing(cards.get(item.card_id as string)?.grade_status)
  ).length;

  if (inFlight >= MAX_IN_FLIGHT) {
    return {
      submission_id: submission.id,
      in_flight: inFlight,
      claimed: 0,
      dispatched: 0,
      filed,
      status: 'running',
      note: 'at concurrency ceiling',
    };
  }

  // 5. Claim, charge, dispatch.
  const headroom = MAX_IN_FLIGHT - inFlight;
  const queued = items
    .filter((item) => item.status === 'queued' && item.card_id)
    .sort((a, b) => a.position - b.position)
    .slice(0, headroom);

  // Route slug comes from the submission's category. Sports sub-categories
  // and the Naruto/Other case both already collapse correctly inside
  // categoryToRouteSlug, so there is nothing to duplicate here.
  const routeSlug = categoryToRouteSlug(submission.category);
  let claimed = 0;
  let dispatched = 0;

  // Two phases, deliberately split.
  //
  // Phase A — claim + charge, SEQUENTIALLY. `deductCredit`'s personal-credit
  // path is a read-modify-write on user_credits.balance (read balance, write
  // balance - 1), so N parallel deductions all read the same starting balance
  // and the last write wins: charges get lost, and the `balance < 1` guard
  // can wave through more grades than the user can afford. These are two fast
  // DB round-trips per item, so serialising them costs milliseconds.
  //
  // Phase B — dispatch, CONCURRENTLY. This is the slow part (each dispatch
  // holds its abort window), and it is what the owner watched crawl through
  // cards one at a time. Up to MAX_IN_FLIGHT grade in parallel.
  const charged: typeof queued = [];
  let blocked = false;

  for (const item of queued) {
    if (!(await claimItem(item.id))) continue; // another drain got there first
    claimed += 1;

    // Charge BEFORE dispatch, keyed on card_id. A retried item that was
    // already charged comes back alreadyCharged:true and costs nothing.
    const charge = await deductCredit(submission.user_id, {
      cardId: item.card_id as string,
      description: `Grade card (bulk submission)`,
    });

    if (!charge.success) {
      if ((charge.error || '').toLowerCase().includes('insufficient')) {
        // Balance moved out from under a committed submission (spent from
        // another device). Park it — this is the backstop the SOW describes,
        // not the primary gate, which ran at commit. Anything already charged
        // in this tick still gets dispatched below: the credit is spent, so
        // the card must grade.
        console.warn(`${LOG} ${submission.id} out of credits mid-run — blocking`);
        await releaseClaim(item.id);
        await supabaseServer()
          .from('submissions')
          .update({ status: 'blocked_insufficient_credits' })
          .eq('id', submission.id)
          .eq('status', 'running');
        blocked = true;
        break;
      }
      await releaseClaim(item.id, charge.error || 'Could not charge this card');
      continue;
    }

    charged.push(item);
  }

  const outcomes = await Promise.allSettled(
    charged.map(async (item) => {
      const result = await dispatchGrade(
        origin,
        routeSlug,
        item.card_id as string,
        submission.user_id
      );

      if (!result.dispatched) {
        // Never reached the route, so nothing is grading and nothing will
        // release the lock. Requeue; the charge stays and is not re-taken.
        await releaseClaim(item.id, result.error || 'Dispatch failed');
        return false;
      }

      // ALWAYS 'grading' — never 'graded' straight off the dispatch.
      //
      // This used to be `result.completed ? 'graded' : 'grading'`, where
      // `completed` was set by nothing more than `res.ok`. A 200 from a
      // category route is NOT proof that a grade was written: those routes
      // have several early-return branches that answer 200 without grading
      // anything. When that happened the item went terminal as 'graded',
      // reconcile skipped it (terminal items are not revisited), the card kept
      // a null grade_status forever, and completeSubmission fired the "your
      // cards are graded" email over cards that had never been graded.
      //
      // Observed in production 2026-09-02 on submission c03e8631: 3 items all
      // marked graded with attempts=0, 2 of the 3 cards with no grade at all,
      // and the customer shown "A Authentic" on both.
      //
      // 'graded' is now only ever set by reconcile(), which reads the card row
      // and promotes on card.grade_status === 'complete'. Its other branches
      // are already right: null requeues within the attempt budget, 'failed'
      // retries and refunds, and a lease past STUCK_GRADE_MS fails and refunds.
      // The cost is that an item shows 'grading' until the next tick confirms
      // it; the benefit is that "graded" always means a grade exists.
      await setItemStatus(item.id, {
        status: 'grading',
        error: result.error ?? null,
      });
      return true;
    })
  );

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (outcome.status === 'fulfilled') {
      if (outcome.value) dispatched += 1;
      continue;
    }
    // dispatchGrade swallows its own errors, so this is a bookkeeping failure
    // (releaseClaim / setItemStatus threw). Leave the claim for reconcile.
    console.error(
      `${LOG} dispatch bookkeeping failed for item ${charged[i].id}:`,
      outcome.reason?.message || outcome.reason
    );
  }

  return {
    submission_id: submission.id,
    in_flight: inFlight + dispatched,
    claimed,
    dispatched,
    filed,
    status: blocked ? 'blocked_insufficient_credits' : 'running',
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * Two callers, one code path:
 *  - the Vercel cron, carrying the CRON_SECRET bearer token
 *  - the submission's owner, kicking their own queue from an open page
 *
 * The owner path takes `?submission_id=` and is scoped to that one submission
 * after an ownership check. Unlike the 8 grading GETs, this endpoint never
 * trusts a client-supplied user id — it is the model the code audit asked for.
 */
export async function POST(request: NextRequest) {
  if (!drainEnabled()) {
    return NextResponse.json({ success: false, error: 'Drain disabled', disabled: true });
  }

  const origin = resolveSelfOrigin(request);
  const submissionId = new URL(request.url).searchParams.get('submission_id');

  const cron = requireCron(request, 'submissions/drain');
  let submissions: SubmissionRow[] = [];

  if (cron.ok) {
    if (submissionId) {
      const supabase = supabaseServer();
      const { data } = await supabase
        .from('submissions')
        .select('id, user_id, name, category, sub_category, binder_id, status, source, card_count, routing_key, created_at, committed_at, completed_at')
        .eq('id', submissionId)
        .eq('status', 'running')
        .maybeSingle();
      submissions = data ? [data as unknown as SubmissionRow] : [];
    } else {
      submissions = await listRunningSubmissions(MAX_SUBMISSIONS_PER_TICK);
    }
  } else {
    // Not the cron — the only other accepted caller is the owner of a named
    // submission. No submission_id means there is nothing to authorize.
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: 'submission_id is required' },
        { status: 400 }
      );
    }
    const loaded = await getOwnedSubmission(submissionId, auth.userId);
    if (!loaded.ok) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }
    if (loaded.data.status !== 'running') {
      return NextResponse.json({
        success: true,
        skipped: `submission is ${loaded.data.status}`,
        results: [],
      });
    }
    submissions = [loaded.data];
  }

  const results: TickResult[] = [];
  for (const submission of submissions) {
    try {
      results.push(await tickSubmission(submission, origin));
    } catch (e: any) {
      console.error(`${LOG} tick failed for ${submission.id}:`, e?.message);
      results.push({
        submission_id: submission.id,
        in_flight: 0,
        claimed: 0,
        dispatched: 0,
        filed: 0,
        status: 'error',
        note: e?.message || 'tick failed',
      });
    }
  }

  return NextResponse.json({ success: true, submissions: results.length, results });
}

/** Vercel cron issues GET. Same handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
