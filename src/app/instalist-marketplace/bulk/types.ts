/**
 * Shapes the bulk review page reads off GET /api/ebay/bulk/batches/:id.
 * Mirrors ebay_bulk_batches / ebay_bulk_items, snake_case on purpose so the
 * rows can be PATCHed straight back.
 */

import type { BulkBatchSettings } from '@/lib/ebay/bulkSettings';
import type { BulkItemStatus, BulkBatchStatus, ReadinessIssue } from '@/lib/ebay/bulkReadiness';
import type { MarketplaceCard } from '../types';

export interface BulkBatch {
  id: string;
  user_id: string;
  org_id: string | null;
  status: BulkBatchStatus;
  settings: BulkBatchSettings;
  total_count: number;
  ready_count: number;
  live_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}

export interface BulkItemSpecific {
  name: string;
  value: string | string[];
  required?: boolean;
  editable?: boolean;
}

export interface BulkItem {
  id: string;
  batch_id: string;
  card_id: string;
  position: number;
  status: BulkItemStatus;
  attempts: number;
  title: string | null;
  price: number | string | null;
  description_html: string | null;
  item_specifics: BulkItemSpecific[] | null;
  image_urls: string[] | null;
  image_status: 'pending' | 'ready' | 'failed';
  readiness: ReadinessIssue[] | null;
  price_edited: boolean;
  title_edited: boolean;
  description_edited: boolean;
  listing_row_id: string | null;
  error_code: string | null;
  error_message: string | null;
  updated_at: string;
}

/**
 * The eBay listing a published (or skipped) row points at, keyed by
 * `BulkItem.listing_row_id`. Only the fields the progress view links with.
 */
export interface BulkListingRef {
  id: string;
  listing_id: string | null;
  listing_url: string | null;
  status: string;
  price: number | null;
  published_at: string | null;
}

export interface BulkBatchPayload {
  batch: BulkBatch;
  items: BulkItem[];
  listings: BulkListingRef[];
  cards: MarketplaceCard[];
  hasMore: boolean;
}

/** One row of GET /api/ebay/bulk/batches — the "get me back to my batch" list. */
export interface BulkBatchSummary {
  id: string;
  status: BulkBatchStatus;
  total_count: number;
  ready_count: number;
  live_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}
