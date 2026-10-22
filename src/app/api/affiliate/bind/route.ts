/**
 * POST { code } - attach a referral code to the signed-in account
 * (src/lib/affiliateAccountRef.ts). Called by ReferralTracker once per browser
 * session when a stored referral code and a signed-in session are both present,
 * so a purchase from another browser or device is still attributed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { bindAccountReferral } from '@/lib/affiliateAccountRef';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  let body: { code?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const result = await bindAccountReferral(auth.userId, body.code);
  if (result.bound) console.log(`[Affiliate] Referral ${result.code} bound to account ${auth.userId}`);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
