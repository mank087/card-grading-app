/**
 * Temporary diagnostic — looks up a single eBay item by ID via both
 * GetMyeBaySelling (does the bulk endpoint still consider it active?)
 * and GetItem (what's the listing's actual current state?). Tells us
 * whether the cron's orphan-detection branch is even reachable for
 * a given listing.
 *
 * Auth: CRON_SECRET.
 *
 * Usage:
 *   curl "https://dcmgrading.com/api/admin/ebay-item-debug?itemId=147140658204" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Delete once the stuck-listing investigation is done.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getValidAccessToken } from '@/lib/ebay/auth';
import { getMyEbaySelling, getItemDetail } from '@/lib/ebay/sellApi';

const CRON_SECRET = process.env.CRON_SECRET;
const USE_SANDBOX = process.env.EBAY_USE_SANDBOX === 'true';

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

  // Find this listing in the DB so we know which user's token to use
  const { data: dbRow } = await supabaseAdmin
    .from('ebay_listings')
    .select('id, user_id, status, listing_id, title, created_at, last_synced_at, sold_at, ended_at, published_at, duration')
    .eq('listing_id', itemId)
    .maybeSingle();

  if (!dbRow) return NextResponse.json({ error: 'No DB row found for this itemId' }, { status: 404 });

  const accessToken = await getValidAccessToken(dbRow.user_id);
  const apiConfig = { accessToken, sandbox: USE_SANDBOX };

  // 1. What does GetMyeBaySelling say about this user's listings?
  const bulk = await getMyEbaySelling(apiConfig, {
    activeEntries: 200,
    soldEntries: 200,
    unsoldEntries: 200,
  });

  const inActive = bulk.active.find(i => i.itemId === itemId);
  const inSold = bulk.sold.find(i => i.itemId === itemId);
  const inUnsold = bulk.unsold.find(i => i.itemId === itemId);

  // 2. What does GetItem say directly?
  const detail = await getItemDetail(apiConfig, itemId);

  return NextResponse.json({
    itemId,
    dbRow: {
      status: dbRow.status,
      title: dbRow.title,
      published_at: dbRow.published_at,
      duration: dbRow.duration,
      last_synced_at: dbRow.last_synced_at,
      sold_at: dbRow.sold_at,
      ended_at: dbRow.ended_at,
    },
    bulk: {
      foundInActive: !!inActive,
      foundInSold: !!inSold,
      foundInUnsold: !!inUnsold,
      activeSample: inActive ? { endTime: inActive.endTime, listingFormat: inActive.listingFormat } : null,
    },
    getItem: detail,
    diagnosis:
      inActive
        ? 'Bulk endpoint still reports this listing as ACTIVE. The cron will refresh counters and skip the GetItem fallback. If eBay UI shows it ended, this is eBay-side eventual consistency.'
      : detail
        ? detail.listingStatus === 'Active'
          ? 'Orphan — GetItem confirms ACTIVE. No state change should happen.'
          : `Orphan — GetItem reports ${detail.listingStatus} with QuantitySold=${detail.quantitySold}. Cron should mark it ${detail.listingStatus === 'Completed' && detail.quantitySold > 0 ? 'SOLD' : 'ENDED'} on its next pass.`
        : 'Orphan, and GetItem returned null (item likely deleted on eBay).',
  });
}
