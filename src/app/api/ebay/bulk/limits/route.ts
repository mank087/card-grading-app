/**
 * GET /api/ebay/bulk/limits — the seller's remaining eBay listing allowance.
 *
 * Advisory only. When eBay does not report an allowance for the account (the
 * common case for established sellers, who have no monthly cap), this answers
 * `{ available: null }` and the batch panel hides the allowance line rather
 * than inventing a number. A failure here never blocks a batch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardBulkRoute } from '@/lib/ebay/bulkService';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { getSellerListingAllowance } from '@/lib/ebay/sellerLimits';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId } = guard.auth;

  let connection = await getConnectionForUser(userId);
  if (!connection) {
    return NextResponse.json({ available: null, amountAvailable: null, activeCount: null });
  }
  connection = await refreshTokenIfNeeded(connection);
  if (!connection) {
    return NextResponse.json({ available: null, amountAvailable: null, activeCount: null });
  }

  try {
    const allowance = await getSellerListingAllowance({
      accessToken: connection.access_token,
      sandbox: connection.is_sandbox,
    });
    return NextResponse.json(allowance);
  } catch (err: any) {
    console.error('[ebay/bulk] limits lookup failed:', err?.message ?? err);
    return NextResponse.json({ available: null, amountAvailable: null, activeCount: null });
  }
}
