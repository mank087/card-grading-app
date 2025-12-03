import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  verifyMTGCard,
  getMTGApiUpdateFields,
  extractMTGDisplayMetadata,
  type MTGCardInfoForVerification
} from "@/lib/mtgApiVerification";

/**
 * POST /api/mtg/verify
 *
 * Verify an MTG card against the Scryfall API
 * Called automatically after grading an MTG card
 *
 * Request body:
 * {
 *   card_id: string,         // Card UUID to verify and update
 *   card_info?: object       // Optional: Override card info (from conversational_card_info)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   verified: boolean,
 *   mtg_api_id: string | null,
 *   corrections: array,
 *   metadata: object
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { card_id, card_info: overrideCardInfo } = body;

    if (!card_id) {
      return NextResponse.json(
        { error: "card_id is required" },
        { status: 400 }
      );
    }

    console.log(`[MTG Verify API] Starting verification for card ${card_id}`);

    const supabase = supabaseServer();

    // Get card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(`
        id,
        category,
        card_name,
        featured,
        card_set,
        card_number,
        release_date,
        manufacturer_name,
        conversational_card_info,
        mtg_api_verified
      `)
      .eq("id", card_id)
      .single();

    if (cardError || !card) {
      console.error(`[MTG Verify API] Card not found:`, cardError);
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    // Only verify MTG cards
    if (card.category !== 'MTG') {
      return NextResponse.json({
        success: false,
        verified: false,
        reason: 'Not an MTG card',
        category: card.category
      });
    }

    // Skip if already verified (unless forced)
    const forceVerify = request.nextUrl.searchParams.get('force') === 'true';
    if (card.mtg_api_verified && !forceVerify) {
      console.log(`[MTG Verify API] Card already verified, skipping`);
      return NextResponse.json({
        success: true,
        verified: true,
        already_verified: true,
        message: 'Card was previously verified'
      });
    }

    // Build card info for verification
    // Priority: override > conversational_card_info > database fields
    const convInfo = card.conversational_card_info as any || {};

    const cardInfoForVerification: MTGCardInfoForVerification = {
      card_name: overrideCardInfo?.card_name || convInfo.card_name || card.card_name,
      player_or_character: overrideCardInfo?.player_or_character || convInfo.player_or_character || card.featured,
      set_name: overrideCardInfo?.set_name || convInfo.set_name || card.card_set,
      // 🔧 MTG uses collector_number in AI output, card_number in database
      card_number: overrideCardInfo?.card_number || convInfo.collector_number || convInfo.card_number || card.card_number,
      year: overrideCardInfo?.year || convInfo.year || card.release_date,
      set_code: overrideCardInfo?.set_code || convInfo.set_code || convInfo.expansion_code || null,
      language: overrideCardInfo?.language || convInfo.language || 'English',
      is_foil: overrideCardInfo?.is_foil ?? convInfo.is_foil ?? false,
      foil_type: overrideCardInfo?.foil_type || convInfo.foil_type || null
    };

    console.log(`[MTG Verify API] Card info for verification:`, cardInfoForVerification);

    // Perform verification
    const verificationResult = await verifyMTGCard(cardInfoForVerification);

    console.log(`[MTG Verify API] Verification result:`, {
      success: verificationResult.success,
      verified: verificationResult.verified,
      mtg_api_id: verificationResult.mtg_api_id,
      confidence: verificationResult.confidence,
      corrections_count: verificationResult.corrections.length
    });

    // Update database with verification results
    if (verificationResult.success && verificationResult.mtg_api_data) {
      const updateFields = getMTGApiUpdateFields(verificationResult);

      if (updateFields) {
        const { error: updateError } = await supabase
          .from("cards")
          .update(updateFields)
          .eq("id", card_id);

        if (updateError) {
          console.error(`[MTG Verify API] Failed to update card:`, updateError);
          // Don't fail the request, verification was successful
        } else {
          console.log(`[MTG Verify API] Card updated with Scryfall API data`);
        }
      }
    }

    const processingTime = Date.now() - startTime;

    // Include set card_count for proper "X/Y" formatting
    const setData = verificationResult.mtg_set_data;

    return NextResponse.json({
      success: verificationResult.success,
      verified: verificationResult.verified,
      mtg_api_id: verificationResult.mtg_api_id,
      mtg_oracle_id: verificationResult.mtg_oracle_id,
      verification_method: verificationResult.verification_method,
      confidence: verificationResult.confidence,
      corrections: verificationResult.corrections,
      metadata: verificationResult.mtg_api_data
        ? extractMTGDisplayMetadata(verificationResult.mtg_api_data)
        : null,
      set_card_count: setData?.card_count || setData?.printed_size || null,
      error: verificationResult.error || null,
      processing_time_ms: processingTime
    });

  } catch (error: any) {
    console.error(`[MTG Verify API] Error:`, error);
    return NextResponse.json(
      { error: "Verification failed", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mtg/verify?card_id=xxx
 *
 * Check verification status of an MTG card
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
        mtg_api_id,
        mtg_oracle_id,
        mtg_api_verified,
        mtg_api_verified_at,
        mtg_api_data,
        mtg_api_confidence,
        mtg_api_method,
        mtg_mana_cost,
        mtg_type_line,
        mtg_colors,
        mtg_rarity,
        mtg_set_code,
        card_language,
        is_foil,
        foil_type,
        is_double_faced,
        scryfall_price_usd,
        scryfall_price_usd_foil,
        scryfall_price_eur,
        scryfall_price_updated_at
      `)
      .eq("id", cardId)
      .single();

    if (error || !card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    if (card.category !== 'MTG') {
      return NextResponse.json({
        verified: false,
        reason: 'Not an MTG card'
      });
    }

    return NextResponse.json({
      verified: card.mtg_api_verified || false,
      mtg_api_id: card.mtg_api_id,
      mtg_oracle_id: card.mtg_oracle_id,
      verified_at: card.mtg_api_verified_at,
      confidence: card.mtg_api_confidence,
      method: card.mtg_api_method,
      // MTG-specific fields
      mana_cost: card.mtg_mana_cost,
      type_line: card.mtg_type_line,
      colors: card.mtg_colors,
      rarity: card.mtg_rarity,
      set_code: card.mtg_set_code,
      language: card.card_language,
      is_foil: card.is_foil,
      foil_type: card.foil_type,
      is_double_faced: card.is_double_faced,
      // Pricing
      pricing: {
        usd: card.scryfall_price_usd,
        usd_foil: card.scryfall_price_usd_foil,
        eur: card.scryfall_price_eur,
        updated_at: card.scryfall_price_updated_at
      },
      // Full API data
      api_data: card.mtg_api_data
    });

  } catch (error: any) {
    console.error(`[MTG Verify API] GET error:`, error);
    return NextResponse.json(
      { error: "Failed to check verification status" },
      { status: 500 }
    );
  }
}
