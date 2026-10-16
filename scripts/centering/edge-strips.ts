// Centering ground-truth helper v2: one strip per FRONT edge, oriented so the card's cut
// edge is on the LEFT and the card interior runs to the RIGHT. Window = 250px outside the
// detected outline to 250px inside; ruler ticks every 10 source px, labels every 50.
import { createClient } from '@supabase/supabase-js'; import sharp from 'sharp';
import { detectCardGeometry } from '../../src/lib/zoomInspection';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const out = process.argv[2]; const ids = process.argv.slice(3); const OUT = 250, IN = 250, SCALE = 2, BAND = 160;
const rulerSvg = (w: number, h: number) => { const l: string[] = []; for (let p = 0; p <= w; p += 10) { const major = p % 50 === 0; l.push(`<line x1="${p}" y1="0" x2="${p}" y2="${h}" stroke="${major ? '#ff0040' : '#ffd400'}" stroke-width="${major ? 1.5 : 0.6}" opacity="0.75"/>`); if (major) l.push(`<text x="${p + 2}" y="12" font-size="11" fill="#ff0040" font-family="monospace">${p - OUT}</text>`); } return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${l.join('')}</svg>`); };
(async () => {
  const meta: any[] = [];
  for (const id of ids) {
    const { data: c } = await db.from('cards').select('card_name,front_path,back_path,conversational_centering_ratios').eq('id', id).single(); if (!c) continue;
    const dl = async (p: string) => Buffer.from(await (await db.storage.from('cards').download(p)).data!.arrayBuffer());
    const [fb, bb] = await Promise.all([dl(c.front_path), dl(c.back_path)]);
    const rot = await sharp(fb).rotate().toBuffer(); const m = await sharp(rot).metadata(); const W = m.width!, H = m.height!;
    const g = await detectCardGeometry(rot, await sharp(bb).rotate().toBuffer()); const q = g.front; if (!q || q.length !== 4) { console.log(id.slice(0, 8), 'no quad'); continue; }
    const P = q.map(p => ({ x: p.x / 1000 * W, y: p.y / 1000 * H })); const [tl, tr, br, bl] = P;
    const mid = (a: any, b: any) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    // For each edge: crop a band centered on the edge midpoint, then rotate so "outside" is left.
    const edges = [
      { k: 'L', m: mid(tl, bl), rotate: 0, horiz: true },   // left edge: outside is already left
      { k: 'R', m: mid(tr, br), rotate: 180, horiz: true },  // right edge: flip so outside is left
      { k: 'T', m: mid(tl, tr), rotate: 270, horiz: false }, // top edge: outside is up -> rotate so up becomes left
      { k: 'B', m: mid(bl, br), rotate: 90, horiz: false },  // bottom edge: outside is down
    ];
    const strips: Buffer[] = [];
    for (const e of edges) {
      const w = e.horiz ? OUT + IN : BAND, h = e.horiz ? BAND : OUT + IN;
      let left: number, top: number;
      if (e.k === 'L') { left = Math.round(e.m.x - OUT); top = Math.round(e.m.y - BAND / 2); }
      else if (e.k === 'R') { left = Math.round(e.m.x - IN); top = Math.round(e.m.y - BAND / 2); }
      else if (e.k === 'T') { left = Math.round(e.m.x - BAND / 2); top = Math.round(e.m.y - OUT); }
      else { left = Math.round(e.m.x - BAND / 2); top = Math.round(e.m.y - IN); }
      // pad with black if the window runs off the photo
      const extended = await sharp(rot).extend({ top: OUT + IN, bottom: OUT + IN, left: OUT + IN, right: OUT + IN, background: '#000' }).toBuffer();
      const cut = await sharp(extended).extract({ left: left + OUT + IN, top: top + OUT + IN, width: w, height: h }).toBuffer();
      const padded = await sharp(cut).rotate(e.rotate).toBuffer();
      const withRuler = await sharp(padded).composite([{ input: rulerSvg(OUT + IN, BAND), left: 0, top: 0 }]).png().toBuffer();
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="${BAND}"><rect width="60" height="${BAND}" fill="#222"/><text x="12" y="${BAND / 2 + 10}" font-size="30" fill="#fff" font-family="monospace">${e.k}</text></svg>`);
      strips.push(await sharp({ create: { width: 60 + OUT + IN, height: BAND, channels: 3, background: '#222' } }).composite([{ input: label, left: 0, top: 0 }, { input: withRuler, left: 60, top: 0 }]).png().toBuffer());
    }
    const sheet = await sharp({ create: { width: 60 + OUT + IN, height: (BAND + 6) * 4, channels: 3, background: '#000' } }).composite(strips.map((s, i) => ({ input: s, left: 0, top: i * (BAND + 6) }))).resize((60 + OUT + IN) * SCALE, undefined, { kernel: 'lanczos3' }).jpeg({ quality: 92 }).toFile(`${out}/edge-${id.slice(0, 8)}.jpg`);
    const cardW = Math.hypot(tr.x - tl.x, tr.y - tl.y), cardH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    meta.push({ id, name: c.card_name, cardW: Math.round(cardW), cardH: Math.round(cardH), model: c.conversational_centering_ratios });
    console.log(id.slice(0, 8), c.card_name, 'quadW', Math.round(cardW), 'quadH', Math.round(cardH), 'model', JSON.stringify(c.conversational_centering_ratios));
  }
  const prev = require('fs').existsSync(`${out}/edge-meta.json`) ? JSON.parse(require('fs').readFileSync(`${out}/edge-meta.json`, 'utf8')) : [];
  require('fs').writeFileSync(`${out}/edge-meta.json`, JSON.stringify([...prev.filter((p: any) => !ids.includes(p.id)), ...meta], null, 1));
})();
