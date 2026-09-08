import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const token = request.cookies.get('admin_token')?.value;
    const admin = token ? await verifyAdminSession(token) : null;
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    const page = Number(request.nextUrl.searchParams.get('page') || '0');
    if (!Number.isInteger(page) || page < 0 || page > 10000) {
      return NextResponse.json({ error: 'Invalid page.' }, { status: 400, headers });
    }
    const pending=request.nextUrl.searchParams.get('view')!=='all';
    let query = supabaseServer().from('card_grade_reviews')
      .select('id, card_id, requester_id, grade_run_id, requested_at, status, concerns, note, customer_result, outcome, completed_at, original_grade, proposed_grade, owner_decision, decided_at, attempt_count, last_error_code, cards(serial, category, card_name)');
    if(pending)query=query.eq('review_mode','manual').in('status',['queued','processing']);
    const { data, error } = await query.order('requested_at', { ascending: pending }).order('id', { ascending: pending })
      .range(page * 50, page * 50 + 50);
    if (error) throw error;
    return NextResponse.json({ reviews: data.slice(0, 50), hasMore: data.length > 50 }, { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to load grade reviews. Verify the review migration has been applied.' }, { status: 503, headers });
  }
}
