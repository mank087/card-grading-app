/**
 * eBay Batch Price Refresh API
 *
 * Refreshes cached prices for multiple cards in the background.
 * Rate-limited to avoid hitting eBay API limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { isPriceCacheStale, fetchAndCacheCardPrice } from '@/lib/ebay/priceTracker';

// Max cards to refresh per request (to avoid timeout)
const MAX_CARDS_PER_BATCH = 10;

// Delay between API calls (ms) to respect rate limits
const DELAY_BETWEEN_CALLS = 500;

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { card_ids, force = false } = body;

    if (!card_ids || !Array.isArray(card_ids) || card_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'card_ids array is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Fetch cards that belong to this user and need refresh
    // Include conversational_grading for fallback parsing, plus legacy direct fields
    const { data: cards, error: fetchError } = await supabase
      .from('cards')
      .select(`
        id,
        category,
        conversational_card_info,
        conversational_grading,
        ai_grading,
        card_name,
        featured,
        pokemon_featured,
        card_set,
        card_number,
        release_date,
        manufacturer_name,
        is_foil,
        foil_type,
        mtg_rarity,
        ebay_price_updated_at
      `)
      .eq('user_id', auth.userId)
      .in('id', card_ids.slice(0, MAX_CARDS_PER_BATCH * 2)); // Fetch more to filter stale ones

    if (fetchError) {
      console.error('[Batch Refresh] Error fetching cards:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch cards' },
        { status: 500 }
      );
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        success: true,
        refreshed: 0,
        message: 'No cards found to refresh',
      });
    }

    // Filter to only stale cards (>= 7 days old or never updated), unless force=true
    const staleCards = force
      ? cards
      : cards.filter(card => isPriceCacheStale(card.ebay_price_updated_at, 7));

    console.log(`[Batch Refresh] ${staleCards.length} of ${cards.length} cards to refresh (force=${force})`);

    if (staleCards.length === 0) {
      return NextResponse.json({
        success: true,
        refreshed: 0,
        message: 'All cards have fresh prices',
      });
    }

    // Limit to max batch size
    const cardsToRefresh = staleCards.slice(0, MAX_CARDS_PER_BATCH);

    // Helper: Build card info from various sources (matching my-collection API logic)
    const buildCardInfo = (card: any) => {
      // Try conversational_card_info first (newest format)
      if (card.conversational_card_info) {
        return card.conversational_card_info;
      }

      // Try parsing conversational_grading JSON
      if (card.conversational_grading) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading;

          if (parsed.card_info) {
            return parsed.card_info;
          }
        } catch (e) {
          // Parsing failed, continue to legacy fields
        }
      }

      // Try ai_grading JSON (older format, used by Pokemon and other cards)
      if (card.ai_grading) {
        try {
          const aiGrading = typeof card.ai_grading === 'string'
            ? JSON.parse(card.ai_grading)
            : card.ai_grading;

          // Legacy format uses "Card Information" with spaces
          const cardInfo = aiGrading["Card Information"] || aiGrading.card_info;
          if (cardInfo) {
            return {
              player_or_character: cardInfo.player_or_character || cardInfo.featured_player,
              card_name: cardInfo.card_name,
              set_name: cardInfo.set_name || cardInfo.card_set,
              card_number: cardInfo.card_number,
              year: cardInfo.year || cardInfo.release_date,
              manufacturer: cardInfo.manufacturer,
              subset: cardInfo.subset,
              rarity_or_variant: cardInfo.rarity_or_variant,
            };
          }
        } catch (e) {
          // Parsing failed, continue to legacy fields
        }
      }

      // Fall back to legacy direct fields on the card (including pokemon_featured)
      if (card.featured || card.card_name || card.pokemon_featured) {
        return {
          player_or_character: card.pokemon_featured || card.featured,
          card_name: card.card_name,
          set_name: card.card_set,
          card_number: card.card_number,
          year: card.release_date,
          manufacturer: card.manufacturer_name,
          // MTG/Lorcana specific fields
          is_foil: card.is_foil || false,
          foil_type: card.foil_type,
          rarity_or_variant: card.mtg_rarity,
        };
      }

      return null;
    };

    // Refresh prices with delays between calls
    const results: { id: string; success: boolean; median_price?: number | null }[] = [];

    for (let i = 0; i < cardsToRefresh.length; i++) {
      const card = cardsToRefresh[i];
      const cardInfo = buildCardInfo(card);

      console.log(`[Batch Refresh] Processing card ${i + 1}/${cardsToRefresh.length}: ${card.category} - ${cardInfo?.card_name || card.card_name || 'unknown'}`);

      try {
        const refreshedPrice = await fetchAndCacheCardPrice({
          id: card.id,
          category: card.category || 'Other',
          conversational_card_info: cardInfo,
        });

        results.push({
          id: card.id,
          success: true,
          median_price: refreshedPrice?.median_price ?? null,
        });
      } catch (error) {
        console.error(`[Batch Refresh] Error refreshing card ${card.id}:`, error);
        results.push({
          id: card.id,
          success: false,
        });
      }

      // Add delay between calls (except for last one)
      if (i < cardsToRefresh.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      refreshed: successCount,
      total_stale: staleCards.length,
      results,
      message: `Refreshed ${successCount} of ${cardsToRefresh.length} cards`,
    });

  } catch (error) {
    console.error('[Batch Refresh] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh prices',
      },
      { status: 500 }
    );
  }
}
