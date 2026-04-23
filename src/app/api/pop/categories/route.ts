import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { POP_CATEGORIES, getSlugFromCategory } from '@/lib/popReport';

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const [rpcResult, subCatResult] = await Promise.all([
      supabaseAdmin.rpc('get_pop_categories'),
      // Get sub-category counts for "Other" cards
      supabaseAdmin
        .from('cards')
        .select('sub_category, conversational_whole_grade')
        .eq('category', 'Other')
        .not('conversational_whole_grade', 'is', null)
        .not('sub_category', 'is', null),
    ]);

    if (rpcResult.error) {
      console.error('Pop categories RPC error:', rpcResult.error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Build sub-category counts
    const subCatCounts = new Map<string, { unique: Set<string>; total: number }>();
    for (const row of (subCatResult.data || [])) {
      const sc = row.sub_category;
      if (!sc) continue;
      if (!subCatCounts.has(sc)) subCatCounts.set(sc, { unique: new Set(), total: 0 });
      const entry = subCatCounts.get(sc)!;
      entry.total++;
      // We don't have card_name here for unique counting, so approximate
      entry.unique.add(String(entry.total));
    }

    // Calculate how many "Other" cards have a proper sub-category (to subtract from Other total)
    let subCategoryTotal = 0;
    for (const [, counts] of subCatCounts) {
      subCategoryTotal += counts.total;
    }

    // Map DB results to category metadata
    const categories = (rpcResult.data || [])
      .map((row: { category: string; unique_cards: number; total_graded: number }) => {
        const meta = POP_CATEGORIES.find((c) => c.dbCategory === row.category && !c.dbSubCategory);
        const slug = getSlugFromCategory(row.category);

        // For "Other": subtract cards that have a sub-category (they show as their own entries)
        let uniqueCards = Number(row.unique_cards);
        let totalGraded = Number(row.total_graded);
        if (row.category === 'Other') {
          uniqueCards = Math.max(0, uniqueCards - subCategoryTotal);
          totalGraded = Math.max(0, totalGraded - subCategoryTotal);
        }

        return {
          slug,
          dbCategory: row.category,
          displayName: meta?.displayName || row.category,
          icon: meta?.icon || '\uD83C\uDCCF',
          uniqueCards,
          totalGraded,
        };
      })
      .filter((c: { totalGraded: number; dbCategory: string }) => c.totalGraded >= 3);

    // Add entries for ALL sub-categories found in the DB (1+ graded cards)
    for (const [subCat, counts] of subCatCounts) {
      if (counts.total < 1) continue;
      const meta = POP_CATEGORIES.find((c) => c.dbSubCategory === subCat);
      const slug = meta?.slug || subCat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      categories.push({
        slug,
        dbCategory: 'Other',
        displayName: meta?.displayName || subCat,
        icon: meta?.icon || '\uD83C\uDCCF',
        uniqueCards: counts.total,
        totalGraded: counts.total,
      });
    }

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
