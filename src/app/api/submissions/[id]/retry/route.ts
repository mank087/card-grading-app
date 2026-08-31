import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { retrySubmissionItems } from '@/lib/submissions/service';
import { SUBMISSION_ERROR_STATUS } from '@/lib/submissions/types';

/**
 * POST /api/submissions/[id]/retry
 *
 * Requeues every `failed` item (status='queued', attempts=0, error=null,
 * claimed_at=null) and, if the submission had actually stopped
 * (complete/failed/paused/blocked_insufficient_credits), flips it back to
 * `running` with `completed_at` cleared. No credit logic lives here: an item
 * that was already charged before it failed is handled idempotently by
 * deductCredit at drain time, keyed on card_id — a requeue never double-
 * charges and never needs to know whether the charge already happened.
 *
 * Mirrors the owner-auth pattern of the sibling commit/cancel routes. The
 * caller (the progress page's "Retry failed" button) still kicks the drain
 * afterward so the first tick doesn't wait for the cron.
 */

export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
  }

  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result = await retrySubmissionItems(id, auth.userId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, ...result.error },
      { status: SUBMISSION_ERROR_STATUS[result.error.code] }
    );
  }

  return NextResponse.json({
    success: true,
    submission: result.data.submission,
    requeued: result.data.requeued,
  });
}
