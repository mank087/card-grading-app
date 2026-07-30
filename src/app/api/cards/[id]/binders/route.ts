import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';

/**
 * GET /api/cards/[id]/binders → { binderIds: [...] }
 *
 * Which of the owner's binders hold this card. Powers the picker at the bottom
 * of a card detail page. Owner-only: which binders someone files a card into is
 * their business, not a viewer's.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }

    const supabase = supabaseServer();

    const { data: card } = await supabase
      .from('cards')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!card || card.user_id !== auth.userId) {
      return NextResponse.json({ binderIds: [] });
    }

    // Constrain to binders this user owns so a membership row can never leak
    // someone else's binder id.
    const { data, error } = await supabase
      .from('binder_cards')
      .select('binder_id, binders!inner(user_id)')
      .eq('card_id', id)
      .eq('binders.user_id', auth.userId);

    if (error) {
      // Pre-migration: no binders table yet.
      if ((error as any).code === '42P01') return NextResponse.json({ binderIds: [], available: false });
      console.error('[card binders] read failed:', error);
      return NextResponse.json({ binderIds: [] });
    }

    return NextResponse.json({ binderIds: (data ?? []).map((r: any) => r.binder_id) });
  } catch (error: any) {
    console.error('[card binders] GET failed:', error);
    return NextResponse.json({ binderIds: [] });
  }
}
