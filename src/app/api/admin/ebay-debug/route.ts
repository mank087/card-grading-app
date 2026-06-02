/**
 * Temporary diagnostic endpoint.
 *
 * Runs a real GetMyeBaySelling call for a single user and returns:
 *   - Whether HitCount / WatchCount tags exist in the raw XML
 *   - The first 3 items raw (truncated) so we can see field shape
 *   - Whether SoldList uses ItemArray vs OrderTransactionArray
 *   - Whether there are any error/warning messages in the response
 *
 * Auth: same Bearer CRON_SECRET pattern as the cron endpoints.
 *
 * Usage:
 *   curl "https://dcmgrading.com/api/admin/ebay-debug?userId=<uuid>" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Delete this file once the view-count investigation is done.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { callTradingApi } from '@/lib/ebay/tradingApi';
import { getValidAccessToken } from '@/lib/ebay/auth';

const CRON_SECRET = process.env.CRON_SECRET;
const USE_SANDBOX = process.env.EBAY_USE_SANDBOX === 'true';

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let userId = searchParams.get('userId');

  // Default to the user with the most active listings.
  if (!userId) {
    const { data } = await supabaseAdmin
      .from('ebay_listings')
      .select('user_id')
      .eq('status', 'active')
      .limit(5000);
    const counts = new Map<string, number>();
    for (const r of data ?? []) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    userId = sorted[0]?.[0] ?? null;
  }
  if (!userId) return NextResponse.json({ error: 'No userId and no fallback' }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken(userId);
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>TOKEN_PLACEHOLDER</eBayAuthToken></RequesterCredentials>
  <Version>1349</Version>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination><EntriesPerPage>3</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
    <Include>true</Include>
  </ActiveList>
  <SoldList>
    <Sort>EndTime</Sort>
    <Pagination><EntriesPerPage>3</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
    <DurationInDays>60</DurationInDays>
    <Include>true</Include>
  </SoldList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;

    const response = await callTradingApi(
      { accessToken, sandbox: USE_SANDBOX },
      'GetMyeBaySelling',
      xml
    );

    // Extract first 3 active items
    const activeBlock = response.match(/<ActiveList>([\s\S]*?)<\/ActiveList>/i)?.[1] ?? '';
    const activeItemArray = activeBlock.match(/<ItemArray>([\s\S]*?)<\/ItemArray>/i)?.[1] ?? '';
    const activeItems = [...activeItemArray.matchAll(/<Item>([\s\S]*?)<\/Item>/gi)].slice(0, 3);

    const activeSummary = activeItems.map((m, i) => {
      const item = m[1];
      const hitCount = item.match(/<HitCount[^>]*>([^<]*)<\/HitCount>/i)?.[1] ?? null;
      const watchCount = item.match(/<WatchCount[^>]*>([^<]*)<\/WatchCount>/i)?.[1] ?? null;
      const questionCount = item.match(/<QuestionCount[^>]*>([^<]*)<\/QuestionCount>/i)?.[1] ?? null;
      const itemId = item.match(/<ItemID[^>]*>([^<]*)<\/ItemID>/i)?.[1] ?? null;
      const title = item.match(/<Title[^>]*>([^<]*)<\/Title>/i)?.[1] ?? null;
      const allTags = [...item.matchAll(/<(\w+)[^>]*\/?>/g)].map(m => m[1]);
      const uniqueTags = [...new Set(allTags)].sort();
      return {
        index: i,
        itemId,
        title: title?.slice(0, 60),
        hitCount,
        watchCount,
        questionCount,
        uniqueTags,
        rawSnippet: item.slice(0, 1500),
      };
    });

    // Sold structure
    const soldBlock = response.match(/<SoldList>([\s\S]*?)<\/SoldList>/i)?.[1] ?? '';
    const soldDiag = {
      blockLength: soldBlock.length,
      hasOrderTransactionArray: /<OrderTransactionArray>/.test(soldBlock),
      hasItemArray: /<ItemArray>/.test(soldBlock),
      transactionCount: (soldBlock.match(/<Transaction>/g) ?? []).length,
      firstTransactionSnippet: soldBlock.match(/<Transaction>([\s\S]*?)<\/Transaction>/i)?.[1]?.slice(0, 1500) ?? null,
    };

    const errors = [...response.matchAll(/<Errors>([\s\S]*?)<\/Errors>/gi)].map(m => m[1].slice(0, 500));

    return NextResponse.json({
      userId,
      sandbox: USE_SANDBOX,
      responseLength: response.length,
      active: {
        sampleCount: activeItems.length,
        items: activeSummary,
      },
      sold: soldDiag,
      errorBlocks: errors,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed', stack: err.stack }, { status: 500 });
  }
}
