import { NextRequest, NextResponse } from 'next/server';
import { sanitizeFaq } from '@/lib/seo/blogSchema';
import { verifyAdminSession, logAdminActivity } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BlogPostFormData } from '@/types/blog';

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
    // Sortable columns in the admin table. Category sorts by the related
    // category's name; ties fall back to most recently updated.
    const SORT_COLUMNS: Record<string, string> = {
      title: 'title',
      category: 'category(name)',
      status: 'status',
      published_at: 'published_at',
      view_count: 'view_count',
      updated_at: 'updated_at',
    };
    const sortColumn = SORT_COLUMNS[searchParams.get('sort') || ''] || 'updated_at';
    const ascending = searchParams.get('dir') === 'asc';

    let query = supabaseAdmin
      .from('blog_posts')
      // Only the columns the admin table renders.
      .select(
        'id,title,slug,status,published_at,view_count,updated_at,category:blog_categories(name,color)',
        { count: 'exact' }
      )
      .order(sortColumn, { ascending, nullsFirst: false });
    if (sortColumn !== 'updated_at') query = query.order('updated_at', { ascending: false });

    if (status && status !== 'all') {
      const nowIso = new Date().toISOString();
      if (status === 'scheduled') {
        // Scheduled posts are stored as status 'published' with a future
        // published_at (legacy rows may still carry status 'scheduled').
        query = query.or(`status.eq.scheduled,and(status.eq.published,published_at.gt.${nowIso})`);
      } else if (status === 'published') {
        query = query.eq('status', 'published').or(`published_at.is.null,published_at.lte.${nowIso}`);
      } else {
        query = query.eq('status', status);
      }
    }

    // Strip characters that would break PostgREST's or() filter syntax.
    const q = (search || '').trim().replace(/[%,()]/g, '');
    if (q) {
      query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }

    return NextResponse.json({
      posts,
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

    // "Scheduled" is stored as published with a future published_at: the
    // public queries (status='published' AND published_at<=now) then pick the
    // post up on its date with no job needed to flip the status.
    let status = body.status || 'draft';
    if (status === 'scheduled') {
      const at = body.published_at ? new Date(body.published_at).getTime() : NaN;
      if (isNaN(at) || at <= Date.now()) {
        return NextResponse.json(
          { error: 'Scheduled posts need a publish date in the future' },
          { status: 400 }
        );
      }
      status = 'published';
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
      quick_answer: typeof body.quick_answer === 'string' && body.quick_answer.trim() ? body.quick_answer.trim().slice(0, 600) : null,
      faq: sanitizeFaq(body.faq),
      status,
      published_at: status === 'published' ? (body.published_at || new Date().toISOString()) : body.published_at || null,
      author_name: body.author_name || 'Douglas Mankiewicz',
      created_by: admin.id,
      updated_by: admin.id,
    };

    let { data: newPost, error } = await supabaseAdmin
      .from('blog_posts')
      .insert(postData)
      .select(`
        *,
        category:blog_categories(*)
      `)
      .single();

    if (error && /quick_answer|faq|schema cache/i.test(error.message)) {
      // Migration 20260911_blog_quick_answer_faq.sql not applied yet: save
      // the post without the two answer-engine fields rather than fail.
      const { quick_answer: _qa, faq: _faq, ...legacy } = postData;
      ({ data: newPost, error } = await supabaseAdmin
        .from('blog_posts')
        .insert(legacy)
        .select(`
          *,
          category:blog_categories(*)
        `)
        .single());
    }

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
