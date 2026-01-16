/**
 * eBay Listing API (Trading API)
 *
 * Creates eBay listings for graded cards using the Trading API.
 * This allows inline shipping/payment/return details without
 * creating permanent business policies on the seller's account.
 *
 * POST /api/ebay/listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import {
  EBAY_CONDITIONS,
  DCM_GRADER_ID,
  getEbayGradeId,
  DCM_TO_EBAY_CATEGORY,
  EBAY_CATEGORIES,
} from '@/lib/ebay/constants';
import {
  addFixedPriceItem,
  type TradingApiConfig,
  type ListingDetails,
  type ShippingDetails,
  type ReturnDetails,
  type PackageDimensions,
} from '@/lib/ebay/tradingApi';
import type { EbayListing } from '@/lib/ebay/types';

// Create Supabase client with explicit env var handling
function getSupabaseClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !key) {
    console.error('[eBay Listing] Missing Supabase config:', { hasUrl: !!url, hasKey: !!key });
  }

  return createClient(url, key);
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
  quantity?: number;
  bestOfferEnabled?: boolean;
  duration?: string;
  imageUrls: string[];
  itemSpecifics?: ItemSpecific[];

  // Shipping options
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED';
  domesticShippingService: string;
  flatRateAmount?: number;
  handlingDays: number;
  postalCode: string;

  // Package dimensions
  packageWeightOz: number;
  packageLengthIn: number;
  packageWidthIn: number;
  packageDepthIn: number;

  // International shipping
  offerInternational: boolean;
  internationalShippingType?: 'FLAT_RATE' | 'CALCULATED';
  internationalShippingService?: string;
  internationalFlatRateCost?: number;
  internationalShipToLocations?: string[];

  // Domestic return options
  domesticReturnsAccepted: boolean;
  domesticReturnPeriodDays?: number;
  domesticReturnShippingPaidBy?: 'BUYER' | 'SELLER';

  // International return options
  internationalReturnsAccepted: boolean;
  internationalReturnPeriodDays?: number;
  internationalReturnShippingPaidBy?: 'BUYER' | 'SELLER';

  // Regulatory documents (Certificate of Analysis, etc.)
  regulatoryDocumentIds?: string[];
}

interface ListingResponse {
  success: boolean;
  listingId?: string;
  sku: string;
  listingUrl?: string;
  status: string;
  fees?: Array<{ name: string; amount: number }>;
  warnings?: Array<{ code: string; message: string }>;
  error?: string;
  errors?: Array<{ code: string; message: string }>;
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
 * Map listing duration to Trading API format
 */
