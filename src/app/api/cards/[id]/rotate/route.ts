/**
 * POST /api/cards/[id]/rotate  { face: 'front' | 'back', direction: 'cw' | 'ccw' }
 *
 * Owner turns one face of their card 90° for display (Oct 2026). Writes a new
 * display copy and thumbnail (rotateDisplay.ts); every surface that shows the
 * card reads the display copy, so the turn appears on the card page, the
 * collection, labels, reports, listings and the app. The original photo and
 * the grade are untouched. Returns fresh signed URLs for the turned face.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isUuid } from '@/lib/uuid';
import { rotateCardFace, type RotateStorage } from '@/lib/images/rotateDisplay';
import { thumbPath } from '@/lib/images/cardThumbnails';

const CATEGORY_SLUGS = ['sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const face = body?.face === 'back' ? 'back' : body?.face === 'front' ? 'front' : null;
  const direction = body?.direction === 'ccw' ? 'ccw' : body?.direction === 'cw' ? 'cw' : null;
  if (!face || !direction) return NextResponse.json({ error: 'face must be front or back; direction cw or ccw.' }, { status: 400 });

  const { data: card, error } = await supabaseAdmin.from('cards')
    .select('id,user_id,category,front_path,back_path,capture_quality,deleted_at')
    .eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load the card.' }, { status: 503 });
  if (!card || card.deleted_at || card.user_id !== auth.userId) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

  try {
    const storage = supabaseAdmin.storage.from('cards') as unknown as RotateStorage;
    const result = await rotateCardFace(storage, card, face, direction);
    const cq = typeof card.capture_quality === 'string' ? JSON.parse(card.capture_quality || '{}') : (card.capture_quality || {});
    const { error: saveError } = await supabaseAdmin.from('cards')
      .update({ capture_quality: { ...cq, display: result.display } })
      .eq('id', id).eq('user_id', auth.userId);
    if (saveError) return NextResponse.json({ error: 'The turned photo was made but could not be saved. Try again.' }, { status: 503 });
    const sign = async (path: string) => (await supabaseAdmin.storage.from('cards').createSignedUrl(path, 60 * 60)).data?.signedUrl ?? null;
    const [url, thumbUrl] = await Promise.all([sign(result.path), sign(thumbPath(result.path))]);
    for (const slug of CATEGORY_SLUGS) revalidatePath(`/${slug}/${id}`);
    revalidatePath('/collection');
    return NextResponse.json({ ok: true, face, rotation: result.rotation, url, thumb_url: thumbUrl, width: result.width, height: result.height },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e: any) {
    console.error(`[rotate ${id}]`, e?.message || e);
    return NextResponse.json({ error: 'Could not turn the photo. Try again.' }, { status: 503 });
  }
}
