/**
 * COMIC LAB grading endpoint — ADMIN ONLY, testing sandbox.
 * Not referenced by any user-facing surface; results are returned to the
 * caller and not persisted (the lab UI keeps its own local history).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { gradeComic, ComicEra } from '@/lib/comicGrader';
import { randomUUID } from 'crypto';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const ERAS = new Set(['golden', 'silver', 'bronze', 'copper', 'modern']);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function decodeImage(dataUrl: unknown, name: string): Buffer | null {
  if (typeof dataUrl !== 'string' || !dataUrl) return null;
  const m = dataUrl.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,(.+)$/);
  if (!m) throw new Error(`${name} must be a base64 image data URL (jpeg/png/webp)`);
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) throw new Error(`${name} exceeds ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
  return buf;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = await verifyAdminSession(token);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const era = String(body.era || 'modern').toLowerCase();
    if (!ERAS.has(era)) return NextResponse.json({ error: `era must be one of ${[...ERAS].join(', ')}` }, { status: 400 });

    let frontBuf: Buffer | null, backBuf: Buffer | null, spineBuf: Buffer | null, pageEdgeBuf: Buffer | null;
    try {
      frontBuf = decodeImage(body.front, 'front');
      backBuf = decodeImage(body.back, 'back');
      spineBuf = decodeImage(body.spine, 'spine');
      pageEdgeBuf = decodeImage(body.pageEdge, 'pageEdge');
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (!frontBuf || !backBuf) {
      return NextResponse.json({ error: 'front and back cover images are required' }, { status: 400 });
    }

    console.log(`[COMIC LAB] grading request: era=${era} spine=${!!spineBuf} pageEdge=${!!pageEdgeBuf} (admin: ${admin.email ?? admin.id ?? 'unknown'})`);
    const t0 = Date.now();
    const result = await gradeComic({ frontBuf, backBuf, spineBuf, pageEdgeBuf, era: era as ComicEra });
    console.log(`[COMIC LAB] graded in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${result.ok ? `${result.finalGrade} (${result.gradeLabel})` : `ERROR ${result.error}`}`);

    // Persist to the lab collection (comics_lab + images in the cards bucket).
    // Persistence failure never fails the grade response — the result is still
    // returned; savedId is null and the error is included for the lab UI.
    let savedId: string | null = null;
    let saveError: string | null = null;
    if (result.ok) {
      try {
        const id = randomUUID();
        const upload = async (buf: Buffer | null | undefined, name: string): Promise<string | null> => {
          if (!buf) return null;
          const p = `comic-lab/${id}/${name}.jpg`;
          const { error } = await supabaseAdmin.storage.from('cards').upload(p, buf, { contentType: 'image/jpeg', upsert: true });
          if (error) throw new Error(`upload ${name}: ${error.message}`);
          return p;
        };
        const [front_path, back_path, spine_path, page_edge_path] = await Promise.all([
          upload(frontBuf, 'front'), upload(backBuf, 'back'), upload(spineBuf, 'spine'), upload(pageEdgeBuf, 'page-edge'),
        ]);
        const { error: insErr } = await supabaseAdmin.from('comics_lab').insert({
          id,
          graded_by: admin.email ?? null,
          era,
          title: result.comicInfo?.title ?? null,
          issue_number: result.comicInfo?.issue_number ?? null,
          publisher: result.comicInfo?.publisher ?? null,
          final_grade: result.finalGrade,
          grade_label: result.gradeLabel,
          category_scores: Object.fromEntries(Object.entries(result.categories).map(([k, v]: any) => [k, v.score])),
          page_quality: result.pageQuality?.value ?? 'unknown',
          packaging_type: result.packaging?.type ?? 'none',
          summary: result.summary,
          engine_version: result.engineVersion,
          grading_json: result,
          front_path, back_path, spine_path, page_edge_path,
        });
        if (insErr) throw new Error(`insert: ${insErr.message}`);
        savedId = id;
      } catch (e: any) {
        saveError = e.message;
        console.error('[COMIC LAB] persistence failed (grade still returned):', e.message);
      }
    }

    return NextResponse.json({ ...result, savedId, saveError, elapsedSec: Math.round((Date.now() - t0) / 1000) });
  } catch (error: any) {
    console.error('[COMIC LAB] fatal:', error);
    return NextResponse.json({ error: error.message || 'grading failed' }, { status: 500 });
  }
}
