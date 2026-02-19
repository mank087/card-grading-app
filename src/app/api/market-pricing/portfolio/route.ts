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
  const category = (card.category as string) || 'Other';

  // Primary: dcm_price_estimate column
  if (card.dcm_price_estimate != null && (card.dcm_price_estimate as number) > 0) {
    return card.dcm_price_estimate as number;
  }

  // Fallback: dcm_cached_prices JSON blob (older cards before column was added)
  const cached = card.dcm_cached_prices as Record<string, unknown> | null;
  if (cached?.estimatedValue != null && (cached.estimatedValue as number) > 0) {
    return cached.estimatedValue as number;
  }

  // MTG foil-aware Scryfall fallback
  if (category === 'MTG') {
    if (card.is_foil && (card.scryfall_price_usd_foil as number) > 0) {
      return card.scryfall_price_usd_foil as number;
    }
    if ((card.scryfall_price_usd as number) > 0) {
      return card.scryfall_price_usd as number;
    }
  }

  // eBay median as final fallback
  if (card.ebay_price_median != null && (card.ebay_price_median as number) > 0) {
    return card.ebay_price_median as number;
  }

  return 0;
}

// Parse card_info from conversational_grading JSON string (fallback for older cards)
function parseConversationalGradingName(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    const info = parsed?.card_info;
    return info?.player_or_character || info?.card_name || null;
  } catch {
    return null;
  }
}

