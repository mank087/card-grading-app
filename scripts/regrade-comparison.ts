/**
 * Regrade Comparison Harness (READ-ONLY)
 *
 * Regrades a few existing production cards through the CURRENT (uncommitted
 * v9.0/v9.1) grading engine and compares fresh results against stored grades.
 *
 * SAFETY: strictly read-only against the database. The ONLY Supabase calls are
 * SELECT queries on the cards table and storage.createSignedUrl (no row is
 * ever inserted/updated/deleted). All output goes to a markdown report file.
 *
 * Usage:
 *   npx tsx scripts/regrade-comparison.ts [--dry-run]
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
const REPORT_PATH = path.join(__dirname, '..', 'output', 'regrade-comparison-2026-07-04-calibrated.md');
const CARDS_PER_CATEGORY = 4;
const DELAY_BETWEEN_CARDS_MS = 4000;

// Engine card types (mirrors promptLoader_v5 CardType; routes pass these exact strings)
type EngineCardType = 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'onepiece' | 'yugioh' | 'starwars' | 'other';

// Category groups → engine cardType (mirrors the per-category API routes exactly:
// sports route uses sportCategories list; the others .eq() a single category string)
const GROUPS: { label: string; categories: string[]; cardType: EngineCardType }[] = [
  { label: 'Sports', categories: ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'], cardType: 'sports' },
  { label: 'Pokemon', categories: ['Pokemon'], cardType: 'pokemon' },
  { label: 'MTG', categories: ['MTG'], cardType: 'mtg' },
  { label: 'Lorcana', categories: ['Lorcana'], cardType: 'lorcana' },
  { label: 'One Piece', categories: ['One Piece'], cardType: 'onepiece' },
  { label: 'Yu-Gi-Oh', categories: ['Yu-Gi-Oh'], cardType: 'yugioh' },
  { label: 'Star Wars', categories: ['Star Wars'], cardType: 'starwars' },
  { label: 'Other', categories: ['Other'], cardType: 'other' },
];

type Subgrades = { centering: number | null; corners: number | null; edges: number | null; surface: number | null };

interface CardRow {
  id: string;
  card_name: string | null;
  category: string;
  front_path: string | null;
  back_path: string | null;
  created_at: string;
  conversational_decimal_grade: any;
  conversational_condition_label: string | null;
  conversational_grading: string | null;
  user_condition_report: any;
  user_condition_processed: any;
}

interface ComparisonResult {
  card: CardRow;
  group: string;
  old: {
    grade: number | null;
    subgrades: Subgrades;
    label: string | null;
    summaryExcerpt: string;
    promptVersion: string | null;
  };
  fresh?: {
    grade: number | null;
    subgrades: Subgrades;
    label: string | null;
    uncertainty: string | null;
    narratorSummary: string;
    modelSummaryExcerpt: string;
    zoomNotes: string[];
    structuralDetected: boolean;
    labelMatchesDerived: boolean;
    version: string | null;
    /** v9.1 uncertainty gate (10 held at 9): detected via summary text and/or console log */
    uncertaintyGateFired: boolean;
    /** v9.1 corroboration rule: zoom caps limited as UNCORROBORATED (console-log only) */
    uncorroboratedZoom: string[];
  };
  error?: string;
}

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

