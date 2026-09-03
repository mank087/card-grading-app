/**
 * The seller's remaining eBay listing allowance.
 *
 * Why this exists: the most common bulk failure is not an API error, it is a
 * new seller hitting their monthly selling limit (10 items / $500 is eBay's
 * usual starting allowance). Showing "100 selected, 10 allowed" BEFORE the
 * publish button is pressed is worth more than any per-row retry.
 *
 * How it is fetched: eBay exposes the allowance on the Trading API's
 * `GetMyeBaySelling` summary as QuantityLimitRemaining / AmountLimitRemaining.
 * Not every account and not every API version returns them, so this reads
 * them defensively and reports `available: null` when they are absent — the
 * UI then hides the allowance line rather than guessing a number. Nothing in
 * the publish path depends on this value.
 */

import { callTradingApi, type TradingApiConfig } from '@/lib/ebay/tradingApi';

export interface SellerListingAllowance {
  /** Listings the seller may still create this period, or null if unknown. */
  available: number | null;
  /** Dollar allowance remaining this period, or null if unknown. */
  amountAvailable: number | null;
  /** Active listings the account currently holds, or null if unknown. */
  activeCount: number | null;
}

function readNumber(xml: string, tag: string): number | null {
  const match = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i').exec(xml);
  if (!match) return null;
  const value = Number(match[1].trim());
  return Number.isFinite(value) ? value : null;
}

/**
 * One small Trading call. `DetailLevel: ReturnSummary` plus an ActiveList
 * page of ONE entry keeps the response to the summary block and a single
 * item — enough to read PaginationResult's total without downloading the
 * seller's inventory.
 */
export async function getSellerListingAllowance(
  config: TradingApiConfig
): Promise<SellerListingAllowance> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>TOKEN_PLACEHOLDER</eBayAuthToken>
  </RequesterCredentials>
  <SellingSummary>
    <Include>true</Include>
  </SellingSummary>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>1</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnSummary</DetailLevel>
</GetMyeBaySellingRequest>`;

  const response = await callTradingApi(config, 'GetMyeBaySelling', xml);

  return {
    available: readNumber(response, 'QuantityLimitRemaining'),
    amountAvailable: readNumber(response, 'AmountLimitRemaining'),
    // TotalNumberOfEntries inside ActiveList's PaginationResult.
    activeCount: readNumber(response, 'TotalNumberOfEntries'),
  };
}
