// Step 6a: ground truth vs the model's centering vs the live CV measurement, front face only.
import { createClient } from '@supabase/supabase-js'; import sharp from 'sharp';
import { detectCardGeometry, measureCentering } from '../../src/lib/zoomInspection';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const truth = require('./truth-set.json').cards as any[];
const meta = require('C:/Users/benja/AppData/Local/Temp/claude/C--Users-benja-card-grading-app/7411bccd-a8f3-4be6-900a-2dc612c40e2e/scratchpad/cen/edge-meta.json') as any[];
const fullId = (prefix: string) => meta.find(m => m.id.startsWith(prefix))?.id;
const pct = (a: number | null, b: number | null) => a == null || b == null ? null : Math.round(100 * a / (a + b));
const parse = (s: any) => { const m = String(s ?? '').match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[1]) : null; };
(async () => {
  const rows: any[] = [];
  for (const t of truth) {
    const prefix = (t.id_prefix || t.id).slice(0, 8);
    const { data: cards } = await db.from('cards').select('id,card_name,front_path,back_path,conversational_centering_ratios,cv_centering').eq('id', fullId(prefix) || prefix).limit(1);
    const c = cards?.[0]; if (!c) { console.log(prefix, 'not found'); continue; }
    const dl = async (p: string) => Buffer.from(await (await db.storage.from('cards').download(p)).data!.arrayBuffer());
    const [fb, bb] = await Promise.all([dl(c.front_path), dl(c.back_path)]);
    const rot = await sharp(fb).rotate().toBuffer();
    const g = await detectCardGeometry(rot, await sharp(bb).rotate().toBuffer());
    const cv = g.front ? await measureCentering(rot, g.front) : null;
    const tl = pct(t.left, t.right), tt = pct(t.top, t.bottom);
    const ml = parse(c.conversational_centering_ratios?.front_lr), mt = parse(c.conversational_centering_ratios?.front_tb);
    const cl = cv?.leftRight ? parse(cv.leftRight) : null, ct = cv?.topBottom ? parse(cv.topBottom) : null;
    const storedCv = c.cv_centering?.front; const sl = storedCv?.leftRight ? parse(storedCv.leftRight) : null, st = storedCv?.topBottom ? parse(storedCv.topBottom) : null;
    rows.push({ name: t.name, conf: t.confidence, truthLR: tl, truthTB: tt, modelLR: ml, modelTB: mt, cvLR: cl, cvTB: ct, cvWidths: cv?.widths, storedLR: sl, storedTB: st });
    console.log(`${t.name.padEnd(32)} ${t.confidence.padEnd(6)} truth ${String(tl ?? '-').padStart(2)}/${String(tt ?? '-').padStart(2)}  model ${String(ml ?? '-').padStart(2)}/${String(mt ?? '-').padStart(2)}  cv ${String(cl ?? '-').padStart(2)}/${String(ct ?? '-').padStart(2)}  cvWidths ${JSON.stringify(cv?.widths)}  storedCv ${String(sl ?? '-')}/${String(st ?? '-')}`);
  }
  const err = (k: 'model' | 'cv', ax: 'LR' | 'TB') => { const xs = rows.filter(r => r['truth' + ax] != null && r[k + ax] != null).map(r => Math.abs(r[k + ax] - r['truth' + ax])); return xs.length ? `${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)} (n=${xs.length}, >5pt ${xs.filter(x => x > 5).length})` : 'n/a'; };
  console.log(`\nMAE in points of the major share (truth as read):  model L/R ${err('model', 'LR')}  T/B ${err('model', 'TB')}   |   CV L/R ${err('cv', 'LR')}  T/B ${err('cv', 'TB')}`);
  // direction agreement: does each path put the larger border on the same side as truth (when truth is off by >=5 points)?
  for (const k of ['model', 'cv'] as const) for (const ax of ['LR', 'TB'] as const) { const xs = rows.filter(r => r['truth' + ax] != null && r[k + ax] != null && Math.abs(r['truth' + ax] - 50) >= 5); const ok = xs.filter(r => Math.sign(r['truth' + ax] - 50) === Math.sign(r[k + ax] - 50)).length; console.log(`${k} ${ax}: direction right on ${ok}/${xs.length} off-center cards`); }
  require('fs').writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
})();
