import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import {
  ensureSoldBinder,
  nextBinderPosition,
  slugify,
  type SmartFilter,
} from '@/lib/binders/service';

/**
 * GET  /api/binders  → the user's binders, in order, with card counts
 * POST /api/binders  → create a binder
 *
 * See docs/BINDERS_DESIGN_2026-07-30.md.
 */

const MAX_NAME = 60;
const MAX_DESCRIPTION = 300;

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }
    const supabase = supabaseServer();

    // The Sold binder is opt-in and self-maintaining; materialise or clear it
    // to match the preference before listing.
    const { data: prefRow } = await supabase
      .from('user_credits')
      .select('sold_binder_enabled')
      .eq('user_id', auth.userId)
      .maybeSingle();
    if (prefRow?.sold_binder_enabled === true) {
      await ensureSoldBinder(supabase, auth.userId);
    }

    const { data: binders, error } = await supabase
      .from('binders')
      .select('*')
      .eq('user_id', auth.userId)
      .order('position', { ascending: true });

    if (error) {
      // Pre-migration: report an empty list rather than breaking the collection.
      if ((error as any).code === '42P01' || (error as any).code === '42703') {
        return NextResponse.json({ binders: [], available: false });
      }
      console.error('[binders] list failed:', error);
      return NextResponse.json({ error: 'Failed to load binders' }, { status: 500 });
    }

    // Counts. Manual binders count membership rows; smart binders count the
    // cards their filter currently matches, so the number is never stale.
    const manualIds = (binders ?? []).filter(b => !b.smart_filter).map(b => b.id);
    const counts = new Map<string, number>();

    if (manualIds.length) {
      const { data: rows } = await supabase
        .from('binder_cards')
        .select('binder_id, card_id')
        .in('binder_id', manualIds);
      for (const r of rows ?? []) counts.set(r.binder_id, (counts.get(r.binder_id) ?? 0) + 1);
    }

    for (const b of binders ?? []) {
      if (!b.smart_filter) continue;
      const f = b.smart_filter as SmartFilter;
      let q = supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.userId)
        .is('deleted_at', null);
      if (f.ownership_status) q = q.eq('ownership_status', f.ownership_status);
      if (f.category) q = q.eq('category', f.category);
      const { count } = await q;
      counts.set(b.id, count ?? 0);
    }

    return NextResponse.json({
      available: true,
      binders: (binders ?? []).map(b => ({ ...b, card_count: counts.get(b.id) ?? 0 })),
    });
  } catch (error: any) {
    console.error('[binders] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const name = String(body?.name ?? '').trim().slice(0, MAX_NAME);
    if (!name) {
      return NextResponse.json({ error: 'Give the binder a name.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Slugs are per-user and only matter for public binders, but keeping them
    // unique on create avoids a collision the first time one is shared.
    const base = slugify(name);
    let slug = base;
    for (let n = 2; n < 50; n++) {
      const { data: clash } = await supabase
        .from('binders')
        .select('id')
        .eq('user_id', auth.userId)
        .eq('slug', slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${n}`;
    }

    const { data, error } = await supabase
      .from('binders')
      .insert({
        user_id: auth.userId,
        name,
        description: body?.description ? String(body.description).slice(0, MAX_DESCRIPTION) : null,
        accent_color: typeof body?.accent_color === 'string' ? body.accent_color.slice(0, 20) : null,
        smart_filter: body?.smart_filter ?? null,
        position: await nextBinderPosition(supabase, auth.userId),
        slug,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      if ((error as any).code === '42P01') {
        return NextResponse.json({ error: 'Binders are not available yet.' }, { status: 503 });
      }
      console.error('[binders] create failed:', error);
      return NextResponse.json({ error: 'Failed to create binder' }, { status: 500 });
    }

    return NextResponse.json({ binder: { ...data, card_count: 0 } }, { status: 201 });
  } catch (error: any) {
    console.error('[binders] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
