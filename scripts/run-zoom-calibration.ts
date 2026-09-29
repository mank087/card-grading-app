/**
 * FROZEN ZOOM-REGRESSION RUNNER (Sept 29 2026)
 *
 * Grades every case in scripts/zoom-calibration-set.json N times through the
 * CURRENT engine and reports, against the hand-verified verdicts:
 *   - whole-grade hit rate, off-by-one rate, mean absolute error
 *   - whether the case's recorded false positive recurs
 *   - whether a real defect (must_detect negative control) is still found
 *   - whether the limiting category matches, and whether a held grade names its reason
 *   - measured OpenAI spend per run and in total
 *
 * A script, not a unit test: each grade is a paid, nondeterministic model call.
 *
 *   npx tsx scripts/run-zoom-calibration.ts --n 2 --tag baseline
 *   ZOOM_CORROBORATION_V1=on npx tsx scripts/run-zoom-calibration.ts --n 2 --tag corroboration
 *   npx tsx scripts/run-zoom-calibration.ts --report baseline [--compare corroboration]
 *   options: --only <key>  --concurrency <c> (default 2)
 *
 * Resumable: rows append to <SCRATCH or scripts>/zoom-cal-<tag>.jsonl and a re-run
 * skips (case, run) pairs already recorded.
 *
 * NO PRODUCTION WRITES. The photos are signed with the service key up front, and the
 * key is then removed from this process before any grading call. Every grading-path
 * write (api_usage_log, zoom evidence uploads, capture/CV-centering/model rows, first
 * look) checks for that key at call time and is skipped without it. The routing key is
 * also a non-UUID ("zoomcal:<card>"), which skips the card-row writes on its own.
 * Spend is measured here instead, from the usage block of each OpenAI response.
 */
import { createClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'async_hooks';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

type Sev = 'minor' | 'moderate' | 'heavy';
const SEV_RANK: Record<string, number> = { none: -1, minor: 0, slight: 0, light: 0, moderate: 1, heavy: 2, severe: 2, major: 2 };
const CATS = ['centering', 'corners', 'edges', 'surface'] as const;

interface DefectSpec {
  note?: string;
  face: 'front' | 'back' | 'any';
  categories: string[];
  types: string[] | null;
  min_severity: Sev;
  regions?: string[];
  description_contains?: string[];
  any_source?: boolean;
}
interface CalCase {
  key: string;
  label: string;
  cardType: string;
  card_id: string;
  front_path: string;
  back_path: string;
  engine_grade: number;
  expected_grade: number;
  expected_subgrades: Record<string, [number | null, number | null]> | null;
  expected_limiting: string[] | null;
  false_positive: DefectSpec | null;
  must_detect?: DefectSpec;
  hold_must_name_reason?: boolean;
}
interface FoundDefect { source: string; category: string; face: string; type: string; severity: string; location: string; description: string }
interface Row {
  key: string; run: number; flag: string; grade: number | null;
  subs: Record<string, number>; faces: Record<string, number>;
  hold: { cause?: string; reason?: string } | null;
  summary: string; defects: FoundDefect[]; corroboration?: unknown;
  heldNarrationBad: boolean; costUsd: number; tokens: { p: number; c: number; calls: number };
  secs: number; err?: string;
}

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (name: string) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : undefined; };
const reportTag = argVal('--report');
const compareTag = argVal('--compare');
const tag = argVal('--tag') || reportTag || 'branch';
const N = Number(argVal('--n') || 2);
const only = argVal('--only');
const concurrency = Math.max(1, Number(argVal('--concurrency') || 2));
const OUTDIR = process.env.SCRATCH || __dirname;
const outFile = (t: string) => path.join(OUTDIR, `zoom-cal-${t}.jsonl`);

const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'zoom-calibration-set.json'), 'utf8'));
const cases: CalCase[] = set.cards.filter((c: CalCase) => !only || c.key === only);

