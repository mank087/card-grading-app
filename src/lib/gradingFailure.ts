// src/lib/gradingFailure.ts
// Shared handling for grading-pipeline failures and cross-instance grading locks.
//
// Before this existed, a grading failure inside a GET /api/<category>/[id]
// request left the card row untouched: no error recorded, no credit refunded,
// and the in-memory per-instance lock map couldn't stop a second serverless
// instance from grading the same card concurrently. Cards stranded at
// "pending" with a spent credit were invisible to both the user and support.
//
// Column usage on `cards` (both previously unused):
// - grade_status:   null → never graded | 'processing:<ISO>' → lock held |
//                   'failed' → last attempt failed | 'complete' → graded
// - error_message:  human-readable reason for the last failure

import { createClient } from '@supabase/supabase-js';
import { refundGradeCredit } from './credits';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// A lock older than this is presumed dead (function killed/timed out) and may
// be taken over. Matches the 300s route maxDuration plus margin.
const LOCK_STALE_MS = 6 * 60 * 1000;

/**
 * Record a grading failure on the card row and refund the grade credit.
 * Never throws — this runs inside catch blocks and must not mask the original error.
 */
export async function recordGradingFailure(opts: {
  cardId: string;
  userId: string | null | undefined;
  category: string;
  errorMessage: string;
}): Promise<{ refunded: boolean }> {
  const { cardId, userId, category, errorMessage } = opts;
  let refunded = false;

  try {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from('cards')
      .update({
        grade_status: 'failed',
        error_message: (errorMessage || 'Unknown grading error').slice(0, 500),
      })
      .eq('id', cardId);
    if (error) {
      console.error(`[GradingFailure] Failed to mark card ${cardId}:`, error.message);
    } else {
      console.log(`[GradingFailure] Marked card ${cardId} (${category}) as failed: ${errorMessage}`);
    }
  } catch (e: any) {
    console.error(`[GradingFailure] Error marking card ${cardId}:`, e.message);
  }

  if (userId) {
    try {
      const result = await refundGradeCredit(userId, cardId, `${category} grading error`);
      refunded = result.refunded;
    } catch (e: any) {
      console.error(`[GradingFailure] Refund error for card ${cardId}:`, e.message);
    }
  }

  return { refunded };
}

/**
 * Try to acquire the cross-instance grading lock for a card via a
 * compare-and-swap on cards.grade_status. Returns:
 * - { acquired: true, lockValue }  → caller may grade; must release afterwards
 * - { acquired: false }            → another instance is actively grading (429 the request)
 *
 * Stale locks (holder died mid-grade) are taken over automatically.
 * Fails open: if the check itself errors, grading proceeds (previous behavior).
 */
export async function acquireGradingLock(
  cardId: string,
  currentStatus: string | null | undefined
): Promise<{ acquired: boolean; lockValue?: string }> {
  try {
    if (typeof currentStatus === 'string' && currentStatus.startsWith('processing:')) {
      const startedAt = Date.parse(currentStatus.slice('processing:'.length));
      if (!Number.isNaN(startedAt) && Date.now() - startedAt < LOCK_STALE_MS) {
        return { acquired: false };
      }
      console.log(`[GradingLock] Stale lock on ${cardId} (held since ${currentStatus}) — taking over`);
    }

    const lockValue = `processing:${new Date().toISOString()}`;
    const supabase = getServiceClient();

    // CAS: only claim the lock if grade_status still holds the value we read.
    let query = supabase.from('cards').update({ grade_status: lockValue }).eq('id', cardId);
    query = currentStatus == null
      ? query.is('grade_status', null)
      : query.eq('grade_status', currentStatus);
    const { data, error } = await query.select('id');

    if (error) {
      console.error(`[GradingLock] Lock write failed for ${cardId} (failing open):`, error.message);
      return { acquired: true };
    }
    if (!data || data.length === 0) {
      // Someone else changed grade_status between our read and write
      return { acquired: false };
    }
    return { acquired: true, lockValue };
  } catch (e: any) {
    console.error(`[GradingLock] Lock error for ${cardId} (failing open):`, e.message);
    return { acquired: true };
  }
}

/**
 * Release the grading lock, recording the outcome. Never throws.
 */
export async function releaseGradingLock(
  cardId: string,
  outcome: 'complete' | 'failed'
): Promise<void> {
  try {
    const supabase = getServiceClient();
    const update: Record<string, unknown> = { grade_status: outcome };
    if (outcome === 'complete') update.error_message = null;
    const { error } = await supabase.from('cards').update(update).eq('id', cardId);
    if (error) console.error(`[GradingLock] Release failed for ${cardId}:`, error.message);
  } catch (e: any) {
    console.error(`[GradingLock] Release error for ${cardId}:`, e.message);
  }
}
