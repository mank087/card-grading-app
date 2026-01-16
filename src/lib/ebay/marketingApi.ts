/**
 * eBay Marketing API Helper
 *
 * Handles Promoted Listings functionality including:
 * - Checking seller eligibility for advertising
 * - Getting suggested ad rates
 * - Creating campaigns and adding ads
 */

import { EBAY_API_URLS } from './constants';

// =============================================================================
// Types
// =============================================================================

export interface AdvertisingEligibility {
  eligible: boolean;
  reason?: string;
  reasonCode?: 'NOT_ENOUGH_ACTIVITY' | 'NOT_IN_GOOD_STANDING' | 'RESTRICTED';
}

export interface SuggestedAdRate {
  listingId: string;
  suggestedBidPercentage: number;
  trendingBidPercentage: number;
  promoteWithAd: 'RECOMMENDED' | 'UNDETERMINED';
}

export interface CreateCampaignResult {
  success: boolean;
  campaignId?: string;
  error?: string;
}

export interface CreateAdResult {
  success: boolean;
  adId?: string;
  error?: string;
}

export interface PromotedListingResult {
  success: boolean;
  campaignId?: string;
  adId?: string;
  error?: string;
}

// =============================================================================
// API Endpoints
// =============================================================================

const getApiBase = (sandbox: boolean) =>
  sandbox ? EBAY_API_URLS.sandbox.api : EBAY_API_URLS.production.api;

// =============================================================================
// Check Advertising Eligibility
// =============================================================================

/**
 * Check if a seller is eligible for Promoted Listings
 * Uses the Account API's getAdvertisingEligibility method
 */
export async function getAdvertisingEligibility(
  accessToken: string,
  sandbox: boolean = false
): Promise<AdvertisingEligibility> {
  const apiBase = getApiBase(sandbox);

  try {
    const response = await fetch(
      `${apiBase}/sell/account/v1/advertising_eligibility?program_types=PROMOTED_LISTINGS`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Marketing API] getAdvertisingEligibility failed:', response.status, errorText);

      // If 403, likely missing marketing scope
      if (response.status === 403) {
        return {
          eligible: false,
          reason: 'Missing marketing permissions. Please reconnect your eBay account.',
          reasonCode: 'RESTRICTED',
        };
      }

      // If 404, the endpoint might not exist for this marketplace/account type
      if (response.status === 404) {
        return {
          eligible: false,
          reason: 'Promoted Listings is not available for your account type.',
        };
      }

      // Parse error details if available
      let errorDetail = '';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.errors?.[0]?.message || errorJson.message || '';
      } catch {
        errorDetail = errorText.substring(0, 100);
      }

      return {
        eligible: false,
        reason: `Unable to check eligibility (${response.status}${errorDetail ? ': ' + errorDetail : ''})`,
      };
    }

    const data = await response.json();
    console.log('[Marketing API] Eligibility response:', JSON.stringify(data));

    // Parse the response - structure varies based on eligibility
    // The API returns an array of program eligibilities
    const promotedListings = data.advertisingEligibility?.find(
      (p: any) => p.programType === 'PROMOTED_LISTINGS'
    );

    if (!promotedListings) {
      return {
        eligible: false,
        reason: 'Promoted Listings program not available',
      };
    }

    if (promotedListings.status === 'ELIGIBLE') {
      return { eligible: true };
    }

    // Map ineligibility reasons
    const reasonMap: Record<string, string> = {
      NOT_ENOUGH_ACTIVITY: 'Your account needs more activity. New accounts typically become eligible within a few weeks.',
      NOT_IN_GOOD_STANDING: 'Your account must be Above Standard or Top Rated to use Promoted Listings.',
      RESTRICTED: 'Your account is not approved for Promoted Listings.',
    };

    return {
      eligible: false,
      reason: reasonMap[promotedListings.reason] || promotedListings.reason || 'Not eligible for Promoted Listings',
      reasonCode: promotedListings.reason,
    };
  } catch (error) {
    console.error('[Marketing API] getAdvertisingEligibility error:', error);
    return {
      eligible: false,
      reason: `Failed to check eligibility: ${error instanceof Error ? error.message : 'Network error'}`,
    };
  }
}

// =============================================================================
// Get Suggested Ad Rate
// =============================================================================

/**
 * Get suggested ad rate for a listing using the Recommendation API
 * Note: This requires the listing to already exist on eBay
 */
