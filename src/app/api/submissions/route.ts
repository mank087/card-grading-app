import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import {
  createDraftSubmission,
  listSubmissions,
} from '@/lib/submissions/service';
import { MAX_SUBMISSION_ITEMS, SUBMISSION_ERROR_STATUS, type SubmissionItemInput } from '@/lib/submissions/types';

/**
 * POST /api/submissions  → create a draft submission (+ its item metadata)
 * GET  /api/submissions  → the caller's submissions, newest first
 *
 * A draft costs nothing: no card rows, no credits. Images are uploaded by the
 * intake stage before this is called, so the body carries storage paths only.
 * Committing is a separate, explicit call.
 */

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function parseItems(raw: unknown): SubmissionItemInput[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: 'items must be an array' };
  if (raw.length > MAX_SUBMISSION_ITEMS) {
    return { error: `A submission holds at most ${MAX_SUBMISSION_ITEMS} cards.` };
  }

  const items: SubmissionItemInput[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i] as any;
    if (!entry || typeof entry !== 'object') return { error: `items[${i}] is not an object` };

    // Position defaults to array order — the intake stage sorts by filename
    // before it posts, so array order IS scan order unless it says otherwise.
    const position = Number.isFinite(entry.position) ? Number(entry.position) : i;
    if (!Number.isInteger(position) || position < 0) {
      return { error: `items[${i}].position must be a non-negative integer` };
    }
    if (seen.has(position)) return { error: `items[${i}] repeats position ${position}` };
    seen.add(position);

    const front = typeof entry.front_path === 'string' ? entry.front_path.trim() : '';
    const back = typeof entry.back_path === 'string' ? entry.back_path.trim() : '';
    if (!front || !back) {
      return { error: `items[${i}] needs both front_path and back_path` };
    }

    items.push({
      position,
      front_path: front,
      back_path: back,
      front_hash: typeof entry.front_hash === 'string' ? entry.front_hash : null,
      back_hash: typeof entry.back_hash === 'string' ? entry.back_hash : null,
    });
  }

  return items;
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const category = typeof body?.category === 'string' ? body.category.trim() : '';
  if (!category) return badRequest('category is required');

  const parsed = parseItems(body?.items);
  if (!Array.isArray(parsed)) return badRequest(parsed.error);

  const result = await createDraftSubmission({
    userId: auth.userId,
    category,
    name: typeof body?.name === 'string' ? body.name : null,
    subCategory: typeof body?.sub_category === 'string' ? body.sub_category : null,
    binderId: typeof body?.binder_id === 'string' ? body.binder_id : null,
    source: typeof body?.source === 'string' ? body.source : 'upload',
    items: parsed,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, ...result.error },
      { status: SUBMISSION_ERROR_STATUS[result.error.code] }
    );
  }

  return NextResponse.json({
    success: true,
    submission: result.data.submission,
    item_count: result.data.itemCount,
  });
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = Number(new URL(request.url).searchParams.get('limit'));
  const result = await listSubmissions(auth.userId, Number.isFinite(limitParam) ? limitParam : 50);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, ...result.error },
      { status: SUBMISSION_ERROR_STATUS[result.error.code] }
    );
  }

  return NextResponse.json({ success: true, submissions: result.data });
}
