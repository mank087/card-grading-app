/**
 * eBay Selling Dashboard Read Helpers
 *
 * Powers /instalist-marketplace by wrapping GetMyeBaySelling (Trading API)
 * and returning normalized active/sold/unsold lists. Trading XML is used
 * here for symmetry with the existing create path in tradingApi.ts —
 * later phases can migrate to the modern Sell Inventory API if useful.
 *
 * Token handling lives in src/lib/ebay/auth.ts (getValidAccessToken).
 * This module is pure XML build + parse + normalize.
 */

import { callTradingApi, type TradingApiConfig } from './tradingApi';

const TRADING_API_VERSION = '1349';

export interface EbaySellingItem {
  itemId: string;
  title: string;
  sku?: string;
  currentPrice: number;
  currency: string;
  quantity: number;
  quantitySold?: number;
  listingFormat: 'FixedPriceItem' | 'Chinese' | 'Auction' | 'Unknown';
  startTime?: string;
  endTime?: string;
  listingUrl?: string;
  hitCount?: number; // page views
  watchCount?: number;
  bidCount?: number;
  reserveMet?: boolean;
  bestOfferEnabled?: boolean;
  galleryUrl?: string;
}

export interface MyEbaySellingResult {
  active: EbaySellingItem[];
  sold: EbaySellingItem[];
  unsold: EbaySellingItem[];
}

/**
 * Fetch all of a user's active, sold, and unsold listings via
 * Trading API GetMyeBaySelling. Returns up to 200 items per bucket.
 *
 * eBay's pagination is per-list, so we ask for one page of 200 in each
 * container. For users with bigger inventories we can extend with
 * follow-up paging later — for v1, 200/bucket is enough headroom.
 */
export async function getMyEbaySelling(
  config: TradingApiConfig,
  options: {
    activeEntries?: number;
    soldEntries?: number;
    unsoldEntries?: number;
    includeFlags?: { active?: boolean; sold?: boolean; unsold?: boolean };
  } = {}
): Promise<MyEbaySellingResult> {
  const activeEntries = options.activeEntries ?? 200;
  const soldEntries = options.soldEntries ?? 200;
  const unsoldEntries = options.unsoldEntries ?? 200;
  const flags = options.includeFlags ?? { active: true, sold: true, unsold: true };

  const xml = buildGetMyEbaySellingXml({
    activeEntries: flags.active ? activeEntries : 0,
    soldEntries: flags.sold ? soldEntries : 0,
    unsoldEntries: flags.unsold ? unsoldEntries : 0,
  });

  const responseXml = await callTradingApi(config, 'GetMyeBaySelling', xml);

  return {
    active: flags.active ? parseItemArray(extractContainer(responseXml, 'ActiveList')) : [],
    sold: flags.sold ? parseItemArray(extractContainer(responseXml, 'SoldList')) : [],
    unsold: flags.unsold ? parseItemArray(extractContainer(responseXml, 'UnsoldList')) : [],
  };
}

/**
 * Build the GetMyeBaySelling XML request.
 *
 * Setting `entriesPerPage: 0` in any container omits that container from
 * the response — useful for sync crons that only need active listings.
 */
function buildGetMyEbaySellingXml(args: {
  activeEntries: number;
  soldEntries: number;
  unsoldEntries: number;
}): string {
  const container = (name: string, entries: number, sort: string) => {
    if (entries <= 0) return '';
    return `<${name}>
      <Sort>${sort}</Sort>
      <Pagination>
        <EntriesPerPage>${entries}</EntriesPerPage>
        <PageNumber>1</PageNumber>
      </Pagination>
      <Include>true</Include>
    </${name}>`;
  };

  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>TOKEN_PLACEHOLDER</eBayAuthToken>
  </RequesterCredentials>
  <Version>${TRADING_API_VERSION}</Version>
  ${container('ActiveList', args.activeEntries, 'TimeLeft')}
  ${container('SoldList', args.soldEntries, 'EndTime')}
  ${container('UnsoldList', args.unsoldEntries, 'EndTime')}
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
}

