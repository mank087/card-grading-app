/**
 * Admin Affiliate Application detail API
 * PATCH: decline an application or update its admin notes.
 *
 * Approving is done by POST /api/admin/affiliates with an application_id in the
 * body, which creates the affiliate and flips the application to 'approved'.
 * This route deliberately does not accept status 'approved'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = body?.status as string | undefined;
    const adminNotes = body?.admin_notes as string | undefined;

    if (status && status !== 'declined' && status !== 'new') {
      return NextResponse.json(
        { error: 'Only "declined" or "new" can be set here. Approve by creating the affiliate.' },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (adminNotes !== undefined) update.admin_notes = adminNotes ? String(adminNotes).slice(0, 2000) : null;

    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('affiliate_applications')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating affiliate application:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ application: data });
  } catch (error) {
    console.error('Error updating affiliate application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
