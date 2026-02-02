import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, logAdminActivity } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BlogPost, BlogPostFormData } from '@/types/blog';

// GET - List all blog posts (including drafts)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // draft, published, scheduled, archived
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(*)
      `, { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }

    return NextResponse.json({
      posts: posts as BlogPost[],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in admin blog posts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new blog post
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: BlogPostFormData = await request.json();

    // Validate required fields
    if (!body.title || !body.slug || !body.content) {
      return NextResponse.json(
        { error: 'Title, slug, and content are required' },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const { data: existingPost } = await supabaseAdmin
      .from('blog_posts')
      .select('id')
      .eq('slug', body.slug)
      .single();

    if (existingPost) {
      return NextResponse.json(
        { error: 'A post with this slug already exists' },
        { status: 400 }
      );
    }

    // Prepare post data
    const postData = {
      title: body.title,
      subtitle: body.subtitle || null,
      slug: body.slug,
      excerpt: body.excerpt || null,
      content: body.content,
      featured_image_path: body.featured_image_path || null,
      featured_image_alt: body.featured_image_alt || null,
      category_id: body.category_id || null,
      tags: body.tags || [],
      meta_title: body.meta_title || null,
      meta_description: body.meta_description || null,
      status: body.status || 'draft',
      published_at: body.status === 'published' ? (body.published_at || new Date().toISOString()) : body.published_at || null,
      author_name: body.author_name || 'DCM Team',
      created_by: admin.id,
      updated_by: admin.id,
    };

    const { data: newPost, error } = await supabaseAdmin
      .from('blog_posts')
      .insert(postData)
      .select(`
        *,
        category:blog_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error creating blog post:', error);
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }

    // Log admin activity
    await logAdminActivity(
      admin.id,
      admin.email,
      'blog_post_create',
      'blog_post',
      newPost.id,
      { title: newPost.title, status: newPost.status },
      null
    );

    return NextResponse.json({ post: newPost }, { status: 201 });
  } catch (error) {
    console.error('Error in admin blog posts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
