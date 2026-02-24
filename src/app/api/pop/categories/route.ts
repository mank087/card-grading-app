import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { POP_CATEGORIES, getSlugFromCategory } from '@/lib/popReport';

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_pop_categories');

    if (error) {
      console.error('Pop categories RPC error:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Map DB results to category metadata
    const categories = (data || [])
      .map((row: { category: string; unique_cards: number; total_graded: number }) => {
        const meta = POP_CATEGORIES.find((c) => c.dbCategory === row.category);
        const slug = getSlugFromCategory(row.category);
        return {
          slug,
          dbCategory: row.category,
          displayName: meta?.displayName || row.category,
          icon: meta?.icon || '\uD83C\uDCCF',
          uniqueCards: Number(row.unique_cards),
          totalGraded: Number(row.total_graded),
        };
      })
      .filter((c: { totalGraded: number }) => c.totalGraded >= 3);

    // Calculate platform totals
    const totals = {
      totalUniqueCards: categories.reduce((sum: number, c: { uniqueCards: number }) => sum + c.uniqueCards, 0),
      totalGraded: categories.reduce((sum: number, c: { totalGraded: number }) => sum + c.totalGraded, 0),
    };

    return NextResponse.json(
      { categories, totals },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err) {
    console.error('Pop categories error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