/**
 * Extract the inner XML of a top-level container like <ActiveList>...</ActiveList>.
 * Returns empty string if not present (container omitted or empty).
 */
function extractContainer(xml: string, containerName: string): string {
  const match = xml.match(new RegExp(`<${containerName}>([\\s\\S]*?)</${containerName}>`, 'i'));
  return match ? match[1] : '';
}

/**
 * Parse all <Item> blocks inside a container's <ItemArray>.
 */
function parseItemArray(containerXml: string): EbaySellingItem[] {
  if (!containerXml) return [];
  const itemArrayMatch = containerXml.match(/<ItemArray>([\s\S]*?)<\/ItemArray>/i);
  if (!itemArrayMatch) return [];
  const itemArrayXml = itemArrayMatch[1];

  const items: EbaySellingItem[] = [];
  const itemMatches = itemArrayXml.matchAll(/<Item>([\s\S]*?)<\/Item>/gi);
  for (const m of itemMatches) {
    items.push(parseItem(m[1]));
  }
  return items;
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i'));
  return m ? m[1] : null;
}

function tagNum(xml: string, name: string): number | undefined {
  const v = tag(xml, name);
  if (v === null) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function tagBool(xml: string, name: string): boolean | undefined {
  const v = tag(xml, name);
  if (v === null) return undefined;
  return v.toLowerCase() === 'true';
}

function parseItem(itemXml: string): EbaySellingItem {
  // SellingStatus is nested — current price lives inside it.
  const sellingStatusMatch = itemXml.match(/<SellingStatus>([\s\S]*?)<\/SellingStatus>/i);
  const sellingStatusXml = sellingStatusMatch ? sellingStatusMatch[1] : '';

  // Listing type lives on the Item-level <ListingType> field.
  const listingType = (tag(itemXml, 'ListingType') ?? 'Unknown') as EbaySellingItem['listingFormat'];

  // CurrentPrice has a currencyID attribute we need to capture.
  const priceMatch = sellingStatusXml.match(/<CurrentPrice[^>]*currencyID="([^"]+)"[^>]*>([^<]*)<\/CurrentPrice>/i);
  const currentPrice = priceMatch ? parseFloat(priceMatch[2]) : 0;
  const currency = priceMatch ? priceMatch[1] : 'USD';

  // Listing URL — eBay returns <ListingDetails><ViewItemURL>...</ViewItemURL></ListingDetails>
  const listingDetailsMatch = itemXml.match(/<ListingDetails>([\s\S]*?)<\/ListingDetails>/i);
  const listingDetailsXml = listingDetailsMatch ? listingDetailsMatch[1] : '';

  return {
    itemId: tag(itemXml, 'ItemID') ?? '',
    title: tag(itemXml, 'Title') ?? '',
    sku: tag(itemXml, 'SKU') ?? undefined,
    currentPrice,
    currency,
    quantity: tagNum(itemXml, 'Quantity') ?? 1,
    quantitySold: tagNum(sellingStatusXml, 'QuantitySold'),
    listingFormat: listingType,
    startTime: tag(listingDetailsXml, 'StartTime') ?? undefined,
    endTime: tag(itemXml, 'EndTime') ?? tag(listingDetailsXml, 'EndTime') ?? undefined,
    listingUrl: tag(listingDetailsXml, 'ViewItemURL') ?? undefined,
    hitCount: tagNum(itemXml, 'HitCount'),
    watchCount: tagNum(itemXml, 'WatchCount'),
    bidCount: tagNum(sellingStatusXml, 'BidCount'),
    reserveMet: tagBool(sellingStatusXml, 'ReserveMet'),
    bestOfferEnabled: tagBool(itemXml, 'BestOfferEnabled'),
    galleryUrl: tag(itemXml, 'GalleryURL') ?? undefined,
  };
}
