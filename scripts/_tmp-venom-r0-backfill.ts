/**
 * One-card backfill: apply v9.22 R0 to the Venom card (ee5e4ecb).
 *
 * The card was graded 2026-08-29 under v9.21, which reported both faces
 * honestly as full-bleed with no measurable border and then deducted a point
 * for it. R0 now scores such a face as centred, which takes this card to 10.
 *
 * Deliberately scoped to this ONE card — the other 12 cards R0 would move are
 * being left as graded.
 *
 * Dry run by default. Pass --apply to write. Backs the original row up to
 * scripts/_tmp-venom-r0-backup.json before touching anything.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { applyCenteringPolicy, layoutFromCardType, centeringUnmeasurableNote, R0_QUALITY_TIER } from '../src/lib/grading/centeringPolicy';
import { getConditionFromGrade } from '../src/lib/conditionAssessment';

dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ID = 'ee5e4ecb-e5f6-4786-a00b-cf1be5e13d5a';
const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, '_tmp-venom-r0-backup.json');

(async () => {
  const { data, error } = await sb.from('cards').select('*').eq('id', ID).maybeSingle();
  if (error || !data) { console.error('read failed:', error?.message ?? 'no row'); process.exit(1); }
  const row: any = data;

  if (row.conversational_whole_grade !== 9) {
    console.error(`refusing: expected whole grade 9, found ${row.conversational_whole_grade}. Already backfilled?`);
    process.exit(1);
  }

  fs.writeFileSync(BACKUP, JSON.stringify(row, null, 2));
  console.log(`original row backed up to ${BACKUP}\n`);

  const grading = typeof row.conversational_grading === 'string'
    ? JSON.parse(row.conversational_grading)
    : JSON.parse(JSON.stringify(row.conversational_grading));

  // Run the real policy per face rather than hardcoding a 10, so this card ends
  // up with exactly what a fresh v9.22 grade would have produced.
  let note: string | null = null;
  for (const face of ['front', 'back'] as const) {
    const sec = grading.centering?.[face];
    if (!sec) { console.error(`refusing: no centering.${face}`); process.exit(1); }
    const result = applyCenteringPolicy({
      face,
      proposedScore: sec.score,
      ratio: null, // stored as "XX/XX" — unmeasurable, which is R0's precondition
      passDevs: [],
      layout: layoutFromCardType(sec.card_type),
      passScores: [],
      cv: null,
      imageConfidence: row.conversational_image_confidence ?? null,
      year: Number(String(row.conversational_card_info?.year ?? '').slice(0, 4)) || null,
    });
    if (!result.firedRules.includes('R0')) {
      console.error(`refusing: R0 did not fire on ${face} (rules: ${result.firedRules.join(',') || 'none'})`);
      process.exit(1);
    }
    note = note ?? centeringUnmeasurableNote(result);
    sec.score = result.score;
    sec.quality_tier = R0_QUALITY_TIER;
    sec.analysis = `${centeringUnmeasurableNote(result)} ${sec.analysis ?? ''}`.trim();
    sec.policy = {
      mode: 'enforce',
      proposed_score: result.raised ? 9 : result.score,
      policy_score: result.score,
      fired_rules: result.firedRules,
      reasons: result.reasons,
      review: result.reviewFlag,
      raised: result.raised,
      backfilled_at: new Date().toISOString(),
      backfill_note: 'v9.22 R0 applied retroactively; card was graded under v9.21',
    };
    grading.raw_sub_scores[`centering_${face}`] = result.score;
  }

  const grade = Math.min(
    grading.raw_sub_scores.centering_front, grading.raw_sub_scores.centering_back,
    grading.raw_sub_scores.corners_front, grading.raw_sub_scores.corners_back,
    grading.raw_sub_scores.edges_front, grading.raw_sub_scores.edges_back,
    grading.raw_sub_scores.surface_front, grading.raw_sub_scores.surface_back,
  );
  const condition = getConditionFromGrade(grade);

  grading.weighted_scores.centering_weighted = 10;
  grading.weighted_scores.preliminary_grade = grade;
  grading.weighted_scores.weakest_subgrade = grade;
  grading.weighted_scores.condition_tier = 'G'; // grade 10; F is grade 9

  grading.final_grade.decimal_grade = grade;
  grading.final_grade.whole_grade = grade;
  grading.final_grade.condition_label = condition;
  // The stock sentence every other 10 in the table carries.
  grading.final_grade.summary =
    `A virtually flawless card in these photos - sharp corners, clean edges, and a pristine surface throughout. Final grade: ${grade} (${condition}).`;
  // The old one read "the intentionally asymmetric insert layout limits
  // centering assessment to a 9, producing a final grade of 9".
  grading.final_grade.model_summary =
    'The card presents with clean corners, edges, and surfaces on both faces; the full-art design carries no printed border to measure, so centering is not counted against the grade; final grade: 10.';

  const subScores = JSON.parse(JSON.stringify(row.conversational_sub_scores));
  subScores.centering = { front: 10, back: 10, weighted: 10 };

  const labelData = row.label_data ? JSON.parse(JSON.stringify(row.label_data)) : null;
  if (labelData) {
    labelData.grade = grade;
    labelData.condition = condition;
  }

  const patch: Record<string, any> = {
    conversational_grading: grading,
    conversational_sub_scores: subScores,
    conversational_whole_grade: grade,
    dcm_grade_whole: grade,
    raw_decimal_grade: grade,
    prompt_version: 'DCM_Grading_v9.22',
    ...(labelData ? { label_data: labelData } : {}),
  };

  console.log('--- BEFORE -> AFTER ---');
  console.log(`whole grade        ${row.conversational_whole_grade} -> ${grade}`);
  console.log(`dcm_grade_whole    ${row.dcm_grade_whole} -> ${grade}`);
  console.log(`raw_decimal_grade  ${row.raw_decimal_grade} -> ${grade}`);
  console.log(`sub centering      ${JSON.stringify(row.conversational_sub_scores.centering)} -> ${JSON.stringify(subScores.centering)}`);
  console.log(`condition_label    ${JSON.stringify(row.label_data?.condition)} -> ${JSON.stringify(condition)}`);
  console.log(`label_data.grade   ${JSON.stringify(row.label_data?.grade)} -> ${grade}`);
  console.log(`front quality_tier -> ${grading.centering.front.quality_tier}`);
  console.log(`\nnote prefixed to both faces:\n  ${note}`);
  console.log(`\nmodel_summary:\n  ${grading.final_grade.model_summary}`);
  console.log(`\nratios stay "XX/XX" (they are the honest answer) and render as an em dash.`);

  if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); return; }

  const { error: upErr } = await sb.from('cards').update(patch).eq('id', ID);
  if (upErr) { console.error('write failed:', upErr.message); process.exit(1); }

  const { data: after, error: vErr } = await sb.from('cards')
    .select('conversational_whole_grade, dcm_grade_whole, raw_decimal_grade, conversational_sub_scores, label_data, prompt_version')
    .eq('id', ID).maybeSingle();
  if (vErr) { console.error('verify read failed:', vErr.message); process.exit(1); }
  const a: any = after;
  console.log('\n--- VERIFIED AFTER WRITE ---');
  console.log(`whole grade      ${a.conversational_whole_grade}`);
  console.log(`dcm_grade_whole  ${a.dcm_grade_whole}`);
  console.log(`raw_decimal      ${a.raw_decimal_grade}`);
  console.log(`sub centering    ${JSON.stringify(a.conversational_sub_scores.centering)}`);
  console.log(`label            grade ${a.label_data?.grade}, ${a.label_data?.condition}`);
  console.log(`prompt_version   ${a.prompt_version}`);
  const ok = a.conversational_whole_grade === 10 && a.dcm_grade_whole === 10 && a.label_data?.condition === 'Gem Mint';
  console.log(ok ? '\nOK' : '\nMISMATCH — check the row against the backup');
})();
