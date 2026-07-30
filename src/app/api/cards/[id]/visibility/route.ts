import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
import { isUuid } from "@/lib/uuid";
import { isRecordLocked } from "@/lib/cards/ownership";

type VisibilityToggleRequest = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/cards/[id]/visibility
 * Toggle card visibility between public and private
 *
 * Request body:
 * {
 *   "visibility": "public" | "private"
 * }
 *
 * Security:
 * - Requires authentication via Bearer token
 * - Only card owner can change visibility
 * - Validates visibility value
 */
export async function PATCH(
  request: NextRequest,
  { params }: VisibilityToggleRequest
) {
  try {
    // Await params before accessing properties
    const resolvedParams = await params;
    const cardId = resolvedParams.id;

    if (!cardId) {
      return NextResponse.json(
        { error: "Card ID is required" },
        { status: 400 }
      );
    }

    if (!isUuid(cardId)) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    // Verify authentication - get user ID from token, not query params
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized - Please log in" },
        { status: 401 }
      );
    }
    const userId = auth.userId;

    const supabase = supabaseServer();

    // Parse request body
    const body = await request.json();
    const { visibility } = body;

    // Validate visibility value
    if (!visibility || (visibility !== 'public' && visibility !== 'private')) {
      return NextResponse.json(
        { error: "Invalid visibility value. Must be 'public' or 'private'" },
        { status: 400 }
      );
    }

    // Check if card exists and user owns it
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, user_id, serial, ownership_status')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (card.user_id !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only change visibility of your own cards" },
        { status: 403 }
      );
    }

    // A sold card can't be hidden. The buyer's slab carries a QR to this
    // page; making it private turns that QR into a dead end. Going MORE
    // visible is always allowed.
    if (visibility === 'private' && isRecordLocked(card)) {
      return NextResponse.json(
        {
          error:
            "This card is marked as sold, so it has to stay visible — the buyer " +
            "verifies it by scanning the label. Move it back to your collection " +
            "with \"Still mine\" first if you want to hide it.",
          code: 'card_sold_locked',
        },
        { status: 423 }
      );
    }

    // Update visibility
    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update({ visibility })
      .eq('id', cardId)
      .select('id, visibility, serial')
      .single();

    if (updateError) {
      console.error('Error updating card visibility:', updateError);
      return NextResponse.json(
        { error: "Failed to update card visibility" },
        { status: 500 }
      );
    }

    console.log(`✅ Card ${cardId} visibility updated to ${visibility} by user ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Card is now ${visibility}`,
      card: {
        id: updatedCard.id,
        visibility: updatedCard.visibility,
        serial: updatedCard.serial
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in visibility toggle:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cards/[id]/visibility
 * Get current visibility status of a card
 *
 * Security:
 * - Anyone can check visibility status
 * - Returns basic info only
 */
export async function GET(
  request: NextRequest,
  { params }: VisibilityToggleRequest
) {
  try {
    // Await params before accessing properties
    const resolvedParams = await params;
    const cardId = resolvedParams.id;

    if (!cardId) {
      return NextResponse.json(
        { error: "Card ID is required" },
        { status: 400 }
      );
    }

    if (!isUuid(cardId)) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    const supabase = supabaseServer();

    // Get card visibility
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, visibility, serial')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: card.id,
      visibility: card.visibility || 'private',
      serial: card.serial
    }, { status: 200 });

  } catch (error) {
    console.error('Error getting card visibility:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