function getCardName(card: Record<string, unknown>): string {
  // Priority: conversational_card_info → top-level DB fields → conversational_grading JSON string → dvg_grading
  const convInfo = card.conversational_card_info as Record<string, unknown> | null;
  const dvgGrading = card.dvg_grading as Record<string, unknown> | null;
  const dvgCardInfo = dvgGrading?.card_info as Record<string, unknown> | null;
  return (convInfo?.player_or_character as string)
    || (card.featured as string)
    || (card.pokemon_featured as string)
    || (card.card_name as string)
    || parseConversationalGradingName(card.conversational_grading)
    || (dvgCardInfo?.player_or_character as string)
    || (convInfo?.card_name as string)
    || (dvgCardInfo?.card_name as string)
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

    // Parse optional category filter
    const categoryFilter = request.nextUrl.searchParams.get('category') || null;

    const supabase = supabaseServer();

    // Fetch all user cards with pricing columns (lighter query than my-collection)
    const { data: allCards, error } = await supabase
      .from('cards')
      .select(`
        id, card_name, featured, pokemon_featured, conversational_card_info, conversational_grading, dvg_grading,
        category, card_set, card_number, front_path, is_foil,
        conversational_decimal_grade, conversational_whole_grade, conversational_condition_label,
        ebay_price_lowest, ebay_price_median, ebay_price_average, ebay_price_highest,
        dcm_price_estimate, dcm_price_raw, dcm_price_graded_high, dcm_price_median, dcm_price_average,
        dcm_price_updated_at, dcm_price_match_confidence, dcm_cached_prices,
        dcm_price_at_grading, dcm_price_at_grading_date,
        scryfall_price_usd, scryfall_price_usd_foil
      `)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Market Pricing] Error fetching cards:', error);
      return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
    }

    if (!allCards || allCards.length === 0) {
      return NextResponse.json({
        totalValue: 0,
        totalCards: 0,
        cardsWithValue: 0,
        categoryBreakdown: [],
        topCards: [],
        movers: { gainers: [], losers: [] },
        gradeDistribution: [],
        valueDistribution: [],
        valueByGrade: [],
        topSets: [],
        priceSourceBreakdown: [],
        gradeVsValue: [],
      });
    }

    // Always compute category breakdown from ALL cards (powers the selector UI)
    const allCategoryMap = new Map<string, { count: number; value: number }>();
    let allTotalValue = 0;
    for (const card of allCards) {
      const value = getCardValue(card);
      const category = (card.category as string) || 'Other';
      const existing = allCategoryMap.get(category) || { count: 0, value: 0 };
      existing.count++;
      existing.value += value;
      allCategoryMap.set(category, existing);
      allTotalValue += value;
    }

    const categoryBreakdown = Array.from(allCategoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      value: Math.round(data.value * 100) / 100,
      percentage: allTotalValue > 0 ? Math.round((data.value / allTotalValue) * 1000) / 10 : 0,
    })).sort((a, b) => b.value - a.value);

    // Apply category filter if provided
    let cards = allCards;
    if (categoryFilter) {
      cards = allCards.filter(c => (c.category as string) === categoryFilter);
    }

    // Calculate portfolio value from (possibly filtered) cards
    let totalValue = 0;
    let cardsWithValue = 0;
    const cardValues: Array<{ card: Record<string, unknown>; value: number }> = [];

    for (const card of cards) {
      const value = getCardValue(card);
      if (value > 0) {
        cardsWithValue++;
        totalValue += value;
      }
      cardValues.push({ card, value });
    }

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

    // Movers: compare current dcm_price_estimate vs dcm_price_at_grading
    // No external queries needed — both values are on the cards table
    const changes: Array<{ card: Record<string, unknown>; changePercent: number; currentValue: number; gradingValue: number }> = [];

    for (const card of cards) {
      const currentPrice = (card.dcm_price_estimate as number) || 0;
      const gradingPrice = (card.dcm_price_at_grading as number) || 0;
      if (currentPrice <= 0 || gradingPrice <= 0) continue;

      const changePercent = ((currentPrice - gradingPrice) / gradingPrice) * 100;
      if (Math.abs(changePercent) >= 0.1) {
        changes.push({ card, changePercent: Math.round(changePercent * 10) / 10, currentValue: currentPrice, gradingValue: gradingPrice });
      }
    }

    const sortedChanges = changes.sort((a, b) => b.changePercent - a.changePercent);
    const gainerCards = sortedChanges.filter(c => c.changePercent > 0).slice(0, 5);
    const loserCards = sortedChanges.filter(c => c.changePercent < 0).slice(-5).reverse();

    const mapMover = (item: typeof changes[0]) => ({
      id: item.card.id as string,
      name: getCardName(item.card),
      category: (item.card.category as string) || 'other',
      grade: (item.card.conversational_decimal_grade as number) || 0,
      conditionLabel: '',
      value: Math.round(item.currentValue * 100) / 100,
      gradingValue: Math.round(item.gradingValue * 100) / 100,
      imageUrl: null,
      cardPath: getCardPath(item.card),
      cardSet: (item.card.card_set as string) || '',
      cardNumber: (item.card.card_number as string) || '',
      changePercent: item.changePercent,
    });

    // Compute grading-time portfolio summary
    let totalGradingValue = 0;
    let cardsWithGradingPrice = 0;
    for (const card of cards) {
      const gradingPrice = (card.dcm_price_at_grading as number) || 0;
      if (gradingPrice > 0) {
        totalGradingValue += gradingPrice;
        cardsWithGradingPrice++;
      }
    }

    const movers = {
      gainers: gainerCards.map(mapMover),
      losers: loserCards.map(mapMover),
      totalGradingValue: Math.round(totalGradingValue * 100) / 100,
      totalCurrentValue: Math.round(totalValue * 100) / 100,
      cardsWithGradingPrice,
    };

    // --- NEW CHART DATA ---

    // 1. Grade Distribution — count cards per grade tier
    const GRADE_TIERS = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '<5'];
    const gradeCountMap = new Map<string, number>();
    GRADE_TIERS.forEach(t => gradeCountMap.set(t, 0));

    for (const card of cards) {
      const grade = (card.conversational_decimal_grade as number) || (card.conversational_whole_grade as number) || 0;
      if (grade <= 0) continue;
      let tier: string;
      if (grade >= 10) tier = '10';
      else if (grade >= 9.5) tier = '9.5';
      else if (grade >= 9) tier = '9';
      else if (grade >= 8.5) tier = '8.5';
      else if (grade >= 8) tier = '8';
      else if (grade >= 7.5) tier = '7.5';
      else if (grade >= 7) tier = '7';
      else if (grade >= 6.5) tier = '6.5';
      else if (grade >= 6) tier = '6';
      else if (grade >= 5.5) tier = '5.5';
      else if (grade >= 5) tier = '5';
      else tier = '<5';
      gradeCountMap.set(tier, (gradeCountMap.get(tier) || 0) + 1);
    }

    const gradeDistribution = GRADE_TIERS
      .map(grade => ({ grade, count: gradeCountMap.get(grade) || 0 }))
      .filter(g => g.count > 0);

    // 2. Value Distribution — bucket cards by value range
    const VALUE_BUCKETS = [
      { label: '$0', min: 0, max: 0.01 },
      { label: '$0-10', min: 0.01, max: 10 },
      { label: '$10-25', min: 10, max: 25 },
      { label: '$25-50', min: 25, max: 50 },
      { label: '$50-100', min: 50, max: 100 },
      { label: '$100-250', min: 100, max: 250 },
      { label: '$250-500', min: 250, max: 500 },
      { label: '$500+', min: 500, max: Infinity },
    ];

    const valueDistribution = VALUE_BUCKETS.map(bucket => {
      const count = cardValues.filter(cv => {
        if (bucket.label === '$0') return cv.value === 0;
        return cv.value >= bucket.min && cv.value < bucket.max;
      }).length;
      return { label: bucket.label, count, min: bucket.min, max: bucket.max === Infinity ? 999999 : bucket.max };
    }).filter(b => b.count > 0);

    // 3. Value by Grade — total and average value per grade tier
    const gradeValueMap = new Map<string, { total: number; count: number }>();
    for (const { card, value } of cardValues) {
      const grade = (card.conversational_decimal_grade as number) || (card.conversational_whole_grade as number) || 0;
      if (grade <= 0) continue;
      let tier: string;
      if (grade >= 10) tier = '10';
      else if (grade >= 9.5) tier = '9.5';
      else if (grade >= 9) tier = '9';
      else if (grade >= 8.5) tier = '8.5';
      else if (grade >= 8) tier = '8';
      else if (grade >= 7.5) tier = '7.5';
      else if (grade >= 7) tier = '7';
      else if (grade >= 6.5) tier = '6.5';
      else if (grade >= 6) tier = '6';
      else if (grade >= 5.5) tier = '5.5';
      else if (grade >= 5) tier = '5';
      else tier = '<5';
      const existing = gradeValueMap.get(tier) || { total: 0, count: 0 };
      existing.total += value;
      existing.count++;
      gradeValueMap.set(tier, existing);
    }

    const valueByGrade = GRADE_TIERS
      .filter(tier => gradeValueMap.has(tier))
      .map(tier => {
        const data = gradeValueMap.get(tier)!;
        return {
          grade: tier,
          totalValue: Math.round(data.total * 100) / 100,
          avgValue: Math.round((data.total / data.count) * 100) / 100,
          count: data.count,
        };
      });

    // 4. Top Sets by Value — aggregate by card_set
    const setMap = new Map<string, { value: number; count: number; category: string }>();
    for (const { card, value } of cardValues) {
      const setName = (card.card_set as string) || '';
      if (!setName) continue;
      const existing = setMap.get(setName) || { value: 0, count: 0, category: (card.category as string) || 'Other' };
      existing.value += value;
      existing.count++;
      setMap.set(setName, existing);
    }

    const topSets = Array.from(setMap.entries())
      .map(([set, data]) => ({
        set,
        category: data.category,
        value: Math.round(data.value * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 5. Price Source Breakdown
    let dcmCount = 0;
    let ebayCount = 0;
    let scryfallCount = 0;
    let unpricedCount = 0;

    for (const card of cards) {
      if (card.dcm_price_estimate && (card.dcm_price_estimate as number) > 0) {
        dcmCount++;
      } else if (card.ebay_price_median && (card.ebay_price_median as number) > 0) {
        ebayCount++;
      } else if (card.scryfall_price_usd && (card.scryfall_price_usd as number) > 0) {
        scryfallCount++;
      } else {
        unpricedCount++;
      }
    }

    const priceSourceBreakdown = [
      { source: 'PriceCharting', count: dcmCount },
      { source: 'eBay', count: ebayCount },
      { source: 'Scryfall', count: scryfallCount },
      { source: 'Unpriced', count: unpricedCount },
    ].filter(s => s.count > 0);

    // 6. Grade vs Value — scatter data (sample up to 200 points for performance)
    const gradeVsValueRaw: Array<{ grade: number; value: number; name: string; cardPath: string }> = [];
    for (const { card, value } of cardValues) {
      const grade = (card.conversational_decimal_grade as number) || (card.conversational_whole_grade as number) || 0;
      if (grade <= 0) continue;
      gradeVsValueRaw.push({
        grade: Math.round(grade * 10) / 10,
        value: Math.round(value * 100) / 100,
        name: getCardName(card),
        cardPath: getCardPath(card),
      });
    }
    // Sort by value desc and take top 200 to avoid huge payloads
    const gradeVsValue = gradeVsValueRaw
      .sort((a, b) => b.value - a.value)
      .slice(0, 200);

    return NextResponse.json({
      totalValue: Math.round(totalValue * 100) / 100,
      totalCards: cards.length,
      cardsWithValue,
      categoryBreakdown,
      topCards,
      movers,
      gradeDistribution,
      valueDistribution,
      valueByGrade,
      topSets,
      priceSourceBreakdown,
      gradeVsValue,
    });
  } catch (error) {
    console.error('[Market Pricing] Portfolio error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
