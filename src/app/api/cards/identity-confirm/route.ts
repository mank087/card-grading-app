/**
 * GET /api/cards/identity-confirm — is the "Confirm your card details" flow on?
 *
 * The mobile collection shows "Confirm details" chips without loading each
 * card's review state, so it needs the server kill switch on its own. Same
 * switch as GET /api/cards/[id]/identity-review: IDENTITY_CONFIRM_DISABLED=1
 * turns the flow off on the web and on both phones at once. No card data, no
 * auth; the answer is the same for everyone.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { enabled: process.env.IDENTITY_CONFIRM_DISABLED !== '1' },
    { headers: { 'cache-control': 'public, max-age=60, s-maxage=60' } },
  );
}
