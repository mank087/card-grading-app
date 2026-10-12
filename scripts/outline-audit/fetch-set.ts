/**
 * Card-outline audit (Oct 12 2026): pull a measurement set of recent graded
 * cards — their stored gate quads + original photos. Read-only; light columns,
 * one page of ≤200 rows; downloads originals to OUT_DIR.
 *   npx tsx --env-file=../../.env.local scripts/_outline-fetch-set.ts
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const OUT = process.env.OUT_DIR!;
const N = Number(process.env.N || 40);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const EXTRA = (process.env.EXTRA_IDS || '').split(',').filter(Boolean);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { data, error } = await sb.from('cards')
    .select('id, category, created_at, front_path, back_path, front:capture_quality->front, back:capture_quality->back, gate_model:capture_quality->>gate_model, outcome:capture_quality->>zoom_outcome')
    .gte('created_at', '2026-10-03')
    .not('capture_quality', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  let rows = (data as any[]).filter(r => r.front?.quad && r.front_path);
  // Spread across categories: round-robin
  const byCat = new Map<string, any[]>();
  for (const r of rows) { const k = r.category || '?'; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k)!.push(r); }
  const picked: any[] = [];
  while (picked.length < N && [...byCat.values()].some(a => a.length)) {
    for (const a of byCat.values()) { const r = a.shift(); if (r && picked.length < N) picked.push(r); }
  }
  if (EXTRA.length) {
    const { data: ex } = await sb.from('cards').select('id, category, created_at, front_path, back_path, front:capture_quality->front, back:capture_quality->back, gate_model:capture_quality->>gate_model, outcome:capture_quality->>zoom_outcome').in('id', EXTRA);
    for (const r of ex || []) if (!picked.find(p => p.id === r.id)) picked.unshift(r);
  }
  const manifest: any[] = [];
  for (const r of picked) {
    const entry: any = { id: r.id, category: r.category, created_at: r.created_at, gate_model: r.gate_model, outcome: r.outcome, faces: {} };
    for (const face of ['front', 'back'] as const) {
      const p = face === 'front' ? r.front_path : r.back_path;
      if (!p) continue;
      const file = path.join(OUT, `${r.id}_${face}.jpg`);
      if (!fs.existsSync(file)) {
        const { data: blob, error: e2 } = await sb.storage.from('cards').download(p);
        if (e2 || !blob) { console.warn('download failed', r.id, face, e2?.message); continue; }
        fs.writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
      }
      const meta = await sharp(file).metadata();
      entry.faces[face] = { file, width: meta.width, height: meta.height, orientation: meta.orientation ?? null, format: meta.format, quad: r[face]?.quad ?? null, fill: r[face]?.fill_percent ?? null };
    }
    manifest.push(entry);
    console.log(r.id, r.category, entry.faces.front?.width + 'x' + entry.faces.front?.height, 'orient', entry.faces.front?.orientation);
  }
  fs.writeFileSync(path.join(OUT, '..', 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('cards', manifest.length);
}
main().catch(e => { console.error(e); process.exit(1); });
