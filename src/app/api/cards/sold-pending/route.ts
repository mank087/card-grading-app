import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
import { findEbaySoldCandidates, markCardsSoldFromEbay } from "@/lib/ebay/sync";
import { isMissingColumnError } from "@/lib/cards/ownership";

/**
 * The one-time "we noticed you sold these on eBay" prompt.
 *
 * The eBay sync knows when a listing sells, so it COULD move the card into the
 * Sold category on the owner's behalf. Doing that unannounced the first time is
 * presumptuous, so the sync stands down until the owner has answered once, and
 * this endpoint is what asks.
 *
 * Only the AUTOMATIC eBay path is governed here. A sale made anywhere else — a
 * card show, a private trade — is always marked by hand through
 * PATCH /api/cards/[id]/ownership and never touches this preference.
 *
 *   GET   → { shouldAsk, pending: [...], autoMark }
 *   POST  { autoMark: boolean }
 *         → saves the answer; when true, moves the pending cards immediately
 */

async function readPref(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_credits')
    .select('ebay_auto_mark_sold')
    .eq('user_id', userId)
    .maybeSingle();
  // Pre-migration: treat as "not asked" so nothing moves on its own.
  if (error) return { value: null as boolean | null, available: !isMissingColumnError(error) };
  return { value: (data?.ebay_auto_mark_sold ?? null) as boolean | null, available: true };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();
    const pref = await readPref(supabase, auth.userId);

    // Only ever ask when there is something concrete to ask ABOUT — an empty
    // prompt on a fresh account is noise.
    if (!pref.available || pref.value !== null) {
      return NextResponse.json({ shouldAsk: false, pending: [], autoMark: pref.value });
    }

    const candidates = await findEbaySoldCandidates(auth.userId);
    if (!candidates.length) {
      return NextResponse.json({ shouldAsk: false, pending: [], autoMark: null });
    }

    // Names for the prompt copy ("Charizard and 2 others").
    const { data: cards } = await supabase
      .from('cards')
      .select('id, card_name, featured, serial')
      .in('id', candidates.map(c => c.cardId));
    const nameById = new Map((cards ?? []).map((c: any) => [c.id, c.featured || c.card_name || c.serial]));

    return NextResponse.json({
      shouldAsk: true,
      autoMark: null,
      pending: candidates.map(c => ({
        id: c.cardId,
        serial: c.serial,
        name: nameById.get(c.cardId) ?? c.serial,
        soldAt: c.soldAt,
        price: c.price,
      })),
    });
  } catch (error: any) {
    console.error('[sold-pending] GET failed:', error);
    return NextResponse.json({ shouldAsk: false, pending: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (typeof body?.autoMark !== 'boolean') {
      return NextResponse.json({ error: "autoMark must be true or false." }, { status: 400 });
    }
    const autoMark: boolean = body.autoMark;

    const supabase = supabaseServer();
    const { error: prefError } = await supabase
      .from('user_credits')
      .update({ ebay_auto_mark_sold: autoMark })
      .eq('user_id', auth.userId);

    if (prefError) {
      if (isMissingColumnError(prefError)) {
        return NextResponse.json({ error: "This setting isn't available yet." }, { status: 503 });
      }
      console.error('[sold-pending] could not save preference:', prefError);
      return NextResponse.json({ error: "Failed to save your choice" }, { status: 500 });
    }

    // Saying yes applies to the cards that are already waiting, not just future
    // sales — otherwise the answer appears to do nothing.
    let moved = 0;
    if (autoMark) {
      const candidates = await findEbaySoldCandidates(auth.userId);
      moved = await markCardsSoldFromEbay(auth.userId, candidates);
    }

    console.log(`[sold-pending] user ${auth.userId} set autoMark=${autoMark}, moved ${moved}`);
    return NextResponse.json({ autoMark, moved });
  } catch (error: any) {
    console.error('[sold-pending] POST failed:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
