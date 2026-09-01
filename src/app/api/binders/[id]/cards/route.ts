import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { isUuid } from '@/lib/uuid';
import { createSignedUrlMap } from '@/lib/signedUrlBatch';
import { addCardsToBinder, applySmartFilter, isSmart, type SmartFilter } from '@/lib/binders/service';

/**
 * GET    /api/binders/[id]/cards   → the binder's cards, in order, keyset-paged
 * POST   /api/binders/[id]/cards   → add cards      { cardIds: [...] }
 * DELETE /api/binders/[id]/cards   → remove cards   { cardIds: [...] }
 *
 * Removing a card from a binder does NOT delete the card — it stays in the
 * collection and in any other binder it belongs to.
 */

const PAGE_SIZE = 60;

/** Columns the collection grid actually renders. The cards table carries
 *  multi-MB grading blobs this view never reads. */
const CARD_COLUMNS = `
  id, serial, front_path, back_path, card_name, featured, pokemon_featured,
  category, sub_category, card_set, card_number, release_date, manufacturer_name,
  visibility, created_at,
  conversational_whole_grade, conversational_decimal_grade,
  conversational_condition_label, conversational_card_info,
  ownership_status, sold_at, sold_price, sold_channel,
  dcm_price_estimate, ebay_price_median, scryfall_price_usd, is_foil,
  custom_label_data, card_colors
`;
// card_colors is the per-card sampled palette the heritage slab bands are drawn
// from. /api/cards/my-collection selects it, this route did not, so every card
// opened inside a binder fell through resolveHeritageBandColors() to the DCM
// brand purple while the same card in My Collection sampled correctly. It is a
// small JSON blob (a handful of hex strings), not one of the multi-MB grading
// columns this list exists to keep out.

async function loadOwned(supabase: any, id: string, userId: string) {
  const { data } = await supabase
    .from('binders').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  return data;
}

export async function GET(
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

    const url = new URL(request.url);
    const cursorPos = url.searchParams.get('cursorPos');
    const cursorId = url.searchParams.get('cursorId');

    // ---- Smart binder: evaluate the filter, no membership rows ----
    if (isSmart(binder)) {
      let q = supabase
        .from('cards')
        .select(CARD_COLUMNS)
        .eq('user_id', auth.userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      q = applySmartFilter(q, binder.smart_filter as SmartFilter);
      if (cursorPos) q = q.lt('created_at', cursorPos);

      const { data, error } = await q;
      if (error) {
        console.error('[binders] smart read failed:', error);
        return NextResponse.json({ error: 'Failed to load binder' }, { status: 500 });
      }
      const cards = (data ?? []) as unknown as Record<string, any>[];
      const last = cards[cards.length - 1];
      return NextResponse.json({
        binder,
        cards: await withImageUrls(supabase, cards),
        smart: true,
        reorderable: false,
        nextCursor: cards.length === PAGE_SIZE ? { cursorPos: last?.created_at, cursorId: last?.id } : null,
      });
    }

    // ---- Manual binder: keyset page over (position, card_id) ----
    // Keyset, not offset: reordering shifts rows across page boundaries, so an
    // offset page would show duplicates or skip cards mid-scroll.
    let memQ = supabase
      .from('binder_cards')
      .select('card_id, position')
      .eq('binder_id', id)
      .order('position', { ascending: true })
      .order('card_id', { ascending: true })
      .limit(PAGE_SIZE);

    if (cursorPos && cursorId) {
      memQ = memQ.or(`position.gt.${cursorPos},and(position.eq.${cursorPos},card_id.gt.${cursorId})`);
    }

    const { data: members, error: memErr } = await memQ;
    if (memErr) {
      console.error('[binders] membership read failed:', memErr);
      return NextResponse.json({ error: 'Failed to load binder' }, { status: 500 });
    }
    if (!members?.length) {
      return NextResponse.json({ binder, cards: [], smart: false, reorderable: true, nextCursor: null });
    }

    const { data: cardRows } = await supabase
      .from('cards')
      .select(CARD_COLUMNS)
      .in('id', members.map(m => m.card_id))
      .is('deleted_at', null);

    // Restore binder order (the IN query returns arbitrary order), and drop
    // soft-deleted cards — their membership row survives so a restore silently
    // puts them back.
    const byId = new Map((cardRows ?? []).map((c: any) => [c.id, c]));
    const ordered = members
      .map(m => byId.get(m.card_id))
      .filter(Boolean) as Record<string, any>[];

    const last = members[members.length - 1];
    return NextResponse.json({
      binder,
      cards: await withImageUrls(supabase, ordered),
      smart: false,
      reorderable: true,
      nextCursor: members.length === PAGE_SIZE
        ? { cursorPos: String(last.position), cursorId: last.card_id }
        : null,
    });
  } catch (error: any) {
    console.error('[binders] cards GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function withImageUrls(supabase: any, cards: Record<string, any>[]) {
  const paths = cards.flatMap(c => [c.front_path, c.back_path]).filter(Boolean);
  if (!paths.length) return cards.map(c => ({ ...c, front_url: null, back_url: null }));
  try {
    const map = await createSignedUrlMap(supabase.storage, 'cards', paths, 60 * 60);
    return cards.map(c => ({
      ...c,
      front_url: c.front_path ? map.get(c.front_path) ?? null : null,
      back_url: c.back_path ? map.get(c.back_path) ?? null : null,
    }));
  } catch {
    return cards.map(c => ({ ...c, front_url: null, back_url: null }));
  }
}

export async function POST(
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
    if (isSmart(binder)) {
      return NextResponse.json(
        { error: 'This binder fills itself from a filter — cards can\'t be added by hand.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const cardIds: string[] = Array.isArray(body?.cardIds) ? body.cardIds.filter(isUuid) : [];
    if (!cardIds.length) return NextResponse.json({ error: 'No cards supplied.' }, { status: 400 });

    // Only the user's own, live cards — never let a binder reference someone
    // else's card by guessing an id.
    const { data: owned } = await supabase
      .from('cards')
      .select('id')
      .eq('user_id', auth.userId)
      .is('deleted_at', null)
      .in('id', cardIds);
    const ownedIds = (owned ?? []).map((c: any) => c.id);
    if (!ownedIds.length) return NextResponse.json({ error: 'No matching cards.' }, { status: 404 });

    const added = await addCardsToBinder(supabase, id, ownedIds);
    return NextResponse.json({ added, skipped: ownedIds.length - added });
  } catch (error: any) {
    console.error('[binders] cards POST failed:', error);
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

    const body = await request.json().catch(() => null);
    const cardIds: string[] = Array.isArray(body?.cardIds) ? body.cardIds.filter(isUuid) : [];
    if (!cardIds.length) return NextResponse.json({ error: 'No cards supplied.' }, { status: 400 });

    // Membership only. The cards stay in the collection.
    const { error } = await supabase
      .from('binder_cards')
      .delete()
      .eq('binder_id', id)
      .in('card_id', cardIds);

    if (error) {
      console.error('[binders] remove failed:', error);
      return NextResponse.json({ error: 'Failed to remove cards' }, { status: 500 });
    }
    return NextResponse.json({ removed: cardIds.length, cardsKept: true });
  } catch (error: any) {
    console.error('[binders] cards DELETE failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
