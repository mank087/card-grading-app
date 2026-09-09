/**
 * Credits API
 * Get user's current credit balance and transaction history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserCredits, getTransactionHistory } from '@/lib/credits';
import { verifyAuth } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    // Check if transactions are requested
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';
    const historyLimit = parseInt(searchParams.get('limit') || '20', 10);

    // Get user credits
    const credits = await getUserCredits(userId);

    if (!credits) {
      return NextResponse.json(
        { error: 'Failed to fetch credits' },
        { status: 500 }
      );
    }

    // Prepare response
    const response: {
      balance: number;
      totalPurchased: number;
      totalUsed: number;
      firstPurchaseBonusAvailable: boolean;
      isCardLover: boolean;
      isVip: boolean;
      transactions?: Awaited<ReturnType<typeof getTransactionHistory>>;
    } = {
      balance: credits.balance,
      totalPurchased: credits.total_purchased,
      totalUsed: credits.total_used,
      firstPurchaseBonusAvailable: !credits.first_purchase_bonus_claimed,
      // Membership flags ride along so client surfaces can tell a member from a
      // never-paid account without a second round trip.
      isCardLover: Boolean(credits.is_card_lover),
      isVip: Boolean(credits.is_vip),
    };

    // Include transaction history if requested
    if (includeHistory) {
      response.transactions = await getTransactionHistory(userId, historyLimit);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Credits fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}
