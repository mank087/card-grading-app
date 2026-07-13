/** COMIC LAB detail / update / delete — admin only. */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function authed(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  return token ? await verifyAdminSession(token) : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authed(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data: comic, error } = await supabaseAdmin.from('comics_lab').select('*').eq('id', id).single();
  if (error || !comic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sign = async (p: string | null) => {
    if (!p) return null;
    const { data } = await supabaseAdmin.storage.from('cards').createSignedUrl(p, 3600);
    return data?.signedUrl ?? null;
  };
  const [front_url, back_url, spine_url, page_edge_url] = await Promise.all([
    sign(comic.front_path), sign(comic.back_path), sign(comic.spine_path), sign(comic.page_edge_path),
  ]);
  return NextResponse.json({ comic: { ...comic, front_url, back_url, spine_url, page_edge_url } });
}

/** PATCH: anchor workflow — record the operator's expected grade / notes. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authed(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const patch: any = {};
  if (body.expected_grade !== undefined) {
    const g = body.expected_grade === null ? null : Number(body.expected_grade);
    if (g !== null && (!Number.isFinite(g) || g < 0.5 || g > 10)) {
      return NextResponse.json({ error: 'expected_grade must be 0.5-10 or null' }, { status: 400 });
    }
    patch.expected_grade = g;
  }
  if (body.operator_notes !== undefined) patch.operator_notes = String(body.operator_notes ?? '').slice(0, 2000);
  if (body.title !== undefined) patch.title = String(body.title ?? '').slice(0, 200);
  if (body.issue_number !== undefined) patch.issue_number = String(body.issue_number ?? '').slice(0, 50);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  const { error } = await supabaseAdmin.from('comics_lab').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authed(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data: comic } = await supabaseAdmin.from('comics_lab').select('front_path, back_path, spine_path, page_edge_path').eq('id', id).single();
  if (comic) {
    const paths = [comic.front_path, comic.back_path, comic.spine_path, comic.page_edge_path].filter(Boolean) as string[];
    if (paths.length) await supabaseAdmin.storage.from('cards').remove(paths);
  }
  const { error } = await supabaseAdmin.from('comics_lab').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
