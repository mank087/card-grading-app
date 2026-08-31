import { NextRequest, NextResponse } from 'next/server';
import { fetchPopCards } from '@/lib/pop/popData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category: slug } = await params;
    const searchParams = request.nextUrl.searchParams;

    const { category, cards, pagination } = await fetchPopCards({
      slug,
      search: searchParams.get('search'),
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json(
      // `categoryInfo` is kept as an alias: the sub-category branch used to
      // return that key and only that key.
      { category, categoryInfo: category, cards, pagination },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('Pop cards error:', err);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}
