/**
 * Replay the pixel edge check on production cards the outline rule flags as out of frame.
 * READ-ONLY. No model calls. Photos are cached, so a re-run costs no egress.
 * Writes contact sheets of the real photo edges so every decision can be checked by eye.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '../../.env.local' });
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { clippedCorners } from '../src/lib/grading/frameClipping';
import { verifyClippedCorners } from '../src/lib/grading/frameEdgeCheck';

const DAYS = Number(process.argv[2] || 7);
const OUT = '../../grading-work/clip-pixel-check/';
const EXTRA = ['eb811bce-60b9-4f3d-bea3-a968d7b40850'];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function photo(id: string, face: string, path: string): Promise<Buffer | null> {
  const file = `${OUT}photos/${id}-${face}.jpg`;
  if (existsSync(file)) return readFileSync(file);
  const dl = await db.storage.from('cards').download(path);
  if (!dl.data) return null;
  const buf = Buffer.from(await dl.data.arrayBuffer()); writeFileSync(file, buf); return buf;
}
/** The outer band of one side, laid out horizontally, so a run of them stacks into a sheet. */
async function band(buf: Buffer, side: string): Promise<Buffer> {
  const b = await sharp(buf, { failOn: 'none' }).rotate().jpeg({ quality: 92 }).toBuffer(); const m = await sharp(b).metadata();
  const [W, H] = [m.width!, m.height!]; const d = 0.07;
  const region = side === 'top' ? { left: 0, top: 0, width: W, height: Math.round(H * d) } : side === 'bottom' ? { left: 0, top: H - Math.round(H * d), width: W, height: Math.round(H * d) }
    : side === 'left' ? { left: 0, top: 0, width: Math.round(W * d), height: H } : { left: W - Math.round(W * d), top: 0, width: Math.round(W * d), height: H };
  region.width = Math.max(1, Math.min(region.width, W - region.left)); region.height = Math.max(1, Math.min(region.height, H - region.top));
  const cut = await sharp(b).extract(region).png().toBuffer();
  let s = sharp(cut); if (side === 'left') s = s.rotate(90); if (side === 'right') s = s.rotate(270);
  return s.resize(1300, 110, { fit: 'fill' }).jpeg({ quality: 86 }).toBuffer();
}

(async () => {
  mkdirSync(OUT + 'photos', { recursive: true });
  const rows: any[] = [];
  for (let day = 0; day < DAYS; day++) {
    const to = new Date(Date.now() - day * 86400e3).toISOString(), from = new Date(Date.now() - (day + 1) * 86400e3).toISOString();
    const { data, error } = await db.from('cards').select('id, category, card_name, front_path, back_path, conversational_whole_grade, conversational_image_confidence, fq:capture_quality->front->quad, bq:capture_quality->back->quad').gte('created_at', from).lt('created_at', to).not('capture_quality', 'is', null).limit(1000);
    if (error) { console.error(error.message); break; } rows.push(...(data || []));
  }
  const extra = await db.from('cards').select('id, category, card_name, front_path, back_path, conversational_whole_grade, conversational_image_confidence, fq:capture_quality->front->quad, bq:capture_quality->back->quad').in('id', EXTRA);
  for (const r of extra.data || []) if (!rows.some(x => x.id === r.id)) rows.push(r);

  const flagged = rows.map(r => ({ r, f: clippedCorners(r.fq, 'front', false), b: clippedCorners(r.bq, 'back', false) })).filter(x => x.f.length + x.b.length > 0);
  console.log(`cards with geometry: ${rows.length} | flagged out of frame by the outline rule: ${flagged.length}`);

  const results: any[] = []; const sheets: Record<string, Array<{ label: string; img: Buffer }>> = { cleared: [], kept: [] };
  for (const { r, f, b } of flagged) {
    let after = 0; const cardSides: any[] = [];
    for (const [face, labels, quad, path] of [['front', f, r.fq, r.front_path], ['back', b, r.bq, r.back_path]] as const) {
      if (!labels.length) continue;
      const buf = await photo(r.id, face, path); if (!buf) { after += labels.length; continue; }
      const res = await verifyClippedCorners(buf, quad, face, labels as string[]);
      after += res.clipped.length;
      for (const s of res.sides) {
        cardSides.push({ face, ...s });
        sheets[s.verdict === 'background' ? 'cleared' : 'kept'].push({ label: `${r.id.slice(0, 8)} ${face} ${s.side} ${s.verdict} d=${s.colorDistance} t=${s.textureRatio}`, img: await band(buf, s.side) });
      }
    }
    const before = f.length + b.length;
    const letterBefore = before >= 2 ? 'D' : 'C', letterAfter = after >= 2 ? 'D' : after === 1 ? 'C' : '(model\'s own)';
    results.push({ id: r.id, name: r.card_name, category: r.category, grade: r.conversational_whole_grade, letter: r.conversational_image_confidence, before, after, letterBefore, letterAfter, sides: cardSides });
  }
  const fully = results.filter(x => x.after === 0), partly = results.filter(x => x.after > 0 && x.after < x.before), same = results.filter(x => x.after === x.before);
  console.log(`fully cleared: ${fully.length} | partly cleared: ${partly.length} | unchanged: ${same.length}`);
  console.log(`fully cleared cards currently graded exactly 9: ${fully.filter(x => x.grade === 9).length}`);
  const tox = results.find(x => x.id.startsWith('eb811bce')); if (tox) console.log('Toxtricity:', JSON.stringify({ before: tox.before, after: tox.after, sides: tox.sides }));
  writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 1));
  for (const [group, items] of Object.entries(sheets)) {
    for (let i = 0; i < items.length; i += 9) {
      const chunk = items.slice(i, i + 9);
      const comp = chunk.map((it, k) => ({ input: it.img, left: 0, top: k * 118 }));
      await sharp({ create: { width: 1300, height: chunk.length * 118, channels: 3, background: '#ff00ff' } }).composite(comp).jpeg({ quality: 84 }).toFile(`${OUT}${group}-${String(i / 9 + 1).padStart(2, '0')}.jpg`);
      writeFileSync(`${OUT}${group}-${String(i / 9 + 1).padStart(2, '0')}.txt`, chunk.map((it, k) => `${k + 1}. ${it.label}`).join('\n'));
    }
    console.log(`${group}: ${items.length} sides`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
