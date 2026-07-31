import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
import { isUuid } from "@/lib/uuid";
import {
  isMissingColumnError,
  isOwnershipStatus,
  isSoldChannel,
  type OwnershipStatus,
} from "@/lib/cards/ownership";

/**
 * PATCH /api/cards/[id]/ownership
 *
 * Moves a card through its ownership lifecycle instead of deleting it.
 *
 *   { "ownership_status": "sold", "sold_price": 120.00, "sold_at": "...",
 *     "sold_note": "Sold at the Portland show" }
 *   { "ownership_status": "owned" }      // undo — "actually, still mine"
 *
 * There is no "archived" any more — it duplicated what delete means and gave
 * users two ways to make a card disappear. Anything that isn't a sale is a
 * delete, which soft-deletes: gone from the owner's view, record kept
 * internally for population and accuracy statistics.
 *
 * Why this exists rather than DELETE: the printed slab carries a QR to
 * /verify/<serial>, so the row has to survive the sale or the buyer is left
 * holding a slab that won't verify. See the migration for the full rationale.
 *
 * Marking sold is deliberately REVERSIBLE. eBay sales get cancelled and
 * returned, and manual marks are self-reported, so "owned" is always a valid
 * destination. Sale details are cleared on the way back so a re-sale can't
 * inherit a stale price.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const nextStatus = body?.ownership_status;
    if (!isOwnershipStatus(nextStatus)) {
      return NextResponse.json(
        { error: "ownership_status must be 'owned' or 'sold'." },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('id, user_id, serial, card_name, ownership_status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (card.user_id !== auth.userId) {
      return NextResponse.json(
        { error: "Forbidden — you can only change your own cards" },
        { status: 403 }
      );
    }

    // Stamp the manual override so the eBay reconciliation defers to this
    // decision — otherwise "Still mine" after a cancelled sale would be undone
    // by the next 15-minute cron run.
    const update: Record<string, any> = {
      ownership_status: nextStatus,
      ownership_overridden_at: new Date().toISOString(),
    };

    if (nextStatus === 'sold') {
      // Price is optional — plenty of people won't want to record it.
      const rawPrice = body?.sold_price;
      if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
        const price = Number(rawPrice);
        if (!isFinite(price) || price < 0) {
          return NextResponse.json(
            { error: "sold_price must be a positive number." },
            { status: 400 }
          );
        }
        update.sold_price = price;
      }

      // Accept a supplied date (sold last month, entering it now) but never
      // let it be in the future.
      //
      // When the card is ALREADY sold and no date is supplied, keep the one on
      // record. Otherwise filling in a missing price later — which the sold
      // view invites — would silently re-date the sale to today, and an
      // eBay-detected sale would lose its real date.
      if (body?.sold_at) {
        const parsed = new Date(body.sold_at);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "sold_at is not a valid date." }, { status: 400 });
        }
        if (parsed.getTime() > Date.now()) {
          return NextResponse.json({ error: "sold_at cannot be in the future." }, { status: 400 });
        }
        update.sold_at = parsed.toISOString();
      } else if (card.ownership_status !== 'sold') {
        update.sold_at = new Date().toISOString();
      }

      // Same reasoning for the channel: don't relabel an eBay sale 'manual'
      // just because someone typed in the price afterwards.
      if (isSoldChannel(body?.sold_channel)) {
        update.sold_channel = body.sold_channel;
      } else if (card.ownership_status !== 'sold') {
        update.sold_channel = 'manual';
      }
      if (typeof body?.sold_note === 'string') {
        update.sold_note = body.sold_note.trim().slice(0, 500) || null;
      }

      // A sold card must stay viewable or the buyer's QR resolves to nothing.
      // This is the one place we override the owner's visibility preference,
      // and it's the whole point of the feature.
      update.visibility = 'public';
    } else {
      // Leaving 'sold' clears the sale details so a later re-sale starts clean.
      update.sold_at = null;
      update.sold_price = null;
      update.sold_channel = null;
      update.sold_note = null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('cards')
      .update(update)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select('id, serial, ownership_status, sold_at, sold_price, sold_channel, sold_note, visibility')
      .maybeSingle();

    if (updateError) {
      if (isMissingColumnError(updateError)) {
        console.error('[Ownership API] ownership columns missing — migration not applied.');
        return NextResponse.json(
          { error: "This feature isn't available yet. Please try again shortly." },
          { status: 503 }
        );
      }
      console.error('[Ownership API] Update failed:', updateError);
      return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
    }

    console.log(
      `[Ownership API] ${card.serial} → ${nextStatus}` +
      (update.sold_channel ? ` (${update.sold_channel})` : '')
    );

    return NextResponse.json({ card: updated });
  } catch (error: any) {
    console.error('[Ownership API] Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cards/[id]/ownership — bulk-friendly alias for PATCH.
 * Some clients (and the mobile app's request helper) only speak POST.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return PATCH(request, ctx);
}

export type { OwnershipStatus };
