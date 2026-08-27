/**
 * Download specific cards' front images for hand review during blur calibration.
 * Resizes to 512px long edge — the same working copy the metric is computed on,
 * so what I look at is what the number describes.
 *
 *   npx tsx scripts/_tmp-blur-fetch-samples.ts <cardId> [<cardId> ...]
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUT = process.env.SAMPLE_OUT_DIR
  || path.join(process.cwd(), 'scripts', '_snapshots', 'blur-calibration', 'samples');

async function main() {
  const ids = process.argv.slice(2).filter(a => /^[0-9a-f-]{36}$/i.test(a));
  if (!ids.length) { console.error('Pass one or more card ids.'); process.exit(1); }

  fs.mkdirSync(OUT, { recursive: true });

  const { data, error } = await supabase
    .from('cards')
    .select('id, front_path, conversational_image_confidence')
    .in('id', ids);
  if (error) { console.error(error.message); process.exit(1); }

  for (const c of data || []) {
    const { data: blob, error: dlErr } = await supabase.storage.from('cards').download((c as any).front_path);
    if (dlErr || !blob) { console.log(`  ${c.id}: download failed`); continue; }
    const buf = Buffer.from(await blob.arrayBuffer());
    const outPath = path.join(OUT, `${(c as any).conversational_image_confidence || 'x'}_${c.id.slice(0, 8)}.jpg`);
    await sharp(buf, { failOn: 'none' })
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toFile(outPath);
    console.log(`  wrote ${outPath}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
