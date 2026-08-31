import { NextResponse } from 'next/server';
import { fetchPopCategories } from '@/lib/pop/popData';

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const { categories, totals } = await fetchPopCategories();

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
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
