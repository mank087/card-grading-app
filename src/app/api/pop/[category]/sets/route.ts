import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCategoryFromSlug, getCategoryMeta } from '@/lib/popReport';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category: slug } = await params;
    const dbCategory = getCategoryFromSlug(slug);
    const meta = getCategoryMeta(slug);
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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
      // Fetch actual category names from DB to get correct casing (e.g. "MMA" not "Mma")
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
