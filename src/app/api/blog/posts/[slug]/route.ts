import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { BlogPost } from '@/types/blog';

export const revalidate = 60; // ISR: revalidate every 60 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = supabaseServer();

    // Get the post by slug (only published)
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(*)
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .single();

    if (error || !post) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    // Views are counted by POST /api/blog/view from the post page, not here
    // (this response is ISR-cached, so it never counted readers).

    return NextResponse.json({ post: post as BlogPost });
  } catch (error) {
    console.error('Error in blog post API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
