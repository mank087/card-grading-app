/**
 * Blur-threshold calibration against real customer submissions.
 *
 * P1 rewrote src/utils/imageQuality.ts to analyse a fixed 512px working copy,
 * which made Laplacian variance comparable across sources for the first time —
 * but the thresholds shipped as reasoned guesses. This measures what real
 * photos actually score, so they can be set from data.
 *
 *   npx tsx scripts/_tmp-blur-calibration.ts [--limit 100]
 *
 * GROUND TRUTH: cards.conversational_image_confidence — the grader's own A/B/C/D
 * verdict on image quality, formed with far more evidence than blur alone
 * (glare, corner visibility, shadows). It is a proxy, not a label: a card can
 * be sharp and still score C for glare. So the useful signal is the DISTRIBUTION
 * of blur variance per confidence letter, not per-card agreement.
 *
 * DB SAFETY: selects only light columns and caps the row count. Never touches
 * conversational_grading or any other heavy JSON blob.
 *
 * Replicates the client algorithm exactly — same 512px long edge, same
 * luminance weights, same 8-neighbour Laplacian, same mean-of-squares. If
 * either side changes, they must change together or the thresholds stop
 * transferring.
 *
 * RESIZE KERNEL: deliberately mitchell, NOT sharp's lanczos3 default. The
 * kernel materially changes the number — measured on the same five images,
 * mitchell reads ~0.67x lanczos3 and nearest ~1.44x. The browser resizes via
 * canvas drawImage, whose high-quality downscale filter is closer to mitchell
 * than to lanczos3, so mitchell is the best available proxy. It is still a
 * proxy: the shipped thresholds carry a deliberate safety margin for it, and
 * a browser-side validation is the honest next step. Do not "fix" this to the
 * default — the thresholds in src/utils/imageQuality.ts were derived here.
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ANALYSIS_EDGE = 512; // must match src/utils/imageQuality.ts

const argLimit = Number(process.argv[process.argv.indexOf('--limit') + 1]);
const LIMIT = Number.isFinite(argLimit) && argLimit > 0 ? Math.min(argLimit, 300) : 100;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Laplacian variance at a fixed scale — the client's checkBlur, in Node. */
async function blurVariance(buf: Buffer): Promise<{ variance: number; srcW: number; srcH: number } | null> {
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    if (!srcW || !srcH) return null;

    // Same scaling rule as the browser: fit the LONG edge to ANALYSIS_EDGE.
    const { data, info } = await sharp(buf, { failOn: 'none' })
      .resize(ANALYSIS_EDGE, ANALYSIS_EDGE, { fit: 'inside', withoutEnlargement: true, kernel: sharp.kernel.mitchell })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    if (w < 3 || h < 3) return null;

    // Client luminance weights (Rec.601), NOT sharp's default greyscale (709).
    const luma = new Float32Array(w * h);
    for (let i = 0, p = 0; p < luma.length; i += 3, p++) {
      luma[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    let sum = 0;
    let count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap =
          -luma[i - w - 1] - luma[i - w] - luma[i - w + 1] +
          -luma[i - 1] + 8 * luma[i] - luma[i + 1] +
          -luma[i + w - 1] - luma[i + w] - luma[i + w + 1];
        sum += lap * lap;
        count++;
      }
    }
    return { variance: count ? sum / count : 0, srcW, srcH };
  } catch {
    return null;
  }
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[i];
}

