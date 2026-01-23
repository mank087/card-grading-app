/**
 * eBay Price Lookup API
 *
 * Searches eBay for active listings matching a card and returns price data.
 * Uses Application tokens (client credentials) - no user auth required.
 *
 * Features:
 * - Multi-query fallback strategy (specific → moderate → broad → minimal)
 * - Median price calculation (more accurate than average)
 * - Bracket format for parallels to match eBay listing conventions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchEbayPrices,
  searchEbayPricesWithFallback,
  searchPokemonPricesWithFallback,
  searchMTGPricesWithFallback,
  searchLorcanaPricesWithFallback,
  searchOnePiecePricesWithFallback,
  searchOtherPricesWithFallback,
  buildSportsCardQuery,
  type SportsCardQueryOptions,
  type PokemonCardQueryOptions,
  type MTGCardQueryOptions,
  type LorcanaCardQueryOptions,
  type OnePieceCardQueryOptions,
  type OtherCardQueryOptions,
} from '@/lib/ebay/browseApi';
import { EBAY_CATEGORIES } from '@/lib/ebay/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      card,
      query: customQuery,
      category,
      limit = 25,  // Increased default for better price statistics
      useFallback = true,  // Enable multi-query fallback by default
      minResults = 3,  // Minimum results before trying next query strategy
    } = body;

    // Determine category ID
    let categoryId: string | undefined;
    if (category) {
      categoryId = category === 'sports'
        ? EBAY_CATEGORIES.SPORTS_TRADING_CARDS
        : category === 'ccg'
        ? EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS
        : category === 'other'
        ? EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS
        : undefined;
    }

    // If custom query provided, use direct search (no fallback)
    if (customQuery) {
      const result = await searchEbayPrices(customQuery, { categoryId, limit });
      return NextResponse.json({
        success: true,
        query: customQuery,
        queryStrategy: 'custom',
        ...result,
      });
    }

    // If card object provided, use fallback strategy for better results
    if (card) {
      if (useFallback) {
        let result;

        // Determine game type for CCG cards
        const gameType = card.game_type || (category === 'ccg' ? 'pokemon' : null);

        // Use game-specific search for CCG cards
        if (gameType === 'pokemon' || (category === 'ccg' && !gameType)) {
          const pokemonOptions: PokemonCardQueryOptions = {
            card_name: card.card_name,
            featured: card.featured,
            card_set: card.card_set,
            card_number: card.card_number,
            release_date: card.release_date,
            subset: card.subset,
            rarity_or_variant: card.rarity_or_variant,
            manufacturer: card.manufacturer,
          };

          result = await searchPokemonPricesWithFallback(pokemonOptions, {
            categoryId,
            limit,
            minResults,
          });
        } else if (gameType === 'mtg') {
          const mtgOptions: MTGCardQueryOptions = {
            card_name: card.card_name,
            card_set: card.card_set,
            card_number: card.card_number,
            release_date: card.release_date,
            rarity: card.rarity_or_variant,
            is_foil: card.is_foil || false,
            foil_type: card.foil_type,
            manufacturer: card.manufacturer,
          };

          result = await searchMTGPricesWithFallback(mtgOptions, {
            categoryId,
            limit,
            minResults,
          });
        } else if (gameType === 'lorcana') {
          const lorcanaOptions: LorcanaCardQueryOptions = {
            card_name: card.card_name,
            card_set: card.card_set,
            card_number: card.card_number,
            release_date: card.release_date,
            rarity: card.rarity_or_variant,
            ink_color: card.ink_color,
            is_foil: card.is_foil || false,
          };

          result = await searchLorcanaPricesWithFallback(lorcanaOptions, {
            categoryId,
            limit,
            minResults,
          });
        } else if (gameType === 'onepiece') {
          const onePieceOptions: OnePieceCardQueryOptions = {
            card_name: card.card_name,
            featured: card.featured,
            card_set: card.card_set,
            card_number: card.card_number,
            release_date: card.release_date,
            rarity: card.rarity_or_variant,
            variant_type: card.variant_type,
            is_foil: card.is_foil || false,
          };

          result = await searchOnePiecePricesWithFallback(onePieceOptions, {
            categoryId,
            limit,
            minResults,
          });
        } else if (gameType === 'other' || category === 'other') {
          // Use Other card search for miscellaneous/non-sport cards
          console.log('[eBay Prices API] Other card data received:', {
            card_name: card.card_name,
            featured: card.featured,
            card_set: card.card_set,
            card_number: card.card_number,
            subset: card.subset,
          });

          const otherOptions: OtherCardQueryOptions = {
            card_name: card.card_name,
            featured: card.featured,
            card_set: card.card_set,
            card_number: card.card_number,
            release_date: card.release_date,
            subset: card.subset,
            rarity_or_variant: card.rarity_or_variant,
            manufacturer: card.manufacturer,
          };

          result = await searchOtherPricesWithFallback(otherOptions, {
            categoryId,
            limit,
            minResults,
          });
        } else {
          // Use sports card search for sports cards
          const cardOptions: SportsCardQueryOptions = {
            card_name: card.card_name,
            featured: card.featured,
            card_set: card.card_set,
            card_number: card.card_number,
            release_date: card.release_date,
            subset: card.subset,
            rarity_or_variant: card.rarity_or_variant,
            manufacturer: card.manufacturer,
            serial_numbering: card.serial_numbering,
            rookie_card: card.rookie_card,
          };

          result = await searchEbayPricesWithFallback(cardOptions, {
            categoryId,
            limit,
            minResults,
          });
        }

        return NextResponse.json({
          success: true,
          query: result.queryUsed,
          ...result,
        });
      } else {
        // Use single query (legacy behavior) - sports cards only
        const cardOptions: SportsCardQueryOptions = {
          card_name: card.card_name,
          featured: card.featured,
          card_set: card.card_set,
          card_number: card.card_number,
          release_date: card.release_date,
          subset: card.subset,
          rarity_or_variant: card.rarity_or_variant,
          manufacturer: card.manufacturer,
          serial_numbering: card.serial_numbering,
          rookie_card: card.rookie_card,
        };

        const searchQuery = buildSportsCardQuery(cardOptions);
        const result = await searchEbayPrices(searchQuery, { categoryId, limit });

        return NextResponse.json({
          success: true,
          query: searchQuery,
          queryStrategy: 'moderate',
          ...result,
        });
      }
    }

    return NextResponse.json(
      { error: 'Either card or query is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[eBay Prices] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for simple queries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Determine category ID
    let categoryId: string | undefined;
    if (category) {
      categoryId = category === 'sports'
        ? EBAY_CATEGORIES.SPORTS_TRADING_CARDS
        : category === 'ccg'
        ? EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS
        : category === 'other'
        ? EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS
        : undefined;
    }

    const result = await searchEbayPrices(query, {
      categoryId,
      limit,
    });

    return NextResponse.json({
      success: true,
      query,
      ...result,
    });
  } catch (error) {
    console.error('[eBay Prices GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