function readRows(t: string): Row[] {
  const f = outFile(t);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as Row[];
}

// ── defect matching (shared by the FP and must-detect checks) ────────────────
export function matchesSpec(d: FoundDefect, spec: DefectSpec): boolean {
  if (!spec.any_source && d.source !== 'zoom-inspection') return false;
  if (spec.face !== 'any' && d.face !== spec.face) return false;
  if (!spec.categories.includes(d.category)) return false;
  const type = d.type.toLowerCase();
  if (spec.types && !spec.types.some(t => type.includes(t))) return false;
  if ((SEV_RANK[d.severity.toLowerCase()] ?? 0) < SEV_RANK[spec.min_severity]) return false;
  const text = `${d.location} ${d.description}`.toLowerCase();
  if (spec.regions && !spec.regions.some(r => text.includes(r))) return false;
  if (spec.description_contains && !spec.description_contains.some(r => d.description.toLowerCase().includes(r))) return false;
  return true;
}

function collectDefects(j: any): FoundDefect[] {
  const out: FoundDefect[] = [];
  const walk = (node: any, cat: string, face: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 3) return;
    if (Array.isArray(node.defects)) {
      for (const d of node.defects) {
        if (!d || typeof d !== 'object' || d.unconfirmed === true) continue;
        const sev = String(d.severity || '').toLowerCase();
        if (sev === 'none') continue;
        out.push({ source: d.source === 'zoom-inspection' ? 'zoom-inspection' : 'evaluation', category: cat, face,
          type: String(d.type || ''), severity: sev || 'minor', location: String(d.location || ''), description: String(d.description || '') });
      }
    }
    for (const [k, v] of Object.entries(node)) if (k !== 'defects' && v && typeof v === 'object' && !Array.isArray(v)) walk(v, cat, face, depth + 1);
  };
  for (const cat of ['corners', 'edges', 'surface']) for (const face of ['front', 'back']) walk(j?.[cat]?.[face], cat, face, 0);
  return out;
}

// ── report ───────────────────────────────────────────────────────────────────
function summarize(t: string) {
  const rows = readRows(t).filter(r => r.grade != null && cases.some(c => c.key === r.key));
  let hit = 0, off1 = 0, absErr = 0, n = 0, fpRuns = 0, fpDen = 0, mdRuns = 0, mdDen = 0, limHit = 0, limDen = 0, holdBad = 0, cost = 0;
  const perCase: Record<string, { grades: number[]; fp: number; fpDen: number; md: number; mdDen: number; lim: number; limDen: number }> = {};
  for (const r of readRows(t)) cost += r.costUsd || 0;
  for (const c of cases) {
    const rs = rows.filter(r => r.key === c.key);
    const pc = perCase[c.key] = { grades: rs.map(r => r.grade!), fp: 0, fpDen: 0, md: 0, mdDen: 0, lim: 0, limDen: 0 };
    for (const r of rs) {
      n++;
      const e = Math.abs(r.grade! - c.expected_grade);
      absErr += e; if (e === 0) hit++; if (e === 1) off1++;
      if (c.false_positive) {
        const spec = c.false_positive as DefectSpec;
        const recurs = r.defects.some(d => matchesSpec(d, spec));
        pc.fpDen++; fpDen++; if (recurs) { pc.fp++; fpRuns++; }
      }
      if (c.must_detect) {
        const found = r.defects.some(d => matchesSpec(d, { ...c.must_detect!, any_source: true }));
        pc.mdDen++; mdDen++; if (found) { pc.md++; mdRuns++; }
      }
      if (c.expected_limiting) {
        const min = Math.min(...CATS.map(k => r.subs[k] ?? 10));
        const limiting = CATS.filter(k => (r.subs[k] ?? 10) === min);
        pc.limDen++; limDen++;
        if (limiting.some(k => c.expected_limiting!.includes(k))) { pc.lim++; limHit++; }
      }
      if (r.heldNarrationBad) holdBad++;
    }
  }
  return { rows, n, hit, off1, absErr, fpRuns, fpDen, mdRuns, mdDen, limHit, limDen, holdBad, cost, perCase };
}