function subgradeDelta(oldS: Subgrades, newS: Subgrades): string {
  const parts: string[] = [];
  for (const k of ['centering', 'corners', 'edges', 'surface'] as const) {
    const o = oldS[k];
    const n = newS[k];
    if (o != null && n != null && o !== n) parts.push(`${k} ${o}→${n}`);
  }
  return parts.length ? parts.join(', ') : 'no subgrade changes';
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

  // ── 1. Select candidate cards (SELECT only) ────────────────────────────────
  const selected: { card: CardRow; group: string; cardType: EngineCardType }[] = [];
  const selectionNotes: string[] = [];

  for (const group of GROUPS) {
    // Transient "fetch failed" errors happen occasionally — retry the SELECT up to 3x
    let data: any = null;
    let error: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await supabase
        .from('cards')
        .select(
          'id, card_name, category, front_path, back_path, created_at, ' +
            'conversational_decimal_grade, conversational_condition_label, conversational_grading, ' +
            'user_condition_report, user_condition_processed'
        )
        .in('category', group.categories)
        .not('conversational_decimal_grade', 'is', null)
        .not('conversational_grading', 'is', null)
        .not('front_path', 'is', null)
        .not('back_path', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60);
      data = res.data;
      error = res.error;
      if (!error) break;
      console.warn(`  [${group.label}] selection attempt ${attempt} failed: ${error.message} — retrying`);
      await sleep(2000 * attempt);
    }

    if (error) {
      selectionNotes.push(`${group.label}: query error — ${error.message}`);
      continue;
    }
    const rows = (data || []) as CardRow[];
    const withNumericGrade = rows.filter((r) => {
      const g = Number(r.conversational_decimal_grade);
      return Number.isFinite(g);
    });

    // Prefer recent cards with mid-range grades (6-9); pad with anything else recent.
    const midRange = withNumericGrade.filter((r) => {
      const g = Number(r.conversational_decimal_grade);
      return g >= 6 && g <= 9;
    });
    const rest = withNumericGrade.filter((r) => !midRange.includes(r));
    const picks = [...midRange, ...rest].slice(0, CARDS_PER_CATEGORY);

    if (picks.length === 0) {
      selectionNotes.push(`${group.label}: no qualifying cards found (of ${rows.length} recent candidates)`);
    } else {
      if (picks.length < CARDS_PER_CATEGORY) {
        selectionNotes.push(`${group.label}: only ${picks.length} qualifying card(s) found`);
      }
      if (midRange.length < picks.length) {
        selectionNotes.push(`${group.label}: padded with non-mid-range grade(s) (only ${midRange.length} cards graded 6-9)`);
      }
      for (const card of picks) selected.push({ card, group: group.label, cardType: group.cardType });
    }
  }

  console.log(`\nSelected ${selected.length} cards:`);
  for (const s of selected) {
    console.log(`  [${s.group}] ${s.card.card_name || '(unnamed)'} — ${s.card.id} — old grade ${s.card.conversational_decimal_grade} — ${s.card.created_at}`);
  }
  for (const n of selectionNotes) console.log(`  NOTE: ${n}`);

  // ── 2. Regrade each card through the current engine ───────────────────────
  const results: ComparisonResult[] = [];

  for (let i = 0; i < selected.length; i++) {
    const { card, group, cardType } = selected[i];
    console.log(`\n================================================================`);
    console.log(`[${i + 1}/${selected.length}] ${group} — ${card.card_name || '(unnamed)'} (${card.id})`);
    console.log(`================================================================`);

    // Parse STORED grading
    let storedJson: any = null;
    try {
      storedJson = JSON.parse(card.conversational_grading || 'null');
    } catch {
      /* leave null */
    }
    const oldGradeNum = Number(card.conversational_decimal_grade);
    const old = {
      grade: Number.isFinite(oldGradeNum) ? oldGradeNum : null,
      subgrades: extractSubgrades(storedJson),
      label: card.conversational_condition_label ?? storedJson?.final_grade?.condition_label ?? null,
      summaryExcerpt: String(storedJson?.final_grade?.summary || '').slice(0, 300),
      promptVersion: storedJson?.metadata?.prompt_version || storedJson?.meta?.prompt_version || null,
    };

    const result: ComparisonResult = { card, group, old };
    results.push(result);

    try {
      // Signed URLs (mirrors the route: bucket "cards", 1h expiry)
      const [frontRes, backRes] = await Promise.all([
        supabase.storage.from('cards').createSignedUrl(card.front_path!, 3600),
        supabase.storage.from('cards').createSignedUrl(card.back_path!, 3600),
      ]);
      const frontUrl = frontRes.data?.signedUrl;
      const backUrl = backRes.data?.signedUrl;
      if (!frontUrl || !backUrl) {
        throw new Error(`signed URL failure (front: ${frontRes.error?.message || 'ok'}, back: ${backRes.error?.message || 'ok'})`);
      }

      if (DRY_RUN) {
        console.log('  [dry-run] signed URLs OK, skipping grade');
        continue;
      }

      // Mirror the route invocation EXACTLY (same options, same condition-report handling)
      const userConditionReport = ensureProcessedConditionReport(
        card.user_condition_report,
        card.user_condition_processed
      );

      const t0 = Date.now();
      // Capture console output: UNCORROBORATED zoom limits + uncertainty-gate fire are log-only
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
      const zoomNotes = consensusNotes.filter((n) => /zoom/i.test(String(n)));
      const zoomDefects: string[] = [];
      for (const face of ['front', 'back'] as const) {
        for (const d of freshJson.surface?.[face]?.defects || []) {
          if (d?.source === 'zoom-inspection') {
            zoomDefects.push(`${face}: ${d.type || 'defect'} @ ${d.location || '?'} (${d.severity || '?'})`);
          }
        }
      }

      // v9.1 uncertainty gate: summary carries "grade held at 9"; console carries "uncertainty gate: 10 → 9"
      const summaryText = String(fg.summary || '');
      const uncertaintyGateFired =
        /grade held at 9/i.test(summaryText) || gradingLogs.some((l) => /uncertainty gate/i.test(l));
      // v9.1 corroboration rule: log-only "[GRADE RECALC] 🔎 zoom: ... UNCORROBORATED ..."
      const uncorroboratedZoom = gradingLogs.filter((l) => /UNCORROBORATED/.test(l)).map((l) => l.trim());

      result.fresh = {
        grade: freshGrade,
        subgrades: extractSubgrades(freshJson),
        label: fg.condition_label ?? null,
        uncertainty: fg.grade_range ?? fresh.extracted_grade.uncertainty ?? null,
        narratorSummary: summaryText,
        modelSummaryExcerpt: String(fg.model_summary || '').slice(0, 300),
        zoomNotes: [...zoomNotes, ...zoomDefects],
        structuralDetected: freshJson.structural_damage?.detected === true,
        labelMatchesDerived: freshGrade != null ? fg.condition_label === getConditionFromGrade(freshGrade) : false,
        version: fresh.meta?.version || null,
        uncertaintyGateFired,
        uncorroboratedZoom,
      };

      console.log(
        `  DONE in ${elapsed}s: old ${old.grade} → new ${freshGrade} (${fg.condition_label}, ${fg.grade_range})` +
          `${uncertaintyGateFired ? ' [UNCERTAINTY GATE]' : ''}${uncorroboratedZoom.length ? ` [${uncorroboratedZoom.length} UNCORROBORATED zoom]` : ''}`
      );
    } catch (err: any) {
      result.error = err?.message || String(err);
      console.error(`  FAILED: ${result.error}`);
    }

    if (i < selected.length - 1 && !DRY_RUN) {
      console.log(`  ...waiting ${DELAY_BETWEEN_CARDS_MS / 1000}s before next card`);
      await sleep(DELAY_BETWEEN_CARDS_MS);
    }
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] complete — no grading calls made, no report written.');
    return;
  }

  // ── 3. Write markdown report ───────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('# Regrade Comparison — v9.1-calibrated Engine vs Stored Grades');
  lines.push('');
  lines.push('Engine includes the v9.1 zoom calibration: softer severity ladder, zoom corroboration');
  lines.push('rule (single-region uncapped zoom findings limited to −2), and uncertainty gate on 10s.');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Fresh grades were produced by the CURRENT (uncommitted) grading engine — ');
  lines.push('`gradeCardConversational` (3-completion ensemble + median consensus + regioned zoom');
  lines.push('inspection + narrate-after-consensus) — invoked exactly as the per-category API routes');
  lines.push('invoke it (same card type mapping, same user condition report handling, signed URLs from');
  lines.push('the `cards` bucket). **No database rows were modified.**');
  lines.push('');
  if (selectionNotes.length) {
    lines.push('## Selection notes');
    lines.push('');
    for (const n of selectionNotes) lines.push(`- ${n}`);
    lines.push('');
  }

  for (const r of results) {
    lines.push(`## ${r.group}: ${r.card.card_name || '(unnamed)'}`);
    lines.push('');
    lines.push(`- **Card ID**: \`${r.card.id}\``);
    lines.push(`- **Category**: ${r.card.category}`);
    lines.push(`- **Graded at (stored)**: ${r.card.created_at}`);
    lines.push('');
    lines.push('### OLD (stored)');
    lines.push('');
    lines.push(`- Grade: **${r.old.grade ?? 'N/A'}**`);
    lines.push(`- Subgrades: ${fmtSub(r.old.subgrades)}`);
    lines.push(`- Condition label: ${r.old.label ?? 'N/A'}`);
    if (r.old.promptVersion) lines.push(`- Prompt version: ${r.old.promptVersion}`);
    lines.push(`- Summary (first 300 chars): ${r.old.summaryExcerpt || '(none)'}`);
    lines.push('');
    if (r.error) {
      lines.push('### NEW — FAILED');
      lines.push('');
      lines.push(`Error: ${r.error}`);
      lines.push('');
      continue;
    }
    if (!r.fresh) continue;
    lines.push('### NEW (fresh regrade)');
    lines.push('');
    lines.push(`- Grade: **${r.fresh.grade ?? 'N/A'}** (uncertainty ${r.fresh.uncertainty ?? '?'})`);
    lines.push(`- Subgrades: ${fmtSub(r.fresh.subgrades)}`);
    lines.push(`- Condition label: ${r.fresh.label ?? 'N/A'} ${r.fresh.labelMatchesDerived ? '(matches getConditionFromGrade)' : '(MISMATCH vs getConditionFromGrade!)'}`);
    lines.push(`- Engine version: ${r.fresh.version ?? '?'}`);
    lines.push(`- Structural damage detected: ${r.fresh.structuralDetected ? 'YES' : 'no'}`);
    lines.push(
      `- Uncertainty gate (10 held at 9): ${r.fresh.uncertaintyGateFired ? '**FIRED**' : 'did not fire'}`
    );
    if (r.fresh.uncorroboratedZoom.length) {
      lines.push(`- Zoom corroboration rule (UNCORROBORATED caps limited):`);
      for (const u of r.fresh.uncorroboratedZoom) lines.push(`  - \`${u}\``);
    } else {
      lines.push('- Zoom corroboration rule: no UNCORROBORATED zoom caps');
    }
    if (r.fresh.zoomNotes.length) {
      lines.push(`- Zoom inspection contributions:`);
      for (const z of r.fresh.zoomNotes) lines.push(`  - ${z}`);
    } else {
      lines.push('- Zoom inspection contributions: none recorded');
    }
    lines.push('');
    lines.push(`**New narrator summary (full):**`);
    lines.push('');
    lines.push(`> ${r.fresh.narratorSummary.replace(/\n/g, ' ')}`);
    lines.push('');
    lines.push(`**Model summary (first 300 chars):** ${r.fresh.modelSummaryExcerpt || '(none)'}`);
    lines.push('');
    const gradeDelta =
      r.old.grade != null && r.fresh.grade != null ? (r.fresh.grade - r.old.grade).toFixed(1) : 'n/a';
    lines.push('### Delta');
    lines.push('');
    lines.push(
      `- Grade: ${r.old.grade} → ${r.fresh.grade} (Δ ${gradeDelta}); ` +
        `${subgradeDelta(r.old.subgrades, r.fresh.subgrades)}; ` +
        `label ${r.old.label ?? '?'} → ${r.fresh.label ?? '?'}`
    );
    lines.push('');
  }

  // Aggregate table
  lines.push('## Aggregate');
  lines.push('');
  lines.push('| Card | Category | Old grade | New grade | Δ | Label old → new | Uncertainty | Gate fired | Zoom fired |');
  lines.push('|------|----------|-----------|-----------|---|-----------------|-------------|------------|------------|');
  const consoleTable: string[] = [];
  consoleTable.push('Card | Category | Old | New | Delta | Label old → new | Uncertainty | Gate | Zoom');
  consoleTable.push('-----|----------|-----|-----|-------|-----------------|-------------|------|-----');
  for (const r of results) {
    const name = (r.card.card_name || '(unnamed)').slice(0, 40);
    if (r.error || !r.fresh) {
      lines.push(`| ${name} | ${r.group} | ${r.old.grade ?? '?'} | FAILED | — | — | — | — | — |`);
      consoleTable.push(`${name} | ${r.group} | ${r.old.grade ?? '?'} | FAILED | - | - | - | - | -`);
      continue;
    }
    const d = r.old.grade != null && r.fresh.grade != null ? (r.fresh.grade - r.old.grade).toFixed(1) : 'n/a';
    const labelChange = `${r.old.label ?? '?'} → ${r.fresh.label ?? '?'}`;
    const gate = r.fresh.uncertaintyGateFired ? 'YES' : 'no';
    const zoomFired = r.fresh.uncorroboratedZoom.length
      ? `UNCORROB x${r.fresh.uncorroboratedZoom.length}`
      : r.fresh.zoomNotes.length
        ? `yes (${r.fresh.zoomNotes.length})`
        : 'no';
    lines.push(
      `| ${name} | ${r.group} | ${r.old.grade} | ${r.fresh.grade} | ${d} | ${labelChange} | ${r.fresh.uncertainty ?? '?'} | ${gate} | ${zoomFired} |`
    );
    consoleTable.push(
      `${name} | ${r.group} | ${r.old.grade} | ${r.fresh.grade} | ${d} | ${labelChange} | ${r.fresh.uncertainty ?? '?'} | ${gate} | ${zoomFired}`
    );
  }
  lines.push('');

  // Distribution stats
  const graded = results.filter((r) => r.fresh && r.old.grade != null && r.fresh.grade != null);
  const deltas = graded.map((r) => (r.fresh!.grade as number) - (r.old.grade as number));
  const exact = deltas.filter((d) => d === 0).length;
  const within1 = deltas.filter((d) => Math.abs(d) === 1).length;
  const twoPlus = deltas.filter((d) => Math.abs(d) >= 2).length;
  const failures = results.filter((r) => r.error);
  const gateCount = graded.filter((r) => r.fresh!.uncertaintyGateFired).length;
  const uncorrobCount = graded.filter((r) => r.fresh!.uncorroboratedZoom.length > 0).length;
  const meanDelta = deltas.length ? (deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2) : 'n/a';
  lines.push('## Distribution');
  lines.push('');
  lines.push(`- Cards compared: ${graded.length} (of ${results.length} attempted; ${failures.length} failed)`);
  lines.push(`- Exact match (Δ = 0): ${exact}`);
  lines.push(`- Within ±1 (|Δ| = 1): ${within1}`);
  lines.push(`- |Δ| ≥ 2: ${twoPlus}`);
  lines.push(`- Mean Δ (new − old): ${meanDelta}`);
  lines.push(`- Uncertainty gate fired: ${gateCount} card(s)`);
  lines.push(`- UNCORROBORATED zoom caps limited: ${uncorrobCount} card(s)`);
  if (failures.length) {
    lines.push('');
    lines.push('### Failures');
    lines.push('');
    for (const f of failures) {
      lines.push(`- [${f.group}] ${f.card.card_name || '(unnamed)'} (\`${f.card.id}\`): ${f.error}`);
    }
  }
  lines.push('');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf-8');

  console.log('\n\n══════════════ AGGREGATE ══════════════');
  for (const row of consoleTable) console.log(row);
  console.log('\n══════════════ DISTRIBUTION ══════════════');
  console.log(`Cards compared: ${graded.length} (of ${results.length} attempted; ${failures.length} failed)`);
  console.log(`Exact match (delta 0): ${exact} | within +/-1: ${within1} | |delta| >= 2: ${twoPlus} | mean delta: ${meanDelta}`);
  console.log(`Uncertainty gate fired: ${gateCount} | UNCORROBORATED zoom: ${uncorrobCount}`);
  console.log(`\nReport written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
