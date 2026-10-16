// Step 6a prototype: measure each front border by walking INWARD FROM THE BACKGROUND
// (cut edge = first sustained departure from the background colour; inner edge = first
// sustained departure from the border colour), instead of snapping around the model quad.
import { createClient } from '@supabase/supabase-js'; import sharp from 'sharp'; import fs from 'fs';
import { detectCardGeometry, measureCentering } from '../../src/lib/zoomInspection';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const S = process.argv[2]; const truth = require('./truth-set.json').cards as any[]; const meta = require(`${S}/edge-meta.json`) as any[];
const quadFile = `${S}/quads.json`; const quads: Record<string, any> = fs.existsSync(quadFile) ? JSON.parse(fs.readFileSync(quadFile, 'utf8')) : {};
type Pt = { x: number; y: number }; type RGB = [number, number, number];
const pct = (a: number | null, b: number | null) => a == null || b == null ? null : Math.round(100 * a / (a + b));
const parse = (s: any) => { const m = String(s ?? '').match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[1]) : null; };
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function proto(buf: Buffer, quadNorm: Pt[]) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height, C = info.channels;
  const q = quadNorm.map(p => ({ x: p.x / 1000 * W, y: p.y / 1000 * H })); const [tl, tr, br, bl] = q;
  const at = (x: number, y: number): RGB | null => { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= W || yi >= H) return null; const i = (yi * W + xi) * C; return [data[i], data[i + 1], data[i + 2]]; };
  const d2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const medRGB = (cs: RGB[]): RGB => [0, 1, 2].map(i => med(cs.map(c => c[i])) ?? 0) as RGB;
  const cardDim = Math.min(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(bl.x - tl.x, bl.y - tl.y));
  const OUT = Math.round(cardDim * 0.15), IN = Math.round(cardDim * 0.2);
  const side = (A: Pt, B: Pt, nx: number, ny: number) => {
    const widths: number[] = []; const detail: string[] = [];
    for (let s = 0; s < 12; s++) {
      const t = 0.2 + 0.6 * (s / 11); const ex = A.x + (B.x - A.x) * t, ey = A.y + (B.y - A.y) * t;
      const line: (RGB | null)[] = []; for (let o = -OUT; o <= IN; o++) line.push(at(ex + nx * o, ey + ny * o));
      const idx = (o: number) => o + OUT;
      const bgSamples = line.slice(0, Math.round(OUT * 0.4)).filter(Boolean) as RGB[]; if (bgSamples.length < 10) { detail.push('nobg'); continue; }
      const bg = medRGB(bgSamples);
      const bgNoise = med(bgSamples.map(c => d2(c, bg))) ?? 0; const thr = Math.max(900, bgNoise * 6);
      let cut: number | null = null;
      for (let o = -OUT + Math.round(OUT * 0.4); o <= IN - 8; o++) { let ok = true; for (let k = 0; k < 8; k++) { const c = line[idx(o + k)]; if (!c || d2(c, bg) < thr) { ok = false; break; } } if (ok) { cut = o; break; } }
      if (cut == null) { detail.push('nocut'); continue; }
      const ref = line.slice(idx(cut + 6), idx(cut + 15)).filter(Boolean) as RGB[]; if (ref.length < 5) { detail.push('noref'); continue; }
      const border = medRGB(ref); const refNoise = med(ref.map(c => d2(c, border))) ?? 0; const thr2 = Math.max(700, refNoise * 6);
      let inner: number | null = null;
      for (let o = cut + 15; o <= IN - 6; o++) { let ok = true; for (let k = 0; k < 6; k++) { const c = line[idx(o + k)]; if (!c || d2(c, border) < thr2) { ok = false; break; } } if (ok) { inner = o; break; } }
      if (inner == null) { detail.push('noinner'); continue; }
      widths.push(inner - cut);
    }
    if (widths.length < 6) return { width: null as number | null, n: widths.length, spread: 0, why: detail.join(',') };
    const m = med(widths)!; const sorted = [...widths].sort((a, b) => a - b); const iqr = sorted[Math.floor(sorted.length * 0.75)] - sorted[Math.floor(sorted.length * 0.25)];
    return { width: m as number | null, n: widths.length, spread: Math.round(100 * iqr / Math.max(1, m)), why: '' };
  };
  const L = side(tl, bl, 1, 0), R = side(tr, br, -1, 0), T = side(tl, tr, 0, 1), B = side(bl, br, 0, -1);
  const ok = (s: { width: number | null; spread: number }) => s.width != null && s.spread <= 35;
  return { L, R, T, B, lr: ok(L) && ok(R) ? pct(L.width, R.width) : null, tb: ok(T) && ok(B) ? pct(T.width, B.width) : null };
}