function report(t: string, other?: string) {
  const a = summarize(t);
  const b = other ? summarize(other) : null;
  const pct = (x: number, d: number) => d ? `${x}/${d} (${Math.round(100 * x / d)}%)` : '-';
  console.log(`\n${'='.repeat(100)}\nZOOM REGRESSION SET - tag="${t}"${other ? ` vs "${other}"` : ''}  (${a.n} grades)\n${'='.repeat(100)}`);
  console.log(`${'case'.padEnd(26)} exp  ${t.padEnd(18)} FP   must  lim${b ? `   | ${other!.padEnd(18)} FP   must  lim` : ''}`);
  for (const c of cases) {
    const pa = a.perCase[c.key], pb = b?.perCase[c.key];
    const cell = (p: any) => p ? `${`[${p.grades.join(',')}]`.padEnd(18)} ${p.fpDen ? `${p.fp}/${p.fpDen}` : '- '}  ${p.mdDen ? `${p.md}/${p.mdDen}` : '- '}   ${p.limDen ? `${p.lim}/${p.limDen}` : '- '}` : '';
    console.log(`${c.key.padEnd(26)} ${String(c.expected_grade).padEnd(4)} ${cell(pa)}${pb ? `   | ${cell(pb)}` : ''}`);
  }
  const line = (s: ReturnType<typeof summarize>, name: string) =>
    `${name.padEnd(16)} exact ${pct(s.hit, s.n)}  off-by-one ${pct(s.off1, s.n)}  MAE ${s.n ? (s.absErr / s.n).toFixed(2) : '-'}  FP recurs ${pct(s.fpRuns, s.fpDen)}  must-detect ${pct(s.mdRuns, s.mdDen)}  limiting ${pct(s.limHit, s.limDen)}  bad hold text ${s.holdBad}  spend $${s.cost.toFixed(2)}`;
  console.log('-'.repeat(100));
  console.log(line(a, t));
  if (b) console.log(line(b, other!));
  console.log('(engine grade at dispute time: ' + cases.map(c => `${c.key}=${c.engine_grade}`).join(' ') + ')');
}

// ── grading ──────────────────────────────────────────────────────────────────
const usageStore = new AsyncLocalStorage<{ p: number; c: number; calls: number; cost: number }>();
// USD per 1M tokens. Mirrors src/lib/apiUsageLogger.ts MODEL_RATES (not exported there).
const RATES: Array<[RegExp, { in: number; cached: number; out: number }]> = [
  [/^gpt-5\.6-luna/, { in: 0.20, cached: 0.02, out: 1.20 }],
  [/^gpt-5\.6-terra/, { in: 2.00, cached: 0.20, out: 12.0 }],
  [/^gpt-5\.1/, { in: 1.25, cached: 0.125, out: 10.0 }],
];
function installUsageMeter() {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const res = await orig(input, init);
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    const store = usageStore.getStore();
    if (store && url.includes('api.openai.com')) {
      try {
        const body = await res.clone().json();
        const u = body?.usage;
        if (u) {
          const p = u.prompt_tokens ?? u.input_tokens ?? 0, c = u.completion_tokens ?? u.output_tokens ?? 0;
          const cached = u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0;
          const rate = RATES.find(([rx]) => rx.test(String(body.model || '')))?.[1] ?? RATES[0][1];
          store.p += p; store.c += c; store.calls++;
          store.cost += ((p - cached) * rate.in + cached * rate.cached + c * rate.out) / 1e6;
        }
      } catch { /* non-JSON (stream/error) responses are not metered */ }
    }
    return res;
  }) as typeof fetch;
}

