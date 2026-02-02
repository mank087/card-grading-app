import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { BlogPost, BlogPostsResponse } from '@/types/blog';

export const revalidate = 60; // ISR: revalidate every 60 seconds

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const searchParams = request.nextUrl.searchParams;

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Filter parameters
    const category = searchParams.get('category'); // category slug
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');

    // Build query for published posts only
    let query = supabase
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(*)
      `, { count: 'exact' })
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });

    // Apply category filter
    if (category) {
      // First get the category ID from the slug
      const { data: categoryData } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('slug', category)
        .single();

      if (categoryData) {
        query = query.eq('category_id', categoryData.id);
      }
    }

    // Apply tag filter
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blog posts' },
        { status: 500 }
      );
    }

    const response: BlogPostsResponse = {
      posts: (posts || []) as BlogPost[],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in blog posts API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
