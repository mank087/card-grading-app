/**
 * eBay Integration TypeScript Types
 */

// =============================================================================
// Database Types
// =============================================================================

export interface EbayConnection {
  id: string;
  user_id: string;
  ebay_user_id: string;
  ebay_username: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  refresh_token_expires_at: string | null;
  scopes: string[];
  marketplace_id: string;
  is_sandbox: boolean;
  connected_at: string;
  last_used_at: string | null;
  last_token_refresh_at: string | null;
}

export interface EbayInventoryLocation {
  id: string;
  user_id: string;
  location_id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EbayListing {
  id: string;
  card_id: string;
  user_id: string;
  sku: string;
  inventory_item_group_key: string | null;
  offer_id: string | null;
  listing_id: string | null;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  quantity: number;
  listing_format: 'FIXED_PRICE' | 'AUCTION';
  duration: string | null;
  category_id: string;
  fulfillment_policy_id: string | null;
  payment_policy_id: string | null;
  return_policy_id: string | null;
  ebay_image_urls: string[];
  status: EbayListingStatus;
  listing_url: string | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  ended_at: string | null;
  sold_at: string | null;
}

export type EbayListingStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'ended'
  | 'sold'
  | 'cancelled'
  | 'error';

export interface EbayUserPolicy {
  id: string;
  user_id: string;
  policy_type: 'fulfillment' | 'payment' | 'return';
  policy_id: string;
  name: string;
  description: string | null;
  policy_data: Record<string, any> | null;
  is_default: boolean;
  cached_at: string;
}

// =============================================================================
// OAuth Types
// =============================================================================

export interface EbayTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
  refresh_token_expires_in?: number; // seconds
}

export interface EbayAuthState {
  user_id: string;
  return_url?: string;
  timestamp: number;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface CreateListingRequest {
  cardId: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  quantity?: number;
  listingFormat: 'FIXED_PRICE' | 'AUCTION';
  duration?: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

export interface EbayInventoryItem {
  sku: string;
  product: {
    title: string;
    description: string;
    imageUrls: string[];
    aspects?: Record<string, string[]>;
  };
  condition: string;
  conditionDescriptors: Array<{
    name: string;
    values: string[];
  }>;
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
}

export interface EbayOffer {
  sku: string;
  marketplaceId: string;
  format: string;
  listingDuration?: string;
  pricingSummary: {
    price: {
      value: string;
      currency: string;
    };
    minimumAdvertisedPrice?: {
      value: string;
      currency: string;
    };
  };
  listingPolicies: {
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
  };
  categoryId: string;
  merchantLocationKey?: string;
}

export interface EbayPolicy {
  policyId: string;
  name: string;
  description?: string;
  marketplaceId?: string;
}

export interface EbayFulfillmentPolicy extends EbayPolicy {
  shippingOptions: Array<{
    costType: string;
    shippingServices: Array<{
      shippingCarrierCode: string;
      shippingServiceCode: string;
      freeShipping?: boolean;
      shippingCost?: {
        value: string;
        currency: string;
      };
    }>;
  }>;
}

export interface EbayReturnPolicy extends EbayPolicy {
  returnsAccepted: boolean;
  returnPeriod?: {
    value: number;
    unit: string;
  };
  returnShippingCostPayer?: string;
}

export interface EbayPaymentPolicy extends EbayPolicy {
  paymentMethods: Array<{
    paymentMethodType: string;
  }>;
}

// =============================================================================
// Card Data Types (for listing creation)
// =============================================================================

export interface CardForEbayListing {
  id: string;
  serial: string;
  category: string;
  card_name: string | null;
  card_set: string | null;
  card_number: string | null;
  release_date: string | null;
  featured: string | null;
  pokemon_featured: string | null;
  conversational_decimal_grade: number | null;
  conversational_whole_grade: number | null;
  conversational_condition_label: string | null;
  conversational_summary: string | null;
  conversational_sub_scores: {
    centering?: { weighted?: number };
    corners?: { weighted?: number };
    edges?: { weighted?: number };
    surface?: { weighted?: number };
  } | null;
  front_url: string | null;
  back_url: string | null;
}

// =============================================================================
// Error Types
// =============================================================================

export interface EbayApiError {
  errorId: number;
  domain: string;
  category: string;
  message: string;
  longMessage?: string;
  parameters?: Array<{
    name: string;
    value: string;
  }>;
}

export interface EbayErrorResponse {
  errors: EbayApiError[];
  warnings?: EbayApiError[];
}

// =============================================================================
// Listing Status Types
// =============================================================================

export interface ListingStatusUpdate {
  listingId: string;
  status: EbayListingStatus;
  errorMessage?: string;
  errorCode?: string;
  listingUrl?: string;
  endedAt?: string;
  soldAt?: string;
}
