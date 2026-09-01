import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { cancelSubmission } from '@/lib/submissions/service';
import { SUBMISSION_ERROR_STATUS } from '@/lib/submissions/types';

/**
 * POST /api/submissions/[id]/cancel
 *
 * Stops queued work. Items already dispatched are left alone: that grade is
 * running in its own 300s function against a charged card, and yanking the
 * row would strand it. Those items still reconcile on a later drain pass.
 */

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

  const result = await cancelSubmission(id, auth.userId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, ...result.error },
      { status: SUBMISSION_ERROR_STATUS[result.error.code] }
    );
  }

  return NextResponse.json({
    success: true,
    submission: result.data.submission,
    cancelled_items: result.data.cancelledItems,
  });
}
