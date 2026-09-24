import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCron } from "@/lib/cronAuth";
import { verifyAndSavePokemonCard } from "@/lib/identity/pokemonCatalogLink";

/**
 * POST /api/pokemon/verify
 *
 * Verify a Pokemon card against the local pokemon_cards catalog and save the
 * link (and, on a confident match, the corrected identity). Called by the
 * grading routes after a Pokemon grade.
 *
 * SERVER-TO-SERVER ONLY (Sept 24 2026). It writes catalog and identity fields
 * for any card_id, and `card_info` overrides what it verifies, so it requires
 * `Authorization: Bearer ${CRON_SECRET}` (requireCron: a missing secret in
 * production is a 500, never a pass). It used to be callable by anyone.
 *
 * Request body:
 * {
 *   card_id: string,         // Card UUID to verify and update
 *   card_info?: object,      // Optional: override card info (the grading call's card_info)
 *   regrade?: boolean,       // regrade context: identity is preserved
 *   reidentify?: boolean
 * }
 *
 * The work is done by verifyAndSavePokemonCard (src/lib/identity/pokemonCatalogLink.ts).
 */
export async function POST(request: NextRequest) {
  const auth = requireCron(request, "pokemon/verify");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const cardId = body?.card_id;
    if (!cardId || typeof cardId !== "string") {
      return NextResponse.json({ error: "card_id is required" }, { status: 400 });
    }

    const outcome = await verifyAndSavePokemonCard(supabaseServer(), cardId, {
      force: request.nextUrl.searchParams.get("force") === "true",
      overrideCardInfo: body?.card_info && typeof body.card_info === "object" ? body.card_info : null,
      // Aug 25 2026: on a regrade of an already-identified card, verification may
      // refresh pokemon_api_* metadata but must not rewrite identity unless
      // reidentify was requested.
      regrade: body?.regrade === true,
      reidentify: body?.reidentify === true,
      trigger: "route",
    });
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error: any) {
    console.error(`[Pokemon Verify API] Error:`, error);
    return NextResponse.json(
      { error: "Verification failed", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pokemon/verify?card_id=xxx
 *
 * Check verification status of a card
 */
export async function GET(request: NextRequest) {
  try {
    const cardId = request.nextUrl.searchParams.get('card_id');

    if (!cardId) {
      return NextResponse.json(
        { error: "card_id parameter is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: card, error } = await supabase
      .from("cards")
      .select(`
        id,
        category,
        pokemon_api_id,
        pokemon_api_verified,
        pokemon_api_verified_at,
        pokemon_api_data,
        pokemon_api_confidence,
        pokemon_api_method
      `)
      .eq("id", cardId)
      .single();

    if (error || !card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    if (card.category !== 'Pokemon') {
      return NextResponse.json({
        verified: false,
        reason: 'Not a Pokemon card'
      });
    }

    return NextResponse.json({
      verified: card.pokemon_api_verified || false,
      pokemon_api_id: card.pokemon_api_id,
      verified_at: card.pokemon_api_verified_at,
      confidence: card.pokemon_api_confidence,
      method: card.pokemon_api_method,
      api_data: card.pokemon_api_data
    });

  } catch (error: any) {
    console.error(`[Pokemon Verify API] GET error:`, error);
    return NextResponse.json(
      { error: "Failed to check verification status" },
      { status: 500 }
    );
  }
}
