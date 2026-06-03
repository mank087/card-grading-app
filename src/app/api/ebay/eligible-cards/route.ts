/**
 * GET /api/ebay/eligible-cards
 *
 * Returns the authenticated user's graded cards that DON'T already have
 * an active eBay listing. Powers the CardPicker on the List a Card tab.
 *
 * Returns each card with its raw snake_case schema (the shape the
 * EbayListingModal expects — it reads card.conversational_whole_grade,
 * card.front_path, card.card_name, etc.) plus front_url + back_url as
 * signed Supabase Storage URLs so the modal's image pipeline works
 * exactly like it does from the card-detail page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const supabase = supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Optional server-side text search. When `?q=` is present we narrow
    // at the database level (ILIKE on card_name OR serial) so even users
    // with thousands of cards can find a specific one without the client
    // ever pulling the whole list.
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();

    // Exclude cards that currently have an active listing — the user already
    // listed them via InstaList, no need to surface them again.
    const { data: activeListings } = await supabase
      .from('ebay_listings')
      .select('card_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending']);

    const excludeIds = new Set((activeListings ?? []).map(r => r.card_id).filter(Boolean));

    // SELECT * to mirror the per-category card-detail APIs (e.g.
    // /api/sports/[id]) — they also select '*' so the EbayListingModal
    // always sees the same shape regardless of where the user opens it
    // from. Avoids 500s if any conversational_* / item-specifics column
    // is added or removed from the cards schema later.
    //
    // Default limit bumped to 2000 (was 500) — most users have <500
    // graded cards; power users can have 500-2000+. With a server-side
    // search escape hatch above, the cap is now a safety net rather
    // than a functional limit.
    const HARD_LIMIT = q ? 100 : 2000;
    let query = supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(HARD_LIMIT);

    if (q) {
      // Escape the % and _ wildcards so users searching for literal
      // characters don't accidentally match everything. Then wrap with
      // %…% for substring match. .or() takes a PostgREST filter string.
      const safe = q.replace(/[%_]/g, ch => `\\${ch}`);
      query = query.or(`card_name.ilike.%${safe}%,serial.ilike.%${safe}%`);
    }

    const { data: cards, error } = await query;

    if (error) {
      console.error('[eligible-cards] DB error:', error);
      return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
    }

    // Filter out already-listed cards in JS rather than a PostgREST
    // `not.in.(...)` URL filter — that filter encodes every excluded UUID
    // into the request URL and breaks (HTTP 414) for power users with many
    // active listings. JS-side filtering scales without that risk.
    const eligibleRows = (cards ?? []).filter(c => !excludeIds.has(c.id));

    // (cards.length === HARD_LIMIT) means we hit the cap. For search
    // queries hitting the cap is normal (means "100+ matches, refine
    // further"); for unfiltered fetches it means "2000+ cards exist".
    const hitCap = (cards?.length ?? 0) >= HARD_LIMIT;

    // Batch-sign both front AND back paths so the modal has working URLs
    // for its image generation pipeline without making per-card storage calls.
    const allPaths: string[] = [];
    for (const c of eligibleRows) {
      if (c.front_path) allPaths.push(c.front_path);
      if (c.back_path) allPaths.push(c.back_path);
    }
    const urlMap = new Map<string, string>();
    if (allPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from('cards')
        .createSignedUrls(allPaths, 60 * 60);
      signed?.forEach(s => {
        if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
      });
    }

    const enriched = eligibleRows.map(c => ({
      ...c,
      front_url: c.front_path ? urlMap.get(c.front_path) ?? null : null,
      back_url: c.back_path ? urlMap.get(c.back_path) ?? null : null,
    }));

    return NextResponse.json({
      cards: enriched,
      alreadyListedCount: excludeIds.size,
      // Signals UI behavior: truncated=true means we hit the cap. For
      // unfiltered fetches that's "2000+ cards exist, refine to find
      // older ones." For search queries that's "100+ matches, narrow it."
      truncated: hitCap,
      query: q || undefined,
    });
  } catch (err: any) {
    console.error('[eligible-cards] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
