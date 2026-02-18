import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { isActiveCardLover } from '@/lib/credits';
import { supabaseServer } from '@/lib/supabaseServer';

// DB stores: Pokemon, MTG, Lorcana, One Piece, Other, or sport names (Football, Baseball, etc.)
const SPORTS_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'];

function getCategoryPath(category: string): string {
  if (category === 'Pokemon') return 'pokemon';
  if (category === 'MTG') return 'mtg';
  if (category === 'Lorcana') return 'lorcana';
  if (category === 'One Piece') return 'onepiece';
  if (category === 'Other') return 'other';
  // Sports categories use the /sports/ path
  return 'sports';
}

function getCardValue(card: Record<string, unknown>): number {
  return (card.dcm_price_estimate as number)
    || (card.ebay_price_median as number)
    || (card.scryfall_price_usd as number)
    || 0;
}

function getCardName(card: Record<string, unknown>): string {
  return (card.featured as string)
    || (card.pokemon_featured as string)
    || (card.card_name as string)
    || 'Unknown Card';
}

function getCardPath(card: Record<string, unknown>): string {
  const category = (card.category as string) || 'Other';
  return `/${getCategoryPath(category)}/${card.id}`;
}

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

    // Fetch all user cards with pricing columns (lighter query than my-collection)
    const { data: cards, error } = await supabase
      .from('cards')
      .select(`
        id, card_name, featured, pokemon_featured, category, card_set, card_number, front_path,
        conversational_decimal_grade, conversational_whole_grade, conversational_condition_label,
        ebay_price_lowest, ebay_price_median, ebay_price_average, ebay_price_highest,
        dcm_price_estimate, dcm_price_raw, dcm_price_graded_high, dcm_price_median, dcm_price_average,
        dcm_price_updated_at, dcm_price_match_confidence,
        scryfall_price_usd, scryfall_price_usd_foil
      `)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Market Pricing] Error fetching cards:', error);
      return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        totalValue: 0,
        totalCards: 0,
        cardsWithValue: 0,
        categoryBreakdown: [],
        topCards: [],
        movers: { gainers: [], losers: [] },
      });
    }

    // Calculate portfolio value and category breakdown
    let totalValue = 0;
    let cardsWithValue = 0;
    const categoryMap = new Map<string, { count: number; value: number }>();
    const cardValues: Array<{ card: Record<string, unknown>; value: number }> = [];

    for (const card of cards) {
      const value = getCardValue(card);
      if (value > 0) {
        cardsWithValue++;
        totalValue += value;
      }
      cardValues.push({ card, value });

      const category = (card.category as string) || 'other';
      const existing = categoryMap.get(category) || { count: 0, value: 0 };
      existing.count++;
      existing.value += value;
      categoryMap.set(category, existing);
    }

    // Category breakdown
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      value: Math.round(data.value * 100) / 100,
      percentage: totalValue > 0 ? Math.round((data.value / totalValue) * 1000) / 10 : 0,
    })).sort((a, b) => b.value - a.value);

    // Top 10 most valuable cards
    const sortedByValue = [...cardValues].sort((a, b) => b.value - a.value);
    const top10 = sortedByValue.slice(0, 10).filter(item => item.value > 0);

    // Generate signed URLs only for top 10 thumbnails
    let urlMap = new Map<string, string>();
    if (top10.length > 0) {
      const frontPaths = top10.map(item => item.card.front_path as string).filter(Boolean);
      if (frontPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from('cards')
          .createSignedUrls(frontPaths, 60 * 60);
        signedUrls?.forEach(item => {
          if (item.path && item.signedUrl) {
            urlMap.set(item.path, item.signedUrl);
          }
        });
      }
    }

    const topCards = top10.map(item => ({
      id: item.card.id as string,
      name: getCardName(item.card),
      category: (item.card.category as string) || 'other',
      grade: (item.card.conversational_decimal_grade as number) || (item.card.conversational_whole_grade as number) || 0,
      conditionLabel: (item.card.conversational_condition_label as string) || '',
      value: Math.round(item.value * 100) / 100,
      imageUrl: urlMap.get(item.card.front_path as string) || null,
      cardPath: getCardPath(item.card),
      cardSet: (item.card.card_set as string) || '',
      cardNumber: (item.card.card_number as string) || '',
    }));

    // Movers: compare latest vs previous price for cards with history
    const cardIdsWithPricing = cards
      .filter(c => c.dcm_price_updated_at || c.ebay_price_median)
      .map(c => c.id as string);

    let movers: { gainers: typeof topCards; losers: typeof topCards } = { gainers: [], losers: [] };

    if (cardIdsWithPricing.length > 0) {
      // Get price history entries for user's cards in chunks
      // (PostgREST has URL length limits with large .in() clauses)
      // Prefer dcm_price_estimate (PriceCharting) over median_price (eBay listings)
      const priceHistory: Array<{ card_id: string; median_price: number | null; dcm_price_estimate: number | null; recorded_at: string }> = [];
      const chunkSize = 50;
      for (let i = 0; i < cardIdsWithPricing.length; i += chunkSize) {
        const chunk = cardIdsWithPricing.slice(i, i + chunkSize);
        const { data: chunkData } = await supabase
          .from('card_price_history')
          .select('card_id, median_price, dcm_price_estimate, recorded_at')
          .in('card_id', chunk)
          .order('recorded_at', { ascending: false });
        if (chunkData) priceHistory.push(...chunkData);
      }

      if (priceHistory.length > 0) {
        // Group by card_id, get latest 2 entries
        // Use dcm_price_estimate if available, fall back to median_price (eBay)
        const historyByCard = new Map<string, number[]>();
        for (const entry of priceHistory) {
          const price = entry.dcm_price_estimate ?? entry.median_price;
          if (price === null || price === undefined) continue;
          const existing = historyByCard.get(entry.card_id) || [];
          if (existing.length < 2) {
            existing.push(price);
            historyByCard.set(entry.card_id, existing);
          }
        }

        // Calculate % change
        const changes: Array<{ cardId: string; changePercent: number }> = [];
        historyByCard.forEach((prices, cardId) => {
          if (prices.length === 2 && prices[1] > 0) {
            const changePercent = ((prices[0] - prices[1]) / prices[1]) * 100;
            if (Math.abs(changePercent) >= 0.1) { // Show even small changes
              changes.push({ cardId, changePercent: Math.round(changePercent * 10) / 10 });
            }
          }
        });

        // Sort for gainers and losers
        const sorted = changes.sort((a, b) => b.changePercent - a.changePercent);
        const gainers = sorted.filter(c => c.changePercent > 0).slice(0, 5);
        const losers = sorted.filter(c => c.changePercent < 0).slice(-5).reverse();

        const getCardById = (id: string) => cards.find(c => c.id === id);

        movers = {
          gainers: gainers.map(g => {
            const card = getCardById(g.cardId);
            return {
              id: g.cardId,
              name: card ? getCardName(card) : 'Unknown',
              category: (card?.category as string) || 'other',
              grade: (card?.conversational_decimal_grade as number) || 0,
              conditionLabel: '',
              value: card ? getCardValue(card) : 0,
              imageUrl: null,
              cardPath: card ? getCardPath(card) : '#',
              cardSet: (card?.card_set as string) || '',
              cardNumber: (card?.card_number as string) || '',
              changePercent: g.changePercent,
            };
          }),
          losers: losers.map(l => {
            const card = getCardById(l.cardId);
            return {
              id: l.cardId,
              name: card ? getCardName(card) : 'Unknown',
              category: (card?.category as string) || 'other',
              grade: (card?.conversational_decimal_grade as number) || 0,
              conditionLabel: '',
              value: card ? getCardValue(card) : 0,
              imageUrl: null,
              cardPath: card ? getCardPath(card) : '#',
              cardSet: (card?.card_set as string) || '',
              cardNumber: (card?.card_number as string) || '',
              changePercent: l.changePercent,
            };
          }),
        };
      }
    }

    return NextResponse.json({
      totalValue: Math.round(totalValue * 100) / 100,
      totalCards: cards.length,
      cardsWithValue,
      categoryBreakdown,
      topCards,
      movers,
    });
  } catch (error) {
    console.error('[Market Pricing] Portfolio error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
