/**
 * Repeatability Check Harness (READ-ONLY)
 *
 * Grades the SAME cards twice back-to-back through the CURRENT (v9.1) grading
 * engine and compares run 1 vs run 2. Measures run-to-run stability — the
 * pre-calibration engine flipped a card 9↔6 between same-day runs.
 *
 * SAFETY: strictly read-only against the database. The ONLY Supabase calls are
 * SELECT queries on the cards table and storage.createSignedUrl (no row is
 * ever inserted/updated/deleted). All output goes to a markdown report file.
 *
 * Usage:
 *   npx tsx scripts/repeatability-check.ts [--dry-run]
 *
 * --dry-run: select cards + create signed URLs only (no OpenAI calls).
 *
 * Requires .env.local (Supabase URL + service role key + OPENAI_API_KEY).
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { gradeCardConversational } from '../src/lib/visionGrader';
import { getConditionFromGrade } from '../src/lib/conditionAssessment';
import { ensureProcessedConditionReport } from '../src/lib/conditionReportProcessor';

const DRY_RUN = process.argv.includes('--dry-run');
const REPORT_PATH = path.join(__dirname, '..', 'output', 'repeatability-check-2026-07-04.md');
const DELAY_BETWEEN_GRADES_MS = 5000;

// Fixed card set from the 2026-07-04 regrade round (zoom + clean paths)
const FIXED_CARD_IDS = [
  '5bcf3886-571b-4a24-aa9f-66041556061f', // MTG Vesuvan Doppelganger — zoom-active
  '49595e97-86b2-43e7-8196-2ae68ca9e54a', // MTG Serra Angel — zoom-active
  'f26d9f48-4640-4a2d-8368-21d43a06e668', // Lorcana Moana — clean path
];
// Plus one Pokemon zoom-active card, looked up by name (whichever exists)
const POKEMON_NAME_CANDIDATES = ['Pikachu & Charizard', 'Doublade'];

// Engine card types (mirrors promptLoader_v5 CardType; routes pass these exact strings)
type EngineCardType = 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'onepiece' | 'yugioh' | 'starwars' | 'other';

const SPORT_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

function categoryToCardType(category: string): EngineCardType {
  if (SPORT_CATEGORIES.includes(category)) return 'sports';
  switch (category) {
    case 'Pokemon': return 'pokemon';
    case 'MTG': return 'mtg';
    case 'Lorcana': return 'lorcana';
    case 'One Piece': return 'onepiece';
    case 'Yu-Gi-Oh': return 'yugioh';
    case 'Star Wars': return 'starwars';
    default: return 'other';
  }
}

type Subgrades = { centering: number | null; corners: number | null; edges: number | null; surface: number | null };

interface CardRow {
  id: string;
  card_name: string | null;
  category: string;
  front_path: string | null;
  back_path: string | null;
  created_at: string;
  conversational_decimal_grade: any;
  user_condition_report: any;
  user_condition_processed: any;
}

interface RunResult {
  grade: number | null;
  subgrades: Subgrades;
  label: string | null;
  uncertainty: string | null;
  narratorSummary: string;
  /** numbers extracted from the "Consensus subgrades" line of the narrator summary */
  consensusLineNumbers: string[];
  zoomNotes: string[];
  uncorroboratedZoom: string[];
  uncertaintyGateFired: boolean;
  structuralDetected: boolean;
  version: string | null;
  elapsedSec: string;
}

interface CardResult {
  card: CardRow;
  cardType: EngineCardType;
  runs: (RunResult | null)[]; // [run1, run2]
  errors: (string | null)[];
}

const CARD_SELECT_COLUMNS =
  'id, card_name, category, front_path, back_path, created_at, ' +
  'conversational_decimal_grade, user_condition_report, user_condition_processed';

/**
 * Capture console output during a grading call (the UNCORROBORATED corroboration-rule
 * message and the uncertainty-gate message only exist as console logs). Output is still
 * forwarded to the real console so live progress remains visible.
 */
function captureConsole(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  const wrap = (orig: (...a: any[]) => void) => (...args: any[]) => {
    try {
      lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    } catch {
      /* ignore capture failure */
    }
    orig(...args);
  };
  console.log = wrap(origLog);
  console.warn = wrap(origWarn);
  console.error = wrap(origErr);
  return {
    lines,
    restore: () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
    },
  };
}

function fmtSub(s: Subgrades): string {
  const f = (n: number | null) => (n == null ? '?' : String(n));
  return `C:${f(s.centering)} Co:${f(s.corners)} E:${f(s.edges)} S:${f(s.surface)}`;
}

