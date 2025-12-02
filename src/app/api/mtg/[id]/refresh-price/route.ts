import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCardById, getCardBySetAndNumber, searchCardByFuzzyName } from "@/lib/scryfallApi";

/**
 * POST /api/mtg/[id]/refresh-price
 * Fetches fresh pricing data from Scryfall API and updates the card
 *
 * Rate limiting: 1 refresh per card per hour (stored in database)
 */

type RefreshPriceRequest = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RefreshPriceRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  console.log(`[POST /api/mtg/${cardId}/refresh-price] Starting price refresh`);

  try {
    const supabase = supabaseServer();

    // Get the card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(`
        id,
        category,
        card_name,
        card_set,
        card_number,
        mtg_set_code,
        expansion_code,
        scryfall_price_usd,
        scryfall_price_usd_foil,
        scryfall_price_eur,
        scryfall_price_updated_at,
        mtg_api_id,
        conversational_card_info
      `)
      .eq("id", cardId)
      .eq("category", "MTG")
      .single();

    if (cardError || !card) {
      console.error(`[refresh-price] Card not found:`, cardError);
      return NextResponse.json({ error: "MTG card not found" }, { status: 404 });
    }

    // Rate limiting: Check if price was refreshed within last hour
    const lastUpdate = card.scryfall_price_updated_at
      ? new Date(card.scryfall_price_updated_at).getTime()
      : 0;
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    if (lastUpdate > oneHourAgo) {
      const minutesRemaining = Math.ceil((lastUpdate - oneHourAgo) / (60 * 1000));
      console.log(`[refresh-price] Rate limited - ${minutesRemaining} minutes until next refresh allowed`);
      return NextResponse.json({
        error: "Rate limited",
        message: `Price was recently updated. Please wait ${minutesRemaining} minute(s) before refreshing again.`,
        last_updated: card.scryfall_price_updated_at,
        minutes_remaining: minutesRemaining
      }, { status: 429 });
    }

    // Extract card info for Scryfall lookup
    const cardInfo = card.conversational_card_info as any || {};
    const scryfallId = card.mtg_api_id || cardInfo.mtg_api_id || cardInfo.scryfall_id;
    const setCode = card.mtg_set_code || card.expansion_code || cardInfo.expansion_code || cardInfo.mtg_set_code;
    const cardNumber = card.card_number || cardInfo.collector_number || cardInfo.card_number;
    const cardName = card.card_name || cardInfo.card_name;

    console.log(`[refresh-price] Looking up card:`, {
      scryfallId,
      cardName,
      setCode,
      cardNumber
    });

    // Try to fetch fresh data from Scryfall
    let scryfallCard = null;

    // Strategy 0: Direct Scryfall ID lookup (most reliable - already verified)
    if (scryfallId) {
      console.log(`[refresh-price] Strategy 0: Direct Scryfall ID lookup: ${scryfallId}`);
      scryfallCard = await getCardById(scryfallId);
      if (scryfallCard) {
        console.log(`[refresh-price] ✅ Found via Scryfall ID`);
      }
    }

    // Strategy 1: Set code + collector number (most accurate)
    if (!scryfallCard && setCode && cardNumber) {
      // Clean the card number (remove leading zeros, handle /xxx format)
      let cleanNumber = cardNumber;
      if (cardNumber.includes('/')) {
        cleanNumber = cardNumber.split('/')[0];
      }
      cleanNumber = cleanNumber.replace(/^0+/, '') || '0';

      console.log(`[refresh-price] Strategy 1: Set ${setCode.toLowerCase()} + Number ${cleanNumber}`);
      scryfallCard = await getCardBySetAndNumber(setCode.toLowerCase(), cleanNumber);
    }

    // Strategy 2: Fuzzy name search with set
    if (!scryfallCard && cardName && setCode) {
      console.log(`[refresh-price] Strategy 2: Fuzzy name "${cardName}" + set ${setCode}`);
      scryfallCard = await searchCardByFuzzyName(cardName, setCode.toLowerCase());
    }

    // Strategy 3: Fuzzy name search only
    if (!scryfallCard && cardName) {
      console.log(`[refresh-price] Strategy 3: Fuzzy name only "${cardName}"`);
      scryfallCard = await searchCardByFuzzyName(cardName);
    }

    if (!scryfallCard) {
      console.warn(`[refresh-price] Could not find card in Scryfall API. Tried:`, {
        scryfallId: scryfallId || 'none',
        setCode: setCode || 'none',
        cardNumber: cardNumber || 'none',
        cardName: cardName || 'none'
      });
      return NextResponse.json({
        error: "Card not found in Scryfall",
        message: "Could not find this card in Scryfall API. Try re-grading the card to establish Scryfall verification.",
        debug: {
          had_scryfall_id: !!scryfallId,
          had_set_code: !!setCode,
          had_card_number: !!cardNumber,
          had_card_name: !!cardName
        }
      }, { status: 404 });
    }

    // Extract pricing from Scryfall response
    const newPrices = {
      scryfall_price_usd: scryfallCard.prices.usd ? parseFloat(scryfallCard.prices.usd) : null,
      scryfall_price_usd_foil: scryfallCard.prices.usd_foil ? parseFloat(scryfallCard.prices.usd_foil) : null,
      scryfall_price_usd_etched: scryfallCard.prices.usd_etched ? parseFloat(scryfallCard.prices.usd_etched) : null,
      scryfall_price_eur: scryfallCard.prices.eur ? parseFloat(scryfallCard.prices.eur) : null,
      scryfall_price_updated_at: new Date().toISOString()
    };

    console.log(`[refresh-price] New prices from Scryfall:`, {
      usd: newPrices.scryfall_price_usd,
      usd_foil: newPrices.scryfall_price_usd_foil,
      eur: newPrices.scryfall_price_eur
    });

    // Build update object - include Scryfall ID and card info if we found them
    const updateData: any = {
      ...newPrices,
      // Save Scryfall ID for future lookups (most reliable method)
      mtg_api_id: scryfallCard.id,
      mtg_api_verified: true
    };

    // If card_name was empty, populate it from Scryfall
    if (!card.card_name && scryfallCard.name) {
      updateData.card_name = scryfallCard.name;
    }
    // If card_set was empty, populate it from Scryfall
    if (!card.card_set && scryfallCard.set_name) {
      updateData.card_set = scryfallCard.set_name;
    }
    // If expansion_code was empty, populate it from Scryfall
    if (!card.expansion_code && scryfallCard.set) {
      updateData.expansion_code = scryfallCard.set.toUpperCase();
      updateData.mtg_set_code = scryfallCard.set.toUpperCase();
    }

    // Update database with new prices and card info
    const { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    if (updateError) {
      console.error(`[refresh-price] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to update prices" }, { status: 500 });
    }

    // Also update conversational_card_info with Scryfall data
    const existingCardInfo = card.conversational_card_info || {};
    const updatedCardInfo = {
      ...existingCardInfo,
      scryfall_price_usd: newPrices.scryfall_price_usd,
      scryfall_price_usd_foil: newPrices.scryfall_price_usd_foil,
      mtg_api_id: scryfallCard.id,
      mtg_api_verified: true,
      // Fill in missing card info from Scryfall
      card_name: existingCardInfo.card_name || scryfallCard.name,
      set_name: existingCardInfo.set_name || scryfallCard.set_name,
      expansion_code: existingCardInfo.expansion_code || scryfallCard.set.toUpperCase(),
      collector_number: existingCardInfo.collector_number || scryfallCard.collector_number,
      rarity_or_variant: existingCardInfo.rarity_or_variant || scryfallCard.rarity,
      mana_cost: existingCardInfo.mana_cost || scryfallCard.mana_cost,
      mtg_card_type: existingCardInfo.mtg_card_type || scryfallCard.type_line,
      artist_name: existingCardInfo.artist_name || scryfallCard.artist
    };

    await supabase
      .from("cards")
      .update({ conversational_card_info: updatedCardInfo })
      .eq("id", cardId);

    const processingTime = Date.now() - startTime;
    console.log(`[refresh-price] Price refresh completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      message: "Prices refreshed successfully",
      prices: {
        usd: newPrices.scryfall_price_usd,
        usd_foil: newPrices.scryfall_price_usd_foil,
        usd_etched: newPrices.scryfall_price_usd_etched,
        eur: newPrices.scryfall_price_eur
      },
      updated_at: newPrices.scryfall_price_updated_at,
      source: "Scryfall",
      card_found: {
        name: scryfallCard.name,
        set: scryfallCard.set_name,
        collector_number: scryfallCard.collector_number
      },
      processing_time_ms: processingTime
    });

  } catch (error: any) {
    console.error(`[refresh-price] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to refresh prices: " + error.message },
      { status: 500 }
    );
  }
}
