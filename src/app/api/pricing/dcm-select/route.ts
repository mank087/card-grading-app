/**
 * DCM Manual Selection API
 *
 * Allows users to save their manual parallel selection for a sports card.
 * The selected product ID and name are stored in the cards table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';

interface DcmSelectRequest {
  cardId: string;
  productId: string;
  productName: string;
}

interface DcmSelectResponse {
  success: boolean;
  error?: string;
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
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, user_id')
      .eq('id', cardId)
      .single();

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

    // Update the card with the manual selection
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        dcm_selected_product_id: productId,
        dcm_selected_product_name: productName,
        dcm_selected_at: new Date().toISOString(),
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
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, user_id')
      .eq('id', cardId)
      .single();

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

    // Clear the manual selection
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        dcm_selected_product_id: null,
        dcm_selected_product_name: null,
        dcm_selected_at: null,
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
