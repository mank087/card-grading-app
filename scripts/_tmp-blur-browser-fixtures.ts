/**
 * Build the fixture set for the browser-side blur validation.
 *
 * WHY FULL RESOLUTION: the whole point of the test is the DOWNSCALE. Feeding
 * the browser an already-512px image measures nothing, because the browser
 * skips the resize entirely and both sides then agree trivially. These must be
 * the originals the customer actually uploaded.
 *
 * Emits, into the chosen output dir:
 *   <conf>_<id8>.jpg   full-resolution originals, to drag into the harness
 *   expected.json      the sharp/mitchell variance for each, for comparison
 *
 *   OUT_DIR=/path npx tsx scripts/_tmp-blur-browser-fixtures.ts
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ANALYSIS_EDGE = 512;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'scripts', '_snapshots', 'blur-calibration', 'fixtures');

/** Same maths as src/utils/imageQuality.ts, at a chosen resize kernel. */
async function variance(buf: Buffer, kernel: any): Promise<number> {
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .resize(ANALYSIS_EDGE, ANALYSIS_EDGE, { fit: 'inside', withoutEnlargement: true, kernel })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const l = new Float32Array(w * h);
  for (let i = 0, p = 0; p < l.length; i += 3, p++) {
    l[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let s = 0, c = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = -l[i - w - 1] - l[i - w] - l[i - w + 1] - l[i - 1] + 8 * l[i] - l[i + 1] - l[i + w - 1] - l[i + w] - l[i + w + 1];
      s += lap * lap; c++;
    }
  }
  return c ? s / c : 0;
}

/**
 * A spread across the whole range, not a random sample — the question is
 * whether the browser/sharp ratio is CONSTANT across the scale or drifts with
 * sharpness. Two near the floor, two borderline, two mid, two sharp.
 */
const IDS = [
  'e5de5a5b-7310-43c2-b3a1-6d4db0b843e3', // ~154  worst in sample
  'c3e16e12-6ec5-439d-b465-bb8d1ec9defb', // ~317  D
  'a8519fa1-2362-418e-a173-8d02151d9dee', // ~515  borderline
  '0cf38bcd-d244-4b88-bd5c-3c5307819c2b', // ~795  C
  'db2f0ad2-497c-4d0f-bcb8-46b10e9d654e', // ~972  C, visually fine
  'dce4358d-5849-4a76-948a-8936ddce5aa0', // ~2212 C median
  '81c9e1a3-87fd-4c40-b73e-45fe83c217e7', // ~3700 B
  'cb7d4c1b-18cc-4487-b7b6-feb8f4a2ce8c', // ~15890 sharpest
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const { data, error } = await supabase
    .from('cards')
    .select('id, front_path, conversational_image_confidence')
    .in('id', IDS);
  if (error) { console.error(error.message); process.exit(1); }

  const expected: Array<{ file: string; id8: string; conf: string; mitchell: number; lanczos3: number; bytes: number }> = [];

  for (const c of data || []) {
    const { data: blob, error: dlErr } = await supabase.storage.from('cards').download((c as any).front_path);
    if (dlErr || !blob) { console.log(`  ${c.id}: download failed`); continue; }
    const buf = Buffer.from(await blob.arrayBuffer());

    const conf = String((c as any).conversational_image_confidence || 'x').charAt(0).toUpperCase();
    const id8 = c.id.slice(0, 8);
    const file = `${conf}_${id8}.jpg`;

    // Written AS-IS: no resize, no re-encode. Any processing here would defeat
    // the test by changing the very frequency content being measured.
    fs.writeFileSync(path.join(OUT, file), buf);

    const [mi, l3] = await Promise.all([
      variance(buf, sharp.kernel.mitchell),
      variance(buf, sharp.kernel.lanczos3),
    ]);
    expected.push({
      file, id8, conf,
      mitchell: Math.round(mi),
      lanczos3: Math.round(l3),
      bytes: buf.length,
    });
    console.log(`  ${file.padEnd(20)} mitchell ${String(Math.round(mi)).padStart(6)}  lanczos3 ${String(Math.round(l3)).padStart(6)}  ${(buf.length / 1024).toFixed(0)}KB`);
  }

  expected.sort((a, b) => a.mitchell - b.mitchell);
  fs.writeFileSync(path.join(OUT, 'expected.json'), JSON.stringify(expected, null, 2));
  console.log(`\nWrote ${expected.length} fixtures + expected.json to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