export async function getSuggestedAdRate(
  accessToken: string,
  listingId: string,
  sandbox: boolean = false
): Promise<SuggestedAdRate | null> {
  const apiBase = getApiBase(sandbox);

  try {
    const response = await fetch(
      `${apiBase}/sell/recommendation/v1/find?filter=recommendationTypes:{AD}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        body: JSON.stringify({
          listingIds: [listingId],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Marketing API] getSuggestedAdRate failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('[Marketing API] Recommendation response:', JSON.stringify(data));

    // Find the recommendation for our listing
    const recommendation = data.listingRecommendations?.find(
      (r: any) => r.listingId === listingId
    );

    if (!recommendation?.marketing?.ad) {
      // Return default trending rate if no specific recommendation
      return {
        listingId,
        suggestedBidPercentage: 10, // Default 10%
        trendingBidPercentage: 10,
        promoteWithAd: 'UNDETERMINED',
      };
    }

    const ad = recommendation.marketing.ad;

    // Get the ITEM (personalized) rate or fall back to TRENDING
    const itemRate = ad.bidPercentages?.find((b: any) => b.basisType === 'ITEM');
    const trendingRate = ad.bidPercentages?.find((b: any) => b.basisType === 'TRENDING');

    return {
      listingId,
      suggestedBidPercentage: itemRate?.value || trendingRate?.value || 10,
      trendingBidPercentage: trendingRate?.value || 10,
      promoteWithAd: ad.promoteWithAd || 'UNDETERMINED',
    };
  } catch (error) {
    console.error('[Marketing API] getSuggestedAdRate error:', error);
    return null;
  }
}

/**
 * Get trending ad rate for a category (doesn't require listing to exist)
 * This uses a general category lookup
 */
export async function getTrendingAdRate(
  accessToken: string,
  categoryId: string,
  sandbox: boolean = false
): Promise<number> {
  // For now, return a reasonable default based on typical trading card rates
  // eBay's average for collectibles is around 8-12%
  const defaultRates: Record<string, number> = {
    '261328': 10, // Sports Trading Cards
    '183050': 8,  // Non-Sport Trading Cards
    '183454': 12, // CCG Individual Cards (Pokemon, MTG, etc.)
  };

  return defaultRates[categoryId] || 10;
}

// =============================================================================
// Create Campaign
// =============================================================================

/**
 * Create a Promoted Listings campaign with CPS (Cost Per Sale) funding model
 */
export async function createCampaign(
  accessToken: string,
  campaignName: string,
  sandbox: boolean = false
): Promise<CreateCampaignResult> {
  const apiBase = getApiBase(sandbox);

  try {
    const response = await fetch(`${apiBase}/sell/marketing/v1/ad_campaign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
      body: JSON.stringify({
        campaignName,
        marketplaceId: 'EBAY_US',
        // CPS (Cost Per Sale) uses SALE funding model
        fundingStrategy: {
          fundingModel: 'COST_PER_SALE',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Marketing API] createCampaign failed:', response.status, errorText);
      return {
        success: false,
        error: `Failed to create campaign: ${response.status}`,
      };
    }

    // Campaign ID is in the Location header
    const locationHeader = response.headers.get('Location');
    const campaignId = locationHeader?.split('/').pop();

    if (!campaignId) {
      return {
        success: false,
        error: 'Campaign created but ID not returned',
      };
    }

    console.log('[Marketing API] Campaign created:', campaignId);

    return {
      success: true,
      campaignId,
    };
  } catch (error) {
    console.error('[Marketing API] createCampaign error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Add Ad to Campaign
// =============================================================================

/**
 * Add a listing as an ad to an existing campaign
 */
export async function createAd(
  accessToken: string,
  campaignId: string,
  listingId: string,
  bidPercentage: number,
  sandbox: boolean = false
): Promise<CreateAdResult> {
  const apiBase = getApiBase(sandbox);

  try {
    const response = await fetch(
      `${apiBase}/sell/marketing/v1/ad_campaign/${campaignId}/ad`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        body: JSON.stringify({
          listingId,
          bidPercentage: bidPercentage.toString(),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Marketing API] createAd failed:', response.status, errorText);
      return {
        success: false,
        error: `Failed to create ad: ${response.status}`,
      };
    }

    // Ad ID is in the Location header
    const locationHeader = response.headers.get('Location');
    const adId = locationHeader?.split('/').pop();

    console.log('[Marketing API] Ad created:', adId);

    return {
      success: true,
      adId: adId || undefined,
    };
  } catch (error) {
    console.error('[Marketing API] createAd error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Find or Create DCM Campaign
// =============================================================================

/**
 * Find an existing DCM campaign or create a new one
 */
export async function findOrCreateDcmCampaign(
  accessToken: string,
  sandbox: boolean = false
): Promise<CreateCampaignResult> {
  const apiBase = getApiBase(sandbox);
  const dcmCampaignName = 'DCM Graded Cards';

  try {
    // First, try to find an existing DCM campaign
    const searchResponse = await fetch(
      `${apiBase}/sell/marketing/v1/ad_campaign?campaign_name=${encodeURIComponent(dcmCampaignName)}&campaign_status=RUNNING,PAUSED`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      }
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      const existingCampaign = data.campaigns?.find(
        (c: any) => c.campaignName === dcmCampaignName
      );

      if (existingCampaign) {
        console.log('[Marketing API] Found existing DCM campaign:', existingCampaign.campaignId);
        return {
          success: true,
          campaignId: existingCampaign.campaignId,
        };
      }
    }

    // No existing campaign found, create a new one
    console.log('[Marketing API] Creating new DCM campaign');
    return await createCampaign(accessToken, dcmCampaignName, sandbox);
  } catch (error) {
    console.error('[Marketing API] findOrCreateDcmCampaign error:', error);
    // Fall back to creating a new campaign
    return await createCampaign(accessToken, dcmCampaignName, sandbox);
  }
}

// =============================================================================
// Promote Listing (High-level function)
// =============================================================================

/**
 * High-level function to promote a listing with Promoted Listings
 * Creates/finds campaign and adds the listing as an ad
 */
export async function promoteListing(
  accessToken: string,
  listingId: string,
  bidPercentage: number,
  sandbox: boolean = false
): Promise<PromotedListingResult> {
  try {
    // Find or create the DCM campaign
    const campaignResult = await findOrCreateDcmCampaign(accessToken, sandbox);

    if (!campaignResult.success || !campaignResult.campaignId) {
      return {
        success: false,
        error: campaignResult.error || 'Failed to create campaign',
      };
    }

    // Add the listing as an ad
    const adResult = await createAd(
      accessToken,
      campaignResult.campaignId,
      listingId,
      bidPercentage,
      sandbox
    );

    if (!adResult.success) {
      return {
        success: false,
        campaignId: campaignResult.campaignId,
        error: adResult.error || 'Failed to create ad',
      };
    }

    return {
      success: true,
      campaignId: campaignResult.campaignId,
      adId: adResult.adId,
    };
  } catch (error) {
    console.error('[Marketing API] promoteListing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
