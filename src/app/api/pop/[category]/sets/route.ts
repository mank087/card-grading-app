import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCategoryFromSlug, getCategoryMeta } from '@/lib/popReport';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category: slug } = await params;
    const meta = getCategoryMeta(slug);
    let dbCategory = getCategoryFromSlug(slug);
    let dbSubCategory = meta?.dbSubCategory || null;

    // If no meta found, check if this slug maps to an Other sub-category in the DB
    if (!meta) {
      // Find a sub_category whose slugified form matches this slug
      const { data: subCatRows } = await supabaseAdmin
        .from('cards')
        .select('sub_category')
        .eq('category', 'Other')
        .not('sub_category', 'is', null)
        .not('conversational_whole_grade', 'is', null)
        .limit(1000);
      if (subCatRows) {
        const match = subCatRows.find((r: { sub_category: string }) => {
          const s = r.sub_category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return s === slug;
        });
        if (match) {
          dbCategory = 'Other';
          dbSubCategory = match.sub_category; // exact DB value preserves casing
        }
      }
    }
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // If this is a sub-category pop report, use direct query with sub_category filter
    if (dbSubCategory) {
      let cardsQuery = supabaseAdmin
        .from('cards')
        .select('card_name, card_number, featured, card_set, front_path, conversational_whole_grade')
        .eq('category', dbCategory)
        .eq('sub_category', dbSubCategory)
        .not('conversational_whole_grade', 'is', null);
      if (search) {
        cardsQuery = cardsQuery.or(`card_name.ilike.%${search}%,featured.ilike.%${search}%,card_set.ilike.%${search}%`);
      }

      const [cardsResult, countResult] = await Promise.all([
        cardsQuery,
        supabaseAdmin
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .eq('category', dbCategory)
          .eq('sub_category', dbSubCategory)
          .not('conversational_whole_grade', 'is', null),
      ]);

      // Build pop data from direct query results
      const rawCards = cardsResult.data || [];
      const cardMap = new Map<string, any>();
      for (const card of rawCards) {
        const key = `${card.card_name || card.featured || 'Unknown'}__${card.card_set || ''}__${card.card_number || ''}`;
        if (!cardMap.has(key)) {
          cardMap.set(key, {
            card_name: card.card_name || card.featured || 'Unknown',
            card_number: card.card_number || '',
            featured: card.featured,
            card_set: card.card_set,
            front_path: card.front_path,
            total: 0,
            grades: {} as Record<number, number>,
          });
        }
        const entry = cardMap.get(key)!;
        entry.total++;
        const grade = card.conversational_whole_grade;
        if (grade) entry.grades[grade] = (entry.grades[grade] || 0) + 1;
        if (!entry.front_path && card.front_path) entry.front_path = card.front_path;
      }

      const sortedCards = Array.from(cardMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(offset, offset + limit);

      // Generate signed URLs for thumbnails
      const cards = await Promise.all(
        sortedCards.map(async (row: any) => {
          let thumbnailUrl: string | null = null;
          if (row.front_path) {
            const { data: signedData } = await supabaseAdmin.storage
              .from('cards')
              .createSignedUrl(row.front_path, 3600);
            thumbnailUrl = signedData?.signedUrl || null;
          }
          const grades: Record<number, number> = {};
          for (let g = 1; g <= 10; g++) grades[g] = row.grades[g] || 0;
          return {
            cardName: row.card_name,
            cardNumber: row.card_number,
            featured: row.featured,
            cardSet: row.card_set,
            thumbnailUrl,
            total: row.total,
            grades,
          };
        })
      );

      return NextResponse.json({
        categoryInfo: {
          slug,
          dbCategory,
          displayName: meta?.displayName || dbSubCategory,
          icon: meta?.icon || '\uD83C\uDCCF',
        },
        cards,
        pagination: {
          total: countResult.count || rawCards.length,
          limit,
          offset,
          hasMore: offset + limit < (countResult.count || rawCards.length),
        },
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    // Standard category pop report (no sub-category)
    // Fetch cards, count, and categories in parallel
    const [cardsResult, countResult, categoriesResult] = await Promise.all([
      supabaseAdmin.rpc('get_pop_cards', {
        p_category: dbCategory,
        p_search: search,
        p_limit: limit,
        p_offset: offset,
      }),
      supabaseAdmin.rpc('get_pop_cards_count', {
        p_category: dbCategory,
        p_search: search,
      }),
      supabaseAdmin.rpc('get_pop_categories'),
    ]);

    if (cardsResult.error) {
      console.error('Pop cards RPC error:', cardsResult.error);
      return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
    }

    const totalCount = typeof countResult.data === 'number' ? countResult.data : Number(countResult.data) || 0;

    // Resolve actual display name from DB categories (handles acronyms like MMA, TCG correctly)
    const dbCategoryRow = (categoriesResult.data || []).find(
      (c: { category: string }) => c.category.toLowerCase() === dbCategory.toLowerCase()
    );
    const resolvedDisplayName = meta?.displayName || dbCategoryRow?.category || dbCategory;

    // Generate signed URLs for thumbnails
    const cards = await Promise.all(
      (cardsResult.data || []).map(
        async (row: {
          card_name: string;
          card_number: string;
          featured: string | null;
          card_set: string | null;
          front_path: string | null;
          total: number;
          grade_1: number;
          grade_2: number;
          grade_3: number;
          grade_4: number;
          grade_5: number;
          grade_6: number;
          grade_7: number;
          grade_8: number;
          grade_9: number;
          grade_10: number;
        }) => {
          let thumbnailUrl: string | null = null;

          if (row.front_path) {
            try {
              const { data: signedData } = await supabaseAdmin.storage
                .from('cards')
                .createSignedUrl(row.front_path, 3600);
              thumbnailUrl = signedData?.signedUrl || null;
            } catch {
              // Thumbnail generation failed, leave null
            }
          }

          return {
            cardName: row.card_name,
            cardNumber: row.card_number,
            featured: row.featured,
            cardSet: row.card_set,
            thumbnailUrl,
            total: Number(row.total),
            grades: {
              1: Number(row.grade_1),
              2: Number(row.grade_2),
              3: Number(row.grade_3),
              4: Number(row.grade_4),
              5: Number(row.grade_5),
              6: Number(row.grade_6),
              7: Number(row.grade_7),
              8: Number(row.grade_8),
              9: Number(row.grade_9),
              10: Number(row.grade_10),
            },
          };
        }
      )
    );

    return NextResponse.json(
      {
        category: {
          slug,
          dbCategory,
          displayName: resolvedDisplayName,
          icon: meta?.icon || '\uD83C\uDCCF',
        },
        cards,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('Pop cards error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
