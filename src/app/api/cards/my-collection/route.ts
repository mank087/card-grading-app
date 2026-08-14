import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
import { createSignedUrlMap } from "@/lib/signedUrlBatch";
import { isMissingColumnError, isOwnershipStatus } from "@/lib/cards/ownership";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication - user must be logged in
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Use the authenticated user's ID - NOT from query params
    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // Ownership view. Defaults to 'owned' so the collection shows what the
    // user actually holds; ?status=sold powers the Sold tab and ?status=all is
    // the escape hatch (batch reports over everything). Soft-deleted cards are
    // never returned by any of them.
    const statusParam = searchParams.get('status') || 'owned';
    const ownershipFilter = isOwnershipStatus(statusParam) ? statusParam : null;
    if (!ownershipFilter && statusParam !== 'all') {
      return NextResponse.json(
        { error: "Invalid status. Use 'owned', 'sold', or 'all'." },
        { status: 400 }
      );
    }

    // Explicit column list — the cards table carries multi-MB grading blobs
    // this endpoint never reads. Split so the migration-window fallback can
    // drop the ownership columns without falling back to SELECT *.
    const BASE_COLUMNS = `
        id, serial, org_id, org_serial, org_serial_display, front_path, back_path, card_name, featured, pokemon_featured, category, card_set,
        manufacturer_name, release_date, card_number, grade_numeric, ai_confidence_score,
        dcm_grade_whole, dvg_image_quality, created_at, visibility,
        conversational_decimal_grade, conversational_whole_grade, conversational_image_confidence,
        conversational_card_info, conversational_condition_label, dvg_decimal_grade,
        conversational_weighted_sub_scores, conversational_sub_scores, conversational_corners_edges_surface,
        conversational_final_grade_summary, conversational_grade_uncertainty, estimated_professional_grades,
        is_foil, foil_type, is_double_faced, mtg_api_verified, mtg_rarity, mtg_set_code,
        card_language, scryfall_price_usd, scryfall_price_usd_foil,
        serial_numbering, rarity_tier, rarity_description, autographed, autograph_type,
        memorabilia_type, rookie_card, first_print_rookie, holofoil,
        ebay_price_lowest, ebay_price_median, ebay_price_average, ebay_price_highest,
        ebay_price_listing_count, ebay_price_updated_at,
        dcm_price_estimate, dcm_price_raw, dcm_price_graded_high, dcm_price_median, dcm_price_average,
        dcm_price_updated_at, dcm_price_match_confidence, dcm_price_product_id, dcm_price_product_name,
        dcm_prices_cached_at,
        custom_label_data,
        card_colors`;
    const OWNERSHIP_COLUMNS = `ownership_status, sold_at, sold_price, sold_channel, sold_note`;

    const buildQuery = (applyOwnership: boolean) => {
      let query = supabase
        .from('cards')
        .select(applyOwnership ? `${BASE_COLUMNS}, ${OWNERSHIP_COLUMNS}` : BASE_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (applyOwnership) {
        query = query.is('deleted_at', null);
        if (ownershipFilter) query = query.eq('ownership_status', ownershipFilter);
      }

      // Apply search filter if provided
      if (search) {
        query = query.or(`serial.ilike.%${search}%,card_name.ilike.%${search}%`);
      }
      return query;
    };

    // supabase-js can only infer row types from a LITERAL select string; ours
    // is assembled at runtime, so type the rows explicitly (they're plain card
    // records) exactly as /api/ebay/eligible-cards does.
    const first = await buildQuery(true);
    let cards = (first.data ?? null) as unknown as Record<string, any>[] | null;
    let error = first.error;

    // Migration window: the ownership columns are applied by hand, so tolerate
    // a schema that predates them rather than 500ing the collection page.
    let ownershipApplied = true;
    if (error && isMissingColumnError(error)) {
      console.warn(
        '[Collection API] ownership_status column missing — falling back to an unfiltered ' +
        'collection. Apply supabase/migrations/20260730_add_card_ownership_status.sql.'
      );
      ownershipApplied = false;

      // Falling back to the UNFILTERED query is only acceptable for the default
      // "owned" view, where showing everything matches the pre-ownership
      // behaviour. For an explicit sold request it is actively wrong — the user
      // asked for a subset and would silently get their whole collection back
      // under a "Sold" heading. Return nothing instead, and let
      // ownershipApplied:false tell the client to hide the tabs.
      if (ownershipFilter && ownershipFilter !== 'owned') {
        console.warn(`[Collection API] cannot serve status=${ownershipFilter} pre-migration — returning empty.`);
        return NextResponse.json({
          cards: [],
          counts: { owned: 0, sold: 0 },
          ownershipApplied: false,
          status: statusParam,
        });
      }

      // Same query, minus the ownership columns and the filter.
      const legacy = await buildQuery(false);
      cards = (legacy.data ?? null) as unknown as Record<string, any>[] | null;
      error = legacy.error;
    }

    if (error) {
      console.error('[Collection API] Error fetching cards:', error);
      return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
    }

    // Per-status counts drive the collection tabs. Head-only count queries —
    // no rows transferred. Skipped entirely during the migration window.
    const counts = { owned: 0, sold: 0 };
    if (ownershipApplied) {
      const [owned, sold] = await Promise.all(
        (['owned', 'sold'] as const).map(status =>
          supabase
            .from('cards')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .eq('ownership_status', status)
        )
      );
      counts.owned = owned.count ?? 0;
      counts.sold = sold.count ?? 0;
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [], counts, ownershipApplied, status: statusParam });
    }

    // 🚀 PERFORMANCE: Batch create signed URLs — chunked to respect Supabase's
    // 1,000-paths-per-request limit (collections >500 cards used to 400 the whole
    // batch and every card rendered "No image").
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path]);

    let urlMap: Map<string, string>;
    try {
      urlMap = await createSignedUrlMap(supabase.storage, 'cards', allPaths, 60 * 60);
    } catch (signError) {
      console.error('[Collection API] Error creating signed URLs:', signError);
      // Fall back to returning cards without URLs
      return NextResponse.json({
        cards: cards.map(card => ({ ...card, front_url: null, back_url: null })),
        counts,
        ownershipApplied,
        status: statusParam,
      });
    }

    // Map URLs back to cards + parse conversational_grading for missing fields
    const cardsWithUrls = cards.map(card => {
      const enrichedCard = {
        ...card,
        front_url: urlMap.get(card.front_path) || null,
        back_url: urlMap.get(card.back_path) || null
      };

      return enrichedCard;
    });

    return NextResponse.json({ cards: cardsWithUrls, counts, ownershipApplied, status: statusParam });
  } catch (error: any) {
    console.error('[Collection API] Unexpected error:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
