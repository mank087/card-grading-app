/**
 * eBay Listing API
 *
 * Creates eBay listings for graded cards. This handles the full flow:
 * 1. Create/update inventory item
 * 2. Create offer
 * 3. Optionally publish the offer
 *
 * POST /api/ebay/listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import {
  EBAY_CONDITIONS,
  CONDITION_DESCRIPTORS,
  DCM_GRADER_ID,
  getEbayGradeId,
  DCM_TO_EBAY_CATEGORY,
  EBAY_CATEGORIES,
  MARKETPLACES,
  LISTING_FORMATS,
  EBAY_API_URLS,
} from '@/lib/ebay/constants';
import type { CardForEbayListing, EbayListing } from '@/lib/ebay/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

interface ItemSpecific {
  name: string;
  value: string | string[];
}

interface CreateListingRequest {
  cardId: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  quantity?: number;
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
  bestOfferEnabled?: boolean;  // Allow Best Offer (only for FIXED_PRICE)
  duration?: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  imageUrls: string[];  // Already uploaded to Supabase
  itemSpecifics?: ItemSpecific[];  // Category-specific attributes
  publish?: boolean;    // Whether to publish immediately
}

interface ListingResponse {
  success: boolean;
  listingId?: string;
  sku: string;
  offerId?: string;
  listingUrl?: string;
  status: string;
  error?: string;
}

/**
 * Generate a unique SKU for the listing
 */
function generateSku(cardId: string, userId: string): string {
  const timestamp = Date.now().toString(36);
  const shortUserId = userId.slice(0, 8);
  return `DCM-${shortUserId}-${cardId.slice(0, 8)}-${timestamp}`.toUpperCase();
}

/**
 * Get eBay category ID for a card
 */
function getEbayCategoryId(category: string): string {
  return DCM_TO_EBAY_CATEGORY[category] || EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS;
}

/**
 * Make authenticated request to eBay API
 */
