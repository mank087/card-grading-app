/** COMIC LAB collection list — admin only. */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token || !(await verifyAdminSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('comics_lab')
    .select('id, created_at, era, title, issue_number, publisher, final_grade, grade_label, page_quality, packaging_type, expected_grade, front_path')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Signed thumbnail URLs (1h)
  const comics = await Promise.all((data ?? []).map(async (c) => {
    const { data: signed } = await supabaseAdmin.storage.from('cards').createSignedUrl(c.front_path, 3600);
    return { ...c, front_url: signed?.signedUrl ?? null };
  }));
  return NextResponse.json({ comics });
}
