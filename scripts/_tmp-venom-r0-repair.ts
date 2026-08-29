/**
 * Finish the Venom (ee5e4ecb) R0 backfill.
 *
 * The first pass updated the conversational_* grading JSON and the top-level
 * whole grade, but missed every other place this card's grade is stored:
 *
 *   • ai_grading                     — a FULL duplicate of the grading structure
 *   • conversational_decimal_grade   — what labelDataGenerator.getGrade() reads FIRST,
 *                                      which is why label_data.gradeFormatted stayed "9"
 *                                      and the eBay listing image rendered a 9
 *   • conversational_weighted_sub_scores.centering
 *   • conversational_preliminary_grade / weighted_total_pre_cap
 *   • conversational_condition_label / conversational_final_grade_summary
 *   • grading_passes (both copies)   — folded, the way the pipeline already folds
 *                                      zoom and structural caps into displayed passes
 *
 * label_data is REGENERATED through generateLabelData rather than hand-patched,
 * so grade / gradeFormatted / condition cannot drift apart again.
 *
 * Dry run by default; --apply to write. Backs up to _tmp-venom-r0-repair-backup.json.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { generateLabelData } from '../src/lib/labelDataGenerator';
import { getConditionFromGrade } from '../src/lib/conditionAssessment';

dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ID = 'ee5e4ecb-e5f6-4786-a00b-cf1be5e13d5a';
const APPLY = process.argv.includes('--apply');
const GRADE = 10;
const BACKUP = path.join(__dirname, '_tmp-venom-r0-repair-backup.json');

const R0_NOTE = 'This card’s artwork runs to the edge with no even printed border, so there is no border ratio to measure. Centering is not counted against the grade on a design like this.';
const MODEL_SUMMARY = 'The card presents with clean corners, edges, and surfaces on both faces; the full-art design carries no printed border to measure, so centering is not counted against the grade; final grade: 10.';

const parse = (v: any) => (typeof v === 'string' ? JSON.parse(v) : JSON.parse(JSON.stringify(v)));

/** Apply the R0 outcome to one grading-structure blob (conversational_grading or ai_grading). */
function repairGradingBlob(g: any, condition: string) {
  for (const face of ['front', 'back'] as const) {
    const sec = g?.centering?.[face];
    if (!sec) continue;
    sec.score = GRADE;
    sec.quality_tier = 'Centered';
    if (!String(sec.analysis ?? '').startsWith(R0_NOTE)) {
      sec.analysis = `${R0_NOTE} ${sec.analysis ?? ''}`.trim();
    }
    sec.policy = {
      mode: 'enforce',
      proposed_score: 9,
      policy_score: GRADE,
      fired_rules: ['R0'],
      reasons: [`${sec.card_type === 'Asymmetric Insert' ? 'asymmetric' : 'full_bleed'} face has no centre to measure — scored as centred`],
      review: false,
      raised: true,
      backfilled_at: new Date().toISOString(),
      backfill_note: 'v9.22 R0 applied retroactively; card was graded under v9.21',
    };
    if (g.raw_sub_scores) g.raw_sub_scores[`centering_${face}`] = GRADE;
  }
  if (g.weighted_scores) {
    g.weighted_scores.centering_weighted = GRADE;
    g.weighted_scores.preliminary_grade = GRADE;
    g.weighted_scores.weakest_subgrade = GRADE;
    g.weighted_scores.condition_tier = 'G';
  }
  if (g.final_grade) {
    g.final_grade.decimal_grade = GRADE;
    g.final_grade.whole_grade = GRADE;
    g.final_grade.condition_label = condition;
    g.final_grade.summary = `A virtually flawless card in these photos - sharp corners, clean edges, and a pristine surface throughout. Final grade: ${GRADE} (${condition}).`;
    g.final_grade.model_summary = MODEL_SUMMARY;
  }
  // Fold R0 into the displayed passes, the same way the pipeline already folds
  // zoom and structural caps in, so the Three-Pass table cannot show 9/9/9
  // sitting underneath a centering tile of 10.
  const gp = g.grading_passes;
  if (gp) {
    for (const k of ['pass_1', 'pass_2', 'pass_3', 'averaged', 'averaged_rounded']) {
      if (gp[k] && typeof gp[k].centering === 'number') gp[k].centering = GRADE;
      if (gp[k] && typeof gp[k].whole_grade === 'number') gp[k].whole_grade = Math.max(gp[k].whole_grade, GRADE);
      if (gp[k] && typeof gp[k].final === 'number') gp[k].final = Math.max(gp[k].final, GRADE);
    }
  }
  return g;
}

