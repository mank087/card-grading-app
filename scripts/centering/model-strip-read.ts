// Step 6a strip comparison probe: the model reads the four ruler-overlaid edge strips
// (cut edge at 0, interior to the right, labels every 50px) and reports each border width.
import OpenAI from 'openai'; import fs from 'fs';
const S = process.argv[2]; const truth = require('./truth-set.json').cards as any[]; const meta = require(`${S}/edge-meta.json`) as any[];
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pct = (a: number | null, b: number | null) => a == null || b == null ? null : Math.round(100 * a / (a + b));
const parse = (s: any) => { const m = String(s ?? '').match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[1]) : null; };
const PROMPT = `You are reading a measurement sheet. It shows four horizontal strips labelled L, R, T, B: a magnified slice across one edge of a trading card's FRONT at the midpoint of that edge. Every strip is oriented the same way: the area OUTSIDE the card (background: cloth, table, sleeve, white) is on the LEFT, the card's cut edge is near the red "0" line, and the card interior runs to the RIGHT. A ruler is drawn over each strip: thin yellow ticks every 10 pixels, red lines with numbers every 50 pixels (negative = outside the card).
For each strip report the BORDER WIDTH in pixels: the distance from the card's physical cut edge (where the background ends and the card stock begins) to the inner edge of the printed border (where the border's solid colour ends and the artwork, photo, frame line or text begins). Read both positions off the ruler to the nearest 5 pixels and subtract. Use the first printed element after the border colour; a thin frame line printed just inside the border counts as the inner edge. If a strip has no measurable border (the artwork runs to the cut edge, or the edge is hidden by glare or a holder), report null for that strip.
Reply with JSON only: {"L":{"cut":-5,"inner":40,"width":45},"R":{...},"T":{...},"B":{...}} with width null where not measurable.`;
(async () => {
  const rows: any[] = []; let cost = 0;
  for (const t of truth) {
    const prefix = (t.id_prefix || t.id).slice(0, 8); const m = meta.find(x => x.id.startsWith(prefix)); if (!m) continue;
    const img = fs.readFileSync(`${S}/edge-${prefix}.jpg`).toString('base64');
    const res = await openai.chat.completions.create({ model: 'gpt-5.6-luna', max_completion_tokens: 6000, response_format: { type: 'json_object' } as any,
      messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: [{ type: 'text', text: 'Measurement sheet:' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}`, detail: 'high' } }] as any }] });
    const u: any = res.usage; cost += (u?.prompt_tokens || 0) * 1.25e-6 + (u?.completion_tokens || 0) * 1e-5;
    const raw = res.choices[0]?.message?.content || ''; let j: any = {}; try { j = JSON.parse(raw); } catch { /* keep {} */ }
    if (process.env.RAW) console.log('   RAW', raw.replace(/\s+/g, ' ').slice(0, 300), 'finish', res.choices[0]?.finish_reason);
    const w = (k: string) => (typeof j?.[k]?.width === 'number' ? j[k].width : null);
    const sl = pct(w('L'), w('R')), st = pct(w('T'), w('B')); const tl = pct(t.left, t.right), tt = pct(t.top, t.bottom);
    rows.push({ name: t.name, truthLR: tl, truthTB: tt, stripLR: sl, stripTB: st, modelLR: parse(m.model?.front_lr), modelTB: parse(m.model?.front_tb), widths: [w('L'), w('R'), w('T'), w('B')] });
    console.log(`${t.name.padEnd(30)} truth ${String(tl ?? '-').padStart(2)}/${String(tt ?? '-').padStart(2)} [${t.left}/${t.right} ${t.top}/${t.bottom}]  STRIP ${String(sl ?? '-').padStart(2)}/${String(st ?? '-').padStart(2)} [${w('L')}/${w('R')} ${w('T')}/${w('B')}]  model ${String(parse(m.model?.front_lr) ?? '-').padStart(2)}/${String(parse(m.model?.front_tb) ?? '-').padStart(2)}`);
  }
  const err = (k: string, ax: string) => { const xs = rows.filter(r => r['truth' + ax] != null && r[k + ax] != null).map(r => Math.abs(r[k + ax] - r['truth' + ax])); return xs.length ? `${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)} n=${xs.length} >5pt:${xs.filter(x => x > 5).length}` : 'n/a'; };
  for (const k of ['model', 'strip']) console.log(`${k.padEnd(6)} L/R ${err(k, 'LR')}   T/B ${err(k, 'TB')}`);
  for (const k of ['model', 'strip']) for (const ax of ['LR', 'TB']) { const xs = rows.filter(r => r['truth' + ax] != null && r[k + ax] != null && Math.abs(r['truth' + ax] - 50) >= 5); const ok = xs.filter(r => Math.sign(r['truth' + ax] - 50) === Math.sign(r[k + ax] - 50)).length; console.log(`${k} ${ax} direction ${ok}/${xs.length}`); }
  console.log(`spend $${cost.toFixed(2)}`); fs.writeFileSync(`${S}/strip-read.json`, JSON.stringify(rows, null, 1));
})();
