/**
 * Credit Deduction API
 * Deducts 1 credit from user's account when grading a card
 */

import { NextRequest, NextResponse } from 'next/server';
import { deductCredit, hasCredits } from '@/lib/credits';
import { verifyAuth } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
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

    // Get request body
    const body = await request.json();
    const { cardId, isRegrade } = body as { cardId?: string; isRegrade?: boolean };

    // Check if user has credits
    const hasSufficientCredits = await hasCredits(userId, 1);
    if (!hasSufficientCredits) {
      return NextResponse.json(
        { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 }
      );
    }

    // Deduct credit
    const result = await deductCredit(userId, {
      cardId,
      isRegrade: isRegrade || false,
      description: isRegrade ? 'Re-grade card' : 'Grade card',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to deduct credit' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error('Credit deduction error:', error);
    return NextResponse.json(
      { error: 'Failed to deduct credit' },
      { status: 500 }
    );
  }
}