function mapListingDuration(duration?: string): string {
  switch (duration) {
    case 'DAYS_3': return 'Days_3';
    case 'DAYS_5': return 'Days_5';
    case 'DAYS_7': return 'Days_7';
    case 'DAYS_10': return 'Days_10';
    case 'DAYS_30': return 'Days_30';
    case 'GTC':
    default:
      return 'GTC';
  }
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
    const supabase = getSupabaseClient();

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
      quantity = 1,
      bestOfferEnabled = false,
      duration,
      imageUrls,
      itemSpecifics = [],
      // Shipping
      shippingType = 'CALCULATED',
      domesticShippingService = 'USPSPriority',
      flatRateAmount = 5.00,
      handlingDays = 1,
      postalCode = '10001',
      // Package dimensions (defaults for small bubble mailer)
      packageWeightOz = 4,
      packageLengthIn = 10,
      packageWidthIn = 6,
      packageDepthIn = 1,
      // International shipping
      offerInternational = false,
      internationalShippingType = 'CALCULATED',
      internationalShippingService = 'USPSPriorityMailInternational',
      internationalFlatRateCost = 15.00,
      internationalShipToLocations = ['Worldwide'],
      // Domestic returns
      domesticReturnsAccepted = false,
      domesticReturnPeriodDays = 30,
      domesticReturnShippingPaidBy = 'BUYER',
      // International returns
      internationalReturnsAccepted = false,
      internationalReturnPeriodDays = 30,
      internationalReturnShippingPaidBy = 'BUYER',
      // Regulatory documents
      regulatoryDocumentIds = [],
    } = body;

    // Validate required fields
    if (!cardId || !title || !price || !imageUrls?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: cardId, title, price, imageUrls' },
        { status: 400 }
      );
    }

    // Validate postal code
    if (!postalCode || postalCode.length < 5) {
      return NextResponse.json(
        { error: 'Valid postal code is required for shipping' },
        { status: 400 }
      );
    }

    // Fetch card data
    console.log('[eBay Listing] Looking up card with ID:', cardId, 'Type:', typeof cardId);

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
      console.error('[eBay Listing] Card not found. ID:', cardId, 'Error:', cardError?.message, 'Code:', cardError?.code);
      return NextResponse.json(
        { error: 'Card not found', debug: { cardId, errorMessage: cardError?.message, errorCode: cardError?.code } },
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

    // Get grade for condition descriptors
    const grade = card.conversational_whole_grade || card.conversational_decimal_grade || 1;
    const gradeId = getEbayGradeId(grade);

    // Prepare Trading API config
    const tradingConfig: TradingApiConfig = {
      accessToken: connection.access_token,
      sandbox: connection.is_sandbox,
    };

    // Prepare listing details
    const listingDetails: ListingDetails = {
      title,
      description: description || card.conversational_summary || `DCM Graded ${card.card_name || 'Trading Card'} - Grade ${grade}`,
      categoryId,
      price,
      quantity,
      conditionId: EBAY_CONDITIONS.GRADED,
      imageUrls,
      itemSpecifics: itemSpecifics.map(spec => ({
        name: spec.name,
        value: spec.value,
      })),
      sku,
      listingDuration: mapListingDuration(duration),
      bestOfferEnabled,
      // Graded card specific
      professionalGrader: DCM_GRADER_ID,
      grade: gradeId,
      certificationNumber: card.serial,
      // Regulatory documents (Certificate of Analysis)
      regulatoryDocumentIds: regulatoryDocumentIds.length > 0 ? regulatoryDocumentIds : undefined,
    };

    // Prepare package dimensions
    const packageDimensions: PackageDimensions = {
      weightOz: packageWeightOz,
      lengthIn: packageLengthIn,
      widthIn: packageWidthIn,
      depthIn: packageDepthIn,
    };

    // Prepare shipping details
    const shippingDetails: ShippingDetails = {
      shippingType,
      domesticShippingService,
      flatRateCost: flatRateAmount,
      handlingDays,
      postalCode,
      packageDimensions,
      // International shipping
      offerInternational,
      internationalShippingType: offerInternational ? internationalShippingType : undefined,
      internationalShippingService: offerInternational ? internationalShippingService : undefined,
      internationalFlatRateCost: offerInternational && internationalShippingType === 'FLAT_RATE' ? internationalFlatRateCost : undefined,
      internationalShipToLocations: offerInternational ? internationalShipToLocations : undefined,
    };

    // Prepare return details
    const returnDetails: ReturnDetails = {
      domesticReturnsAccepted,
      domesticReturnPeriodDays: domesticReturnsAccepted ? domesticReturnPeriodDays : undefined,
      domesticReturnShippingPaidBy: domesticReturnsAccepted ? domesticReturnShippingPaidBy : undefined,
      internationalReturnsAccepted,
      internationalReturnPeriodDays: internationalReturnsAccepted ? internationalReturnPeriodDays : undefined,
      internationalReturnShippingPaidBy: internationalReturnsAccepted ? internationalReturnShippingPaidBy : undefined,
    };

    console.log('[eBay Listing] Creating listing via Trading API:', { sku, categoryId, title, shippingType, offerInternational });

    // Create listing via Trading API
    const result = await addFixedPriceItem(
      tradingConfig,
      listingDetails,
      shippingDetails,
      returnDetails
    );

    if (!result.success) {
      console.error('[eBay Listing] Trading API error:', result.errors);
      return NextResponse.json({
        success: false,
        error: result.errors?.[0]?.message || 'Failed to create listing',
        errors: result.errors,
        sku,
        status: 'error',
      }, { status: 400 });
    }

    console.log('[eBay Listing] Listing created successfully:', { itemId: result.itemId, listingUrl: result.listingUrl });

    // Store listing record in database
    const listingRecord: Partial<EbayListing> = {
      card_id: cardId,
      user_id: user.id,
      sku: sku,
      listing_id: result.itemId,
      listing_url: result.listingUrl,
      title: title,
      description: description || null,
      price: price,
      currency: 'USD',
      quantity: quantity,
      listing_format: 'FIXED_PRICE',
      duration: duration || 'GTC',
      category_id: categoryId,
      ebay_image_urls: imageUrls,
      status: 'active',
      published_at: new Date().toISOString(),
    };

    // Save to database
    const { error: saveError } = await supabase
      .from('ebay_listings')
      .insert(listingRecord);

    if (saveError) {
      console.error('[eBay Listing] Failed to save listing record:', saveError);
      // Don't fail the request - the eBay listing was created successfully
    }

    const response: ListingResponse = {
      success: true,
      sku,
      listingId: result.itemId,
      listingUrl: result.listingUrl,
      status: 'active',
      fees: result.fees,
      warnings: result.warnings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[eBay Listing] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: String(error) },
      { status: 500 }
    );
  }
}
