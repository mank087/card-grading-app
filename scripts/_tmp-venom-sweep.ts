/** Walk the ENTIRE card row and report every path whose value looks like a
 *  stale grade or centering score. Read-only. */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ID = 'ee5e4ecb-e5f6-4786-a00b-cf1be5e13d5a';

const hits: string[] = [];
function walk(node: any, path: string) {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    // Prose that still names a 9, or a stringified 9.
    if (/\b9\b/.test(node) && /grade|centering|mint|final|score/i.test(node)) {
      hits.push(`${path} = ${JSON.stringify(node.slice(0, 180))}`);
    } else if (node === '9') hits.push(`${path} = "9"`);
    return;
  }
  if (typeof node === 'number') {
    if (node === 9 && /grade|centering|score|weighted|preliminary|weakest|decimal/i.test(path)) {
      hits.push(`${path} = 9`);
    }
    return;
  }
  if (typeof node !== 'object') return;
  for (const k of Object.keys(node)) walk(node[k], `${path}.${k}`);
}

(async () => {
  const { data, error } = await sb.from('cards').select('*').eq('id', ID).maybeSingle();
  if (error) { console.error(error.message); process.exit(1); }
  const row: any = data;
  for (const k of Object.keys(row)) {
    let v = row[k];
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try { v = JSON.parse(v); } catch {}
    }
    walk(v, k);
  }
  console.log(`stale-looking values: ${hits.length}`);
  hits.forEach(h => console.log('  ' + h));

  console.log('\n--- non-null columns that could carry a grade ---');
  for (const k of Object.keys(row).sort()) {
    if (row[k] === null || row[k] === undefined) continue;
    if (!/grading|grade|score|label|report|centering|slab|image|url/i.test(k)) continue;
    const v = typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k]);
    console.log(`  ${k}  (${v.length} chars)`);
  }
})();
