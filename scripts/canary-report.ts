/**
 * Canary A/B report: baseline vs canary model on real user-submitted cards.
 *
 * Because routing is a deterministic hash of the card id, both arms see the
 * same card population over the same window. That is the whole point -- a
 * before/after comparison across two different weeks would confound the model
 * change with whatever people happened to submit.
 *
 *   npx tsx scripts/canary-report.ts            # last 7 days
 *   npx tsx scripts/canary-report.ts --days 2   # since the canary started
 *
 * Watch for, in rough order of how alarming they are:
 *   1. LOW GRADES ON CLEAN CARDS  -- the Jordan failure. A clean card graded
 *      <=8 is the refund-generating outcome.
 *   2. SUB-GRADE DRIFT            -- luna measured -0.82 corners on the
 *      calibration set. Sustained drift shifts the whole pop report.
 *   3. GRADE DISTRIBUTION SHIFT   -- especially the 10-rate and the mean.
 *   4. LATENCY                    -- luna measured +40%.
 *   5. ERROR RATE                 -- a canary that 400s is worse than a slow one.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const DAYS = Number(arg('days') || 7);

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '-');

async function pageAll(table: string, select: string, apply: (q: any) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(sb.from(table).select(select)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

(async () => {
  const since = new Date(Date.now() - DAYS * 86400000).toISOString();

  let cards: any[];
  try {
    cards = await pageAll(
      'cards',
      'id, created_at, grading_model, conversational_whole_grade, conversational_condition_label, category, conversational_sub_scores',
      (q) => q.gte('created_at', since).not('grading_model', 'is', null)
    );
  } catch (e: any) {
    if (String(e.message).includes('grading_model')) {
      console.error('\ncards.grading_model does not exist yet.');
      console.error('Apply supabase/migrations/20260801_add_grading_model_tracking.sql first.\n');
      process.exit(1);
    }
    throw e;
  }

  if (!cards.length) {
    console.log(`\nNo cards with grading_model in the last ${DAYS}d.`);
    console.log('Either the migration just landed, or GRADING_CANARY_PERCENT is unset in production.\n');
    return;
  }

  const arms = new Map<string, any[]>();
  for (const c of cards) {
    const m = c.grading_model || 'unknown';
    if (!arms.has(m)) arms.set(m, []);
    arms.get(m)!.push(c);
  }

  console.log(`\n${'='.repeat(84)}`);
  console.log(`CANARY REPORT  --  last ${DAYS}d  --  ${cards.length} attributed grades`);
  console.log('='.repeat(84));

  // Weighted sub-grades live in conversational_sub_scores as
  // {centering:{front,back,weighted}, corners:{...}, ...}.
  const sub = (rows: any[], k: string) =>
    rows.map(r => Number(r.conversational_sub_scores?.[k]?.weighted)).filter(n => Number.isFinite(n) && n > 0);

  const summary: any[] = [];
  for (const [model, rows] of arms) {
    const grades = rows.map(r => Number(r.conversational_whole_grade)).filter(Number.isFinite);
    const tens = grades.filter(g => g === 10).length;
    const low = grades.filter(g => g <= 6).length;
    summary.push({
      model, n: rows.length,
      meanGrade: mean(grades), medianGrade: median(grades),
      tenRate: grades.length ? (tens / grades.length) * 100 : 0,
      lowRate: grades.length ? (low / grades.length) * 100 : 0,
      centering: mean(sub(rows, 'centering')),
      corners: mean(sub(rows, 'corners')),
      edges: mean(sub(rows, 'edges')),
      surface: mean(sub(rows, 'surface')),
    });
  }
  summary.sort((a, b) => b.n - a.n);

  console.log('\nMODEL'.padEnd(20) + 'N'.padStart(7) + 'MEAN'.padStart(8) + 'MED'.padStart(6) + '10-RATE'.padStart(9) + '<=6'.padStart(8) + '  C     Co    E     S');
  console.log('-'.repeat(84));
  for (const s of summary) {
    console.log(
      s.model.padEnd(20) + String(s.n).padStart(7) + f2(s.meanGrade).padStart(8) + f2(s.medianGrade).padStart(6) +
      (f2(s.tenRate) + '%').padStart(9) + (f2(s.lowRate) + '%').padStart(8) +
      '  ' + f2(s.centering) + '  ' + f2(s.corners) + '  ' + f2(s.edges) + '  ' + f2(s.surface)
    );
  }

  const base = summary.find(s => s.model === (process.env.GRADING_BASELINE_MODEL || 'gpt-5.1'));
  const can = summary.find(s => s.model !== (process.env.GRADING_BASELINE_MODEL || 'gpt-5.1'));

  if (base && can) {
    console.log(`\n--- ${can.model} minus ${base.model} ---`);
    console.log(`  mean grade   ${(can.meanGrade - base.meanGrade >= 0 ? '+' : '')}${f2(can.meanGrade - base.meanGrade)}`);
    console.log(`  10-rate      ${(can.tenRate - base.tenRate >= 0 ? '+' : '')}${f2(can.tenRate - base.tenRate)} pts`);
    console.log(`  <=6 rate     ${(can.lowRate - base.lowRate >= 0 ? '+' : '')}${f2(can.lowRate - base.lowRate)} pts`);
    for (const k of ['centering', 'corners', 'edges', 'surface'] as const) {
      const d = can[k] - base[k];
      console.log(`  ${k.padEnd(12)} ${(d >= 0 ? '+' : '')}${f2(d)}${Math.abs(d) >= 0.5 ? '   <-- DRIFT' : ''}`);
    }

    const share = (can.n / (can.n + base.n)) * 100;
    console.log(`\n  canary share of traffic: ${f2(share)}%  (expected ~${process.env.GRADING_CANARY_PERCENT || '?'}%)`);

    console.log('\n--- GO / NO-GO ---');
    const checks = [
      { name: 'mean grade within 0.3 of baseline', ok: Math.abs(can.meanGrade - base.meanGrade) <= 0.3 },
      { name: 'no sub-grade drift >= 0.5', ok: (['centering', 'corners', 'edges', 'surface'] as const).every(k => Math.abs(can[k] - base[k]) < 0.5) },
      { name: '10-rate within 5 pts', ok: Math.abs(can.tenRate - base.tenRate) <= 5 },
      { name: 'low-grade rate within 5 pts', ok: Math.abs(can.lowRate - base.lowRate) <= 5 },
      { name: 'sample >= 100 canary cards', ok: can.n >= 100 },
    ];
    for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
    const failed = checks.filter(c => !c.ok);
    console.log(failed.length
      ? `\n  => ${failed.length} check(s) failed. Do NOT widen the canary. To roll back set GRADING_CANARY_KILL=1.`
      : '\n  => all checks pass. Safe to widen the canary.');
  } else {
    console.log('\nOnly one arm has data so far -- no comparison possible yet.');
  }

  // ---- latency, cost and errors from the usage log ----
  const usage = await pageAll('api_usage_log', 'endpoint, operation, input_tokens, output_tokens, cost_usd, duration_ms, status, request_metadata', (q) => q.gte('created_at', since));
  const byModel = new Map<string, { n: number; ms: number; err: number; inT: number; outT: number; cached: number }>();
  for (const r of usage) {
    const m = r.endpoint || 'unknown';
    const g = byModel.get(m) ?? { n: 0, ms: 0, err: 0, inT: 0, outT: 0, cached: 0 };
    g.n++; g.ms += Number(r.duration_ms) || 0;
    if (r.status !== 'success') g.err++;
    g.inT += Number(r.input_tokens) || 0;
    g.outT += Number(r.output_tokens) || 0;
    g.cached += Number(r.request_metadata?.cached_input_tokens) || 0;
    byModel.set(m, g);
  }
  const RATES: Record<string, { in: number; cached: number; out: number }> = {
    'gpt-5.1': { in: 1.25, cached: 0.125, out: 10.0 },
    'gpt-5.6-luna': { in: 0.20, cached: 0.02, out: 1.20 },
    'gpt-5.6-terra': { in: 2.00, cached: 0.20, out: 12.0 },
  };
  console.log(`\n--- API calls by model (last ${DAYS}d) ---`);
  for (const [m, g] of byModel) {
    const p = RATES[m];
    const cost = p ? ((g.inT - g.cached) / 1e6) * p.in + (g.cached / 1e6) * p.cached + (g.outT / 1e6) * p.out : NaN;
    console.log(` ${m.padEnd(16)} calls=${String(g.n).padStart(6)} avg=${(g.ms / g.n / 1000).toFixed(1)}s errors=${g.err} out=${g.outT.toLocaleString()} cached=${g.inT ? Math.round(g.cached / g.inT * 100) : 0}%${p ? ` cost=$${cost.toFixed(2)}` : ''}`);
  }
  console.log('');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
