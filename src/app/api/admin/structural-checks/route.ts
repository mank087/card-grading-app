import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { displayImagePath } from '@/lib/images/displayPath';

/**
 * Pending structural-cap checks (src/lib/gradeReview/structuralCheck.ts), newest
 * first. Filters on the small capture_quality mirror; the heavy report column is
 * never read here.
 */
const PAGE = 50;
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const token = request.cookies.get('admin_token')?.value;
    const admin = token ? await verifyAdminSession(token) : null;
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    const page = Number(request.nextUrl.searchParams.get('page') || '0');
    if (!Number.isInteger(page) || page < 0 || page > 10000) return NextResponse.json({ error: 'Invalid page.' }, { status: 400, headers });
    const db = supabaseServer();
    const { data, error } = await db.from('cards')
      .select('id, serial, category, card_name, user_id, front_path, back_path, conversational_whole_grade, conversational_evaluated_at, display_crop:capture_quality->display, structural_check:capture_quality->structural_check')
      .eq('capture_quality->structural_check->>status', 'pending').is('deleted_at', null)
      .order('conversational_evaluated_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE);
    if (error) throw error;
    const rows = (data ?? []).slice(0, PAGE) as Record<string, any>[];
    const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
    const { data: users } = userIds.length ? await db.from('users').select('id, email').in('id', userIds) : { data: [] as { id: string; email: string }[] };
    const emails = new Map((users ?? []).map(user => [user.id, user.email]));
    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data: signed } = await db.storage.from('cards').createSignedUrl(path, 3600);
      return signed?.signedUrl ?? null;
    };
    const checks = await Promise.all(rows.map(async row => {
      // Show the trimmed display copy (smaller) and keep the original one click away.
      const [front, back, frontOriginal, backOriginal] = await Promise.all([
        sign(displayImagePath(row, 'front')), sign(displayImagePath(row, 'back')),
        sign(row.front_path ?? null), sign(row.back_path ?? null)]);
      return {
        id: row.id, serial: row.serial, category: row.category, card_name: row.card_name,
        owner_email: emails.get(row.user_id) ?? null, grade: row.conversational_whole_grade,
        evaluated_at: row.conversational_evaluated_at, check: row.structural_check,
        // A regrade (or a test harness run) can leave a mirror that no longer matches the card.
        stale: Number(row.conversational_whole_grade) !== Number(row.structural_check?.capped_grade),
        photos: { front, back, front_original: frontOriginal, back_original: backOriginal },
      };
    }));
    return NextResponse.json({ checks, hasMore: (data ?? []).length > PAGE }, { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to load structural checks.' }, { status: 503, headers });
  }
}
