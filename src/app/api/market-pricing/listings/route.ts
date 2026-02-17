import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { isActiveCardLover } from '@/lib/credits';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }

    const isCardLover = await isActiveCardLover(auth.userId);
    if (!isCardLover) {
      return NextResponse.json({ error: 'Card Lovers subscription required' }, { status: 403 });
    }

    const supabase = supabaseServer();

    const { data: listings, error } = await supabase
      .from('ebay_listings')
      .select(`
        id, card_id, listing_id, listing_url, title, price, currency,
        listing_format, status, created_at, published_at, ended_at, sold_at
      `)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Market Pricing] Error fetching listings:', error);
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
    }

    // Get card info for listed cards
    const cardIds = (listings || []).map(l => l.card_id).filter(Boolean);
    let cardMap = new Map<string, Record<string, unknown>>();

    if (cardIds.length > 0) {
      const { data: cards } = await supabase
        .from('cards')
        .select('id, card_name, featured, pokemon_featured, category, front_path, conversational_decimal_grade')
        .in('id', cardIds);

      if (cards) {
        // Generate signed URLs for thumbnails
        const frontPaths = cards.map(c => c.front_path).filter(Boolean);
        let urlMap = new Map<string, string>();
        if (frontPaths.length > 0) {
          const { data: signedUrls } = await supabase.storage
            .from('cards')
            .createSignedUrls(frontPaths, 60 * 60);
          signedUrls?.forEach(item => {
            if (item.path && item.signedUrl) urlMap.set(item.path, item.signedUrl);
          });
        }

        for (const card of cards) {
          cardMap.set(card.id, {
            ...card,
            imageUrl: urlMap.get(card.front_path) || null,
            displayName: card.featured || card.pokemon_featured || card.card_name || 'Unknown Card',
          });
        }
      }
    }

    const enrichedListings = (listings || []).map(listing => {
      const card = cardMap.get(listing.card_id);
      return {
        ...listing,
        card: card ? {
          name: card.displayName,
          category: card.category,
          grade: card.conversational_decimal_grade,
          imageUrl: card.imageUrl,
        } : null,
      };
    });

    return NextResponse.json({ listings: enrichedListings });
  } catch (error) {
    console.error('[Market Pricing] Listings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
