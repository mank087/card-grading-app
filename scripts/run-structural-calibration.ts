/**
 * STRUCTURAL-CAP CALIBRATION RUNNER (Oct 2026)
 *
 * Grades each case in a structural set N times through the CURRENT engine and
 * records what the crease/bend pipeline did: whether a structural cap applied,
 * the final grade, the verifier's verdict, the pass votes, and measured spend.
 *
 *   STRUCTURAL_V2=0 npx tsx --env-file=.env.local scripts/run-structural-calibration.ts --set <file> --tag baseline --n 2
 *   npx tsx --env-file=.env.local scripts/run-structural-calibration.ts --set <file> --tag v2 --n 2
 *   npx tsx scripts/run-structural-calibration.ts --set <file> --report baseline [--compare v2]
 *   options: --only <key>  --concurrency <c> (default 3)  --out-dir <dir>
 *
 * Set file: {"cases":[{"key","label":"false|real|unclear|unlabeled","note","card_id","cardType"}]}.
 * Rows append to <out-dir>/structural-cal-<tag>.jsonl; a re-run skips (case, run) pairs on file.
 *
 * NO PRODUCTION WRITES (same scheme as run-zoom-calibration.ts): the photos are
 * signed with the service key up front, then the key is deleted from this
 * process before any grading call, so every grading-path write (api_usage_log,
 * zoom evidence uploads, card-row diagnostics) is skipped. The routing key is a
 * non-UUID ("structcal:<card>") as well. Spend is metered from the usage block
 * of each OpenAI response.
 */
import { createClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'async_hooks';
import * as fs from 'fs';
import * as path from 'path';

interface Case { key: string; label: string; note?: string; card_id: string; cardType: string }
interface Row {
  key: string; label: string; run: number; tag: string; v2: string;
  grade: number | null; capped: boolean;
  subs: Record<string, number>; faces: Record<string, number>;
  structural: any; v2Record: any; severe: any; passFinals: Array<number | null>;
  cardInfo: { name?: string; set?: string; subset?: string; year?: string };
  log: string[]; summary: string;
  costUsd: number; tokens: { p: number; c: number; calls: number }; secs: number; err?: string;
}

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
const setFile = arg('--set');
const tag = arg('--tag') || 'run';
const N = Number(arg('--n') || 2);
const only = arg('--only');
const concurrency = Number(arg('--concurrency') || 3);
const outDir = arg('--out-dir') || process.env.SCRATCH || path.join(__dirname);
const reportTag = arg('--report');
const compareTag = arg('--compare');
if (!setFile) { console.error('--set <file> is required'); process.exit(1); }
const cases: Case[] = JSON.parse(fs.readFileSync(setFile, 'utf8')).cases.filter((c: Case) => !only || c.key === only);
const outFile = (t: string) => path.join(outDir, `structural-cal-${t}.jsonl`);
const readRows = (t: string): Row[] => fs.existsSync(outFile(t))
  ? fs.readFileSync(outFile(t), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

function report(t: string, other?: string) {
  const tags = [t, ...(other ? [other] : [])];
  const byTag = Object.fromEntries(tags.map(x => [x, readRows(x)]));
  console.log(`\n${'key'.padEnd(9)} ${'label'.padEnd(9)} ` + tags.map(x => `${x}: capped/grade per run`.padEnd(34)).join(' '));
  const sum: Record<string, Record<string, { runs: number; capped: number; cost: number }>> = {};
  for (const c of cases) {
    const cells = tags.map(x => {
      const rows = byTag[x].filter(r => r.key === c.key && !r.err).sort((a, b) => a.run - b.run);
      const s = ((sum[x] ??= {})[c.label] ??= { runs: 0, capped: 0, cost: 0 });
      for (const r of rows) { s.runs++; if (r.capped) s.capped++; }
      return rows.map(r => `${r.capped ? 'CAP' : 'ok '}/${r.grade}${r.v2Record?.outcome ? `(${r.v2Record.outcome[0]})` : ''}`).join(' ').padEnd(34);
    });
    console.log(`${c.key.padEnd(9)} ${c.label.padEnd(9)} ${cells.join(' ')}`);
  }
  for (const x of tags) {
    const rows = byTag[x];
    const cost = rows.reduce((a, r) => a + (r.costUsd || 0), 0);
    console.log(`\n[${x}] runs=${rows.length} errors=${rows.filter(r => r.err).length} spend=$${cost.toFixed(2)} ($${(cost / Math.max(1, rows.length)).toFixed(3)}/grade)`);
    for (const [label, s] of Object.entries(sum[x] || {})) console.log(`  ${label.padEnd(9)} capped ${s.capped}/${s.runs} runs`);
  }
}

// ── metering + per-job log capture ───────────────────────────────────────────
const jobStore = new AsyncLocalStorage<{ p: number; c: number; calls: number; cost: number; log: string[] }>();
const RATES: Array<[RegExp, { in: number; cached: number; out: number }]> = [
  [/^gpt-5\.6-luna/, { in: 0.20, cached: 0.02, out: 1.20 }],
  [/^gpt-5\.6-terra/, { in: 2.00, cached: 0.20, out: 12.0 }],
  [/^gpt-5\.1/, { in: 1.25, cached: 0.125, out: 10.0 }],
];
function installMeter() {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const res = await orig(input, init);
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    const store = jobStore.getStore();
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
      } catch { /* non-JSON responses are not metered */ }
    }
    return res;
  }) as typeof fetch;
  // Keep only the structural-relevant engine lines, per job.
  const KEEP = /structural|Ensemble finals|low-score check|STRUCTURAL|crease|zoom: \d+ structural/i;
  for (const level of ['log', 'warn'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: any[]) => {
      const store = jobStore.getStore();
      if (store) {
        const line = args.map(a => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(' ');
        if (KEEP.test(line)) store.log.push(line.slice(0, 600));
        return;
      }
      orig(...args);
    };
  }
}

