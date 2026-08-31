// src/lib/submissions/service.ts
//
// Server-side service layer for bulk grading submissions.
// Spec: docs/SOW_submissions_bulk_grading_2026-08-31.md
//
// The queue is the source of truth. This file owns everything up to the point
// a submission starts running; POST /api/submissions/drain owns what happens
// after. Nothing here calls OpenAI and nothing here charges a credit — the
// drain charges per card at grade time, so an abandoned or failed submission
// never leaves someone out 100 credits.
//
// Every function returns a SubmissionResult rather than throwing: each caller
// is a route that has to turn the failure into a status code, and the credit
// gate in particular carries numbers the UI renders as the two offered paths
// ("keep the first N" / "buy credits").

import { supabaseServer } from '@/lib/supabaseServer';
import { getUserCredits } from '@/lib/credits';
import { getOrgForUser } from '@/lib/organizations';
import { generateNextSerial } from '@/lib/serialGenerator';
import {
  ACTIVE_ITEM_STATUSES,
  MAX_SUBMISSION_ITEMS,
  type SubmissionError,
  type SubmissionItemInput,
  type SubmissionItemRow,
  type SubmissionResult,
  type SubmissionRow,
} from './types';

const LOG = '[submissions]';

/** Columns worth reading for a submission. Never `select('*')` on a hot path. */
const SUBMISSION_COLUMNS =
  'id, user_id, name, category, sub_category, binder_id, status, source, card_count, routing_key, created_at, committed_at, completed_at';

/**
 * Item columns for queue work. Deliberately excludes nothing heavy — this
 * table has no JSON columns — but the list is explicit so it stays that way.
 */
const ITEM_COLUMNS =
  'id, submission_id, card_id, position, front_path, back_path, front_hash, back_hash, status, claimed_at, attempts, error, created_at';

function ok<T>(data: T): SubmissionResult<T> {
  return { ok: true, data };
}

/**
 * Typed failure. The `SubmissionResult<never>` return means a failure from one
 * service call can be handed straight back by a caller returning any other
 * result type, without a cast — `{ ok: false }` is assignable to every
 * SubmissionResult.
 */
function fail(error: SubmissionError): SubmissionResult<never> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Load a submission, enforcing ownership. */
export async function getOwnedSubmission(
  submissionId: string,
  userId: string
): Promise<SubmissionResult<SubmissionRow>> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', submissionId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG} load failed for ${submissionId}:`, error.message);
    return fail({ code: 'internal', message: 'Could not load submission' });
  }
  if (!data) return fail({ code: 'not_found', message: 'Submission not found' });

  const row = data as unknown as SubmissionRow;
  // Service-role client bypasses RLS, so the ownership check is ours to make.
  if (row.user_id !== userId) {
    return fail({ code: 'not_found', message: 'Submission not found' });
  }
  return ok(row);
}

/** The user's submissions, newest first. Light columns only — this feeds a list. */
export async function listSubmissions(
  userId: string,
  limit = 50
): Promise<SubmissionResult<Array<Pick<SubmissionRow,
  'id' | 'name' | 'category' | 'status' | 'card_count' | 'binder_id' | 'created_at' | 'committed_at' | 'completed_at'>>>> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, name, category, status, card_count, binder_id, created_at, committed_at, completed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    console.error(`${LOG} list failed for ${userId}:`, error.message);
    return fail({ code: 'internal', message: 'Could not list submissions' });
  }
  return ok((data ?? []) as any);
}

/** All items for a submission, in scan order. */
export async function getSubmissionItems(submissionId: string): Promise<SubmissionItemRow[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('submission_items')
    .select(ITEM_COLUMNS)
    .eq('submission_id', submissionId)
    .order('position', { ascending: true });

  if (error) {
    console.error(`${LOG} items load failed for ${submissionId}:`, error.message);
    return [];
  }
  return (data ?? []) as unknown as SubmissionItemRow[];
}

/** Per-status item counts, derived rather than stored (no counter to drift). */
export function tallyItems(items: Array<Pick<SubmissionItemRow, 'status'>>) {
  const counts = { queued: 0, dispatched: 0, grading: 0, graded: 0, failed: 0, skipped: 0 };
  for (const item of items) {
    if (item.status in counts) counts[item.status as keyof typeof counts] += 1;
  }
  return {
    ...counts,
    total: items.length,
    active: counts.queued + counts.dispatched + counts.grading,
    done: counts.graded + counts.failed + counts.skipped,
  };
}

// ---------------------------------------------------------------------------
// Credit gate
// ---------------------------------------------------------------------------

