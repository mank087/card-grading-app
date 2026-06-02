/**
 * GET /api/ebay/eligible-cards
 *
 * Returns the authenticated user's graded cards that DON'T already have
 * an active eBay listing. Powers the CardPicker on the List a Card tab.
 *
 * "Graded" = conversational_whole_grade IS NOT NULL. Ungraded cards are
 * out of scope for v1 per the locked plan.
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

    // Two-step query: pull the user's active listing card_ids, then load
    // the rest. Supabase JS doesn't support NOT IN with a subquery cleanly,
    // and a single-roundtrip via .filter('id', 'not.in', ...) requires the
    // exclusion list inline anyway.
    const { data: activeListings } = await supabase
      .from('ebay_listings')
      .select('card_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending']);

    const excludeIds = new Set((activeListings ?? []).map(r => r.card_id).filter(Boolean));

    let query = supabase
      .from('cards')
      .select(`
        id,
        card_name,
        category,
        serial,
        front_path,
        back_path,
        conversational_whole_grade,
        conversational_condition_label,
        conversational_sub_scores,
        dcm_price_estimate,
        ebay_price_median,
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

    // Signed URLs for thumbnails (front_path).
    const paths = (cards ?? []).map(c => c.front_path).filter((p): p is string => !!p);
    const urlMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from('cards')
        .createSignedUrls(paths, 60 * 60);
      signed?.forEach(s => {
        if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
      });
    }

    const normalized = (cards ?? []).map(c => ({
      id: c.id,
      cardName: c.card_name,
      category: c.category,
      serial: c.serial,
      grade: c.conversational_whole_grade,
      conditionLabel: c.conversational_condition_label,
      subScores: c.conversational_sub_scores,
      dcmPriceEstimate: c.dcm_price_estimate ? Number(c.dcm_price_estimate) : null,
      ebayPriceMedian: c.ebay_price_median ? Number(c.ebay_price_median) : null,
      thumbnailUrl: urlMap.get(c.front_path) ?? null,
      frontPath: c.front_path,
      backPath: c.back_path,
      createdAt: c.created_at,
    }));

    return NextResponse.json({
      cards: normalized,
      alreadyListedCount: excludeIds.size,
    });
  } catch (err: any) {
    console.error('[eligible-cards] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