(async () => {
  if (reportTag) { report(reportTag, compareTag); return; }
  const v2 = process.env.STRUCTURAL_V2 || 'default (on)';
  const done = new Set(readRows(tag).map(r => `${r.key}|${r.run}`));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
  const signed = new Map<string, { f: string; b: string }>();
  for (const c of cases) {
    const { data: card, error } = await db.from('cards').select('id, front_path, back_path').eq('id', c.card_id).maybeSingle();
    if (error || !card?.front_path || !card?.back_path) { console.log(`✗ ${c.key}: card not found`); continue; }
    const { data: f } = await db.storage.from('cards').createSignedUrl(card.front_path, 6 * 3600);
    const { data: b } = await db.storage.from('cards').createSignedUrl(card.back_path, 6 * 3600);
    if (!f || !b) { console.log(`✗ ${c.key}: could not sign photos`); continue; }
    signed.set(c.key, { f: f.signedUrl, b: b.signedUrl });
  }
  // From here on this process cannot write to production (see header).
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  installMeter();
  const { gradeCardConversational } = await import('../src/lib/visionGrader');
  process.stdout.write(`structural calibration: N=${N} x ${cases.length} cases, tag=${tag}, STRUCTURAL_V2=${v2}, concurrency=${concurrency} -> ${outFile(tag)} (${done.size} on file)\n`);

  const jobs: Array<{ c: Case; run: number }> = [];
  for (let run = 1; run <= N; run++) for (const c of cases) if (!done.has(`${c.key}|${run}`) && signed.has(c.key)) jobs.push({ c, run });
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { c, run } = jobs[next++];
      const urls = signed.get(c.key)!;
      const store = { p: 0, c: 0, calls: 0, cost: 0, log: [] as string[] };
      const t0 = Date.now();
      let row: Row;
      try {
        const r: any = await jobStore.run(store, () =>
          gradeCardConversational(urls.f, urls.b, c.cardType as any, { routingKey: `structcal:${c.card_id}` }));
        const j = JSON.parse(r.markdown_report);
        const ws = j.weighted_scores || {};
        const sd = j.structural_damage || {};
        row = {
          key: c.key, label: c.label, run, tag, v2,
          grade: r.extracted_grade?.decimal_grade ?? null,
          capped: sd.detected === true,
          subs: { centering: ws.centering_weighted, corners: ws.corners_weighted, edges: ws.edges_weighted, surface: ws.surface_weighted },
          faces: j.raw_sub_scores || {},
          structural: { detected: sd.detected, unconfirmed: sd.unconfirmed, findings: sd.findings, verification: sd.verification, unconfirmed_note: sd.unconfirmed_note },
          v2Record: sd.v2 ?? null,
          severe: j.severe_score_check ?? null,
          passFinals: ['pass_1', 'pass_2', 'pass_3'].map(k => j.grading_passes?.[k]?.final ?? null),
          cardInfo: { name: j.card_info?.card_name, set: j.card_info?.set_name, subset: j.card_info?.subset, year: j.card_info?.year },
          log: store.log, summary: String(j.final_grade?.summary || ''),
          costUsd: store.cost, tokens: { p: store.p, c: store.c, calls: store.calls }, secs: Math.round((Date.now() - t0) / 1000),
        };
      } catch (e: any) {
        row = { key: c.key, label: c.label, run, tag, v2, grade: null, capped: false, subs: {}, faces: {},
          structural: null, v2Record: null, severe: null, passFinals: [], cardInfo: {}, log: store.log, summary: '',
          costUsd: store.cost, tokens: { p: store.p, c: store.c, calls: store.calls }, secs: Math.round((Date.now() - t0) / 1000), err: String(e?.message || e) };
      }
      fs.appendFileSync(outFile(tag), JSON.stringify(row) + '\n');
      process.stdout.write(`  ${row.err ? '✗' : '✓'} ${c.key} (${c.label}) run ${run}: ${row.capped ? 'CAPPED' : 'not capped'} grade=${row.grade}${row.v2Record?.outcome ? ` v2=${row.v2Record.outcome}` : ''} $${row.costUsd.toFixed(3)} ${row.secs}s${row.err ? ' ERR ' + row.err : ''}\n`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  report(tag, compareTag);
})().catch(e => { console.error('Fatal:', e); process.exit(1); });
