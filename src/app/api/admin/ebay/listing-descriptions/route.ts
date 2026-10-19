/**
 * Admin: find and repair a seller's live eBay listings whose description
 * belongs to another card (see lib/ebay/repairListingDescriptions.ts).
 * POST { email, apply?: boolean, clearTemplate?: boolean }. Dry run unless apply.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { repairListingDescriptions } from '@/lib/ebay/repairListingDescriptions';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const token = request.cookies.get('admin_token')?.value;
  const admin = token ? await verifyAdminSession(token) : null;
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  let body: { email?: string; apply?: boolean; clearTemplate?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Enter the seller account email.' }, { status: 400, headers });
  const db = supabaseServer();
  const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
  if (!user) return NextResponse.json({ error: 'No account with that email.' }, { status: 404, headers });
  try {
    const report = await repairListingDescriptions(db, {
      userId: user.id,
      apply: body.apply === true,
      clearTemplate: body.clearTemplate === true,
    });
    console.log('[admin ebay listing-descriptions]', {
      admin: admin.email,
      email,
      apply: body.apply === true,
      wrong: report.wrong.length,
      revised: report.wrong.filter(r => r.result === 'revised').length,
      failed: report.wrong.filter(r => r.result === 'failed').length,
      templateCleared: report.templateCleared,
    });
    return NextResponse.json(report, { headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Repair failed.' }, { status: 500, headers });
  }
}