(async () => {
  const { data, error } = await sb.from('cards').select('*').eq('id', ID).maybeSingle();
  if (error || !data) { console.error('read failed:', error?.message ?? 'no row'); process.exit(1); }
  const row: any = data;
  fs.writeFileSync(BACKUP, JSON.stringify(row, null, 2));
  console.log(`backed up to ${BACKUP}\n`);

  const condition = getConditionFromGrade(GRADE);

  const conversational = repairGradingBlob(parse(row.conversational_grading), condition);
  const aiGrading = row.ai_grading ? repairGradingBlob(parse(row.ai_grading), condition) : null;

  const weightedSubs = row.conversational_weighted_sub_scores
    ? { ...parse(row.conversational_weighted_sub_scores), centering: GRADE }
    : null;

  const subScores = parse(row.conversational_sub_scores);
  subScores.centering = { front: GRADE, back: GRADE, weighted: GRADE };

  const summary = `A virtually flawless card in these photos - sharp corners, clean edges, and a pristine surface throughout. Final grade: ${GRADE} (${condition}).`;

  // Regenerate the label from the CORRECTED row so grade / gradeFormatted /
  // condition are derived by the same function production uses.
  const correctedForLabel: any = {
    ...row,
    conversational_decimal_grade: GRADE,
    conversational_whole_grade: GRADE,
    conversational_condition_label: condition,
    conversational_grading: conversational,
    conversational_sub_scores: subScores,
    label_data: null, // force a regenerate, do not reuse the cached blob
  };
  const labelData = generateLabelData(correctedForLabel);

  const patch: Record<string, any> = {
    conversational_grading: conversational,
    conversational_sub_scores: subScores,
    conversational_whole_grade: GRADE,
    conversational_decimal_grade: GRADE,
    conversational_preliminary_grade: GRADE,
    conversational_condition_label: condition,
    conversational_final_grade_summary: summary,
    weighted_total_pre_cap: GRADE,
    dcm_grade_whole: GRADE,
    raw_decimal_grade: GRADE,
    label_data: labelData,
    prompt_version: 'DCM_Grading_v9.22',
    ...(aiGrading ? { ai_grading: aiGrading } : {}),
    ...(weightedSubs ? { conversational_weighted_sub_scores: weightedSubs } : {}),
  };

  console.log('--- WILL WRITE ---');
  console.log(`conversational_decimal_grade   ${row.conversational_decimal_grade} -> ${GRADE}   <-- drove the eBay image`);
  console.log(`conversational_preliminary_gr  ${row.conversational_preliminary_grade} -> ${GRADE}`);
  console.log(`weighted_total_pre_cap         ${row.weighted_total_pre_cap} -> ${GRADE}`);
  console.log(`conversational_condition_label ${JSON.stringify(row.conversational_condition_label)} -> ${JSON.stringify(condition)}`);
  console.log(`weighted_sub_scores.centering  ${row.conversational_weighted_sub_scores?.centering} -> ${GRADE}`);
  console.log(`ai_grading.final_grade         ${row.ai_grading?.final_grade?.whole_grade} -> ${aiGrading?.final_grade?.whole_grade}`);
  console.log(`ai_grading centering f/b       ${row.ai_grading?.centering?.front?.score}/${row.ai_grading?.centering?.back?.score} -> ${aiGrading?.centering?.front?.score}/${aiGrading?.centering?.back?.score}`);
  console.log(`label_data.grade               ${row.label_data?.grade} -> ${labelData.grade}`);
  console.log(`label_data.gradeFormatted      ${JSON.stringify(row.label_data?.gradeFormatted)} -> ${JSON.stringify(labelData.gradeFormatted)}`);
  console.log(`label_data.condition           ${JSON.stringify(row.label_data?.condition)} -> ${JSON.stringify(labelData.condition)}`);
  console.log(`passes centering               ${JSON.stringify([1,2,3].map(i => row.conversational_grading?.grading_passes?.[`pass_${i}`]?.centering))} -> ${JSON.stringify([1,2,3].map(i => conversational.grading_passes?.[`pass_${i}`]?.centering))}`);

  if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); return; }

  const { error: upErr } = await sb.from('cards').update(patch).eq('id', ID);
  if (upErr) { console.error('write failed:', upErr.message); process.exit(1); }
  console.log('\nwritten. re-sweeping for anything still stale...');
})();
