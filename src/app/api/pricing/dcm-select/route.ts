/**
 * DCM Manual Selection API
 *
 * Allows users to save their manual parallel selection for a sports card.
 * The selected product ID and name are stored in the cards table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { isMissingColumnError, isRecordLocked, LOCKED_RECORD_ERROR } from '@/lib/cards/ownership';
import { PRICING_INVALIDATION_COLUMNS } from '@/lib/identity/saveCardIdentity';
import { PRICE_WRITE_STALE_CODE } from '@/lib/pricing/guardedPriceWrite';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The stored prices that belonged to the PREVIOUS product. Picking or clearing a
 * product makes them wrong immediately, so they are cleared in the same UPDATE
 * rather than lingering until the next fetch. This is the Phase 2A invalidation
 * list minus the dcm_selected_* fields, which this route is writing itself.
 */
const SELECTION_STALE_PRICE_COLUMNS = PRICING_INVALIDATION_COLUMNS.filter(
  column => !column.startsWith('dcm_selected_'),
);

/** How many times to re-read and retry the compare-and-set before giving up. */
const SELECTION_CAS_ATTEMPTS = 3;

function clearedPriceColumns(): Record<string, null> {
  const cleared: Record<string, null> = {};
  for (const column of SELECTION_STALE_PRICE_COLUMNS) cleared[column] = null;
  return cleared;
}

/**
 * Write the owner's product selection as a compare-and-set on
 * pricing_selection_revision.
 *
 * Before Phase 2C this was read-then-write: the route read the revision, then
 * wrote revision + 1 by card id. Two concurrent picks (or a pick racing a
 * clear) both read the same number and both wrote the same number, so one of
 * them silently vanished and any in-flight price write guarded on the newer
 * revision still matched.
 */
async function writeSelectionWithCas(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
  fields: Record<string, unknown>,
  card: Record<string, any>,
  hasRevision: boolean,
): Promise<{ status: 'saved' | 'conflict' | 'error'; error?: string }> {
  const payload = { ...fields, ...clearedPriceColumns() };

  if (!hasRevision) {
    const { error } = await supabase.from('cards').update(payload).eq('id', cardId);
    return error ? { status: 'error', error: error.message } : { status: 'saved' };
  }

  let expected = (card.pricing_selection_revision ?? 0) as number;

  for (let attempt = 0; attempt < SELECTION_CAS_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('cards')
      .update({ ...payload, pricing_selection_revision: expected + 1 })
      .eq('id', cardId)
      .eq('pricing_selection_revision', expected)
      .select('id');

    if (error) return { status: 'error', error: error.message };
    if (data && data.length > 0) return { status: 'saved' };

    // Zero rows: someone else moved the revision. Re-read and try again.
    const { data: fresh, error: readError } = await supabase
      .from('cards')
      .select('pricing_selection_revision')
      .eq('id', cardId)
      .maybeSingle();
    if (readError) return { status: 'error', error: readError.message };
    if (!fresh) return { status: 'conflict' };
    expected = (fresh.pricing_selection_revision ?? 0) as number;
  }

  return { status: 'conflict' };
}

/**
 * Read the fields this route needs, tolerating a database that predates the
 * Phase 2A migration (20260917_identity_confirmation.sql).
 */
async function loadCardForSelection(supabase: SupabaseClient<any, any, any>, cardId: string) {
  const full = await supabase
    .from('cards')
    .select('id, user_id, ownership_status, pricing_selection_revision')
    .eq('id', cardId)
    .single();
  if (!full.error) return { card: full.data as Record<string, any>, hasRevision: true, error: null };
  if (!isMissingColumnError(full.error) && full.error.code !== 'PGRST204' && full.error.code !== '42703') {
    return { card: null, hasRevision: false, error: full.error };
  }
  console.warn(
    '[DCM Select API] cards.pricing_selection_revision is missing — apply ' +
    'supabase/migrations/20260917_identity_confirmation.sql. Saving the selection without a revision bump.'
  );
  const basic = await supabase
    .from('cards')
    .select('id, user_id, ownership_status')
    .eq('id', cardId)
    .single();
  return { card: basic.data as Record<string, any> | null, hasRevision: false, error: basic.error };
}

interface DcmSelectRequest {
  cardId: string;
  productId: string;
  productName: string;
}

interface DcmSelectResponse {
  success: boolean;
  error?: string;
  code?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DcmSelectResponse>> {
  try {
    // Check authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: DcmSelectRequest = await request.json();
    const { cardId, productId, productName } = body;

    // Validate required fields
    if (!cardId || !productId || !productName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: cardId, productId, productName' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Verify the user owns this card
    const { card, hasRevision, error: cardError } = await loadCardForSelection(supabase, cardId);

    if (cardError || !card) {
      console.error('[DCM Select API] Card not found:', cardError);
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    if (card.user_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to modify this card' },
        { status: 403 }
      );
    }

    // A sold card's record is frozen for the buyer, same rule the details
    // editor applies. Repricing it is still a change to what they can verify.
    if (isRecordLocked(card)) {
      return NextResponse.json(
        { success: false, error: LOCKED_RECORD_ERROR.error, code: LOCKED_RECORD_ERROR.code },
        { status: 423 }
      );
    }

    // Update the card with the manual selection. The old product's stored
    // prices go in the same UPDATE so the page cannot show them as current.
    const write = await writeSelectionWithCas(supabase, cardId, {
      dcm_selected_product_id: productId,
      dcm_selected_product_name: productName,
      dcm_selected_at: new Date().toISOString(),
    }, card, hasRevision);

    if (write.status === 'conflict') {
      return NextResponse.json(
        {
          success: false,
          error: 'This card was updated somewhere else. Reopen it and pick again.',
          code: PRICE_WRITE_STALE_CODE,
        },
        { status: 409 }
      );
    }

    if (write.status === 'error') {
      console.error('[DCM Select API] Update error:', write.error);
      return NextResponse.json(
        { success: false, error: 'Failed to save selection' },
        { status: 500 }
      );
    }

    console.log(`[DCM Select API] Saved selection for card ${cardId}: ${productName} (${productId})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DCM Select API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to clear manual selection
export async function DELETE(request: NextRequest): Promise<NextResponse<DcmSelectResponse>> {
  try {
    // Check authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) {
      return NextResponse.json(
        { success: false, error: 'Missing cardId parameter' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Verify the user owns this card
    const { card, hasRevision, error: cardError } = await loadCardForSelection(supabase, cardId);

    if (cardError || !card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    if (card.user_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to modify this card' },
        { status: 403 }
      );
    }

    if (isRecordLocked(card)) {
      return NextResponse.json(
        { success: false, error: LOCKED_RECORD_ERROR.error, code: LOCKED_RECORD_ERROR.code },
        { status: 423 }
      );
    }

    // Clear the manual selection, and the prices that came from it.
    const write = await writeSelectionWithCas(supabase, cardId, {
      dcm_selected_product_id: null,
      dcm_selected_product_name: null,
      dcm_selected_at: null,
    }, card, hasRevision);

    if (write.status === 'conflict') {
      return NextResponse.json(
        {
          success: false,
          error: 'This card was updated somewhere else. Reopen it and try again.',
          code: PRICE_WRITE_STALE_CODE,
        },
        { status: 409 }
      );
    }

    if (write.status === 'error') {
      console.error('[DCM Select API] Clear error:', write.error);
      return NextResponse.json(
        { success: false, error: 'Failed to clear selection' },
        { status: 500 }
      );
    }

    console.log(`[DCM Select API] Cleared selection for card ${cardId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DCM Select API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
