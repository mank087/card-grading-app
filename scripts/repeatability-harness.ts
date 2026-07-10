/**
 * REPEATABILITY + ACCURACY HARNESS
 *
 * Grades each calibration card N times through the CURRENT engine and reports:
 *  - repeatability: grade spread + subgrade spread across runs (NO ground truth needed)
 *  - accuracy: % of runs within tolerance of `expected` (where we have a human anchor)
 *  - structural catch-rate on the crease anchor
 *
 * Resumable + incremental: every grade is appended to a JSONL immediately, and a
 * re-run skips (card,run) pairs already recorded — so a timeout/crash loses nothing.
 *
 *   npx tsx scripts/repeatability-harness.ts [N] [tag]     grade (default N=3, tag=branch)
 *   npx tsx scripts/repeatability-harness.ts --report [tag] summarize existing JSONL only
 *
 * Output JSONL: <scratch or scripts>/repeat-<tag>.jsonl
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { gradeCardConversational } from '../src/lib/visionGrader';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
// consolidatedGrader experiment lives only on grading-v9.2-joey-fixes; this branch runs the default engine
const grade = gradeCardConversational;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());

const OUTDIR = process.env.SCRATCH || __dirname;
const args = process.argv.slice(2);
const reportOnly = args.includes('--report');
const tag = (args.find(a => !a.startsWith('--') && !/^\d+$/.test(a))) || 'branch';
const N = Number(args.find(a => /^\d+$/.test(a)) || 3);
const OUT = path.join(OUTDIR, `repeat-${tag}.jsonl`);

interface CalCard { id: string; label: string; cardType: string; expected: number; tolerance: number; must_detect: string[]; note?: string }
interface Row { id: string; run: number; grade: number | null; subs: Record<string, number>; structural: boolean; detectHits: string[]; err?: string }

function readRows(): Row[] {
  if (!fs.existsSync(OUT)) return [];
  return fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as Row[];
}
function stats(xs: number[]) {
  const v = xs.filter(x => typeof x === 'number');
  if (!v.length) return { min: null, max: null, spread: null, mode: null };
  const min = Math.min(...v), max = Math.max(...v);
  const counts = new Map<number, number>(); v.forEach(x => counts.set(x, (counts.get(x) || 0) + 1));
  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { min, max, spread: max - min, mode };
}

function report(cards: CalCard[]) {
  const rows = readRows();
  console.log(`\n${'='.repeat(92)}\nREPEATABILITY + ACCURACY — tag="${tag}"  (${rows.length} grades on file)\n${'='.repeat(92)}`);
  let spreadSum = 0, spreadCount = 0, stable = 0, within = 0, withinDen = 0;
  for (const c of cards) {
    const rs = rows.filter(r => r.id === c.id && r.grade != null);
    if (!rs.length) { console.log(`\n${c.label}\n  (no runs yet)`); continue; }
    const grades = rs.map(r => r.grade!) as number[];
    const s = stats(grades);
    spreadSum += s.spread!; spreadCount++; if (s.spread === 0) stable++;
    const inTol = rs.filter(r => Math.abs(r.grade! - c.expected) <= c.tolerance).length;
    within += inTol; withinDen += rs.length;
    const structRate = rs.filter(r => r.structural).length;
    const detectRate = c.must_detect.length ? rs.filter(r => c.must_detect.every(t => r.detectHits.includes(t))).length : null;
    const subSpread = ['centering', 'corners', 'edges', 'surface'].map(k => `${k[0].toUpperCase()}${k[1]}:${stats(rs.map(r => r.subs[k])).spread}`).join(' ');
    console.log(`\n${c.label}`);
    console.log(`  grades: [${grades.join(', ')}]  spread=${s.spread}  mode=${s.mode}  expected=${c.expected}±${c.tolerance}`);
    console.log(`  within tolerance: ${inTol}/${rs.length}   subgrade spread: ${subSpread}   structural detected: ${structRate}/${rs.length}${c.must_detect.length ? `   must-detect(${c.must_detect.join(',')}): ${detectRate}/${rs.length}` : ''}`);
  }
  console.log(`\n${'-'.repeat(92)}`);
  console.log(`REPEATABILITY: mean grade spread = ${(spreadSum / Math.max(1, spreadCount)).toFixed(2)}  |  perfectly-stable cards (spread 0): ${stable}/${spreadCount}`);
  console.log(`ACCURACY:      runs within tolerance = ${within}/${withinDen} (${withinDen ? (100 * within / withinDen).toFixed(0) : 0}%)`);
  console.log(`${'='.repeat(92)}\n(lower spread = more repeatable; higher within-tolerance = more accurate)`);
}

(async () => {
  const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'calibration-set.json'), 'utf8'));
  const cards: CalCard[] = set.cards;
  if (reportOnly) { report(cards); return; }

  const done = new Set(readRows().map(r => `${r.id}|${r.run}`));
  console.log(`Harness: N=${N} per card × ${cards.length} cards → ${OUT}\n(${done.size} grades already on file, will skip those)`);
  for (const c of cards) {
    const { data: card } = await supabase.from('cards').select('front_path, back_path').eq('id', c.id).single();
    if (!card) { console.log(`✗ ${c.label} — CARD NOT FOUND`); continue; }
    for (let run = 1; run <= N; run++) {
      if (done.has(`${c.id}|${run}`)) { console.log(`  skip ${c.label} run ${run}`); continue; }
      const { data: f } = await supabase.storage.from('cards').createSignedUrl((card as any).front_path, 3600);
      const { data: b } = await supabase.storage.from('cards').createSignedUrl((card as any).back_path, 3600);
      let row: Row;
      try {
        const r: any = await grade(f!.signedUrl, b!.signedUrl, c.cardType as any);
        const j = JSON.parse(r.markdown_report);
        const ws = j.weighted_scores || {};
        const hay = [j.final_grade?.summary || '', JSON.stringify(j.structural_damage || {}), JSON.stringify(j.grading_passes?.consensus_notes || [])].join(' ').toLowerCase();
        row = {
          id: c.id, run, grade: r.extracted_grade?.decimal_grade ?? null,
          subs: { centering: ws.centering_weighted, corners: ws.corners_weighted, edges: ws.edges_weighted, surface: ws.surface_weighted },
          structural: j.structural_damage?.detected === true,
          detectHits: c.must_detect.filter(t => hay.includes(t.toLowerCase())),
        };
      } catch (e: any) {
        row = { id: c.id, run, grade: null, subs: {}, structural: false, detectHits: [], err: e.message };
      }
      fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
      console.log(`  ✓ ${c.label} run ${run}: grade=${row.grade} struct=${row.structural}${row.err ? ' ERR ' + row.err : ''}`);
    }
  }
  report(cards);
})().catch(e => { console.error('Fatal:', e); process.exit(1); });
