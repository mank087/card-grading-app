// Run refineQuad on stored gate quads in the manifest; write overlays + results.
// Usage: MANIFEST=... OUT=... [QUAD_KEY=quad] npx tsx scripts/_outline-refine-eval.ts
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { loadOutlineImage, refineQuad, quadAspect, toPixels } from './cvOutlineRefine';

const MAN = process.env.MANIFEST!;
const OUT = process.env.OUT!;
const KEY = process.env.QUAD_KEY || 'quad';
async function overlay(file: string, quads: Array<{ q: any; color: string }>): Promise<Buffer> {
  const meta = await sharp(file).metadata();
  const Wd = 400, Hd = Math.round(meta.height! * Wd / meta.width!);
  const polys = quads.filter(x => x.q).map(({ q, color }) => `<polygon points="${q.map((p: any) => `${p.x * Wd / 1000},${p.y * Hd / 1000}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.5"/>`).join('');
  return sharp(file).resize(Wd, Hd).composite([{ input: Buffer.from(`<svg width="${Wd}" height="${Hd}" xmlns="http://www.w3.org/2000/svg">${polys}</svg>`) }]).jpeg().toBuffer();
}
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  const results: any[] = [];
  const tiles: Array<{ buf: Buffer; label: string }> = [];
  for (const c of man) for (const face of ['front', 'back']) {
    const f = c.faces[face]; if (!f?.[KEY]) continue;
    const img = await loadOutlineImage(fs.readFileSync(f.file));
    const r = refineQuad(img, f[KEY]);
    const qa = quadAspect(toPixels(f[KEY], f.width, f.height));
    results.push({ id: c.id, face, ok: r.ok, reason: r.reason, modelAspect: +qa.toFixed(3), aspect: r.aspect && +r.aspect.toFixed(3),
      moved: r.chosen && Object.fromEntries(Object.entries(r.chosen).map(([k, v]: any) => [k, +(v.moved * 100).toFixed(1)])), refined: r.ok ? r.quad : null });
    tiles.push({ buf: await overlay(f.file, [{ q: f[KEY], color: 'red' }, { q: r.ok ? r.quad : null, color: 'lime' }]), label: `${c.id.slice(0, 8)} ${face}` });
  }
  fs.writeFileSync(path.join(OUT, 'refine.json'), JSON.stringify(results, null, 1));
  for (const r of results) console.log(r.id.slice(0, 8), r.face.padEnd(5), r.ok ? 'OK ' : 'NO ', (r.reason || '').padEnd(16), 'mAsp', r.modelAspect, 'asp', r.aspect, JSON.stringify(r.moved));
  // contact sheets of 8 (4x2)
  for (let s = 0; s < tiles.length; s += 8) {
    const group = tiles.slice(s, s + 8);
    const comps: any[] = []; let x = 0, y = 0;
    const tileH = 560;
    for (let i = 0; i < group.length; i++) {
      const t = await sharp(group[i].buf).resize(400, tileH, { fit: 'contain', background: '#000' }).composite([{ input: Buffer.from(`<svg width="400" height="20"><rect width="400" height="20" fill="black"/><text x="4" y="15" fill="white" font-size="14">${s + i} ${group[i].label}</text></svg>`), top: 0, left: 0 }]).jpeg().toBuffer();
      comps.push({ input: t, left: (i % 4) * 400, top: Math.floor(i / 4) * tileH });
    }
    await sharp({ create: { width: 1600, height: tileH * 2, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 80 }).toFile(path.join(OUT, `sheet_${String(s / 8).padStart(2, '0')}.jpg`));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