/**
 * Credits available to this user for grading, matching what deductCredit will
 * actually draw on: the store pool first (when an active org membership
 * exists), then personal credits. Gating on the personal balance alone would
 * wrongly block an enterprise store whose staff grade from the org pool.
 */
export async function availableGradingCredits(
  userId: string
): Promise<{ balance: number; personal: number; org: number }> {
  const credits = await getUserCredits(userId);
  const personal = Number(credits?.balance ?? 0);

  let org = 0;
  try {
    const membership = await getOrgForUser(userId);
    if (membership && membership.org.status === 'active') {
      org = Number(membership.org.monthly_credits ?? 0) + Number(membership.org.overage_credits ?? 0);
    }
  } catch (e: any) {
    // No org table / no membership is the common case — never block on it.
    console.warn(`${LOG} org pool lookup failed for ${userId}:`, e?.message);
  }

  return { balance: personal + org, personal, org };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateDraftInput {
  userId: string;
  category: string;
  name?: string | null;
  subCategory?: string | null;
  binderId?: string | null;
  source?: string | null;
  items?: SubmissionItemInput[];
}

/**
 * Create a draft submission, optionally with its items in the same call.
 * Nothing is charged and no card row exists yet — a draft is free to abandon.
 */
export async function createDraftSubmission(
  input: CreateDraftInput
): Promise<SubmissionResult<{ submission: SubmissionRow; itemCount: number }>> {
  const { userId, category } = input;
  if (!userId) return fail({ code: 'forbidden', message: 'Not authenticated' });
  if (!category || !category.trim()) {
    return fail({ code: 'invalid', message: 'category is required' });
  }

  const items = input.items ?? [];
  if (items.length > MAX_SUBMISSION_ITEMS) {
    return fail({
      code: 'too_many_items',
      message: `A submission holds at most ${MAX_SUBMISSION_ITEMS} cards.`,
      max: MAX_SUBMISSION_ITEMS,
      provided: items.length,
    });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      user_id: userId,
      name: input.name?.trim() || null,
      category: category.trim(),
      sub_category: input.subCategory?.trim() || null,
      binder_id: input.binderId || null,
      source: input.source || 'upload',
      status: 'draft',
      card_count: items.length || null,
    })
    .select(SUBMISSION_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    console.error(`${LOG} create failed:`, error?.message);
    return fail({ code: 'internal', message: 'Could not create submission' });
  }

  const submission = data as unknown as SubmissionRow;

  if (items.length) {
    const added = await addSubmissionItems(submission.id, userId, items);
    if (!added.ok) return added;
    return ok({ submission, itemCount: added.data.inserted });
  }

  return ok({ submission, itemCount: 0 });
}

/**
 * Append items to a draft. Idempotent on (submission_id, position) via the
 * unique index, so a retried intake POST does not duplicate the grid.
 */
export async function addSubmissionItems(
  submissionId: string,
  userId: string,
  items: SubmissionItemInput[]
): Promise<SubmissionResult<{ inserted: number; total: number }>> {
  if (!items.length) return ok({ inserted: 0, total: 0 });

  const loaded = await getOwnedSubmission(submissionId, userId);
  if (!loaded.ok) return loaded;
  if (loaded.data.status !== 'draft' && loaded.data.status !== 'ready' &&
      loaded.data.status !== 'blocked_insufficient_credits') {
    return fail({
      code: 'conflict',
      message: `Cannot add cards to a submission that is ${loaded.data.status}.`,
    });
  }

  const supabase = supabaseServer();
  const { count: existingCount } = await supabase
    .from('submission_items')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId);

  const total = (existingCount ?? 0) + items.length;
  if (total > MAX_SUBMISSION_ITEMS) {
    return fail({
      code: 'too_many_items',
      message: `A submission holds at most ${MAX_SUBMISSION_ITEMS} cards.`,
      max: MAX_SUBMISSION_ITEMS,
      provided: total,
    });
  }

  const rows = items.map((item) => ({
    submission_id: submissionId,
    position: item.position,
    front_path: item.front_path || null,
    back_path: item.back_path || null,
    front_hash: item.front_hash || null,
    back_hash: item.back_hash || null,
    status: 'queued',
  }));

  // upsert on the unique (submission_id, position) index: re-sending the same
  // slot replaces the paths rather than erroring, which is what a resumed
  // upload wants.
  const { error } = await supabase
    .from('submission_items')
    .upsert(rows, { onConflict: 'submission_id,position' });

  if (error) {
    console.error(`${LOG} item insert failed for ${submissionId}:`, error.message);
    return fail({ code: 'internal', message: 'Could not save submission items' });
  }

  await supabase.from('submissions').update({ card_count: total }).eq('id', submissionId);

  return ok({ inserted: rows.length, total });
}

