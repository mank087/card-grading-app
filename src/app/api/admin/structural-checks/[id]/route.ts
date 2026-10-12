import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clientIp, logAdminActivity, verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { applyStructuralAction } from '@/lib/gradeReview/structuralCheckActions';

/**
 * Resolve a structural-cap check: { action: 'confirm' } keeps the grade and
 * records the crease as confirmed; { action: 'clear', notes? } removes the cap
 * with the manual-review correction builder. The customer is not emailed.
 */
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const admin = token ? await verifyAdminSession(token) : null;
    if (!admin) return reply({ error: 'Unauthorized' }, 401);
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) return reply({ error: 'Invalid request origin.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return reply({ error: 'JSON required.' }, 415);
    const { id } = await params;
    if (!isUuid(id)) return reply({ error: 'Card not found.' }, 404);
    const raw = await request.text();
    if (raw.length > 4000) return reply({ error: 'Request is too long.' }, 413);
    let body: { action?: unknown; notes?: unknown };
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid request.' }, 400); }
    const action = body?.action;
    if (action !== 'confirm' && action !== 'clear') return reply({ error: 'Choose confirm or clear.' }, 400);
    const notes = typeof body.notes === 'string' && body.notes.trim().length >= 10 ? body.notes.trim().slice(0, 1500) : undefined;

    const result = await applyStructuralAction(supabaseServer(), id, action, admin.id, notes);
    if (!result.ok) return reply({ error: result.error, stale: result.stale ?? false }, result.status);
    for (const category of ['sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other']) revalidatePath(`/${category}/${id}`);
    revalidatePath('/collection');
    await logAdminActivity(admin.id, admin.email, action === 'confirm' ? 'structural_check_confirmed' : 'structural_check_cleared', 'card', id,
      { before: result.beforeGrade, after: result.afterGrade, uncapped: result.uncappedGrade }, clientIp(request));
    return reply({ status: action === 'confirm' ? 'confirmed' : 'cleared', before: result.beforeGrade, after: result.afterGrade });
  } catch {
    return reply({ error: 'Unable to save. Reload and try again.' }, 503);
  }
}
