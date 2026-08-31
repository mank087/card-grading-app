import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { availableGradingCredits } from '@/lib/submissions/service';

/**
 * GET /api/submissions/balance
 *
 * The credit balance the SERVER-SIDE commit gate will actually judge a
 * submission against: personal balance + active org pool. The client's
 * CreditsContext shows the personal balance only, so a client-side gate built
 * on it wrongly blocks org members whose store pool has credits — the intake
 * page must gate on THIS figure, not the header's.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const balance = await availableGradingCredits(auth.userId);
  return NextResponse.json({ success: true, ...balance });
}
