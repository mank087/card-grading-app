/**
 * GET /api/ebay/my-listings
 *
 * Returns the authenticated user's eBay listings, split by status:
 *   - active: status='active' listings (currently live on eBay)
 *   - sold:   status='sold'
 *   - ended:  status='ended' (ended without selling)
 *
 * Reads from the local ebay_listings table — kept fresh by the
 * /api/cron/ebay-sync poller. For per-row freshness the client can
 * trigger a sync manually via POST.
 *
 * Each row is joined with cards to surface the card name + thumbnail
 * for display in the marketplace dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    // Auth: Bearer token (mirrors /api/ebay/listing pattern)
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

    // Pull all listings for this user with their joined card info. Sort by
    // most-recently-updated first so newly synced changes surface at the top.
    const { data: rows, error } = await supabase
      .from('ebay_listings')
      .select(`
        id,
        card_id,
        sku,
        listing_id,
        listing_url,
        title,
        price,
        currency,
        quantity,
        quantity_sold,
        listing_format,
        duration,
        status,
        view_count,
        watch_count,
        ebay_image_urls,
        published_at,
        ended_at,
        sold_at,
        last_synced_at,
        created_at,
        updated_at,
        cards (
          id,
          card_name,
          category,
          front_path,
          serial,
          conversational_whole_grade
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[my-listings] DB error:', error);
      return NextResponse.json({ error: 'Failed to load listings' }, { status: 500 });
    }

    // Generate signed thumbnail URLs in batch. front_path is the storage path
    // inside the 'cards' bucket; we sign for 1 hour so the UI can render
    // without making per-row fetches.
    const paths = (rows ?? [])
      .map(r => (r as any).cards?.front_path)
      .filter((p): p is string => !!p);
    const urlMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from('cards')
        .createSignedUrls(paths, 60 * 60);
      signed?.forEach(s => {
        if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
      });
    }

    const normalized = (rows ?? []).map((r: any) => {
      // Prefer the eBay-uploaded labeled image — that's the one with the
      // graded label header banner that the user expects to see. Falls back
      // to the raw card image only when the listing pre-dates the image
      // generation pipeline.
      const ebayThumb = Array.isArray(r.ebay_image_urls) && r.ebay_image_urls.length > 0
        ? r.ebay_image_urls[0]
        : null;
      const thumbnailUrl = ebayThumb ?? urlMap.get(r.cards?.front_path) ?? null;
      return {
      id: r.id,
      cardId: r.card_id,
      cardName: r.cards?.card_name ?? 'Unknown card',
      cardCategory: r.cards?.category ?? null,
      cardSerial: r.cards?.serial ?? null,
      cardGrade: r.cards?.conversational_whole_grade ?? null,
      thumbnailUrl,
      sku: r.sku,
      listingId: r.listing_id,
      listingUrl: r.listing_url,
      title: r.title,
      // Guard against null/undefined/non-numeric price so the client's
      // `.toFixed()` calls never blow up rendering for a malformed row.
      price: Number.isFinite(Number(r.price)) ? Number(r.price) : 0,
      currency: r.currency,
      quantity: r.quantity,
      quantitySold: r.quantity_sold ?? 0,
      listingFormat: r.listing_format,
      duration: r.duration,
      status: r.status,
      viewCount: r.view_count ?? 0,
      watchCount: r.watch_count ?? 0,
      publishedAt: r.published_at,
      endedAt: r.ended_at,
      soldAt: r.sold_at,
      lastSyncedAt: r.last_synced_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    });

    return NextResponse.json({
      active: normalized.filter(l => l.status === 'active' || l.status === 'pending'),
      sold: normalized.filter(l => l.status === 'sold'),
      ended: normalized.filter(l => l.status === 'ended' || l.status === 'cancelled'),
    });
  } catch (err: any) {
    console.error('[my-listings] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
