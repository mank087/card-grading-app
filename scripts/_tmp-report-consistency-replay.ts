/**
 * Read-only (Oct 12 2026): run the report-consistency repairs over stored reports,
 * one card at a time, and print before/after. Writes nothing.
 * Usage: npx tsx --env-file=../../.env.local scripts/_tmp-report-consistency-replay.ts <serial|recent:N> ...
 */
import { createClient } from '@supabase/supabase-js';
import { repairReportConsistency } from '../src/lib/grading/reportConsistency';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const short = (s?: string) => (s && s.length > 260 ? s.slice(0, 257) + '...' : s);

async function replay(id: string, label: string, verbose: boolean) {
  const { data } = await db.from('cards').select('conversational_grading').eq('id', id).maybeSingle();
  const raw = data?.conversational_grading;
  if (!raw) return null;
  const json = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const res = repairReportConsistency(json);
  if (verbose || res.repairs.length || res.would_change_grade.length) {
    console.log(`\n=== ${label} (${id}) — ${res.repairs.length} repair(s), ${res.would_change_grade.length} would-change-grade`);
    for (const w of res.would_change_grade) console.log(`  WOULD CHANGE GRADE: ${w.severity} ${w.type} filed ${w.filed_under}, belongs ${w.belongs_to} — ${w.reason}`);
    if (verbose) for (const r of res.repairs) console.log(`  [${r.rule}] ${r.path}\n     before: ${short(r.before)}\n     after:  ${short(r.after)}`);
    else for (const r of res.repairs) console.log(`  [${r.rule}] ${r.path} — ${r.note}`);
  }
  return res;
}

(async () => {
  for (const arg of process.argv.slice(2)) {
    const recent = /^recent:(\d+)$/.exec(arg);
    if (recent) {
      const n = Number(recent[1]);
      const { data: cards, error: listErr } = await db.from('cards').select('id, serial').not('conversational_whole_grade', 'is', null)
        .order('created_at', { ascending: false }).limit(n);
      if (listErr) console.log('list error', listErr.message, 'got', cards?.length);
      let changed = 0, would = 0, byRule: Record<string, number> = {};
      for (const c of cards || []) {
        const r = await replay(c.id, c.serial, !!process.env.VERBOSE);
        if (!r) continue;
        if (r.repairs.length) changed++;
        if (r.would_change_grade.length) would++;
        for (const x of r.repairs) byRule[x.rule] = (byRule[x.rule] || 0) + 1;
      }
      console.log(`\nrecent ${n}: ${changed} report(s) repaired, ${would} with a misfiled finding that would change a grade; repairs by rule ${JSON.stringify(byRule)}`);
      continue;
    }
    const { data: c } = await db.from('cards').select('id, serial, card_name').eq('serial', arg).maybeSingle();
    if (c) await replay(c.id, `${c.serial} ${c.card_name}`, true);
  }
})();
