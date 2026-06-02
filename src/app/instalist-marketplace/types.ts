/**
 * Shared types for the instalist-marketplace UI.
 *
 * Mirrors the shape returned by:
 *   GET /api/ebay/stats
 *   GET /api/ebay/my-listings
 *   GET /api/ebay/eligible-cards
 */

export interface MarketplaceStats {
  activeCount: number;
  soldCount: number;
  endedCount: number;
  grossRevenue: number;
  totalViews: number;
  totalWatchers: number;
  currency: string;
}

export interface MarketplaceListing {
  id: string;
  cardId: string;
  cardName: string;
  cardCategory: string | null;
  cardSerial: string | null;
  cardGrade: number | null;
  thumbnailUrl: string | null;
  sku: string;
  listingId: string | null;
  listingUrl: string | null;
  title: string;
  price: number;
  currency: string;
  quantity: number;
  quantitySold: number;
  listingFormat: string;
  duration: string;
  status: string;
  viewCount: number;
  watchCount: number;
  publishedAt: string | null;
  endedAt: string | null;
  soldAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw card record returned by /api/ebay/eligible-cards. Snake-case on
 * purpose — this is the same shape the per-category card-detail APIs
 * use and the EbayListingModal expects. Don't transform to camelCase
 * here or the modal will read undefined for everything it needs.
 *
 * Indexed type instead of an exhaustive interface because the modal
 * accesses ~30 different card fields and any future addition (item
 * specifics, new grading scores, etc.) should flow through without
 * a parallel type bump here.
 */
export interface MarketplaceCard {
  // Always present (selected explicitly in the eligible-cards route)
  id: string;
  card_name: string | null;
  category: string | null;
  serial: string | null;
  front_path: string | null;
  back_path: string | null;
  front_url: string | null; // signed URL for the modal's image pipeline
  back_url: string | null;
  conversational_whole_grade: number | null;
  dcm_price_estimate: number | null;
  ebay_price_median: number | null;
  created_at: string;
  // Plus everything else the modal accesses — kept as an open
  // index so the type doesn't need to enumerate ~30 fields.
  [key: string]: any;
}
