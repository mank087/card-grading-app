/**
 * Calibrate the R3 pass-agreement threshold from production data.
 * Reads the heavy conversational_grading blob in SMALL batches and stops on
 * any error — see the Aug 8 full-scan outage.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BATCH = 20, MAX = 140;

const devOf = (p: any): number | null => {
  if (typeof p?.centering_dev === 'number') return p.centering_dev;
  const r = p?.centering_ratios?.front ?? p?.centering_ratios?.front_left_right;
  const m = String(r ?? '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? Math.abs(Number(m[1]) - 50) : null;
};

(async () => {
  const spreads: number[] = [];
  const tenSpreads: number[] = [];
  let seen = 0;
  for (let from = 0; from < MAX; from += BATCH) {
    const { data, error } = await sb.from('cards')
      .select('conversational_grading, conversational_sub_scores')
      .not('conversational_grading','is',null)
      .order('created_at',{ascending:false}).range(from, from + BATCH - 1);
    if (error) { console.error('STOPPING on error:', error.message); break; }
    const batch = (data as any[]) || [];
    for (const c of batch) {
      let g: any = c.conversational_grading;
      if (typeof g === 'string') { try { g = JSON.parse(g); } catch { continue; } }
      const gp = g?.grading_passes; if (!gp) continue;
      const devs = ['pass_1','pass_2','pass_3'].map(k => devOf(gp[k])).filter((n): n is number => typeof n === 'number');
      if (devs.length < 2) continue;
      seen++;
      const spread = Math.max(...devs) - Math.min(...devs);
      spreads.push(spread);
      if ((c.conversational_sub_scores||{}).centering?.front === 10) tenSpreads.push(spread);
    }
    if (batch.length < BATCH) break;
  }
  const pct = (a: number[], q: number) => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(q/100*s.length)] ?? NaN; };
  console.log(`cards with >=2 per-pass devs: ${seen}`);
  console.log(`ALL spread  p50=${pct(spreads,50)} p75=${pct(spreads,75)} p90=${pct(spreads,90)} p95=${pct(spreads,95)} max=${Math.max(...spreads)}`);
  console.log(`CEN-10      n=${tenSpreads.length}  p50=${pct(tenSpreads,50)} p75=${pct(tenSpreads,75)} p90=${pct(tenSpreads,90)} max=${Math.max(...tenSpreads,0)}`);
  for (const T of [2,3,4,5,6,8]) {
    const fires = tenSpreads.filter(s => s >= T).length;
    console.log(`  threshold >=${T}: would block ${fires}/${tenSpreads.length} centering-10s (${Math.round(fires/Math.max(1,tenSpreads.length)*100)}%)`);
  }
})();
