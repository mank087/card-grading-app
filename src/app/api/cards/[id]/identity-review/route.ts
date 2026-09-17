/**
 * GET /api/cards/[id]/identity-review — Phase 2B.
 *
 * Everything the "Confirm your card details" dialog needs, in one owner-only
 * read: the review state, the prefilled fields (see
 * src/lib/identity/reviewPrefill.ts for the precedence rules), first look's
 * "could also be" list, and for sports the catalog products the owner can pick
 * between.
 *
 * IMAGES ARE NOT RETURNED. The detail page already holds signed URLs for the
 * front and back and passes them to the dialog as props. Minting a second pair
 * here would be pure Supabase egress for photos the browser has already loaded
 * (see project_supabase_egress_sep2026).
 *
 * The candidate lookup is best effort. PriceCharting being slow or down must not
 * stop an owner confirming what their card is, so a failure returns
 * `candidates: []` with `candidates_error: true`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { isRecordLocked } from '@/lib/cards/ownership';
import {
  buildReviewPrefill,
  firstLookResultOf,
  markBaseCandidate,
  pickBestCandidate,
  reviewEligibility,
  type ReviewCandidate,
  type ReviewPrefill,
} from '@/lib/identity/reviewPrefill';
import { getAvailableParallels, isPriceChartingEnabled } from '@/lib/priceCharting';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } });

function valueOf(prefill: ReviewPrefill, key: string): string {
  return prefill.fields.find(f => f.key === key)?.value || '';
}

/**
 * Look the card up in the catalog with the values the owner is ABOUT to
 * confirm, not the stale stored ones — the whole point of the prefill is that it
 * may already carry a corrected set or year.
 */
export async function loadCandidates(
  prefill: ReviewPrefill,
  category: string | null,
): Promise<{ candidates: ReviewCandidate[]; available: boolean; error: boolean }> {
  const playerName = valueOf(prefill, 'featured') || valueOf(prefill, 'card_name');
  if (!playerName || !isPriceChartingEnabled()) {
    return { candidates: [], available: false, error: false };
  }
  try {
    const found = await getAvailableParallels({
      playerName,
      year: valueOf(prefill, 'release_date') || undefined,
      setName: valueOf(prefill, 'card_set') || undefined,
      cardNumber: valueOf(prefill, 'card_number') || undefined,
      subset: valueOf(prefill, 'subset_variant') || undefined,
      serialNumbering: valueOf(prefill, 'serial_numbering') || undefined,
      sport: category || undefined,
    });
    return { candidates: markBaseCandidate(found), available: true, error: false };
  } catch (err) {
    console.warn('[identity-review] candidate lookup failed:', err instanceof Error ? err.message : err);
    return { candidates: [], available: false, error: true };
  }
}

export async function GET(
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

    const supabase = supabaseServer();
    const { data: card, error } = await supabase.from('cards').select('*').eq('id', cardId).maybeSingle();
    if (error) {
      console.error('[identity-review] card read failed:', error.message);
      return json({ error: 'Card not found' }, 404);
    }
    // A card that is not this viewer's is simply not there, so the endpoint
    // cannot be used to probe other people's collections.
    if (!card || card.user_id !== auth.userId || card.deleted_at) return json({ error: 'Card not found' }, 404);

    const prefill = buildReviewPrefill(card, firstLookResultOf(card.first_look));
    const eligibility = reviewEligibility(card, auth.userId, {
      confirmSince: process.env.NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE || null,
    });

    const candidates = prefill.isSports
      ? await loadCandidates(prefill, card.category ?? null)
      : { candidates: [] as ReviewCandidate[], available: false, error: false };

    return json({
      card_id: cardId,
      mode: eligibility.mode,
      reason: eligibility.reason,
      locked: isRecordLocked(card),
      identity_revision: card.identity_revision ?? null,
      identity_confirmed_revision: card.identity_confirmed_revision ?? null,
      identity_confirmed: card.identity_confirmed_revision !== null
        && card.identity_confirmed_revision !== undefined
        && Number(card.identity_confirmed_revision) >= Number(card.identity_revision ?? 0),
      dismissed: !!card.identity_review_dismissed_at,
      dismissed_at: card.identity_review_dismissed_at ?? null,
      category: prefill.category,
      is_sports: prefill.isSports,
      fields: prefill.fields,
      alternatives: prefill.alternatives,
      first_look_present: prefill.firstLookPresent,
      candidates: candidates.candidates,
      candidates_available: candidates.available,
      candidates_error: candidates.error,
      suggested_candidate_id: pickBestCandidate(candidates.candidates, {
        parallel: valueOf(prefill, 'parallel_type'),
        serial: valueOf(prefill, 'serial_numbering'),
        subset: valueOf(prefill, 'subset_variant'),
      }),
    });
  } catch (err: any) {
    console.error('[identity-review] unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
}
