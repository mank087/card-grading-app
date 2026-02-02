import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { BlogCategoriesResponse } from '@/types/blog';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function GET() {
  try {
    const supabase = supabaseServer();

    const { data: categories, error } = await supabase
      .from('blog_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching blog categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blog categories' },
        { status: 500 }
      );
    }

    const response: BlogCategoriesResponse = {
      categories: categories || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in blog categories API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
