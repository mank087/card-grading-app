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
import type { SupabaseClient } from '@supabase/supabase-js';

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

    // Update the card with the manual selection
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        dcm_selected_product_id: productId,
        dcm_selected_product_name: productName,
        dcm_selected_at: new Date().toISOString(),
        ...(hasRevision
          ? { pricing_selection_revision: (card.pricing_selection_revision ?? 0) + 1 }
          : {}),
      })
      .eq('id', cardId);

    if (updateError) {
      console.error('[DCM Select API] Update error:', updateError);
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

    // Clear the manual selection
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        dcm_selected_product_id: null,
        dcm_selected_product_name: null,
        dcm_selected_at: null,
        ...(hasRevision
          ? { pricing_selection_revision: (card.pricing_selection_revision ?? 0) + 1 }
          : {}),
      })
      .eq('id', cardId);

    if (updateError) {
      console.error('[DCM Select API] Clear error:', updateError);
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
