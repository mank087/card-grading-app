/**
 * Read-only. Light columns only, batched — no heavy grading JSON.
 * Question 1: is centering the limiting subgrade, and did v9.21 change that?
 * Question 2: how many cards now carry an unmeasurable "XX/XX" ratio?
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// v9.21 merged 2026-08-28 11:23 ET = 15:23 UTC. Give the deploy a margin.
const CUT = '2026-08-28T16:00:00Z';
const SINCE = '2026-08-18T00:00:00Z';

type Row = any;
(async () => {
  const rows: Row[] = [];
  for (let f = 0; f < 4000; f += 100) {
    const { data, error } = await sb.from('cards')
      .select('id, created_at, card_name, conversational_whole_grade, conversational_sub_scores, conversational_centering_ratios, conversational_image_confidence, grading_model')
      .gte('created_at', SINCE)
      .not('conversational_sub_scores', 'is', null)
      .order('created_at', { ascending: true })
      .range(f, f + 99);
    if (error) { console.error('stopping:', error.message); break; }
    const b = (data as Row[]) || [];
    rows.push(...b);
    if (b.length < 100) break;
  }
  console.log(`rows: ${rows.length}\n`);

  const bucket = (r: Row) => (r.created_at >= CUT ? 'POST v9.21' : 'PRE  v9.21');
  const groups: Record<string, Row[]> = { 'PRE  v9.21': [], 'POST v9.21': [] };
  for (const r of rows) groups[bucket(r)].push(r);

  const isXX = (s: any) => typeof s === 'string' && /x/i.test(s);

  for (const [name, list] of Object.entries(groups)) {
    if (!list.length) continue;
    let cLimiting = 0, cSoleLimiting = 0, cTen = 0, cNine = 0, cBelow9 = 0, xx = 0, na = 0;
    const cScores: number[] = [];
    for (const r of list) {
      const s = r.conversational_sub_scores || {};
      const cen = s.centering?.weighted, cor = s.corners?.weighted, ed = s.edges?.weighted, su = s.surface?.weighted;
      const all = [cen, cor, ed, su].filter((n) => typeof n === 'number') as number[];
      if (typeof cen !== 'number' || all.length < 4) continue;
      cScores.push(cen);
      const min = Math.min(...all);
      if (cen === min) cLimiting++;
      if (cen === min && [cor, ed, su].every((n) => (n as number) > cen)) cSoleLimiting++;
      if (cen === 10) cTen++; else if (cen === 9) cNine++; else cBelow9++;
      const cr = r.conversational_centering_ratios || {};
      const vals = [cr.front_lr, cr.front_tb, cr.back_lr, cr.back_tb];
      if (vals.some(isXX)) xx++;
      else if (vals.every((v) => !v || v === 'N/A')) na++;
    }
    const n = cScores.length;
    const avg = (cScores.reduce((a, b) => a + b, 0) / n).toFixed(2);
    const pct = (k: number) => `${((k / n) * 100).toFixed(1)}%`;
    console.log(`${name}   n=${n}   mean centering ${avg}`);
    console.log(`  centering is the weakest link (ties incl.) : ${cLimiting} (${pct(cLimiting)})`);
    console.log(`  centering is the SOLE weakest link         : ${cSoleLimiting} (${pct(cSoleLimiting)})`);
    console.log(`  centering 10 / 9 / <=8                     : ${pct(cTen)} / ${pct(cNine)} / ${pct(cBelow9)}`);
    console.log(`  unmeasurable "XX/XX" on any axis           : ${xx} (${pct(xx)})`);
    console.log(`  no ratio stored at all (N/A)               : ${na} (${pct(na)})\n`);
  }

  // Cards displaying the contradiction right now: XX/XX ratio but a decent score.
  const bad = rows.filter((r) => {
    const cr = r.conversational_centering_ratios || {};
    return [cr.front_lr, cr.front_tb, cr.back_lr, cr.back_tb].some(isXX);
  });
  console.log(`=== cards whose UI will read "Off-Center" from an XX/XX ratio: ${bad.length} ===`);
  for (const r of bad.slice(-25)) {
    const c = r.conversational_sub_scores?.centering;
    console.log(`  ${r.created_at.slice(0, 16)}  cen ${c?.front}/${c?.back}  grade ${r.conversational_whole_grade}  ${String(r.card_name).slice(0, 28)}  ${r.id.slice(0, 8)}`);
  }
})();
