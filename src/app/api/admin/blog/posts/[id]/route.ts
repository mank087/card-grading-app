import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, logAdminActivity } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BlogPostFormData } from '@/types/blog';

// GET - Get single blog post by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: post, error } = await supabaseAdmin
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(*)
      `)
      .eq('id', id)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update blog post
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: Partial<BlogPostFormData> = await request.json();

    // Check if post exists
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('blog_posts')
      .select('id, status, published_at')
      .eq('id', id)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // If slug is being changed, check for duplicates
    if (body.slug) {
      const { data: duplicatePost } = await supabaseAdmin
        .from('blog_posts')
        .select('id')
        .eq('slug', body.slug)
        .neq('id', id)
        .single();

      if (duplicatePost) {
        return NextResponse.json(
          { error: 'A post with this slug already exists' },
          { status: 400 }
        );
      }
    }

    // Handle publishing logic
    let publishedAt = body.published_at || null;
    if (body.status === 'published' && !existingPost.published_at && !publishedAt) {
      publishedAt = new Date().toISOString();
    }

    // Update post
    const updateData: Record<string, any> = {
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    };

    // Only include fields that were provided
    if (body.title !== undefined) updateData.title = body.title;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle || null;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt || null;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.featured_image_path !== undefined) updateData.featured_image_path = body.featured_image_path || null;
    if (body.featured_image_alt !== undefined) updateData.featured_image_alt = body.featured_image_alt || null;
    if (body.category_id !== undefined) updateData.category_id = body.category_id || null;
    if (body.tags !== undefined) updateData.tags = body.tags || [];
    if (body.meta_title !== undefined) updateData.meta_title = body.meta_title || null;
    if (body.meta_description !== undefined) updateData.meta_description = body.meta_description || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (publishedAt !== undefined) updateData.published_at = publishedAt;
    if (body.author_name !== undefined) updateData.author_name = body.author_name || 'DCM Team';

    const { data: updatedPost, error } = await supabaseAdmin
      .from('blog_posts')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:blog_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error updating blog post:', error);
      return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
    }

    // Log admin activity
    await logAdminActivity(
      admin.id,
      admin.email,
      'blog_post_update',
      'blog_post',
      id,
      { title: updatedPost.title, status: updatedPost.status },
      null
    );

    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error updating blog post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete blog post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get post info for logging
    const { data: post, error: fetchError } = await supabaseAdmin
      .from('blog_posts')
      .select('id, title')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Delete the post
    const { error } = await supabaseAdmin
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting blog post:', error);
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
    }

    // Log admin activity
    await logAdminActivity(
      admin.id,
      admin.email,
      'blog_post_delete',
      'blog_post',
      id,
      { title: post.title },
      null
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
