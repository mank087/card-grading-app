import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/serverAuth';
import { createSignedUrlMap } from '@/lib/signedUrlBatch';
import { isMissingColumnError } from '@/lib/cards/ownership';

/**
 * GET /api/market-pricing/sold — realised sales for the Sold tab.
 *
 * REVENUE ONLY, deliberately. There is no cost basis anywhere in the system —
 * nothing records what a user PAID for a card — so nothing here may be called
 * profit or gain. `dcm_price_at_grading` exists but is populated on only ~5% of
 * sold cards and is an estimate rather than a purchase price, so it is not used
 * as a baseline.
 *
 * Recorded sale prices are also GROSS: they exclude eBay fees, shipping and
 * postage, so the totals are "what the cards sold for", not take-home. The UI
 * says so.
 *
 * Cards with no recorded price are still returned — the tab lets the owner fill
 * one in — and are counted separately so the total is never silently
 * understated.
 *
 * Not gated: unlike the rest of Market Pricing, any signed-in user sees this.
 */

const COLUMNS = `
  id, serial, card_name, featured, pokemon_featured, category, sub_category,
  card_set, card_number, front_path, conversational_whole_grade,
  conversational_condition_label, conversational_card_info,
  sold_at, sold_price, sold_channel, sold_note, created_at
`;

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('cards')
      .select(COLUMNS)
      .eq('user_id', auth.userId)
      .eq('ownership_status', 'sold')
      .is('deleted_at', null)
      .order('sold_at', { ascending: false, nullsFirst: false });

    if (error) {
      if (isMissingColumnError(error)) {
        return NextResponse.json({ available: false, sales: [], totals: null });
      }
      console.error('[sold] query failed:', error);
      return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as Record<string, any>[];

    // ---- totals ----
    const priced = rows.filter(r => r.sold_price != null);
    const revenue = priced.reduce((sum, r) => sum + Number(r.sold_price), 0);
    const prices = priced.map(r => Number(r.sold_price)).sort((a, b) => a - b);
    const median = prices.length
      ? prices.length % 2
        ? prices[(prices.length - 1) / 2]
        : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : 0;

    // Days between grading and sale — the one genuinely interesting derived
    // number we CAN compute honestly, since both dates are recorded.
    const holdDays = rows
      .filter(r => r.sold_at && r.created_at)
      .map(r => (new Date(r.sold_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000)
      .filter(d => d >= 0)
      .sort((a, b) => a - b);
    const medianHold = holdDays.length
      ? Math.round(holdDays[Math.floor(holdDays.length / 2)])
      : null;

    // ---- breakdowns ----
    const byCategory = new Map<string, { count: number; revenue: number }>();
    const byChannel = new Map<string, { count: number; revenue: number }>();
    const byMonth = new Map<string, { count: number; revenue: number }>();

    for (const r of rows) {
      const value = r.sold_price != null ? Number(r.sold_price) : 0;

      const cat = r.category || 'Other';
      const c = byCategory.get(cat) ?? { count: 0, revenue: 0 };
      byCategory.set(cat, { count: c.count + 1, revenue: c.revenue + value });

      const ch = r.sold_channel === 'ebay' ? 'eBay' : 'Private sale';
      const h = byChannel.get(ch) ?? { count: 0, revenue: 0 };
      byChannel.set(ch, { count: h.count + 1, revenue: h.revenue + value });

      if (r.sold_at) {
        const m = String(r.sold_at).slice(0, 7); // YYYY-MM
        const mm = byMonth.get(m) ?? { count: 0, revenue: 0 };
        byMonth.set(m, { count: mm.count + 1, revenue: mm.revenue + value });
      }
    }

    // ---- thumbnails ----
    const paths = rows.map(r => r.front_path).filter(Boolean);
    let urls = new Map<string, string>();
    if (paths.length) {
      try {
        urls = await createSignedUrlMap(supabase.storage, 'cards', paths, 60 * 60);
      } catch { /* list still renders without images */ }
    }

    const round = (n: number) => Math.round(n * 100) / 100;

    return NextResponse.json({
      available: true,
      totals: {
        salesCount: rows.length,
        pricedCount: priced.length,
        // How many sales have no price yet — the UI invites the owner to fill
        // these in rather than quietly leaving them out of the total.
        missingPriceCount: rows.length - priced.length,
        revenue: round(revenue),
        averageSale: priced.length ? round(revenue / priced.length) : 0,
        medianSale: round(median),
        medianDaysToSell: medianHold,
      },
      byCategory: [...byCategory.entries()]
        .map(([name, v]) => ({ name, count: v.count, revenue: round(v.revenue) }))
        .sort((a, b) => b.revenue - a.revenue),
      byChannel: [...byChannel.entries()]
        .map(([name, v]) => ({ name, count: v.count, revenue: round(v.revenue) })),
      byMonth: [...byMonth.entries()]
        .map(([month, v]) => ({ month, count: v.count, revenue: round(v.revenue) }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      sales: rows.map(r => ({
        id: r.id,
        serial: r.serial,
        name: r.featured || r.pokemon_featured || r.card_name || 'Card',
        category: r.category,
        cardSet: r.card_set,
        cardNumber: r.card_number,
        grade: r.conversational_whole_grade,
        condition: r.conversational_condition_label,
        soldAt: r.sold_at,
        soldPrice: r.sold_price != null ? Number(r.sold_price) : null,
        soldChannel: r.sold_channel,
        soldNote: r.sold_note,
        frontUrl: r.front_path ? urls.get(r.front_path) ?? null : null,
      })),
    });
  } catch (error: any) {
    console.error('[sold] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
