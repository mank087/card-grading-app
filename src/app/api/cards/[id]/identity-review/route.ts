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
  NO_CANDIDATE,
  pickBestCandidate,
  reviewEligibility,
  type ReviewCandidate,
  type ReviewPrefill,
} from '@/lib/identity/reviewPrefill';
import { loadReviewCandidates, serialDenominatorOf } from '@/lib/identity/reviewCandidates';
import { resolveSetCodesInFields } from '@/lib/identity/setOptions';
import { settlePokemonNumber } from '@/lib/identity/pokemonNumberCheck';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } });

function valueOf(prefill: ReviewPrefill, key: string): string {
  return prefill.fields.find(f => f.key === key)?.value || '';
}

/**
 * Which row the picker opens on. The owner's own earlier pick always wins; then
 * the best textual match among versions with the card's serial run; then the
 * product pricing is using today; then "None of these".
 */
function suggestCandidate(candidates: ReviewCandidate[], card: Record<string, any>, prefill: ReviewPrefill): string {
  const has = (id: unknown) => !!id && candidates.some(c => c.id === String(id));
  if (has(card.dcm_selected_product_id)) return String(card.dcm_selected_product_id);
  const hints = { parallel: valueOf(prefill, 'parallel_type'), serial: valueOf(prefill, 'serial_numbering'), subset: valueOf(prefill, 'subset_variant') };
  const run = serialDenominatorOf(hints.serial);
  const sameRun = run ? candidates.filter(c => c.serialDenominator === run) : [];
  if (sameRun.length === 1) return sameRun[0].id;
  const best = pickBestCandidate(sameRun.length ? sameRun : candidates, hints);
  if (best !== NO_CANDIDATE) return best;
  return has(card.dcm_price_product_id) ? String(card.dcm_price_product_id) : NO_CANDIDATE;
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
    // A printed set code ("PZA") becomes the catalog's set name before anything uses it.
    try { prefill.fields = await resolveSetCodesInFields(prefill.fields, card.category); } catch { /* keep the raw read */ }
    // Pokémon: when the grading call and first look read different numbers, the catalog decides.
    try { prefill.fields = await settlePokemonNumber(prefill.fields, card.category); } catch { /* keep as built */ }
    const eligibility = reviewEligibility(card, auth.userId, {
      confirmSince: process.env.NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE || null,
    });

    const candidates = prefill.isSports
      ? await loadReviewCandidates(prefill, card)
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
      // What Market Pricing is matched to right now, for every category.
      pricing_match: (card.dcm_selected_product_name || card.dcm_price_product_name)
        ? { product_name: String(card.dcm_selected_product_name || card.dcm_price_product_name), picked_by_owner: !!card.dcm_selected_product_id }
        : null,
      current_product_id: card.dcm_selected_product_id ? String(card.dcm_selected_product_id) : null,
      suggested_candidate_id: suggestCandidate(candidates.candidates, card, prefill),
    });
  } catch (err: any) {
    console.error('[identity-review] unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
}
