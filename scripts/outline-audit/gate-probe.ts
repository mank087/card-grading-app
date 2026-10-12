/**
 * Card-outline audit: run geometry-gate PROMPT VARIANTS on the manifest set and
 * record the quads. Calls OpenAI directly (no api_usage_log write); every call's
 * estimated cost is appended to SPEND file.
 *   MANIFEST=... OUT=... VARIANTS=A,B IDS=a,b npx tsx --env-file=../../.env.local scripts/_outline-gate-probe.ts
 */
import fs from 'fs';
import OpenAI from 'openai';
import sharp from 'sharp';
import { applyModelCompat, BASELINE_MODEL } from '../../src/lib/grading/modelRouter';

const MAN = JSON.parse(fs.readFileSync(process.env.MANIFEST!, 'utf8'));
const OUT = process.env.OUT!;
const SPEND = process.env.SPEND!;
const VARIANTS = (process.env.VARIANTS || 'A').split(',');
const IDS = (process.env.IDS || '').split(',').filter(Boolean);
const LIMIT = Number(process.env.LIMIT || 999);
const RATES = { in: 0.20, cached: 0.02, out: 1.20 }; // gpt-5.6-luna $/M
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CURRENT_SYS = 'You locate a trading card in each photo. Reply ONLY with JSON:\n' +
  '{"front_fill_percent": <0-100>, "front_corners": [{"x":<0-1000>,"y":<0-1000>} x4], "back_fill_percent": <0-100>, "back_corners": [{"x":<0-1000>,"y":<0-1000>} x4]}\n' +
  'fill_percent = share of the image area covered by the card itself (not sleeve/holder/background).\n' +
  'corners = the card\'s four outer corners in NORMALIZED coordinates (x: 0=left edge of image, 1000=right; y: 0=top, 1000=bottom), ordered [top-left, top-right, bottom-right, bottom-left]. Locate them precisely at the card\'s printed corner tips.';

const PIXEL_SYS = (fw: number, fh: number, bw: number, bh: number) => 'You locate a trading card in each photo. Reply ONLY with JSON:\n' +
  '{"front_fill_percent": <0-100>, "front_corners": [{"x":<px>,"y":<px>} x4], "back_fill_percent": <0-100>, "back_corners": [{"x":<px>,"y":<px>} x4]}\n' +
  'fill_percent = share of the image area covered by the card itself (not sleeve/holder/background).\n' +
  `corners = the four outer corners of the PHYSICAL card (the cut edge of the card stock, including its whole border — not a sleeve, toploader, stand or holder, and not an inner printed frame), as PIXEL coordinates in the image exactly as given: Photo 1 is ${fw} px wide and ${fh} px tall, Photo 2 is ${bw} px wide and ${bh} px tall; x from the left edge, y from the top edge. Order [top-left, top-right, bottom-right, bottom-left]. Check the bottom corners as carefully as the top ones: the card ends where its bottom border meets the background.`;

const NORM_IMPROVED_SYS = 'You locate a trading card in each photo. Reply ONLY with JSON:\n' +
  '{"front_fill_percent": <0-100>, "front_corners": [{"x":<0-1000>,"y":<0-1000>} x4], "back_fill_percent": <0-100>, "back_corners": [{"x":<0-1000>,"y":<0-1000>} x4]}\n' +
  'fill_percent = share of the image area covered by the card itself (not sleeve/holder/background).\n' +
  'corners = the four outer corners of the PHYSICAL card (the cut edge of the card stock, including its whole border — not a sleeve, toploader, stand or holder, and not an inner printed frame), in NORMALIZED coordinates (x: 0=left edge of image, 1000=right; y: 0=top, 1000=bottom), ordered [top-left, top-right, bottom-right, bottom-left]. Check the bottom corners as carefully as the top ones: the card ends where its bottom border meets the background.';
const PIXEL_PLAIN_SYS = (fw: number, fh: number, bw: number, bh: number) => 'You locate a trading card in each photo. Reply ONLY with JSON:\n' +
  '{"front_fill_percent": <0-100>, "front_corners": [{"x":<px>,"y":<px>} x4], "back_fill_percent": <0-100>, "back_corners": [{"x":<px>,"y":<px>} x4]}\n' +
  'fill_percent = share of the image area covered by the card itself (not sleeve/holder/background).\n' +
  `corners = the card's four outer corners as PIXEL coordinates in the image exactly as given: Photo 1 is ${fw} px wide and ${fh} px tall, Photo 2 is ${bw} px wide and ${bh} px tall; x from the left edge, y from the top edge. Order [top-left, top-right, bottom-right, bottom-left]. Locate them precisely at the card's printed corner tips.`;

