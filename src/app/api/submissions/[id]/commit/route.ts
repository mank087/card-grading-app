import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { commitSubmission } from '@/lib/submissions/service';
import { SUBMISSION_ERROR_STATUS } from '@/lib/submissions/types';

/**
 * POST /api/submissions/[id]/commit
 *
 * Validates the submission, creates its `cards` rows and moves it to
 * `running`. Nothing is charged here — the drain deducts per card at dispatch
 * time (idempotent on card_id), so a submission that never runs costs nothing
 * and a retried commit cannot double-charge.
 *
 * The credit gate lives in the service: an insufficient balance parks the
 * submission at `blocked_insufficient_credits` and returns 402 with
 * `required`, `balance` and `affordable`, which is what the UI needs to offer
 * "keep the first N" or "buy credits".
 */

export const maxDuration = 60;

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

  const result = await commitSubmission(id, auth.userId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, ...result.error },
      { status: SUBMISSION_ERROR_STATUS[result.error.code] }
    );
  }

  return NextResponse.json({
    success: true,
    submission: result.data.submission,
    cards_created: result.data.cardsCreated,
    item_count: result.data.itemCount,
  });
}