/**
 * Commit a submission: validate it, create the `cards` rows, and hand the
 * queue to the drain.
 *
 * Deliberately does NOT charge. The drain calls deductCredit per card at
 * dispatch time, keyed on card_id, so a retry storm cannot double-charge and
 * a submission that never runs costs nothing.
 */
export async function commitSubmission(
  submissionId: string,
  userId: string
): Promise<SubmissionResult<{ submission: SubmissionRow; cardsCreated: number; itemCount: number }>> {
  const loaded = await getOwnedSubmission(submissionId, userId);
  if (!loaded.ok) return loaded;
  const submission = loaded.data;

  if (submission.status === 'running') {
    return ok({ submission, cardsCreated: 0, itemCount: submission.card_count ?? 0 });
  }
  if (!['draft', 'ready', 'blocked_insufficient_credits', 'paused'].includes(submission.status)) {
    return fail({
      code: 'conflict',
      message: `A ${submission.status} submission cannot be committed.`,
    });
  }

  const items = await getSubmissionItems(submissionId);

  // --- validation -------------------------------------------------------
  if (!items.length) {
    return fail({ code: 'invalid', message: 'This submission has no cards.' });
  }
  if (items.length > MAX_SUBMISSION_ITEMS) {
    return fail({
      code: 'too_many_items',
      message: `A submission holds at most ${MAX_SUBMISSION_ITEMS} cards.`,
      max: MAX_SUBMISSION_ITEMS,
      provided: items.length,
    });
  }

  // Pairing must be complete. A half-paired item is the double-feed failure
  // mode reaching the server, and it must never become a charged card.
  const incomplete = items
    .filter((item) => !item.front_path || !item.back_path)
    .map((item) => item.position);
  if (incomplete.length) {
    return fail({
      code: 'incomplete_pairs',
      message: `${incomplete.length} card${incomplete.length === 1 ? '' : 's'} ${
        incomplete.length === 1 ? 'is' : 'are'
      } missing a front or a back.`,
      positions: incomplete.slice(0, 50),
    });
  }

  // --- credit gate (owner requirement, enforced server-side) ------------
  const required = items.length;
  const { balance } = await availableGradingCredits(userId);
  if (balance < required) {
    const supabase = supabaseServer();
    await supabase
      .from('submissions')
      .update({ status: 'blocked_insufficient_credits' })
      .eq('id', submissionId);
    return fail({
      code: 'insufficient_credits',
      message: `This submission needs ${required} credit${required === 1 ? '' : 's'} and you have ${balance}.`,
      required,
      balance,
      affordable: Math.max(0, balance),
    });
  }

  // --- create the cards rows -------------------------------------------
  const created = await createCardsForItems(submission, items);
  if (!created.ok) return created;

  const supabase = supabaseServer();
  const { data: updated, error: updateError } = await supabase
    .from('submissions')
    .update({
      status: 'running',
      committed_at: new Date().toISOString(),
      card_count: items.length,
    })
    .eq('id', submissionId)
    .select(SUBMISSION_COLUMNS)
    .maybeSingle();

  if (updateError) {
    console.error(`${LOG} commit status write failed for ${submissionId}:`, updateError.message);
    return fail({ code: 'internal', message: 'Could not start the submission' });
  }

  return ok({
    submission: (updated as unknown as SubmissionRow) ?? submission,
    cardsCreated: created.data.cardsCreated,
    itemCount: items.length,
  });
}

/**
 * Create one `cards` row per item that does not have one yet, mirroring the
 * single-upload insert shape (src/app/upload/page.tsx). Cards are `public`,
 * same as every other graded card (decision 2, resolved Aug 31) — same insert
 * path, no special casing.
 *
 * Serials are assigned SEQUENTIALLY with the 23505 retry: generateNextSerial
 * is check-then-insert, so a concurrent upload can take the serial between
 * the check and our write. Running these in parallel at 100× would turn a
 * rare race into a common one.
 *
 * grade_status is left NULL — the grading route's acquireGradingLock CASes
 * from null, and pre-setting it would lock every card out of its own grade.
 */
const STORAGE_PATH_CARD_ID =
  /^[0-9a-f-]{36}\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

/**
 * The intake stage uploads to `cards/{user_id}/{cardId}/front.jpg`, so the
 * card id it chose is already baked into the storage path. Reuse it rather
 * than minting a new one — a fresh uuid would leave every image filed under a
 * directory belonging to no card row.
 */
function cardIdFromPath(path: string | null): string | null {
  if (!path) return null;
  const match = STORAGE_PATH_CARD_ID.exec(path);
  return match ? match[1] : null;
}

