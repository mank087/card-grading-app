import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { isSmart, moveCardInBinder } from '@/lib/binders/service';

/**
 * PATCH /api/binders/[id]/cards/reorder
 *   { "cardId": "...", "afterCardId": "..." | null }
 *
 * The client sends INTENT — "put this card after that one" — never a position
 * number. The server reads the neighbours and computes the midpoint, so two
 * people dragging at once can't both write the same position from stale reads.
 * null afterCardId means "move to the front".
 *
 * See src/lib/binders/position.ts for the fractional indexing itself.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Binder not found' }, { status: 404 });

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { data: binder } = await supabase
      .from('binders')
      .select('id, smart_filter')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (!binder) return NextResponse.json({ error: 'Binder not found' }, { status: 404 });
    if (isSmart(binder)) {
      return NextResponse.json(
        { error: 'This binder is sorted by its filter and can\'t be rearranged by hand.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const cardId = body?.cardId;
    const afterCardId = body?.afterCardId ?? null;

    if (!isUuid(cardId ?? '')) {
      return NextResponse.json({ error: 'cardId is required.' }, { status: 400 });
    }
    if (afterCardId !== null && !isUuid(afterCardId)) {
      return NextResponse.json({ error: 'afterCardId must be a card id or null.' }, { status: 400 });
    }
    if (afterCardId === cardId) {
      return NextResponse.json({ error: 'A card cannot be placed after itself.' }, { status: 400 });
    }

    const position = await moveCardInBinder(supabase, id, cardId, afterCardId);
    if (position === null) {
      // Almost always a stale client: the anchor card was moved or removed by
      // another tab. Ask for a refresh rather than guessing where it meant.
      return NextResponse.json(
        { error: 'That position is out of date — refresh the binder and try again.', code: 'stale_order' },
        { status: 409 }
      );
    }

    return NextResponse.json({ cardId, position });
  } catch (error: any) {
    console.error('[binders] reorder failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
