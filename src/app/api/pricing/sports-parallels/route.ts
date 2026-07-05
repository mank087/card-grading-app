/**
 * GET /api/pricing/sports-parallels
 *
 * Returns the full parallel family for a sports card from the local
 * sports_card_products table (WS3.1). Powers the parallel picker on web and
 * mobile. Unlike the legacy getAvailableParallels (live API search filtered
 * by the AI-extracted card number), this is backed by local data and returns
 * the complete family with prices in one call.
 *
 * Query params (one of):
 *   cardId=<uuid>        resolve the family from the card's matched product /
 *                        AI-extracted identity
 *   productId=<scp id>   resolve the family from a known SportsCardsPro id
 *
 * Response:
 *   {
 *     available: boolean,           // local DB imported?
 *     matchedProductId: string|null,
 *     parallels: Array<{
 *       id, productName, variantText, serialDenominator, isRookie,
 *       prices: { raw, psa9, psa10 },   // headline prices for the picker rows
 *       hasPrices: boolean,
 *       isBase: boolean,
 *     }>,
 *     setName: string|null,
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  isSportsLocalDbAvailable,
  getLocalSportsFamily,
  matchSportsCardLocal,
  type SportsProductRow,
} from '@/lib/sportsCardMatcher';

export const dynamic = 'force-dynamic';

function toParallelRow(row: SportsProductRow) {
  return {
    id: row.id,
    productName: row.product_name,
    variantText: row.variant_text,
    serialDenominator: row.serial_denominator,
    isRookie: !!row.is_rookie,
    prices: {
      raw: row.loose_price != null ? Number(row.loose_price) : null,
      psa9: row.graded_price != null ? Number(row.graded_price) : null,
      psa10: row.manual_only_price != null ? Number(row.manual_only_price) : null,
    },
    hasPrices: !!(row.loose_price || row.graded_price || row.manual_only_price || row.new_price),
    isBase: !row.variant_text,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');
    const productId = searchParams.get('productId');

    if (!cardId && !productId) {
      return NextResponse.json({ error: 'cardId or productId required' }, { status: 400 });
    }

    if (!(await isSportsLocalDbAvailable())) {
      return NextResponse.json({ available: false, matchedProductId: null, parallels: [], setName: null });
    }

    // Direct product-id path (picker refresh, dcm-select follow-up)
    if (productId) {
      const family = await getLocalSportsFamily(productId);
      return NextResponse.json({
        available: true,
        matchedProductId: productId,
        parallels: family.map(toParallelRow),
        setName: family[0]?.console_name || null,
      });
    }

    // Card path: prefer the already-matched product, else match now
    const { data: card, error } = await supabaseServer()
      .from('cards')
      .select('id, category, conversational_card_info, dcm_price_product_id')
      .eq('id', cardId)
      .single();
    if (error || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    if (card.dcm_price_product_id) {
      const family = await getLocalSportsFamily(card.dcm_price_product_id);
      if (family.length > 0) {
        return NextResponse.json({
          available: true,
          matchedProductId: card.dcm_price_product_id,
          parallels: family.map(toParallelRow),
          setName: family[0]?.console_name || null,
        });
      }
    }

    const ci = (card.conversational_card_info || {}) as Record<string, any>;
    const player = ci.player_or_character || ci.featured;
    if (!player) {
      return NextResponse.json({ available: true, matchedProductId: null, parallels: [], setName: null });
    }

    const match = await matchSportsCardLocal({
      playerName: player,
      year: ci.year || ci.release_date,
      setName: ci.set_name || ci.card_set,
      cardNumber: ci.card_number_raw || ci.card_number,
      variant: ci.parallel_type,
      subset: ci.subset,
      serialNumbering: ci.serial_numbering,
      sport: card.category,
    });

    return NextResponse.json({
      available: true,
      matchedProductId: match.product?.id || null,
      parallels: match.family.map(toParallelRow),
      setName: match.matchedSet?.console_name || match.family[0]?.console_name || null,
    });
  } catch (err) {
    console.error('[sports-parallels] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
