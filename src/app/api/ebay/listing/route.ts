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
import { supabaseServer } from '@/lib/supabaseServer';
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
  addAuctionItem,
  type TradingApiConfig,
  type ListingDetails,
  type ShippingDetails,
  type ReturnDetails,
  type PackageDimensions,
} from '@/lib/ebay/tradingApi';
import type { EbayListing } from '@/lib/ebay/types';

interface ItemSpecific {
  name: string;
  value: string | string[];
}

interface CreateListingRequest {
  cardId: string;
  title: string;
  description?: string;
  price: number;
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
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
  userAction?: string;
}

/**
 * Map eBay error codes/messages to user-friendly error messages
 * with actionable guidance
 */
function getEbayErrorDetails(error: { code?: string; message?: string }): {
  userMessage: string;
  userAction?: string;
} {
  const code = error?.code || '';
  const message = error?.message?.toLowerCase() || '';

  // Seller account not set up (code 120)
  if (code === '120' || message.includes('seller') && message.includes('account')) {
    return {
      userMessage: 'Your eBay seller account needs to be set up before you can create listings.',
      userAction: 'Please visit eBay.com → My eBay → Selling to complete your seller account setup. You may need to add a payment method and verify your identity.',
    };
  }

  // Account restrictions/suspensions
  if (message.includes('restriction') || message.includes('suspended') || message.includes('blocked')) {
    return {
      userMessage: 'Your eBay account has restrictions that prevent listing.',
      userAction: 'Please check your eBay account status and resolve any outstanding issues at eBay.com → My eBay → Account.',
    };
  }

  // Payment method issues
  if (message.includes('payment') || message.includes('paypal') || message.includes('managed payments')) {
    return {
      userMessage: 'Your eBay payment method needs to be configured.',
      userAction: 'Please set up or verify your payment method in eBay Seller Hub → Payments.',
    };
  }

  // Category-specific restrictions
  if (message.includes('category') || message.includes('approval') || message.includes('permission')) {
    return {
      userMessage: 'This item category requires special approval on eBay.',
      userAction: 'Some categories require seller approval. Check eBay\'s category requirements or try a different category.',
    };
  }

  // Verification required
  if (message.includes('verify') || message.includes('verification') || message.includes('identity')) {
    return {
      userMessage: 'eBay requires additional verification for your account.',
      userAction: 'Please complete the identity verification process at eBay.com → My eBay → Account.',
    };
  }

  // Default: return original message
  return {
    userMessage: error?.message || 'Failed to create eBay listing.',
    userAction: undefined,
  };
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
    case 'DAYS_1': return 'Days_1';
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
    const supabase = supabaseServer();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session', debug: { errorMsg: userError?.message } },
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
      grade: passedGrade,  // Grade passed from modal (preferred)
      title,
      description,
      price,
      listingFormat = 'FIXED_PRICE',
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

    console.log('[eBay Listing] listingFormat received:', listingFormat, '| raw body listingFormat:', body.listingFormat);

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
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      console.error('[eBay Listing] Card not found:', cardId, cardError?.message);
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

    // Check if card already has an active eBay listing
    const { data: existingListing } = await supabase
      .from('ebay_listings')
      .select('id, listing_id, listing_url, status')
      .eq('card_id', cardId)
      .eq('user_id', user.id)
      .in('status', ['active', 'pending'])
      .single();

    if (existingListing) {
      return NextResponse.json(
        {
          error: 'This card already has an active eBay listing',
          existingListing: {
            listingId: existingListing.listing_id,
            listingUrl: existingListing.listing_url,
            status: existingListing.status,
          },
        },
        { status: 409 } // Conflict
      );
    }

    // Generate SKU
    const sku = generateSku(cardId, user.id);

    // Get eBay category
    const categoryId = getEbayCategoryId(card.category);

    // Get grade for condition descriptors
    // PREFERRED: Use grade passed from modal (same grade shown in UI)
    // FALLBACK: Check multiple sources in the card data
    let grade: number;

    if (passedGrade !== null && passedGrade !== undefined && passedGrade > 0) {
      // Use grade passed from modal - this is the same grade displayed in the UI
      grade = passedGrade;
    } else {
      // Fallback: look up grade from card data
      const dvgGrading = card.ai_grading?.dvg_grading;
      const recommendedGrade = dvgGrading?.recommended_grade;
      grade =
        card.grade ??
        card.conversational_whole_grade ??
        card.conversational_decimal_grade ??
        card.dvg_whole_grade ??
        card.dvg_decimal_grade ??
        recommendedGrade?.recommended_whole_grade ??
        recommendedGrade?.recommended_decimal_grade ??
        card.dcm_grade_whole ??
        card.dcm_grade_decimal ??
        1;
    }

    const gradeId = getEbayGradeId(grade);

    // Prepare Trading API config
    const tradingConfig: TradingApiConfig = {
      accessToken: connection.access_token,
      sandbox: connection.is_sandbox,
    };

    // Prepare listing details
    const listingDetails: ListingDetails = {
      title,
      description: description || `DCM Graded ${card.card_name || 'Trading Card'} - Grade ${grade}`,
      categoryId,
      price,
      listingFormat,
      quantity: listingFormat === 'AUCTION' ? 1 : quantity,
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
      professionalGrader: DCM_GRADER_ID,  // '2750123' = "Other" grader
      grade: gradeId,                      // eBay grade value ID (e.g., '275020' for grade 10)
      // Certification number: DCM serial (REQUIRED by eBay for "Other" grader)
      certificationNumber: (() => {
        const serial = card.serial?.trim();
        const fallback = cardId.replace(/-/g, '').slice(0, 12).toUpperCase();
        return serial && serial.length > 0 ? serial : fallback;
      })(),
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

    // Create listing via Trading API
    const result = listingFormat === 'AUCTION'
      ? await addAuctionItem(tradingConfig, listingDetails, shippingDetails, returnDetails)
      : await addFixedPriceItem(tradingConfig, listingDetails, shippingDetails, returnDetails);

    if (!result.success) {
      console.error('[eBay Listing] Trading API error:', result.errors);

      // Map eBay error to user-friendly message with actionable guidance
      const firstError = result.errors?.[0];
      const errorDetails = getEbayErrorDetails(firstError || {});

      return NextResponse.json({
        success: false,
        error: errorDetails.userMessage,
        userAction: errorDetails.userAction,
        errors: result.errors,
        sku,
        status: 'error',
      }, { status: 400 });
    }

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
      listing_format: listingFormat,
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
