/**
 * Admin Affiliate Applications API
 * GET: List applications, newest first. Optional ?status=new|approved|declined
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing affiliate applications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applications: data || [] });
  } catch (error) {
    console.error('Error listing affiliate applications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
