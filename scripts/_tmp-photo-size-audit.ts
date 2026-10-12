/**
 * Read-only (Oct 12 2026): how many completed grades in the last 30 days have
 * small originals, by capture source and by user. Dimensions come from the
 * pre-charge photo check's api_usage_log rows (sharp metadata of the stored
 * original); cards without a row (bulk submissions, regrades, pre-check-off)
 * are sampled with a 128 KB ranged GET of the front image header.
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { writeFileSync } from 'fs';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SINCE = new Date(Date.now() - 30 * 864e5).toISOString();
const SMALL = Number(process.env.SMALL_SHORT_SIDE || 1000);
const SAMPLE = Number(process.env.SAMPLE || 200);

async function pageAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await q(from, from + 499);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return out;
}

function parseDims(s: string | null): [number, number] | null {
  const m = s ? /^(\d+)x(\d+)$/.exec(s) : null;
  return m ? [Number(m[1]), Number(m[2])] : null;
}

async function headerDims(path: string): Promise<[number, number] | null> {
  const { data } = await db.storage.from('cards').createSignedUrl(path, 120);
  if (!data?.signedUrl) return null;
  for (const bytes of [131071, 1048575]) {
    try {
      const r = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${bytes}` } });
      const buf = Buffer.from(await r.arrayBuffer());
      const m = await sharp(buf, { failOn: 'none' }).metadata();
      if (m.width && m.height) return (m.orientation ?? 1) >= 5 ? [m.height, m.width] : [m.width, m.height];
    } catch { /* try a larger range */ }
  }
  return null;
}

function source(cs: any): string {
  if (!cs) return 'unrecorded';
  const surf = cs.client_surface || '?';
  const f = cs.front || {};
  return `${surf}/${f.source || '?'}${f.capture_method ? ':' + f.capture_method : ''}`;
}

(async () => {
  const cards = await pageAll<any>((a, b) => db.from('cards')
    .select('id, user_id, created_at, front_path, capture_source, submission_id')
    .gte('created_at', SINCE).not('conversational_whole_grade', 'is', null)
    .order('created_at', { ascending: false }).range(a, b));
  console.log(`completed grades since ${SINCE.slice(0, 10)}: ${cards.length}`);

  const pc = await pageAll<any>((a, b) => db.from('api_usage_log')
    .select('card_id, created_at, request_metadata->dims')
    .eq('operation', 'precharge_photo_check').gte('created_at', SINCE)
    .order('created_at', { ascending: false }).range(a, b));
  const dimsByCard = new Map<string, [number, number] | null>();
  for (const r of pc) {
    if (!r.card_id || dimsByCard.has(r.card_id)) continue;
    const d = Array.isArray(r.dims) ? parseDims(r.dims[0]) : null;
    if (d) dimsByCard.set(r.card_id, d);
  }
  const measured = cards.filter(c => dimsByCard.has(c.id));
  const unmeasured = cards.filter(c => !dimsByCard.has(c.id) && c.front_path);
  console.log(`with pre-charge dims: ${measured.length}; without: ${unmeasured.length}`);

  // Sample the unmeasured cards evenly.
  const step = Math.max(1, Math.floor(unmeasured.length / SAMPLE));
  const sample = unmeasured.filter((_, i) => i % step === 0).slice(0, SAMPLE);
  let done = 0;
  for (const c of sample) {
    const d = await headerDims(c.front_path);
    if (d) dimsByCard.set(c.id, d);
    if (++done % 50 === 0) console.log(`  sampled ${done}/${sample.length}`);
  }

  const rows = cards.filter(c => dimsByCard.has(c.id)).map(c => {
    const [w, h] = dimsByCard.get(c.id)!;
    return { id: c.id, user_id: c.user_id, created_at: c.created_at, w, h, short: Math.min(w, h), long: Math.max(w, h),
      src: c.submission_id ? 'bulk_submission' : source(c.capture_source), viaPrecharge: measured.includes(c) };
  });
  const small = rows.filter(r => r.short < SMALL);
  const pct = (a: number, b: number) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
  console.log(`\nfront short side < ${SMALL}px: ${small.length}/${rows.length} = ${pct(small.length, rows.length)}`);
  const pcRows = rows.filter(r => r.viaPrecharge), sRows = rows.filter(r => !r.viaPrecharge);
  console.log(`  pre-charge-measured: ${pcRows.filter(r => r.short < SMALL).length}/${pcRows.length} = ${pct(pcRows.filter(r => r.short < SMALL).length, pcRows.length)}`);
  console.log(`  header-sampled:      ${sRows.filter(r => r.short < SMALL).length}/${sRows.length} = ${pct(sRows.filter(r => r.short < SMALL).length, sRows.length)}`);
  for (const t of [800, 900, 1000, 1200, 1500]) console.log(`  short < ${t}: ${pct(rows.filter(r => r.short < t).length, rows.length)}`);

  const by = (key: (r: any) => string, list: any[]) => {
    const m = new Map<string, { n: number; small: number; dims: Map<string, number> }>();
    for (const r of list) {
      const k = key(r);
      const e = m.get(k) || { n: 0, small: 0, dims: new Map() };
      e.n++; if (r.short < SMALL) { e.small++; const dk = `${r.w}x${r.h}`; e.dims.set(dk, (e.dims.get(dk) || 0) + 1); }
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => b[1].small - a[1].small || b[1].n - a[1].n);
  };
  console.log('\nBy source (n, small, % small, top small dims):');
  for (const [k, e] of by(r => r.src, rows)) console.log(`  ${k.padEnd(48)} ${String(e.n).padStart(5)} ${String(e.small).padStart(4)} ${pct(e.small, e.n).padStart(6)}  ${[...e.dims.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d, n]) => `${d}×${n}`).join(' ')}`);
  console.log('\nBy user (users with small photos):');
  const users = by(r => r.user_id, rows).filter(([, e]) => e.small > 0);
  console.log(`  ${users.length} users; top:`);
  for (const [k, e] of users.slice(0, 15)) console.log(`  ${k} ${e.small}/${e.n}  ${[...e.dims.entries()].map(([d, n]) => `${d}×${n}`).join(' ')}`);
  writeFileSync(process.env.OUT || 'photo-size-audit.json', JSON.stringify(rows));
})().catch(e => { console.error(e); process.exit(1); });
