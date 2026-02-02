import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, logAdminActivity } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET - List all categories
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

    const { data: categories, error } = await supabaseAdmin
      .from('blog_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error in categories API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new category
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

    const body = await request.json();

    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const { data: existing } = await supabaseAdmin
      .from('blog_categories')
      .select('id')
      .eq('slug', body.slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 400 }
      );
    }

    // Get max sort order
    const { data: maxOrder } = await supabaseAdmin
      .from('blog_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data: newCategory, error } = await supabaseAdmin
      .from('blog_categories')
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description || null,
        color: body.color || '#7c3aed',
        sort_order: (maxOrder?.sort_order || 0) + 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    await logAdminActivity(
      admin.id,
      admin.email,
      'blog_category_create',
      'blog_category',
      newCategory.id,
      { name: newCategory.name },
      null
    );

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update category
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    // Check for duplicate slug if changing
    if (body.slug) {
      const { data: existing } = await supabaseAdmin
        .from('blog_categories')
        .select('id')
        .eq('slug', body.slug)
        .neq('id', body.id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A category with this slug already exists' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data: updated, error } = await supabaseAdmin
      .from('blog_categories')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }

    await logAdminActivity(
      admin.id,
      admin.email,
      'blog_category_update',
      'blog_category',
      body.id,
      { name: updated.name },
      null
    );

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete category
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    // Get category for logging
    const { data: category } = await supabaseAdmin
      .from('blog_categories')
      .select('name')
      .eq('id', id)
      .single();

    const { error } = await supabaseAdmin
      .from('blog_categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }

    await logAdminActivity(
      admin.id,
      admin.email,
      'blog_category_delete',
      'blog_category',
      id,
      { name: category?.name },
      null
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
