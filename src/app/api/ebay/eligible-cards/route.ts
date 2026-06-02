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

    // Exclude cards that currently have an active listing — the user already
    // listed them via InstaList, no need to surface them again.
    const { data: activeListings } = await supabase
      .from('ebay_listings')
      .select('card_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending']);

    const excludeIds = new Set((activeListings ?? []).map(r => r.card_id).filter(Boolean));

    // Select the full set of conversational + card fields the
    // EbayListingModal reads. Mirrors what the per-category card-detail
    // APIs return for the same modal so the listing flow behaves identically.
    let query = supabase
      .from('cards')
      .select(`
        id,
        serial,
        card_name,
        category,
        front_path,
        back_path,
        featured,
        pokemon_featured,
        card_set,
        card_number,
        release_date,
        manufacturer_name,
        conversational_whole_grade,
        conversational_decimal_grade,
        conversational_condition_label,
        conversational_card_info,
        conversational_sub_scores,
        conversational_weighted_sub_scores,
        conversational_final_grade_summary,
        conversational_summary,
        conversational_image_confidence,
        conversational_limiting_factor,
        is_foil,
        foil_type,
        is_double_faced,
        mtg_rarity,
        holofoil,
        serial_numbering,
        rarity_tier,
        rarity_description,
        autographed,
        autograph_type,
        memorabilia_type,
        rookie_card,
        first_print_rookie,
        dcm_price_estimate,
        ebay_price_median,
        scryfall_price_usd,
        created_at
      `)
      .eq('user_id', user.id)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (excludeIds.size > 0) {
      query = query.not('id', 'in', `(${[...excludeIds].map(id => `"${id}"`).join(',')})`);
    }

    const { data: cards, error } = await query;
    if (error) {
      console.error('[eligible-cards] DB error:', error);
      return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
    }

    // Batch-sign both front AND back paths so the modal has working URLs
    // for its image generation pipeline without making per-card storage calls.
    const allPaths: string[] = [];
    for (const c of cards ?? []) {
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

    const enriched = (cards ?? []).map(c => ({
      ...c,
      front_url: c.front_path ? urlMap.get(c.front_path) ?? null : null,
      back_url: c.back_path ? urlMap.get(c.back_path) ?? null : null,
    }));

    return NextResponse.json({
      cards: enriched,
      alreadyListedCount: excludeIds.size,
    });
  } catch (err: any) {
    console.error('[eligible-cards] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
