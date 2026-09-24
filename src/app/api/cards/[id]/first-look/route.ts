/**
 * POST /api/cards/[id]/first-look — Phase 2B, on demand.
 *
 * Most cards have no `cards.first_look`: it is only filled at grading time, and
 * only for cards graded since first look was turned on. This endpoint lets the dialog
 * ask for one while the owner is looking at the card, so the prefill can improve
 * for an older card too.
 *
 * WHAT IT MUST NEVER DO: consume a credit, touch a grade, sub-score, timestamp
 * or image, or throw at the client. Every failure answers
 * `{ first_look: null }` and the dialog carries on with the stored values.
 *
 * Cost: the contract pass is roughly half a cent. With FIRST_LOOK_SEARCH=1 an
 * unreadable set triggers a web-search pass that costs a few cents and takes
 * 20-35 seconds, so the dialog runs this in the background and never blocks on
 * it.
 *
 * Idempotent: a card that already has a first look gets it back unchanged, and a
 * second request while one is in flight is refused rather than paying twice.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { isRecordLocked, LOCKED_RECORD_ERROR } from '@/lib/cards/ownership';
import { buildReviewPrefill, firstLookResultOf } from '@/lib/identity/reviewPrefill';
import { runFirstLook, recordFirstLook } from '@/lib/identification/firstLookRunner';
import { fetchCardOriginals } from '@/lib/images/originalImages';
import { createSignedImageMap } from '@/lib/signedUrlBatch';

import { firstLookOnDemandEnabled, firstLookInFlight } from '@/lib/identification/firstLookOnDemand';

import { resolveSetCodesInFields } from '@/lib/identity/setOptions';
import { settlePokemonNumber } from '@/lib/identity/pokemonNumberCheck';
export const dynamic = 'force-dynamic';
/** The search pass can take 20-35s; the contract pass alone is a few seconds. */
export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: cardId } = await params;
    if (!isUuid(cardId)) return json({ error: 'Card not found' }, 404);

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return json({ error: auth.error || 'Authentication required' }, 401);
    }
    if (!firstLookOnDemandEnabled()) {
      return json({ first_look: null, fields: null, enabled: false }, 503);
    }

    const supabase = supabaseServer();
    const { data: card, error } = await supabase.from('cards').select('*').eq('id', cardId).maybeSingle();
    if (error || !card || card.deleted_at) return json({ error: 'Card not found' }, 404);
    if (card.user_id !== auth.userId) return json({ error: 'You do not own this card' }, 403);
    if (isRecordLocked(card)) return json(LOCKED_RECORD_ERROR, 423);

    // Already answered. Give back what is stored rather than paying again.
    const stored = firstLookResultOf(card.first_look);
    if (stored) {
      return json({
        first_look: card.first_look,
        fields: await resolveSetCodesInFields(buildReviewPrefill(card, stored).fields, card.category)
          .then(fields => settlePokemonNumber(fields, card.category))
          .catch(() => buildReviewPrefill(card, stored).fields),
        reused: true,
      });
    }

    if (!card.front_path || !card.back_path) return json({ first_look: null, fields: null });
    if (firstLookInFlight.has(cardId)) return json({ first_look: null, fields: null, running: true }, 202);
    firstLookInFlight.add(cardId);
    try {
      const signed = await createSignedImageMap(supabase.storage, 'cards', [card.front_path, card.back_path], {
        expiresIn: 300,
        preferThumb: false,
      });
      const front = signed.get(card.front_path)?.url;
      const back = signed.get(card.back_path)?.url;
      if (!front || !back) return json({ first_look: null, fields: null });

      const originals = await fetchCardOriginals(front, back);
      // Pass 1 is saved the moment it is read, so a grading-time wait or a
      // reload of the dialog can use it while the search pass is still running.
      // recordFirstLook never replaces a record that is as good or better, so
      // this run and the grading-time run cannot clobber each other.
      let contractWrite: Promise<unknown> = Promise.resolve();
      const record = await runFirstLook(
        { front: originals.front, back: originals.back },
        {
          allowSearch: process.env.FIRST_LOOK_SEARCH === '1',
          onContractPass: contractRecord => (contractWrite = Promise.resolve(recordFirstLook(cardId, contractRecord)).catch(() => false)),
        },
      );
      await contractWrite;
      if (!record) return json({ first_look: null, fields: null });

      await recordFirstLook(cardId, record);
      return json({
        first_look: record,
        fields: await resolveSetCodesInFields(buildReviewPrefill(card, record.result).fields, card.category)
          .then(fields => settlePokemonNumber(fields, card.category))
          .catch(() => buildReviewPrefill(card, record.result).fields),
        reused: false,
      });
    } finally {
      firstLookInFlight.delete(cardId);
    }
  } catch (err: any) {
    // Never surfaced as an error: the dialog must stay usable with stored values.
    console.warn('[first-look on demand] failed:', err?.message || err);
    return json({ first_look: null, fields: null });
  }
}
