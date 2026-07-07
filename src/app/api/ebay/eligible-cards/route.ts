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
import { createSignedUrlMap } from '@/lib/signedUrlBatch';

/**
 * Explicit column list — the cards table carries several very large JSON /
 * markdown blobs (ai_grading, dvg_grading, conversational_grading, raw API
 * caches, defect coordinate maps, ...) that the marketplace flow never
 * reads. SELECT * shipped all of them for up to 2000 rows (multi-MB
 * responses). This list is the union of every field the client consumes:
 *   - CardPicker / ListNewTab / MarketplaceClient (picker display, relist,
 *     categoryToCardType) and the mobile marketplace picker
 *   - EbayListingModal (title/description/image generation/PDF report)
 *   - resolveCardValue (price seed)
 *   - mapCardToItemSpecifics (eBay item specifics)
 *   - getCardLabelData -> generateLabelData (label images)
 * If the modal grows a new card-field read, add the column here too — a
 * missing field silently degrades the listing payload.
 */
const CARD_COLUMNS = [
  // Identity + picker display
  'id', 'card_name', 'category', 'sub_category', 'serial',
  'front_path', 'back_path', 'created_at',
  // Grading (labels, title, description, mini report, PDF report)
  'conversational_whole_grade', 'conversational_decimal_grade',
  'conversational_condition_label', 'conversational_grade_uncertainty',
  'conversational_card_info', 'conversational_sub_scores',
  'conversational_weighted_sub_scores', 'conversational_final_grade_summary',
  'estimated_professional_grades', 'dvg_whole_grade', 'dvg_decimal_grade',
  // Pricing (resolveCardValue chain + picker value sort)
  'dcm_price_estimate', 'dcm_cached_prices', 'ebay_price_median',
  'scryfall_price_usd', 'scryfall_price_usd_foil',
  // Label + item-specifics attributes
  'featured', 'pokemon_featured', 'card_set', 'card_number', 'release_date',
  'serial_numbering', 'rarity_tier', 'rarity_description', 'autographed',
  'autograph_type', 'memorabilia_type', 'rookie_card', 'first_print_rookie',
  'holofoil', 'is_foil', 'foil_type', 'is_double_faced', 'mtg_rarity',
  'is_enchanted', 'manufacturer', 'custom_label_data',
].join(',');

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
    // Strip PostgREST structural characters up front — `.or()` takes a raw
    // filter string where , ( ) are syntax, so a query like "Pikachu (Jungle)"
    // would corrupt the filter. They're never meaningful for a name/serial
    // substring search, so replacing with spaces is lossless in practice.
    const q = (url.searchParams.get('q') || '')
      .replace(/[,()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Exclude cards that currently have an active listing — the user already
    // listed them via InstaList, no need to surface them again.
    const { data: activeListings } = await supabase
      .from('ebay_listings')
      .select('card_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending']);

    const excludeIds = new Set((activeListings ?? []).map(r => r.card_id).filter(Boolean));

    // Default limit bumped to 2000 (was 500) — most users have <500
    // graded cards; power users can have 500-2000+. With a server-side
    // search escape hatch above, the cap is now a safety net rather
    // than a functional limit.
    const HARD_LIMIT = q ? 100 : 2000;
    let query = supabase
      .from('cards')
      .select(CARD_COLUMNS)
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

    const { data, error } = await query;
    // supabase-js can't statically parse a runtime-joined column string,
    // so type the rows explicitly (they're plain card records).
    const cards = (data ?? []) as unknown as Record<string, any>[];

    if (error) {
      console.error('[eligible-cards] DB error:', error);
      return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
    }

    // Filter out already-listed cards in JS rather than a PostgREST
    // `not.in.(...)` URL filter — that filter encodes every excluded UUID
    // into the request URL and breaks (HTTP 414) for power users with many
    // active listings. JS-side filtering scales without that risk.
    const eligibleRows = cards.filter(c => !excludeIds.has(c.id));

    // (cards.length === HARD_LIMIT) means we hit the cap. For search
    // queries hitting the cap is normal (means "100+ matches, refine
    // further"); for unfiltered fetches it means "2000+ cards exist".
    const hitCap = cards.length >= HARD_LIMIT;

    // Batch-sign both front AND back paths so the modal has working URLs
    // for its image generation pipeline without making per-card storage calls.
    const allPaths: string[] = [];
    for (const c of eligibleRows) {
      if (c.front_path) allPaths.push(c.front_path);
      if (c.back_path) allPaths.push(c.back_path);
    }
    // Chunked — Supabase rejects >1000 paths per request, and the 2000-card cap
    // here means up to 4000 paths (collections >500 cards used to get no images)
    let urlMap = new Map<string, string>();
    if (allPaths.length > 0) {
      try {
        urlMap = await createSignedUrlMap(supabase.storage, 'cards', allPaths, 60 * 60);
      } catch (signErr) {
        console.error('[eligible-cards] Error creating signed URLs:', signErr);
      }
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