function extractSubgrades(json: any): Subgrades {
  const avg = json?.grading_passes?.averaged_rounded;
  const ws = json?.weighted_scores;
  return {
    centering: avg?.centering ?? ws?.centering_weighted ?? null,
    corners: avg?.corners ?? ws?.corners_weighted ?? null,
    edges: avg?.edges ?? ws?.edges_weighted ?? null,
    surface: avg?.surface ?? ws?.surface_weighted ?? null,
  };
}

function subgradeDiffs(a: Subgrades, b: Subgrades): { text: string; maxAbs: number } {
  const parts: string[] = [];
  let maxAbs = 0;
  for (const k of ['centering', 'corners', 'edges', 'surface'] as const) {
    const x = a[k];
    const y = b[k];
    if (x != null && y != null && x !== y) {
      parts.push(`${k} ${x}→${y}`);
      maxAbs = Math.max(maxAbs, Math.abs(y - x));
    } else if ((x == null) !== (y == null)) {
      parts.push(`${k} ${x ?? '?'}→${y ?? '?'}`);
    }
  }
  return { text: parts.length ? parts.join(', ') : 'none', maxAbs };
}

/** Extract the numbers on the "Consensus subgrades" line of the narrator summary. */
function extractConsensusLineNumbers(summary: string): string[] {
  const line = summary
    .split(/\n/)
    .find((l) => /consensus subgrades/i.test(l));
  // Narrator summaries are often single-line; fall back to the sentence containing the phrase
  const target =
    line ??
    (summary.match(/[^.]*consensus subgrades[^.]*\./i)?.[0] || '');
  if (!target) return [];
  return target.match(/\d+(?:\.\d+)?/g) || [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  if (!DRY_RUN && !process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 1. Select cards (SELECT only) ──────────────────────────────────────────
  const selected: { card: CardRow; cardType: EngineCardType }[] = [];

  // Fixed IDs
  const { data: fixedRows, error: fixedErr } = await supabase
    .from('cards')
    .select(CARD_SELECT_COLUMNS)
    .in('id', FIXED_CARD_IDS);
  if (fixedErr) {
    console.error(`Fixed-card SELECT failed: ${fixedErr.message}`);
    process.exit(1);
  }
  // Preserve the intended order
  for (const id of FIXED_CARD_IDS) {
    const row = (fixedRows || []).find((r: any) => r.id === id) as CardRow | undefined;
    if (!row) {
      console.error(`Card ${id} not found in cards table — aborting.`);
      process.exit(1);
    }
    if (!row.front_path || !row.back_path) {
      console.error(`Card ${id} (${row.card_name}) is missing image paths — aborting.`);
      process.exit(1);
    }
    selected.push({ card: row, cardType: categoryToCardType(row.category) });
  }

  // Pokemon card by name (whichever candidate exists, with images + stored grade)
  let pokemonRow: CardRow | null = null;
  for (const name of POKEMON_NAME_CANDIDATES) {
    const { data, error } = await supabase
      .from('cards')
      .select(CARD_SELECT_COLUMNS)
      .eq('category', 'Pokemon')
      .ilike('card_name', `%${name}%`)
      .not('front_path', 'is', null)
      .not('back_path', 'is', null)
      .not('conversational_decimal_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      console.warn(`Pokemon lookup for "${name}" failed: ${error.message}`);
      continue;
    }
    if (data && data.length > 0) {
      pokemonRow = data[0] as CardRow;
      console.log(`Pokemon pick: "${name}" matched ${pokemonRow.card_name} (${pokemonRow.id})`);
      break;
    }
    console.log(`Pokemon candidate "${name}" not found — trying next.`);
  }
  if (!pokemonRow) {
    console.error('No Pokemon candidate card found — aborting.');
    process.exit(1);
  }
  selected.push({ card: pokemonRow, cardType: 'pokemon' });

  console.log(`\nSelected ${selected.length} cards (each will be graded TWICE):`);
  for (const s of selected) {
    console.log(`  [${s.card.category}] ${s.card.card_name || '(unnamed)'} — ${s.card.id} — stored grade ${s.card.conversational_decimal_grade}`);
  }

  // ── 2. Grade each card twice ───────────────────────────────────────────────
  const results: CardResult[] = [];

  for (let i = 0; i < selected.length; i++) {
    const { card, cardType } = selected[i];
    const result: CardResult = { card, cardType, runs: [null, null], errors: [null, null] };
    results.push(result);

    console.log(`\n================================================================`);
    console.log(`[card ${i + 1}/${selected.length}] ${card.category} — ${card.card_name || '(unnamed)'} (${card.id})`);
    console.log(`================================================================`);

    // Signed URLs (mirrors the route: bucket "cards", 1h expiry) — reused for both runs
    let frontUrl: string | undefined;
    let backUrl: string | undefined;
    try {
      const [frontRes, backRes] = await Promise.all([
        supabase.storage.from('cards').createSignedUrl(card.front_path!, 3600),
        supabase.storage.from('cards').createSignedUrl(card.back_path!, 3600),
      ]);
      frontUrl = frontRes.data?.signedUrl;
      backUrl = backRes.data?.signedUrl;
      if (!frontUrl || !backUrl) {
        throw new Error(`signed URL failure (front: ${frontRes.error?.message || 'ok'}, back: ${backRes.error?.message || 'ok'})`);
      }
    } catch (err: any) {
      result.errors[0] = result.errors[1] = `signed URLs: ${err?.message || String(err)}`;
      console.error(`  FAILED to sign URLs: ${result.errors[0]}`);
      continue;
    }

    if (DRY_RUN) {
      console.log('  [dry-run] signed URLs OK, skipping grading');
      continue;
    }

    const userConditionReport = ensureProcessedConditionReport(
      card.user_condition_report,
      card.user_condition_processed
    );

    for (let run = 0; run < 2; run++) {
      console.log(`\n  ── RUN ${run + 1}/2 ──`);
      try {
        const t0 = Date.now();
        const capture = captureConsole();
        let fresh;
        try {
          // cast: visionGrader's signature union lags promptLoader_v5 (routes pass
          // 'onepiece'/'yugioh'/'starwars' the same way; runtime accepts all 8)
          fresh = await gradeCardConversational(frontUrl, backUrl, cardType as any, {
            userConditionReport: userConditionReport,
          });
        } finally {
          capture.restore();
        }
        const gradingLogs = capture.lines;
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        const freshJson = JSON.parse(fresh.markdown_report);
        const fg = freshJson.final_grade || {};
        const freshGrade = fg.decimal_grade ?? fresh.extracted_grade.decimal_grade ?? null;
        const consensusNotes: string[] = Array.isArray(freshJson.grading_passes?.consensus_notes)
          ? freshJson.grading_passes.consensus_notes
          : [];
        const zoomNotes = consensusNotes.filter((n) => /zoom/i.test(String(n))).map((n) => String(n));
        const zoomDefects: string[] = [];
        for (const face of ['front', 'back'] as const) {
          for (const d of freshJson.surface?.[face]?.defects || []) {
            if (d?.source === 'zoom-inspection') {
              zoomDefects.push(`${face}: ${d.type || 'defect'} @ ${d.location || '?'} (${d.severity || '?'})`);
            }
          }
        }

        const summaryText = String(fg.summary || '');
        const uncertaintyGateFired =
          /grade held at 9/i.test(summaryText) || gradingLogs.some((l) => /uncertainty gate/i.test(l));
        const uncorroboratedZoom = gradingLogs.filter((l) => /UNCORROBORATED/.test(l)).map((l) => l.trim());

        const runResult: RunResult = {
          grade: freshGrade,
          subgrades: extractSubgrades(freshJson),
          label: fg.condition_label ?? null,
          uncertainty: fg.grade_range ?? fresh.extracted_grade.uncertainty ?? null,
          narratorSummary: summaryText,
          consensusLineNumbers: extractConsensusLineNumbers(summaryText),
          zoomNotes: [...zoomNotes, ...zoomDefects],
          uncorroboratedZoom,
          uncertaintyGateFired,
          structuralDetected: freshJson.structural_damage?.detected === true,
          version: fresh.meta?.version || null,
          elapsedSec: elapsed,
        };
        result.runs[run] = runResult;

        console.log(
          `  RUN ${run + 1} DONE in ${elapsed}s: grade ${freshGrade} (${fg.condition_label}, ${fg.grade_range}) ` +
            `subs ${fmtSub(runResult.subgrades)}` +
            `${uncertaintyGateFired ? ' [UNCERTAINTY GATE]' : ''}` +
            `${uncorroboratedZoom.length ? ` [${uncorroboratedZoom.length} UNCORROBORATED zoom]` : ''}` +
            `${runResult.zoomNotes.length ? ` [zoom x${runResult.zoomNotes.length}]` : ' [no zoom]'}`
        );
      } catch (err: any) {
        result.errors[run] = err?.message || String(err);
        console.error(`  RUN ${run + 1} FAILED: ${result.errors[run]}`);
      }

      // 5s pause between every grade (between run1→run2 and between cards)
      const isLastGrade = i === selected.length - 1 && run === 1;
      if (!isLastGrade) {
        console.log(`  ...waiting ${DELAY_BETWEEN_GRADES_MS / 1000}s before next grade`);
        await sleep(DELAY_BETWEEN_GRADES_MS);
      }
    }
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] complete — no grading calls made, no report written.');
    return;
  }

  // ── 3. Write markdown report ───────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('# Repeatability Check — v9.1 Grading Engine (Run 1 vs Run 2)');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Each card below was graded TWICE back-to-back (fresh `gradeCardConversational` call');
  lines.push('each time, same signed URLs, 5s pause between grades) through the CURRENT (uncommitted');
  lines.push('v9.1) engine — invoked exactly as the per-category API routes invoke it. This measures');
  lines.push('run-to-run stability: the pre-calibration engine flipped a card 9↔6 between same-day');
  lines.push('runs. **No database rows were modified.**');
  lines.push('');

  const runBlock = (r: RunResult, title: string) => {
    lines.push(`### ${title}`);
    lines.push('');
    lines.push(`- Grade: **${r.grade ?? 'N/A'}** (uncertainty ${r.uncertainty ?? '?'})`);
    lines.push(`- Subgrades (averaged_rounded): ${fmtSub(r.subgrades)}`);
    lines.push(`- Condition label: ${r.label ?? 'N/A'} ${r.grade != null && r.label === getConditionFromGrade(r.grade) ? '(matches getConditionFromGrade)' : '(MISMATCH vs getConditionFromGrade!)'}`);
    lines.push(`- Engine version: ${r.version ?? '?'}`);
    lines.push(`- Structural damage detected: ${r.structuralDetected ? 'YES' : 'no'}`);
    lines.push(`- Uncertainty gate (10 held at 9): ${r.uncertaintyGateFired ? '**FIRED**' : 'did not fire'}`);
    if (r.uncorroboratedZoom.length) {
      lines.push('- UNCORROBORATED zoom caps limited:');
      for (const u of r.uncorroboratedZoom) lines.push(`  - \`${u}\``);
    } else {
      lines.push('- UNCORROBORATED zoom caps: none');
    }
    if (r.zoomNotes.length) {
      lines.push('- Zoom inspection contributions:');
      for (const z of r.zoomNotes) lines.push(`  - ${z}`);
    } else {
      lines.push('- Zoom inspection contributions: none recorded');
    }
    lines.push(`- Narrator "Consensus subgrades" numbers: ${r.consensusLineNumbers.length ? r.consensusLineNumbers.join(', ') : '(line not found)'}`);
    lines.push(`- Elapsed: ${r.elapsedSec}s`);
    lines.push('');
    lines.push('**Narrator summary (full):**');
    lines.push('');
    lines.push(`> ${r.narratorSummary.replace(/\n/g, ' ')}`);
    lines.push('');
  };

  for (const res of results) {
    lines.push(`## ${res.card.category}: ${res.card.card_name || '(unnamed)'}`);
    lines.push('');
    lines.push(`- **Card ID**: \`${res.card.id}\``);
    lines.push(`- Stored production grade (context only): ${res.card.conversational_decimal_grade ?? 'N/A'}`);
    lines.push('');
    for (let run = 0; run < 2; run++) {
      if (res.errors[run]) {
        lines.push(`### Run ${run + 1} — FAILED`);
        lines.push('');
        lines.push(`Error: ${res.errors[run]}`);
        lines.push('');
      } else if (res.runs[run]) {
        runBlock(res.runs[run]!, `Run ${run + 1}`);
      }
    }

    const [r1, r2] = res.runs;
    if (r1 && r2) {
      const sd = subgradeDiffs(r1.subgrades, r2.subgrades);
      const gradeMatch = r1.grade === r2.grade;
      const numbersMatch = r1.consensusLineNumbers.join(',') === r2.consensusLineNumbers.join(',');
      lines.push('### Run 1 vs Run 2');
      lines.push('');
      lines.push(`- Final grade: ${r1.grade} vs ${r2.grade} — ${gradeMatch ? '**MATCH**' : '**DIFFER**'}`);
      lines.push(`- Subgrade diffs: ${sd.text}`);
      lines.push(`- Uncertainty: ${r1.uncertainty ?? '?'} vs ${r2.uncertainty ?? '?'} — ${r1.uncertainty === r2.uncertainty ? 'match' : 'differ'}`);
      lines.push(`- Condition label: ${r1.label ?? '?'} vs ${r2.label ?? '?'} — ${r1.label === r2.label ? 'match' : 'differ'}`);
      lines.push(`- Zoom fired: run1 ${r1.zoomNotes.length ? `yes (${r1.zoomNotes.length})` : 'no'} vs run2 ${r2.zoomNotes.length ? `yes (${r2.zoomNotes.length})` : 'no'}`);
      lines.push(`- Narrator "Consensus subgrades" numbers: ${numbersMatch ? 'identical' : `DIFFER (run1: ${r1.consensusLineNumbers.join(', ') || 'n/a'} | run2: ${r2.consensusLineNumbers.join(', ') || 'n/a'})`}`);
      lines.push('');
    }
  }

  // ── Verdict table ──────────────────────────────────────────────────────────
  lines.push('## Verdict');
  lines.push('');
  lines.push('| Card | Run 1 grade | Run 2 grade | Match? | Subgrade diffs | Zoom run1 / run2 |');
  lines.push('|------|-------------|-------------|--------|----------------|------------------|');
  const consoleTable: string[] = [];
  consoleTable.push('Card | Run1 | Run2 | Match? | Subgrade diffs | Zoom r1/r2');
  consoleTable.push('-----|------|------|--------|----------------|-----------');
  let anyGradeDiffer = false;
  let largestSubDiff = 0;
  let largestSubDiffDesc = 'none';
  let zoomConsistent = true;

  for (const res of results) {
    const name = `${res.card.card_name || '(unnamed)'} (${res.card.category})`.slice(0, 50);
    const [r1, r2] = res.runs;
    if (!r1 || !r2) {
      const err = res.errors.find(Boolean) || 'run missing';
      lines.push(`| ${name} | ${r1?.grade ?? 'FAIL'} | ${r2?.grade ?? 'FAIL'} | — | — | ${err} |`);
      consoleTable.push(`${name} | ${r1?.grade ?? 'FAIL'} | ${r2?.grade ?? 'FAIL'} | - | - | ${err}`);
      continue;
    }
    const match = r1.grade === r2.grade;
    if (!match) anyGradeDiffer = true;
    const sd = subgradeDiffs(r1.subgrades, r2.subgrades);
    if (sd.maxAbs > largestSubDiff) {
      largestSubDiff = sd.maxAbs;
      largestSubDiffDesc = `${sd.text} (${res.card.card_name})`;
    }
    const z1 = r1.zoomNotes.length > 0;
    const z2 = r2.zoomNotes.length > 0;
    if (z1 !== z2) zoomConsistent = false;
    const zoomCell = `${z1 ? `yes (${r1.zoomNotes.length})` : 'no'} / ${z2 ? `yes (${r2.zoomNotes.length})` : 'no'}${z1 !== z2 ? ' ⚠ FLICKER' : ''}`;
    lines.push(`| ${name} | ${r1.grade} | ${r2.grade} | ${match ? 'YES' : '**NO**'} | ${sd.text} | ${zoomCell} |`);
    consoleTable.push(`${name} | ${r1.grade} | ${r2.grade} | ${match ? 'YES' : 'NO'} | ${sd.text} | ${zoomCell}`);
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Any final grade differed between runs: ${anyGradeDiffer ? '**YES**' : 'no'}`);
  lines.push(`- Largest subgrade difference observed: ${largestSubDiff > 0 ? `${largestSubDiff} point(s) — ${largestSubDiffDesc}` : 'none'}`);
  lines.push(`- Zoom behavior consistent (fired both runs or neither): ${zoomConsistent ? 'yes' : '**NO — flickered on/off between runs**'}`);
  lines.push('');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf-8');

  console.log('\n\n══════════════ VERDICT ══════════════');
  for (const row of consoleTable) console.log(row);
  console.log('');
  console.log(`Any final grade differed: ${anyGradeDiffer ? 'YES' : 'no'}`);
  console.log(`Largest subgrade diff: ${largestSubDiff > 0 ? `${largestSubDiff} — ${largestSubDiffDesc}` : 'none'}`);
  console.log(`Zoom consistent: ${zoomConsistent ? 'yes' : 'NO (flickered)'}`);
  console.log(`\nReport written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
