/**
 * Credit Deduction API
 * Deducts 1 credit from user's account when grading a card
 */

import { NextRequest, NextResponse } from 'next/server';
import { deductCredit } from '@/lib/credits';
import { verifyAuth } from '@/lib/serverAuth';
import { scheduleFirstGradeEmails } from '@/lib/emailScheduler';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isUuid } from '@/lib/uuid';

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

    // A charge must reference a real card owned by the caller. Without this,
    // the per-card idempotency (one 'grade' charge per card_id) can be
    // bypassed by omitting/mangling cardId — and null-card charges have no
    // audit trail to refund against.
    if (!isUuid(cardId)) {
      return NextResponse.json({ error: 'Valid cardId is required' }, { status: 400 });
    }
    const { data: card } = await supabaseAdmin
      .from('cards')
      .select('id, user_id')
      .eq('id', cardId)
      .maybeSingle();
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    if (card.user_id !== userId) {
      return NextResponse.json({ error: 'Card does not belong to this user' }, { status: 403 });
    }

    // Deduct credit. No separate hasCredits pre-check: deductCredit resolves
    // the duplicate-charge case first (a card already charged returns success
    // without deducting, even at zero balance) and reports insufficiency
    // itself — a pre-check would 402 those duplicates.
    const result = await deductCredit(userId, {
      cardId,
      isRegrade: isRegrade || false,
      description: isRegrade ? 'Re-grade card' : 'Grade card',
    });

    if (!result.success) {
      if (result.error === 'Insufficient credits') {
        return NextResponse.json(
          { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { error: result.error || 'Failed to deduct credit' },
        { status: 500 }
      );
    }

    // First-grade trigger: queue the 3-email post-grade series the moment a user
    // grades their first card (totalUsed transitions 0 → 1). Fire-and-forget —
    // we don't block the grade deduction on email scheduling.
    // Skip for re-grades since those don't represent a new conversion event.
    if (!isRegrade && !result.alreadyCharged && result.totalUsed === 1) {
      (async () => {
        try {
          let userEmail = authResult.user?.email;
          if (!userEmail) {
            // Fallback: look up email from auth.users if verifyAuth didn't include it.
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
            userEmail = authUser?.user?.email;
          }
          if (userEmail) {
            await scheduleFirstGradeEmails(userId, userEmail);
          } else {
            console.warn('[Deduct] First grade trigger: no email available for user', userId);
          }
        } catch (err) {
          console.error('[Deduct] First grade email scheduling failed:', err);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      totalUsed: result.totalUsed,
      totalPurchased: result.totalPurchased,
      alreadyCharged: result.alreadyCharged || false,
    });
  } catch (error) {
    console.error('Credit deduction error:', error);
    return NextResponse.json(
      { error: 'Failed to deduct credit' },
      { status: 500 }
    );
  }
}