async function createCardsForItems(
  submission: SubmissionRow,
  items: SubmissionItemRow[]
): Promise<SubmissionResult<{ cardsCreated: number }>> {
  const supabase = supabaseServer();
  let cardsCreated = 0;

  for (const item of items) {
    if (item.card_id) continue; // resumed commit — this item already has a card

    let serial = await generateNextSerial();
    let cardId: string | null = null;
    let lastError: any = null;
    // Mirrors upload/page.tsx, which supplies its own id so the storage paths
    // it already wrote line up with the row.
    const desiredId = cardIdFromPath(item.front_path) ?? crypto.randomUUID();

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          id: desiredId,
          user_id: submission.user_id,
          serial,
          front_path: item.front_path,
          back_path: item.back_path,
          category: submission.category,
          ...(submission.sub_category ? { sub_category: submission.sub_category } : {}),
          // Public by default, same as every other graded card — the grading
          // API reads the row and single upload does exactly this.
          visibility: 'public',
          submission_id: submission.id,
          // Same per-side shape upload/page.tsx writes (CAPTURE-GATE P0), so
          // "which capture path produces the bad photos" stays answerable
          // once bulk intake exists.
          capture_source: {
            client_surface: 'submission',
            front: { source: submission.source || 'upload' },
            back: { source: submission.source || 'upload' },
          },
        })
        .select('id')
        .maybeSingle();

      lastError = error;
      if (!error && data) {
        cardId = (data as any).id as string;
        break;
      }

      const isSerialConflict =
        error?.code === '23505' && (error.message || '').includes('cards_serial_key');
      if (!isSerialConflict) break;

      console.warn(`${LOG} serial ${serial} collided for item ${item.id} (attempt ${attempt + 1})`);
      serial = await generateNextSerial();
    }

    if (!cardId) {
      console.error(`${LOG} card insert failed for item ${item.id}:`, lastError?.message);
      return fail({
        code: 'internal',
        message: 'Could not create card records for this submission',
      });
    }

    const { error: linkError } = await supabase
      .from('submission_items')
      .update({ card_id: cardId, status: 'queued', error: null })
      .eq('id', item.id);

    if (linkError) {
      console.error(`${LOG} could not link card ${cardId} to item ${item.id}:`, linkError.message);
      return fail({ code: 'internal', message: 'Could not link cards to the submission' });
    }

    item.card_id = cardId;
    cardsCreated += 1;
  }

  return ok({ cardsCreated });
}

/**
 * Cancel a submission. Queued work stops; anything already dispatched is left
 * alone — the grade is running in its own 300s function and killing the row
 * would strand a charged card. Those items still reconcile on the next drain.
 */
export async function cancelSubmission(
  submissionId: string,
  userId: string
): Promise<SubmissionResult<{ submission: SubmissionRow; cancelledItems: number }>> {
  const loaded = await getOwnedSubmission(submissionId, userId);
  if (!loaded.ok) return loaded;
  const submission = loaded.data;

  if (submission.status === 'complete' || submission.status === 'cancelled') {
    return fail({
      code: 'conflict',
      message: `This submission is already ${submission.status}.`,
    });
  }

  const supabase = supabaseServer();
  const { data: skipped, error: skipError } = await supabase
    .from('submission_items')
    .update({ status: 'skipped', error: 'Cancelled by owner' })
    .eq('submission_id', submissionId)
    .eq('status', 'queued')
    .select('id');

  if (skipError) {
    console.error(`${LOG} cancel item update failed for ${submissionId}:`, skipError.message);
    return fail({ code: 'internal', message: 'Could not cancel the submission' });
  }

  const { data: updated, error: updateError } = await supabase
    .from('submissions')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', submissionId)
    .select(SUBMISSION_COLUMNS)
    .maybeSingle();

  if (updateError) {
    console.error(`${LOG} cancel failed for ${submissionId}:`, updateError.message);
    return fail({ code: 'internal', message: 'Could not cancel the submission' });
  }

  return ok({
    submission: (updated as unknown as SubmissionRow) ?? submission,
    cancelledItems: skipped?.length ?? 0,
  });
}

/** Submissions with outstanding work, for the drain's outer loop. */
export async function listRunningSubmissions(limit = 10): Promise<SubmissionRow[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('status', 'running')
    .order('committed_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`${LOG} running list failed:`, error.message);
    return [];
  }
  return (data ?? []) as unknown as SubmissionRow[];
}

/** True when nothing is left queued, dispatched or grading. */
export function isSubmissionDone(items: Array<Pick<SubmissionItemRow, 'status'>>): boolean {
  return !items.some((item) => (ACTIVE_ITEM_STATUSES as string[]).includes(item.status));
}