async function main() {
  console.log(`Pulling the last ${LIMIT} graded cards (light columns only)...\n`);

  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, created_at, category, front_path, back_path, conversational_image_confidence, conversational_whole_grade, capture_source')
    .not('front_path', 'is', null)
    .not('conversational_image_confidence', 'is', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!cards?.length) {
    console.error('No cards returned.');
    process.exit(1);
  }

  console.log(`Got ${cards.length} cards. Measuring front images...\n`);

  const outDir = path.join(process.cwd(), 'scripts', '_snapshots', 'blur-calibration');
  fs.mkdirSync(outDir, { recursive: true });

  const rows: Array<{
    id: string;
    conf: string;
    grade: number | null;
    variance: number;
    srcW: number;
    srcH: number;
    category: string | null;
    source: string | null;
  }> = [];

  let failed = 0;
  for (let i = 0; i < cards.length; i++) {
    const c: any = cards[i];
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from('cards').download(c.front_path);
      if (dlErr || !blob) { failed++; continue; }
      const buf = Buffer.from(await blob.arrayBuffer());
      const m = await blurVariance(buf);
      if (!m) { failed++; continue; }

      rows.push({
        id: c.id,
        conf: String(c.conversational_image_confidence || '?').trim().charAt(0).toUpperCase(),
        grade: c.conversational_whole_grade ?? null,
        variance: Math.round(m.variance * 10) / 10,
        srcW: m.srcW,
        srcH: m.srcH,
        category: c.category ?? null,
        source: c.capture_source?.client_surface ?? null,
      });
    } catch {
      failed++;
    }
    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${cards.length}\r`);
  }

  console.log(`\nMeasured ${rows.length}, failed ${failed}.\n`);

  fs.writeFileSync(path.join(outDir, 'measurements.json'), JSON.stringify(rows, null, 2));

  // ---- Distribution per confidence letter -------------------------------
  console.log('BLUR VARIANCE BY GRADER IMAGE CONFIDENCE (512px long edge)');
  console.log('conf   n     p10      p25      p50      p75      p90');
  for (const letter of ['A', 'B', 'C', 'D']) {
    const vs = rows.filter(r => r.conf === letter).map(r => r.variance).sort((a, b) => a - b);
    if (!vs.length) { console.log(`${letter}      0     —`); continue; }
    console.log(
      `${letter}   ${String(vs.length).padStart(4)}  ` +
      [10, 25, 50, 75, 90].map(p => String(Math.round(pct(vs, p))).padStart(7)).join('  ')
    );
  }

  const all = rows.map(r => r.variance).sort((a, b) => a - b);
  console.log('\nALL CARDS');
  console.log('n     p1       p5      p10      p25      p50      p75      p90');
  console.log(
    `${String(all.length).padStart(4)}  ` +
    [1, 5, 10, 25, 50, 75, 90].map(p => String(Math.round(pct(all, p))).padStart(7)).join('  ')
  );

  // ---- Where the SHIPPED thresholds would land --------------------------
  const SHIPPED = { EXCELLENT: 260, GOOD: 110, ACCEPTABLE: 45, MIN_USABLE: 22 };
  console.log('\nSHIPPED THRESHOLDS vs THIS SAMPLE');
  for (const [name, t] of Object.entries(SHIPPED)) {
    const below = all.filter(v => v < t).length;
    console.log(`  ${name.padEnd(11)} ${String(t).padStart(4)}  → ${((below / all.length) * 100).toFixed(1)}% of real photos fall below`);
  }

  // The number that matters most: how many real submissions the hard blur
  // gate would have blocked. A rejection rate far above the poor-image rate
  // means the floor is too high.
  const wouldBlock = all.filter(v => v < SHIPPED.MIN_USABLE).length;
  const dRate = rows.filter(r => r.conf === 'D').length;
  const cdRate = rows.filter(r => r.conf === 'C' || r.conf === 'D').length;
  console.log(`\n  MIN_USABLE would reject ${wouldBlock}/${all.length} (${((wouldBlock / all.length) * 100).toFixed(1)}%)`);
  console.log(`  grader said D:   ${dRate}/${rows.length} (${((dRate / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  grader said C/D: ${cdRate}/${rows.length} (${((cdRate / rows.length) * 100).toFixed(1)}%)`);

  // ---- The extremes, for eyeballing -------------------------------------
  const bySharp = [...rows].sort((a, b) => a.variance - b.variance);
  console.log('\n10 BLURRIEST (candidates for hand review):');
  for (const r of bySharp.slice(0, 10)) {
    console.log(`  var ${String(r.variance).padStart(7)}  conf ${r.conf}  grade ${r.grade ?? '-'}  ${r.srcW}x${r.srcH}  ${r.id}`);
  }
  console.log('\n10 SHARPEST:');
  for (const r of bySharp.slice(-10).reverse()) {
    console.log(`  var ${String(r.variance).padStart(7)}  conf ${r.conf}  grade ${r.grade ?? '-'}  ${r.srcW}x${r.srcH}  ${r.id}`);
  }

  console.log(`\nWrote ${path.join(outDir, 'measurements.json')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
