import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { slugify } from '@/lib/binders/service';

/**
 * PATCH  /api/binders/[id]  → rename / describe / recolour / cover / publish
 * DELETE /api/binders/[id]  → delete the BINDER ONLY
 *
 * The cards are never touched. A binder is a view onto the collection, not a
 * container that owns them — deleting one that holds 43 cards must leave all 43
 * exactly where they were. This is the highest-risk confusion in the feature,
 * so the UI says it explicitly and the route simply has no path to `cards`.
 */

async function loadOwned(supabase: any, id: string, userId: string) {
  const { data } = await supabase
    .from('binders')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

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
    const binder = await loadOwned(supabase, id, auth.userId);
    if (!binder) return NextResponse.json({ error: 'Binder not found' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    if (typeof body?.name === 'string') {
      const name = body.name.trim().slice(0, 60);
      if (!name) return NextResponse.json({ error: 'Give the binder a name.' }, { status: 400 });
      update.name = name;
      // Only re-slug a binder that has never been shared — changing the slug of
      // a public binder would break links people already have.
      if (!binder.is_public) update.slug = slugify(name);
    }
    if (typeof body?.description === 'string') update.description = body.description.slice(0, 300) || null;
    if (typeof body?.accent_color === 'string') update.accent_color = body.accent_color.slice(0, 20);
    if (body?.cover_card_id === null || isUuid(body?.cover_card_id ?? '')) {
      update.cover_card_id = body.cover_card_id;
    }
    if (typeof body?.is_public === 'boolean') update.is_public = body.is_public;
    if (typeof body?.position === 'number' && isFinite(body.position)) update.position = body.position;

    const { data, error } = await supabase
      .from('binders')
      .update(update)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[binders] update failed:', error);
      return NextResponse.json({ error: 'Failed to update binder' }, { status: 500 });
    }
    return NextResponse.json({ binder: data });
  } catch (error: any) {
    console.error('[binders] PATCH failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const binder = await loadOwned(supabase, id, auth.userId);
    if (!binder) return NextResponse.json({ error: 'Binder not found' }, { status: 404 });

    // System binders (the auto "Sold" one) are switched off via the preference,
    // not deleted — otherwise the next list request just recreates them and the
    // delete looks broken.
    if (binder.system_key) {
      return NextResponse.json(
        {
          error: 'This binder is managed for you. Turn it off in your collection settings instead.',
          code: 'system_binder',
        },
        { status: 400 }
      );
    }

    // binder_cards rows cascade. `cards` is deliberately untouched.
    const { error } = await supabase
      .from('binders')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);

    if (error) {
      console.error('[binders] delete failed:', error);
      return NextResponse.json({ error: 'Failed to delete binder' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cardsKept: true });
  } catch (error: any) {
    console.error('[binders] DELETE failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
