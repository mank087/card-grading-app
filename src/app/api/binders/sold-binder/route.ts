import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { ensureSoldBinder, removeSoldBinder } from '@/lib/binders/service';

/**
 * GET  /api/binders/sold-binder → { enabled }
 * POST /api/binders/sold-binder → { enabled: boolean }
 *
 * Opting in surfaces a "Sold" binder alongside the user's own. It is a SMART
 * binder (filter: ownership_status = sold), so it maintains itself — mark a
 * card sold and it appears, hit "Still mine" and it leaves. Turning it off
 * deletes the binder row, never any cards; sold cards remain reachable through
 * the Sold ownership view either way.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('user_credits')
      .select('sold_binder_enabled')
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (error) return NextResponse.json({ enabled: null, available: false });
    return NextResponse.json({ enabled: data?.sold_binder_enabled ?? null, available: true });
  } catch {
    return NextResponse.json({ enabled: null, available: false });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (typeof body?.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be true or false.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { error } = await supabase
      .from('user_credits')
      .update({ sold_binder_enabled: body.enabled })
      .eq('user_id', auth.userId);

    if (error) {
      console.error('[binders] sold preference save failed:', error);
      return NextResponse.json({ error: 'Failed to save your choice' }, { status: 500 });
    }

    const binder = body.enabled
      ? await ensureSoldBinder(supabase, auth.userId)
      : (await removeSoldBinder(supabase, auth.userId), null);

    return NextResponse.json({ enabled: body.enabled, binder });
  } catch (error: any) {
    console.error('[binders] sold preference failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