(async () => {
  if (reportTag) { report(reportTag, compareTag); return; }
  const flag = process.env.ZOOM_CORROBORATION_V1 || 'off';
  const done = new Set(readRows(tag).map(r => `${r.key}|${r.run}`));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
  const signed = new Map<string, { f: string; b: string }>();
  for (const c of cases) {
    const { data: f, error: fe } = await db.storage.from('cards').createSignedUrl(c.front_path, 6 * 3600);
    const { data: b, error: be } = await db.storage.from('cards').createSignedUrl(c.back_path, 6 * 3600);
    if (fe || be || !f || !b) { console.log(`✗ ${c.key}: could not sign photos (${fe?.message || be?.message})`); continue; }
    signed.set(c.key, { f: f.signedUrl, b: b.signedUrl });
  }
  // From here on this process cannot write to production (see header).
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  installUsageMeter();
  const { gradeCardConversational } = await import('../src/lib/visionGrader');
  const { resolveGradingModel, describeDecision } = await import('../src/lib/grading/modelRouter');
  console.log(`zoom regression: N=${N} x ${cases.length} cases, tag=${tag}, ZOOM_CORROBORATION_V1=${flag}, concurrency=${concurrency}`);
  console.log(`model: ${describeDecision(resolveGradingModel(`zoomcal:${cases[0]?.card_id}`))}  -> ${outFile(tag)}  (${done.size} already on file)`);

  const jobs: Array<{ c: CalCase; run: number }> = [];
  for (let run = 1; run <= N; run++) for (const c of cases) if (!done.has(`${c.key}|${run}`) && signed.has(c.key)) jobs.push({ c, run });
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { c, run } = jobs[next++];
      const urls = signed.get(c.key)!;
      const meter = { p: 0, c: 0, calls: 0, cost: 0 };
      const t0 = Date.now();
      let row: Row;
      try {
        const r: any = await usageStore.run(meter, () =>
          gradeCardConversational(urls.f, urls.b, c.cardType as any, { routingKey: `zoomcal:${c.card_id}` }));
        const j = JSON.parse(r.markdown_report);
        const ws = j.weighted_scores || {};
        const text = JSON.stringify([j.corners, j.edges, j.surface, j.final_grade?.summary]);
        row = {
          key: c.key, run, flag, grade: r.extracted_grade?.decimal_grade ?? null,
          subs: { centering: ws.centering_weighted, corners: ws.corners_weighted, edges: ws.edges_weighted, surface: ws.surface_weighted },
          faces: j.raw_sub_scores || {},
          hold: j.grade_hold ? { cause: j.grade_hold.cause, reason: j.grade_hold.reason } : null,
          summary: String(j.final_grade?.summary || ''),
          defects: collectDefects(j),
          corroboration: j.inspection_status?.zoom_corroboration,
          heldNarrationBad: /Magnified inspection adjusted this face/.test(text),
          costUsd: meter.cost, tokens: { p: meter.p, c: meter.c, calls: meter.calls },
          secs: Math.round((Date.now() - t0) / 1000),
        };
      } catch (e: any) {
        row = { key: c.key, run, flag, grade: null, subs: {}, faces: {}, hold: null, summary: '', defects: [], heldNarrationBad: false,
          costUsd: meter.cost, tokens: { p: meter.p, c: meter.c, calls: meter.calls }, secs: Math.round((Date.now() - t0) / 1000), err: String(e?.message || e) };
      }
      fs.appendFileSync(outFile(tag), JSON.stringify(row) + '\n');
      console.log(`  ${row.err ? '✗' : '✓'} ${c.key} run ${run}: grade=${row.grade} (expected ${c.expected_grade}) $${row.costUsd.toFixed(3)} ${row.secs}s${row.err ? ' ERR ' + row.err : ''}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  report(tag, compareTag);
})().catch(e => { console.error('Fatal:', e); process.exit(1); });