(async () => {
  const rows: any[] = [];
  for (const t of truth) {
    const prefix = (t.id_prefix || t.id).slice(0, 8); const id = meta.find(m => m.id.startsWith(prefix))?.id; if (!id) continue;
    const { data: cards } = await db.from('cards').select('id,front_path,back_path,conversational_centering_ratios').eq('id', id).limit(1); const c = cards?.[0]; if (!c) continue;
    const dl = async (p: string) => Buffer.from(await (await db.storage.from('cards').download(p)).data!.arrayBuffer());
    const rot = await sharp(await dl(c.front_path)).rotate().toBuffer();
    if (!quads[id]) { const g = await detectCardGeometry(rot, await sharp(await dl(c.back_path)).rotate().toBuffer()); quads[id] = { front: g.front, back: g.back }; fs.writeFileSync(quadFile, JSON.stringify(quads)); }
    const quad = quads[id].front; if (!quad) { console.log(t.name, 'no quad'); continue; }
    const p = await proto(rot, quad); const cv = await measureCentering(rot, quad);
    const tl = pct(t.left, t.right), tt = pct(t.top, t.bottom); const ml = parse(c.conversational_centering_ratios?.front_lr), mt = parse(c.conversational_centering_ratios?.front_tb);
    const cl = cv?.leftRight ? parse(cv.leftRight) : null, ct = cv?.topBottom ? parse(cv.topBottom) : null;
    rows.push({ name: t.name, truthLR: tl, truthTB: tt, modelLR: ml, modelTB: mt, cvLR: cl, cvTB: ct, protoLR: p.lr, protoTB: p.tb });
    const w = (s: { width: number | null; spread: number; why: string }) => s.width == null ? `-(${s.why})` : `${s.width}${s.spread > 35 ? '?' : ''}`;
    console.log(`${t.name.padEnd(30)} truth ${String(tl ?? '-').padStart(2)}/${String(tt ?? '-').padStart(2)} [${t.left}/${t.right} ${t.top}/${t.bottom}]  model ${String(ml ?? '-').padStart(2)}/${String(mt ?? '-').padStart(2)}  cv ${String(cl ?? '-').padStart(2)}/${String(ct ?? '-').padStart(2)}  PROTO ${String(p.lr ?? '-').padStart(2)}/${String(p.tb ?? '-').padStart(2)} widths L${w(p.L)} R${w(p.R)} T${w(p.T)} B${w(p.B)}`);
  }
  const err = (k: string, ax: string) => { const xs = rows.filter(r => r['truth' + ax] != null && r[k + ax] != null).map(r => Math.abs(r[k + ax] - r['truth' + ax])); return xs.length ? `${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)} n=${xs.length} >5pt:${xs.filter(x => x > 5).length}` : 'n/a'; };
  for (const k of ['model', 'cv', 'proto']) console.log(`${k.padEnd(6)} L/R ${err(k, 'LR')}   T/B ${err(k, 'TB')}`);
  for (const k of ['model', 'cv', 'proto']) for (const ax of ['LR', 'TB']) { const xs = rows.filter(r => r['truth' + ax] != null && r[k + ax] != null && Math.abs(r['truth' + ax] - 50) >= 5); const ok = xs.filter(r => Math.sign(r['truth' + ax] - 50) === Math.sign(r[k + ax] - 50)).length; console.log(`${k} ${ax} direction ${ok}/${xs.length}`); }
})();
