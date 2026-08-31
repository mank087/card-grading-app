import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { supabaseServer } from '@/lib/supabaseServer';
import { getOwnedSubmission, getSubmissionItems, tallyItems } from '@/lib/submissions/service';
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

  const items = await getSubmissionItems(id);
  const supabase = supabaseServer();

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
