/**
 * Admin: bulk-import a single user's eBay listings into ebay_listings.
 *
 * Pulls every listing eBay returns from GetMyeBaySelling (ActiveList +
 * SoldList + UnsoldList; eBay caps SoldList/UnsoldList at 60 days),
 * filters down to listings whose title contains "DCM" (a clean heuristic
 * for InstaList-created listings), and inserts a row for any listing_id
 * we don't already track.
 *
 * Each new row attempts to link to a cards row by parsing the SKU: DCM
 * InstaList SKUs are formatted `DCM-{userIdFirst8}-{cardIdFirst8}-{ts}`,
 * so the third dash-separated chunk is the first 8 chars of the card UUID.
 * If we can't find a matching card, the row is skipped (the
 * ebay_listings.card_id column is a non-null FK).
 *
 * Auth: CRON_SECRET.
 *
 * Usage:
 *   curl -X POST "https://dcmgrading.com/api/admin/ebay-import-user" \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"userId":"<uuid>"}'
 *
 * Supports a `dryRun: true` body field that returns what would be imported
 * without writing anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getValidAccessToken } from '@/lib/ebay/auth';
import { getMyEbaySelling, type EbaySellingItem } from '@/lib/ebay/sellApi';
import { DCM_TO_EBAY_CATEGORY, EBAY_CATEGORIES } from '@/lib/ebay/constants';

const CRON_SECRET = process.env.CRON_SECRET;
const USE_SANDBOX = process.env.EBAY_USE_SANDBOX === 'true';

const TITLE_FILTER = /dcm/i; // case-insensitive match anywhere in the title

interface CardLite {
  id: string;
  category: string | null;
}

function ebayCategoryFor(cardCategory: string | null | undefined): string {
  if (!cardCategory) return EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS;
  return DCM_TO_EBAY_CATEGORY[cardCategory] ?? EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS;
}

export async function POST(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId, dryRun = false, filterDcmInTitle = true } = body as {
    userId?: string;
    dryRun?: boolean;
    filterDcmInTitle?: boolean;
  };
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const apiConfig = { accessToken, sandbox: USE_SANDBOX };

    // Pull all three buckets at max entries.
    const ebayState = await getMyEbaySelling(apiConfig, {
      activeEntries: 200,
      soldEntries: 200,
      unsoldEntries: 200,
    });

    // Existing listing_ids we already track for this user.
    const { data: existingRows } = await supabaseAdmin
      .from('ebay_listings')
      .select('listing_id')
      .eq('user_id', userId);
    const existingIds = new Set((existingRows ?? []).map(r => r.listing_id).filter(Boolean));

    // Cache cards by their first-8 ID prefix for fast SKU → card lookup.
    // Pull category too so we can populate ebay_listings.category_id.
    const { data: userCards } = await supabaseAdmin
      .from('cards')
      .select('id, category')
      .eq('user_id', userId);
    const cardsById = new Map<string, CardLite>();
    const cardsByPrefix = new Map<string, CardLite[]>();
    for (const c of userCards ?? []) {
      cardsById.set(c.id, c);
      const prefix = c.id.replace(/-/g, '').slice(0, 8).toLowerCase();
      const list = cardsByPrefix.get(prefix) ?? [];
      list.push(c);
      cardsByPrefix.set(prefix, list);
    }

    type Candidate = { status: 'active' | 'sold' | 'ended'; item: EbaySellingItem };
    const candidates: Candidate[] = [];
    for (const item of ebayState.active) candidates.push({ status: 'active', item });
    for (const item of ebayState.sold) candidates.push({ status: 'sold', item });
    for (const item of ebayState.unsold) candidates.push({ status: 'ended', item });

    const skipped: Array<{ reason: string; itemId: string; title?: string }> = [];
    const toImport: Array<{ status: string; item: EbaySellingItem; card_id: string }> = [];

    for (const { status, item } of candidates) {
      if (existingIds.has(item.itemId)) {
        skipped.push({ reason: 'already_in_db', itemId: item.itemId });
        continue;
      }
      if (filterDcmInTitle && !TITLE_FILTER.test(item.title)) {
        skipped.push({ reason: 'title_no_dcm', itemId: item.itemId, title: item.title });
        continue;
      }

      // Try to link to a card via the SKU pattern.
      // SKU shape: DCM-XXXXXXXX-YYYYYYYY-ZZZZZZZ where YYYYYYYY is the first
      // 8 chars of the card UUID (with dashes stripped). All uppercase.
      const sku = item.sku;
      let matchedCardId: string | null = null;
      if (sku) {
        const skuMatch = sku.match(/^DCM-[A-Z0-9]{8}-([A-Z0-9]{8})-/i);
        if (skuMatch) {
          const cardPrefix = skuMatch[1].toLowerCase();
          const candidates = cardsByPrefix.get(cardPrefix) ?? [];
          if (candidates.length === 1) matchedCardId = candidates[0].id;
          // If multiple cards share the same 8-char prefix we don't pick at
          // random; skip and report.
          else if (candidates.length > 1) {
            skipped.push({ reason: 'ambiguous_card_prefix', itemId: item.itemId });
            continue;
          }
        }
      }

      if (!matchedCardId) {
        skipped.push({ reason: 'no_matching_card', itemId: item.itemId, title: item.title });
        continue;
      }

      toImport.push({ status, item, card_id: matchedCardId });
    }

    const now = new Date().toISOString();
    let inserted = 0;
    const insertErrors: Array<{ itemId: string; error: string }> = [];

    if (!dryRun) {
      for (const { status, item, card_id } of toImport) {
        // eBay reuses SKUs across relistings (the "Sell similar" / "Relist"
        // flows preserve the original SKU on every resulting ItemID), so
        // ours has to be disambiguated by listing_id. The listing_id IS
        // the natural unique key for an eBay listing; the original SKU is
        // preserved as a prefix for traceability.
        const baseSku = item.sku || 'IMPORTED';
        const insertSku = `${baseSku}-${item.itemId}`;
        const listingFormat = item.listingFormat === 'FixedPriceItem' ? 'FIXED_PRICE' : 'AUCTION';
        const card = cardsById.get(card_id);
        const categoryId = ebayCategoryFor(card?.category);

        const row: Record<string, any> = {
          user_id: userId,
          card_id,
          sku: insertSku,
          listing_id: item.itemId,
          listing_url: item.listingUrl ?? `https://www.ebay.com/itm/${item.itemId}`,
          title: item.title,
          price: item.currentPrice,
          currency: item.currency,
          quantity: item.quantity ?? 1,
          quantity_sold: item.quantitySold ?? 0,
          listing_format: listingFormat,
          duration: 'GTC', // We don't have this from GetMyeBaySelling; safe default.
          category_id: categoryId,
          status,
          ebay_image_urls: item.galleryUrl ? [item.galleryUrl] : [],
          published_at: item.startTime ?? null,
          last_synced_at: now,
        };
        if (status === 'sold') {
          row.sold_at = item.endTime ?? now;
        } else if (status === 'ended') {
          row.ended_at = item.endTime ?? now;
        }

        const { error } = await supabaseAdmin.from('ebay_listings').insert(row);
        if (error) {
          insertErrors.push({ itemId: item.itemId, error: error.message });
        } else {
          inserted++;
        }
      }
    }

    // Summarise skip reasons
    const skipSummary: Record<string, number> = {};
    for (const s of skipped) skipSummary[s.reason] = (skipSummary[s.reason] ?? 0) + 1;

    return NextResponse.json({
      success: true,
      dryRun,
      userId,
      ebayTotals: {
        active: ebayState.active.length,
        sold: ebayState.sold.length,
        unsold: ebayState.unsold.length,
      },
      candidates: candidates.length,
      eligible: toImport.length,
      inserted,
      skipped: skipped.length,
      skipReasons: skipSummary,
      insertErrors,
      // Sample of skipped items for spot-checking
      skippedSample: skipped.slice(0, 10),
    });
  } catch (err: any) {
    console.error('[ebay-import-user] error:', err);
    return NextResponse.json({ error: err.message || 'Import failed', stack: err.stack }, { status: 500 });
  }
}
