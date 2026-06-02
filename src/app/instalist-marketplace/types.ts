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

export interface MarketplaceCard {
  id: string;
  cardName: string;
  category: string | null;
  serial: string | null;
  grade: number | null;
  conditionLabel: string | null;
  subScores: any;
  dcmPriceEstimate: number | null;
  ebayPriceMedian: number | null;
  thumbnailUrl: string | null;
  frontPath: string | null;
  backPath: string | null;
  createdAt: string;
}