async function ebayRequest(
  endpoint: string,
  method: string,
  accessToken: string,
  body?: object,
  sandbox: boolean = true
): Promise<Response> {
  const baseUrl = sandbox
    ? EBAY_API_URLS.sandbox.api
    : EBAY_API_URLS.production.api;

  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

export async function POST(request: NextRequest) {
  try {
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

    // Get eBay connection and refresh token if needed
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
        { error: 'Failed to refresh eBay authorization. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateListingRequest = await request.json();
    const {
      cardId,
      title,
      description,
      price,
      currency = 'USD',
      quantity = 1,
      listingFormat = 'FIXED_PRICE',
      bestOfferEnabled = false,
      duration,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      imageUrls,
      itemSpecifics = [],
      publish = false,
    } = body;

    // Validate required fields
    if (!cardId || !title || !price || !imageUrls?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: cardId, title, price, imageUrls' },
        { status: 400 }
      );
    }

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
      return NextResponse.json(
        { error: 'Missing required policy IDs' },
        { status: 400 }
      );
    }

    // Fetch card data
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id,
        serial,
        category,
        card_name,
        card_set,
        card_number,
        release_date,
        featured,
        pokemon_featured,
        conversational_decimal_grade,
        conversational_whole_grade,
        conversational_condition_label,
        conversational_summary,
        conversational_sub_scores,
        front_url,
        back_url,
        user_id
      `)
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      console.error('[eBay Listing] Card not found:', cardError);
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Verify card belongs to user
    if (card.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to list this card' },
        { status: 403 }
      );
    }

    // Generate SKU
    const sku = generateSku(cardId, user.id);

    // Get eBay category
    const categoryId = getEbayCategoryId(card.category);

    // Get grade ID for condition descriptors
    const grade = card.conversational_whole_grade || card.conversational_decimal_grade || 1;
    const gradeId = getEbayGradeId(grade);

    // Format item specifics for eBay API
    // eBay expects: aspects: { "Name": ["Value1", "Value2"], ... }
    const aspects: Record<string, string[]> = {};
    for (const spec of itemSpecifics) {
      if (spec.name && spec.value) {
        const values = Array.isArray(spec.value) ? spec.value : [spec.value];
        // Filter out empty values
        const filteredValues = values.filter(v => v && v.trim());
        if (filteredValues.length > 0) {
          aspects[spec.name] = filteredValues;
        }
      }
    }

    // Build inventory item payload
    const inventoryItem: Record<string, any> = {
      availability: {
        shipToLocationAvailability: {
          quantity: quantity,
        },
      },
      condition: EBAY_CONDITIONS.GRADED,
      conditionDescriptors: [
        {
          name: CONDITION_DESCRIPTORS.PROFESSIONAL_GRADER,
          values: [DCM_GRADER_ID], // "Other" grader for DCM
        },
        {
          name: CONDITION_DESCRIPTORS.GRADE,
          values: [gradeId],
        },
        {
          name: CONDITION_DESCRIPTORS.CERTIFICATION_NUMBER,
          values: [card.serial],
        },
      ],
      product: {
        title: title,
        description: description || card.conversational_summary || `DCM Graded ${card.card_name || 'Trading Card'} - Grade ${grade}`,
        imageUrls: imageUrls,
        // Include item specifics as aspects
        ...(Object.keys(aspects).length > 0 && { aspects }),
      },
    };

    console.log('[eBay Listing] Creating inventory item:', { sku, categoryId });

    // Step 1: Create/Update Inventory Item
    const inventoryResponse = await ebayRequest(
      `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
      'PUT',
      connection.access_token,
      inventoryItem,
      connection.is_sandbox
    );

    if (!inventoryResponse.ok) {
      const errorData = await inventoryResponse.text();
      console.error('[eBay Listing] Inventory item creation failed:', errorData);
      return NextResponse.json(
        { error: `Failed to create inventory item: ${inventoryResponse.status}`, details: errorData },
        { status: inventoryResponse.status }
      );
    }

    // Step 2: Create Offer
    const offer: Record<string, any> = {
      sku: sku,
      marketplaceId: MARKETPLACES.US,
      format: listingFormat,
      listingDuration: duration,
      pricingSummary: {
        price: {
          value: price.toFixed(2),
          currency: currency,
        },
      },
      listingPolicies: {
        fulfillmentPolicyId: fulfillmentPolicyId,
        paymentPolicyId: paymentPolicyId,
        returnPolicyId: returnPolicyId,
        // Enable Best Offer for Fixed Price listings
        ...(listingFormat === 'FIXED_PRICE' && bestOfferEnabled && {
          bestOfferTerms: {
            bestOfferEnabled: true,
          },
        }),
      },
      categoryId: categoryId,
    };

    console.log('[eBay Listing] Creating offer:', { sku, marketplaceId: MARKETPLACES.US });

    const offerResponse = await ebayRequest(
      '/sell/inventory/v1/offer',
      'POST',
      connection.access_token,
      offer,
      connection.is_sandbox
    );

    if (!offerResponse.ok) {
      const errorData = await offerResponse.text();
      console.error('[eBay Listing] Offer creation failed:', errorData);
      return NextResponse.json(
        { error: `Failed to create offer: ${offerResponse.status}`, details: errorData },
        { status: offerResponse.status }
      );
    }

    const offerData = await offerResponse.json();
    const offerId = offerData.offerId;

    console.log('[eBay Listing] Offer created:', { offerId });

    // Store listing record in database
    const listingRecord: Partial<EbayListing> = {
      card_id: cardId,
      user_id: user.id,
      sku: sku,
      offer_id: offerId,
      title: title,
      description: description || null,
      price: price,
      currency: currency,
      quantity: quantity,
      listing_format: listingFormat,
      duration: duration || null,
      category_id: categoryId,
      fulfillment_policy_id: fulfillmentPolicyId,
      payment_policy_id: paymentPolicyId,
      return_policy_id: returnPolicyId,
      ebay_image_urls: imageUrls,
      status: 'draft',
    };

    let listingId: string | undefined;
    let listingUrl: string | undefined;

    // Step 3: Publish if requested
    if (publish) {
      console.log('[eBay Listing] Publishing offer:', offerId);

      const publishResponse = await ebayRequest(
        `/sell/inventory/v1/offer/${offerId}/publish`,
        'POST',
        connection.access_token,
        undefined,
        connection.is_sandbox
      );

      if (!publishResponse.ok) {
        const errorData = await publishResponse.text();
        console.error('[eBay Listing] Publish failed:', errorData);

        // Save as draft with error
        listingRecord.status = 'error';
        listingRecord.error_message = `Publish failed: ${errorData}`;
      } else {
        const publishData = await publishResponse.json();
        listingId = publishData.listingId;

        // Build listing URL
        const baseUrl = connection.is_sandbox
          ? 'https://sandbox.ebay.com/itm'
          : 'https://www.ebay.com/itm';
        listingUrl = `${baseUrl}/${listingId}`;

        listingRecord.listing_id = listingId;
        listingRecord.listing_url = listingUrl;
        listingRecord.status = 'active';
        listingRecord.published_at = new Date().toISOString();

        console.log('[eBay Listing] Published successfully:', { listingId, listingUrl });
      }
    }

    // Save to database
    const { data: savedListing, error: saveError } = await supabase
      .from('ebay_listings')
      .insert(listingRecord)
      .select()
      .single();

    if (saveError) {
      console.error('[eBay Listing] Failed to save listing record:', saveError);
      // Don't fail the request - the eBay listing was created successfully
    }

    const response: ListingResponse = {
      success: true,
      sku,
      offerId,
      listingId,
      listingUrl,
      status: listingRecord.status as string,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[eBay Listing] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
