import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { supabaseServer } from '@/lib/supabaseServer';
import { getOwnedSubmission, getSubmissionItems, tallyItems } from '@/lib/submissions/service';
import { isProcessing, settleSubmission } from '@/lib/submissions/settle';
import { SUBMISSION_ERROR_STATUS } from '@/lib/submissions/types';

/**
 * GET /api/submissions/[id]/status
 *
 * The progress grid's only endpoint, polled every ~4s while the page is open.
 *
 * Cost discipline is the whole point: the existing per-card
 * `?status_only=true` path would be 100 requests per tick. This is
 * three round trips regardless of size — the submission row, one `.in()` over
 * its items joined to their cards, and one batched createSignedUrls call for
 * every thumbnail at once.
 *
 * Read-only by construction. It never claims, dispatches, charges or fails an
 * item; polling it a thousand times changes nothing.
 */

type Params = { params: Promise<{ id: string }> };

/**
 * Narrow on purpose. `cards` is ~290 columns wide and several are large JSON
 * blobs (conversational_grading, label_data, user_condition_processed) —
 * selecting them for 100 rows every 4 seconds is the production-DB hazard
 * this list exists to avoid.
 */
const CARD_COLUMNS = 'id, grade_status, conversational_whole_grade, category, front_path';

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
  }

  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const loaded = await getOwnedSubmission(id, auth.userId);
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, ...loaded.error },
      { status: SUBMISSION_ERROR_STATUS[loaded.error.code] }
    );
  }

  let items = await getSubmissionItems(id);
  const supabase = supabaseServer();

  // ---------------------------------------------------------------------
  // Self-heal (round 2, Sep 1)
  // ---------------------------------------------------------------------
  // The bug: the owner navigated away mid-run. The last card finished grading,
  // but nothing was left to notice — the item row stayed `dispatched`, the card
  // was never filed into the binder, and the submission sat at `running`. In
  // production the per-minute cron eventually reconciles it (up to a minute of
  // dead air); locally no cron runs at all, so it never recovers.
  //
  // So the poll itself heals it. The guard is deliberately narrow: only a
  // `running` submission with ZERO cards actually holding the grading lock —
  // i.e. nothing is in flight, so there is genuinely nobody left to finish the
  // job. `cards.grade_status` is the authoritative in-flight counter, and it is
  // already loaded below for the grid, so this costs no extra query.
  //
  // Approach: `settleSubmission` is AWAITED, not fired and forgotten. A
  // fire-and-forget shared call or an HTTP self-call is killed the moment the
  // response returns on Vercel, which is precisely the "sometimes files,
  // sometimes doesn't" behaviour this is meant to end. Settling is the cheap
  // half of a drain tick — reconcile, file, complete — a handful of small
  // queries with no dispatching, so awaiting it keeps the poll fast while
  // making filing and completion guaranteed rather than best-effort. Starting
  // NEW grades is still the drain's job, and the page kicks that separately
  // every 30s; here we only requeue the work so that kick has something to do.
  // ---------------------------------------------------------------------
  const preCounts = tallyItems(items);
  if (loaded.data.status === 'running' && preCounts.active > 0) {
    const claimedCardIds = items
      .filter((i) => (i.status === 'dispatched' || i.status === 'grading') && i.card_id)
      .map((i) => i.card_id as string);

    let actuallyInFlight = 0;
    if (claimedCardIds.length) {
      const { data: lockRows } = await supabase
        .from('cards')
        .select('id, grade_status')
        .in('id', claimedCardIds);
      actuallyInFlight = (lockRows ?? []).filter((r: any) => isProcessing(r.grade_status)).length;
    }

    if (actuallyInFlight === 0) {
      try {
        const settled = await settleSubmission(loaded.data, items);
        items = settled.items;
        if (settled.changed) {
          console.log(
            `${'[submissions] status self-heal'} ${id}: filed ${settled.filed}` +
            `${settled.completed ? ', completed' : ''}`
          );
        }
        if (settled.completed) {
          // Reflect it in THIS response rather than making the client wait a
          // poll — the page hands off to the binder on `complete`.
          loaded.data.status = 'complete';
          loaded.data.completed_at = loaded.data.completed_at || new Date().toISOString();
        }
      } catch (e: any) {
        // Never let a heal attempt break the poll — the cron still covers it.
        console.error(`[submissions] status self-heal failed for ${id}:`, e?.message);
      }
    }
  }

  // One query for every card in the submission.
  const cardIds = items.map((item) => item.card_id).filter((v): v is string => !!v);
  const cardsById = new Map<string, any>();
  if (cardIds.length) {
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select(CARD_COLUMNS)
      .in('id', cardIds);
    if (cardsError) {
      console.error(`[submissions] status card read failed for ${id}:`, cardsError.message);
    }
    for (const card of cards ?? []) cardsById.set((card as any).id, card);
  }

  // One batched signing call for every thumbnail. A card's front_path only
  // exists once its row does, so early in a submission this list is short and
  // grows as the grid fills — which is exactly the trickle the UI renders.
  const thumbPaths = Array.from(
    new Set(
      items
        .map((item) => cardsById.get(item.card_id ?? '')?.front_path || item.front_path)
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
    )
  );

  const signedByPath = new Map<string, string>();
  if (thumbPaths.length) {
    const { data: signed, error: signError } = await supabase.storage
      .from('cards')
      .createSignedUrls(thumbPaths, 60 * 60); // 1 hour, matching the other grids
    if (signError) {
      console.error(`[submissions] status signing failed for ${id}:`, signError.message);
    }
    for (const entry of signed ?? []) {
      if (entry?.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
    }
  }

  const grid = items.map((item) => {
    const card = item.card_id ? cardsById.get(item.card_id) : null;
    const path = card?.front_path || item.front_path || null;
    return {
      position: item.position,
      status: item.status,
      attempts: item.attempts,
      error: item.error,
      card_id: item.card_id,
      grade_status: card?.grade_status ?? null,
      grade: card?.conversational_whole_grade ?? null,
      category: card?.category ?? loaded.data.category,
      front_path: path,
      thumbnail_url: path ? signedByPath.get(path) ?? null : null,
    };
  });

  return NextResponse.json({
    success: true,
    submission: loaded.data,
    counts: tallyItems(items),
    items: grid,
  });
}
