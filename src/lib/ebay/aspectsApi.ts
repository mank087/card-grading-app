/**
 * eBay Taxonomy API — required + recommended item aspects for a category.
 *
 * Lifted verbatim out of GET /api/ebay/aspects so a second caller can run it:
 * bulk batch creation fetches aspects ONCE per distinct eBay category (at most
 * three today — Sports / CCG / Non-Sport) and merges the required ones into
 * every row's item specifics, so a row's readiness knows about an unfilled
 * required aspect before anyone opens a drawer.
 *
 * The route is now a thin wrapper around `fetchCategoryAspects`; behaviour,
 * the recommended-aspect filter and the offline defaults are unchanged.
 */

import { EBAY_API_URLS } from '@/lib/ebay/constants';

/** eBay category tree ID for the US marketplace. */
export const EBAY_US_CATEGORY_TREE_ID = '0';

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

/** The eBay connection fields this module needs (post token refresh). */
export interface AspectsConnection {
  access_token: string;
  is_sandbox: boolean;
}

export type FetchAspectsResult =
  | { ok: true; aspects: EbayAspect[]; fromDefaults?: boolean }
  | { ok: false; status: number; message: string };

/**
 * Fetch and normalise the aspects for one eBay category. On an API failure
 * this falls back to the built-in defaults for the three trading-card
 * categories rather than leaving the seller with no specifics at all.
 */
export async function fetchCategoryAspects(
  connection: AspectsConnection,
  categoryId: string
): Promise<FetchAspectsResult> {
  const baseUrl = connection.is_sandbox
    ? EBAY_API_URLS.sandbox.api
    : EBAY_API_URLS.production.api;

  const taxonomyUrl = `${baseUrl}/commerce/taxonomy/v1/category_tree/${EBAY_US_CATEGORY_TREE_ID}/get_item_aspects_for_category?category_id=${categoryId}`;

  const response = await fetch(taxonomyUrl, {
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[eBay Aspects] Failed to fetch aspects:', errorText);

    const defaultAspects = getDefaultAspectsForCategory(categoryId);
    if (defaultAspects) {
      return { ok: true, aspects: defaultAspects, fromDefaults: true };
    }
    return {
      ok: false,
      status: response.status,
      message: 'Failed to fetch item aspects from eBay',
    };
  }

  const data = await response.json();

  const aspects: EbayAspect[] = (data.aspects || [])
    .filter((aspect: any) => {
      // Include required aspects and commonly used recommended ones
      return (
        aspect.aspectConstraint?.aspectRequired ||
        isRecommendedTradingCardAspect(aspect.localizedAspectName)
      );
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

  return { ok: true, aspects };
}

/**
 * Check if an aspect name is commonly used for trading cards
 */
export function isRecommendedTradingCardAspect(name: string): boolean {
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
export function getDefaultAspectsForCategory(categoryId: string): EbayAspect[] | null {
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
