/**
 * Repair conversational_limiting_factor where it names a category that is not the
 * weakest displayed subgrade (Oct 2026 bug: holds dragged tiles after the limiting
 * factor was picked, so held cards often showed e.g. "corners" with corners at 10).
 * Reads only light columns. Dry run unless APPLY=1. Writes are guarded on the old value.
 */
import { createClient } from '@supabase/supabase-js';
import { weakestCategory, type SubgradeCategory } from '../src/lib/grading/weakestCategory';

const APPLY = process.env.APPLY === '1';
const SINCE = process.env.SINCE || '2026-01-01';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  let lastId: string | null = null, scanned = 0, wrong = 0, written = 0;
  const byPair: Record<string, number> = {};
  const sample: string[] = [];
  for (;;) {
    let q = db.from('cards').select('id,serial,conversational_limiting_factor,conversational_weighted_sub_scores')
      .gte('created_at', SINCE).not('conversational_limiting_factor', 'is', null).order('id').limit(500);
    if (lastId) q = q.gt('id', lastId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows as any[]) {
      scanned++;
      const w = r.conversational_weighted_sub_scores as Partial<Record<SubgradeCategory, number>> | null;
      if (!w) continue;
      const cur = String(r.conversational_limiting_factor).toLowerCase() as SubgradeCategory;
      const weakest = weakestCategory(w);
      if (!weakest || typeof w[cur] !== 'number' || w[cur]! <= w[weakest]!) continue; // already a weakest tile
      wrong++;
      byPair[`${cur}->${weakest}`] = (byPair[`${cur}->${weakest}`] ?? 0) + 1;
      if (sample.length < 10) sample.push(`${r.serial} ${cur}(${w[cur]}) -> ${weakest}(${w[weakest]})`);
      if (APPLY) {
        const { data: up, error: e } = await db.from('cards').update({ conversational_limiting_factor: weakest })
          .eq('id', r.id).eq('conversational_limiting_factor', r.conversational_limiting_factor).select('id');
        if (!e && up?.length) written++;
      }
    }
    if (rows.length < 500) break;
    lastId = (rows[rows.length - 1] as any).id;
  }
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} since ${SINCE}: scanned ${scanned}, wrong limiting factor ${wrong}${APPLY ? `, fixed ${written}` : ''}`);
  console.log(byPair);
  console.log(sample.join('\n'));
})().catch((e) => { console.error('FAILED', e?.message ?? e); process.exit(1); });