async function prep(file: string, longEdge: number | null): Promise<{ b64: string; w: number; h: number; W: number; H: number }> {
  const meta = await sharp(file).metadata();
  if (!longEdge) return { b64: fs.readFileSync(file).toString('base64'), w: meta.width!, h: meta.height!, W: meta.width!, H: meta.height! };
  const { data, info } = await sharp(file).resize(longEdge, longEdge, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  return { b64: data.toString('base64'), w: info.width, h: info.height, W: meta.width!, H: meta.height! };
}

async function call(variant: string, card: any): Promise<any> {
  const F = card.faces.front.file, B = card.faces.back.file;
  let sys: string, detail: string, f: any, b: any, pixel = false;
  if (variant === 'A') { f = await prep(F, null); b = await prep(B, null); sys = CURRENT_SYS; detail = 'high'; }
  else if (variant === 'B') { f = await prep(F, null); b = await prep(B, null); sys = CURRENT_SYS; detail = 'original'; }
  else if (variant === 'C') { f = await prep(F, 1024); b = await prep(B, 1024); sys = PIXEL_SYS(f.w, f.h, b.w, b.h); detail = 'original'; pixel = true; }
  else if (variant === 'D') { f = await prep(F, 1536); b = await prep(B, 1536); sys = PIXEL_SYS(f.w, f.h, b.w, b.h); detail = 'original'; pixel = true; }
  else if (variant === 'E') { f = await prep(F, 1024); b = await prep(B, 1024); sys = PIXEL_SYS(f.w, f.h, b.w, b.h); detail = 'high'; pixel = true; }
  else if (variant === 'F') { f = await prep(F, null); b = await prep(B, null); sys = NORM_IMPROVED_SYS; detail = 'high'; }
  else if (variant === 'G') { f = await prep(F, 1024); b = await prep(B, 1024); sys = PIXEL_PLAIN_SYS(f.w, f.h, b.w, b.h); detail = 'high'; pixel = true; }
  else if (variant === 'E2' || variant === 'E3') { f = await prep(F, 1024); b = await prep(B, 1024); sys = PIXEL_SYS(f.w, f.h, b.w, b.h); detail = 'high'; pixel = true; }
  else throw new Error('variant ' + variant);
  const { config } = applyModelCompat({
    model: BASELINE_MODEL, temperature: 0, max_completion_tokens: 2000, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: [
        { type: 'text', text: 'Photo 1 (front):' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${f.b64}`, detail } },
        { type: 'text', text: 'Photo 2 (back):' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b.b64}`, detail } },
      ] },
    ],
  }, BASELINE_MODEL);
  const t0 = Date.now();
  const res: any = await openai.chat.completions.create(config as any, { timeout: 90_000 });
  const u = res.usage || {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const cost = ((u.prompt_tokens - cached) / 1e6) * RATES.in + (cached / 1e6) * RATES.cached + (u.completion_tokens / 1e6) * RATES.out;
  fs.appendFileSync(SPEND, JSON.stringify({ at: new Date().toISOString(), op: 'outline_gate_probe', variant, card: card.id, model: BASELINE_MODEL, prompt: u.prompt_tokens, completion: u.completion_tokens, cost_usd: +cost.toFixed(6) }) + '\n');
  const j = JSON.parse(res.choices[0].message.content);
  const norm = (q: any, img: any) => !Array.isArray(q) ? null : pixel ? q.map((p: any) => ({ x: +(p.x / img.w * 1000).toFixed(1), y: +(p.y / img.h * 1000).toFixed(1) })) : q;
  return { ms: Date.now() - t0, cost, front: norm(j.front_corners, f), back: norm(j.back_corners, b), frontFill: j.front_fill_percent, backFill: j.back_fill_percent };
}

async function main() {
  const outFile = OUT;
  const all = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
  const cards = MAN.filter((c: any) => (!IDS.length || IDS.includes(c.id)) && c.faces.front && c.faces.back).slice(0, LIMIT);
  for (const v of VARIANTS) {
    all[v] = all[v] || {};
    const queue = cards.filter((c: any) => !all[v][c.id]);
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const c = queue.shift();
        try { all[v][c.id] = await call(v, c); console.log(v, c.id.slice(0, 8), 'ok', all[v][c.id].cost.toFixed(4)); }
        catch (e: any) { console.warn(v, c.id.slice(0, 8), 'fail', e.message); }
      }
    });
    await Promise.all(workers);
    fs.writeFileSync(outFile, JSON.stringify(all, null, 1));
  }
  const spent = fs.readFileSync(SPEND, 'utf8').trim().split('\n').map(l => JSON.parse(l).cost_usd).reduce((a, b) => a + b, 0);
  console.log('total spend so far $' + spent.toFixed(4));
}
main().catch(e => { console.error(e); process.exit(1); });
