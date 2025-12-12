import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  verifyPokemonCard,
  getPokemonApiUpdateFields,
  extractPokemonMetadata,
  type CardInfoForVerification
} from "@/lib/pokemonApiVerification";

/**
 * POST /api/pokemon/verify
 *
 * Verify a Pokemon card against the Pokemon TCG API
 * Called automatically after grading a Pokemon card
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
 *   pokemon_api_id: string | null,
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

    console.log(`[Pokemon Verify API] Starting verification for card ${card_id}`);

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
        pokemon_api_verified
      `)
      .eq("id", card_id)
      .single();

    if (cardError || !card) {
      console.error(`[Pokemon Verify API] Card not found:`, cardError);
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    // Only verify Pokemon cards
    if (card.category !== 'Pokemon') {
      return NextResponse.json({
        success: false,
        verified: false,
        reason: 'Not a Pokemon card',
        category: card.category
      });
    }

    // Skip if already verified (unless forced)
    const forceVerify = request.nextUrl.searchParams.get('force') === 'true';
    if (card.pokemon_api_verified && !forceVerify) {
      console.log(`[Pokemon Verify API] Card already verified, skipping`);
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

    const cardInfoForVerification: CardInfoForVerification = {
      card_name: overrideCardInfo?.card_name || convInfo.card_name || card.card_name,
      player_or_character: overrideCardInfo?.player_or_character || convInfo.player_or_character || card.featured,
      set_name: overrideCardInfo?.set_name || convInfo.set_name || card.card_set,
      card_number: overrideCardInfo?.card_number || convInfo.card_number || card.card_number,
      year: overrideCardInfo?.year || convInfo.year || card.release_date,
      set_code: overrideCardInfo?.set_code || convInfo.set_code || null,
      // New format-aware fields for improved API lookup
      card_number_raw: overrideCardInfo?.card_number_raw || convInfo.card_number_raw || null,
      card_number_format: overrideCardInfo?.card_number_format || convInfo.card_number_format || null,
      set_total: overrideCardInfo?.set_total || convInfo.set_total || null
    };

    console.log(`[Pokemon Verify API] Card info for verification:`, cardInfoForVerification);

    // Perform verification
    const verificationResult = await verifyPokemonCard(cardInfoForVerification);

    console.log(`[Pokemon Verify API] Verification result:`, {
      success: verificationResult.success,
      verified: verificationResult.verified,
      pokemon_api_id: verificationResult.pokemon_api_id,
      confidence: verificationResult.confidence,
      corrections_count: verificationResult.corrections.length
    });

    // Update database with verification results
    if (verificationResult.success && verificationResult.pokemon_api_data) {
      const updateFields = getPokemonApiUpdateFields(verificationResult);

      if (updateFields) {
        // Also merge TCGPlayer URL into conversational_card_info for cached loads
        const tcgplayerUrl = verificationResult.pokemon_api_data.tcgplayer?.url || null;
        const metadata = extractPokemonMetadata(verificationResult.pokemon_api_data);

        // Merge into existing conversational_card_info
        const updatedCardInfo = {
          ...(convInfo || {}),
          set_name: metadata.set_name || convInfo.set_name,
          pokemon_api_verified: true,
          pokemon_api_id: verificationResult.pokemon_api_id,
          rarity_or_variant: metadata.rarity || convInfo.rarity_or_variant,
          tcgplayer_url: tcgplayerUrl
        };

        const { error: updateError } = await supabase
          .from("cards")
          .update({
            ...updateFields,
            conversational_card_info: updatedCardInfo
          })
          .eq("id", card_id);

        if (updateError) {
          console.error(`[Pokemon Verify API] Failed to update card:`, updateError);
          // Don't fail the request, verification was successful
        } else {
          console.log(`[Pokemon Verify API] Card updated with API data and TCGPlayer URL: ${tcgplayerUrl ? 'present' : 'not found'}`);
        }
      }
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: verificationResult.success,
      verified: verificationResult.verified,
      pokemon_api_id: verificationResult.pokemon_api_id,
      verification_method: verificationResult.verification_method,
      confidence: verificationResult.confidence,
      corrections: verificationResult.corrections,
      metadata: verificationResult.pokemon_api_data
        ? extractPokemonMetadata(verificationResult.pokemon_api_data)
        : null,
      error: verificationResult.error || null,
      processing_time_ms: processingTime
    });

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
