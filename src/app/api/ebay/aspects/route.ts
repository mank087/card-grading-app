/**
 * eBay Item Aspects/Specifics API
 *
 * Fetches the required and recommended item specifics for a category
 * from the eBay Taxonomy API.
 *
 * GET /api/ebay/aspects?category_id=183454
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { EBAY_API_URLS } from '@/lib/ebay/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// eBay category tree ID for US marketplace
const EBAY_US_CATEGORY_TREE_ID = '0';

export interface EbayAspect {
  localizedAspectName: string;
  aspectConstraint: {
    aspectRequired: boolean;
    aspectMode: 'FREE_TEXT' | 'SELECTION_ONLY';
    aspectDataType: 'STRING' | 'NUMBER' | 'DATE' | 'STRING_ARRAY';
    itemToAspectCardinality: 'SINGLE' | 'MULTI';
  };
  aspectValues?: Array<{
    localizedValue: string;
  }>;
}

export interface AspectsResponse {
  aspects: EbayAspect[];
  categoryId: string;
  categoryName?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get category_id from query params
    const categoryId = request.nextUrl.searchParams.get('category_id');

    if (!categoryId) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = getAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get eBay connection
    let connection = await getConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json(
        { error: 'No eBay account connected' },
        { status: 400 }
      );
    }

    // Refresh token if needed
    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to refresh eBay authorization' },
        { status: 401 }
      );
    }

    // Fetch aspects from eBay Taxonomy API
    const baseUrl = connection.is_sandbox
      ? EBAY_API_URLS.sandbox.api
      : EBAY_API_URLS.production.api;

    const taxonomyUrl = `${baseUrl}/commerce/taxonomy/v1/category_tree/${EBAY_US_CATEGORY_TREE_ID}/get_item_aspects_for_category?category_id=${categoryId}`;

    const response = await fetch(taxonomyUrl, {
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[eBay Aspects] Failed to fetch aspects:', errorText);

      // Return default aspects for known categories if API fails
      const defaultAspects = getDefaultAspectsForCategory(categoryId);
      if (defaultAspects) {
        return NextResponse.json({
          aspects: defaultAspects,
          categoryId,
          fromDefaults: true,
        });
      }

      return NextResponse.json(
        { error: 'Failed to fetch item aspects from eBay' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform and filter relevant aspects
    const aspects: EbayAspect[] = (data.aspects || [])
      .filter((aspect: any) => {
        // Include required aspects and commonly used recommended ones
        return aspect.aspectConstraint?.aspectRequired ||
          isRecommendedTradingCardAspect(aspect.localizedAspectName);
      })
      .map((aspect: any) => ({
        localizedAspectName: aspect.localizedAspectName,
        aspectConstraint: {
          aspectRequired: aspect.aspectConstraint?.aspectRequired || false,
          aspectMode: aspect.aspectConstraint?.aspectMode || 'FREE_TEXT',
          aspectDataType: aspect.aspectConstraint?.aspectDataType || 'STRING',
          itemToAspectCardinality: aspect.aspectConstraint?.itemToAspectCardinality || 'SINGLE',
        },
        aspectValues: aspect.aspectValues?.slice(0, 50), // Limit dropdown values
      }));

    return NextResponse.json({
      aspects,
      categoryId,
    });
  } catch (error) {
    console.error('[eBay Aspects] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Check if an aspect name is commonly used for trading cards
 */
function isRecommendedTradingCardAspect(name: string): boolean {
  const recommendedAspects = [
    'sport', 'player', 'athlete', 'team', 'manufacturer', 'brand',
    'set', 'year', 'season', 'card number', 'card name', 'type',
    'features', 'rarity', 'parallel', 'character', 'game',
    'language', 'autographed', 'autograph authentication',
    'league', 'era', 'vintage', 'material', 'insert set',
  ];

  const lowerName = name.toLowerCase();
  return recommendedAspects.some(aspect => lowerName.includes(aspect));
}

/**
 * Get default aspects for known trading card categories
 * Used as fallback if Taxonomy API fails
 */
function getDefaultAspectsForCategory(categoryId: string): EbayAspect[] | null {
  const sportsCardAspects: EbayAspect[] = [
    { localizedAspectName: 'Sport', aspectConstraint: { aspectRequired: true, aspectMode: 'SELECTION_ONLY', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Player/Athlete', aspectConstraint: { aspectRequired: true, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'MULTI' } },
    { localizedAspectName: 'Team', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Manufacturer', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Set', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Year Manufactured', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Season', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Card Number', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Card Name', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Features', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'MULTI' } },
    { localizedAspectName: 'Parallel/Variety', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Autographed', aspectConstraint: { aspectRequired: false, aspectMode: 'SELECTION_ONLY', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' }, aspectValues: [{ localizedValue: 'Yes' }, { localizedValue: 'No' }] },
    { localizedAspectName: 'League', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
  ];

  const ccgCardAspects: EbayAspect[] = [
    { localizedAspectName: 'Game', aspectConstraint: { aspectRequired: true, aspectMode: 'SELECTION_ONLY', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Character', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'MULTI' } },
    { localizedAspectName: 'Set', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Rarity', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Card Number', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Card Name', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Manufacturer', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Year Manufactured', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Language', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Features', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'MULTI' } },
    { localizedAspectName: 'Finish', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Autographed', aspectConstraint: { aspectRequired: false, aspectMode: 'SELECTION_ONLY', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' }, aspectValues: [{ localizedValue: 'Yes' }, { localizedValue: 'No' }] },
  ];

  const nonSportAspects: EbayAspect[] = [
    { localizedAspectName: 'Type', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Subject', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'MULTI' } },
    { localizedAspectName: 'Card Name', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Set', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Manufacturer', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Year Manufactured', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Card Number', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Features', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'MULTI' } },
    { localizedAspectName: 'Language', aspectConstraint: { aspectRequired: false, aspectMode: 'FREE_TEXT', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' } },
    { localizedAspectName: 'Autographed', aspectConstraint: { aspectRequired: false, aspectMode: 'SELECTION_ONLY', aspectDataType: 'STRING', itemToAspectCardinality: 'SINGLE' }, aspectValues: [{ localizedValue: 'Yes' }, { localizedValue: 'No' }] },
  ];

  switch (categoryId) {
    case '261328': // Sports Trading Card Singles
      return sportsCardAspects;
    case '183454': // CCG Individual Cards (Pokemon, MTG, etc.)
      return ccgCardAspects;
    case '183050': // Non-Sport Trading Card Singles
      return nonSportAspects;
    default:
      return null;
  }
}
