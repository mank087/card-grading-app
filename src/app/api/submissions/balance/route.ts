import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { availableGradingCredits, committedCreditHold } from '@/lib/submissions/service';

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
  // Report what the commit gate will actually allow: balance minus credits
  // already claimed by the user's other in-flight submissions. Reporting the
  // raw balance here would let the intake page green-light a batch the server
  // is about to refuse.
  const credits = await availableGradingCredits(auth.userId);
  const held = await committedCreditHold(auth.userId);
  return NextResponse.json({
    success: true,
    ...credits,
    held,
    balance: Math.max(0, credits.balance - held),
    rawBalance: credits.balance,
  });
}
