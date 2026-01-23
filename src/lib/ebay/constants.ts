/**
 * eBay Integration Constants
 *
 * Contains category IDs, condition descriptors, grade mappings,
 * and other eBay-specific constants for trading card listings.
 */

// =============================================================================
// OAuth Scopes
// =============================================================================
// Note: Only request scopes that are granted to your app in the eBay Developer Portal
// Some scopes (commerce.identity.readonly, commerce.media.upload) may require special approval
export const EBAY_OAUTH_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
  'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
] as const;

// Marketing scope for checking if user needs to re-authorize
export const MARKETING_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.marketing';

// =============================================================================
// eBay Category IDs
// =============================================================================
export const EBAY_CATEGORIES = {
  // Sports Trading Card Singles - Baseball, Football, Basketball, etc.
  SPORTS_TRADING_CARDS: '261328',

  // Non-Sport Trading Card Singles - Entertainment, Movie cards
  NON_SPORT_TRADING_CARDS: '183050',

  // CCG Individual Cards - Pokemon, MTG, Yu-Gi-Oh, Lorcana
  CCG_INDIVIDUAL_CARDS: '183454',
} as const;

// Map DCM card categories to eBay category IDs
export const DCM_TO_EBAY_CATEGORY: Record<string, string> = {
  'Pokemon': EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS,
  'MTG': EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS,
  'Lorcana': EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS,
  'One Piece': EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS,
  'Football': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
  'Baseball': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
  'Basketball': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
  'Hockey': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
  'Soccer': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
  'Wrestling': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
  'Sports': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
  'Other': EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS,
};

// =============================================================================
// Condition IDs
// =============================================================================
export const EBAY_CONDITIONS = {
  // For all DCM graded cards
  GRADED: '2750',

  // For ungraded cards (not applicable for DCM)
  UNGRADED: '4000',
} as const;

// =============================================================================
// Condition Descriptor IDs (Required for Graded Cards)
// =============================================================================
export const CONDITION_DESCRIPTORS = {
  // Professional Grader - Required
  PROFESSIONAL_GRADER: '27501',

  // Grade - Required
  GRADE: '27502',

  // Certification Number - Optional
  CERTIFICATION_NUMBER: '27503',
} as const;

// =============================================================================
// Professional Grader IDs (for Descriptor 27501)
// =============================================================================
export const GRADER_IDS = {
  PSA: '275010',
  BCCG: '275011',
  BVG: '275012',
  BGS: '275013',
  CSG: '275014',
  CGC: '275015',
  SGC: '275016',
  KSA: '275017',
  GMA: '275018',
  HGA: '275019',
  ISA: '2750110',
  GSG: '2750112',
  PGS: '2750113',
  MNT: '2750114',
  TAG: '2750115',
  RARE: '2750116',
  RCG: '2750117',  // Revolution Card Grading
  CGA: '2750120',
  TCG: '2750121',
  // Use this for DCM - "Other" grader
  OTHER: '2750123',
} as const;

// DCM uses "Other" grader ID
export const DCM_GRADER_ID = GRADER_IDS.OTHER;

// =============================================================================
// Grade Value IDs (for Descriptor 27502)
// =============================================================================
export const GRADE_IDS: Record<number | string, string> = {
  10: '275020',
  9.5: '275021',
  9: '275022',
  8.5: '275023',
  8: '275024',
  7.5: '275025',
  7: '275026',
  6.5: '275027',
  6: '275028',
  5.5: '275029',
  5: '2750210',
  4: '2750212',
  3: '2750214',
  2: '2750216',
  1: '2750218',
  // Special grades
  'authentic': '2750219',
  'authentic_altered': '2750220',
  'authentic_trimmed': '2750221',
};

/**
 * Map DCM whole grade (1-10) to eBay grade ID
 * DCM uses whole numbers, so we map directly
 */
export function getEbayGradeId(dcmGrade: number | null, isAlteredAuthentic: boolean = false): string {
  if (isAlteredAuthentic || dcmGrade === null) {
    return GRADE_IDS['authentic'];
  }

  // Round to whole number and clamp to valid range
  const wholeGrade = Math.min(10, Math.max(1, Math.round(dcmGrade)));
  return GRADE_IDS[wholeGrade] || GRADE_IDS[1];
}

// =============================================================================
// Listing Formats
// =============================================================================
export const LISTING_FORMATS = {
  FIXED_PRICE: 'FIXED_PRICE',
  AUCTION: 'AUCTION',
} as const;

// =============================================================================
// Listing Durations
// =============================================================================
export const LISTING_DURATIONS = {
  DAYS_3: 'DAYS_3',
  DAYS_5: 'DAYS_5',
  DAYS_7: 'DAYS_7',
  DAYS_10: 'DAYS_10',
  DAYS_30: 'DAYS_30',
  GTC: 'GTC', // Good 'Til Cancelled
} as const;

export const LISTING_DURATION_LABELS: Record<string, string> = {
  DAYS_3: '3 Days',
  DAYS_5: '5 Days',
  DAYS_7: '7 Days',
  DAYS_10: '10 Days',
  DAYS_30: '30 Days',
  GTC: "Good 'Til Cancelled",
};

// =============================================================================
// Marketplaces
// =============================================================================
export const MARKETPLACES = {
  US: 'EBAY_US',
  UK: 'EBAY_GB',
  DE: 'EBAY_DE',
  AU: 'EBAY_AU',
  CA: 'EBAY_CA',
} as const;

// =============================================================================
// API Endpoints
// =============================================================================
export const EBAY_API_URLS = {
  production: {
    auth: 'https://auth.ebay.com/oauth2/authorize',
    api: 'https://api.ebay.com',
    token: 'https://api.ebay.com/identity/v1/oauth2/token',
  },
  sandbox: {
    auth: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    api: 'https://api.sandbox.ebay.com',
    token: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
  },
} as const;

// =============================================================================
// Rate Limits
// =============================================================================
export const RATE_LIMITS = {
  // Media API: 50 requests per 5 seconds
  MEDIA_API_REQUESTS_PER_WINDOW: 50,
  MEDIA_API_WINDOW_MS: 5000,

  // Listing revisions: 250 per day per listing
  MAX_LISTING_REVISIONS_PER_DAY: 250,

  // Image size limit
  MAX_IMAGE_SIZE_BYTES: 12 * 1024 * 1024, // 12MB
} as const;

// =============================================================================
// Token Expiration
// =============================================================================
export const TOKEN_CONFIG = {
  // Access tokens expire in 2 hours
  ACCESS_TOKEN_EXPIRY_SECONDS: 7200,

  // Refresh tokens expire in 18 months
  REFRESH_TOKEN_EXPIRY_MONTHS: 18,

  // Refresh access token when it expires within this many minutes
  REFRESH_THRESHOLD_MINUTES: 5,
} as const;
