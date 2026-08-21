/**
 * GOLDEN CALIBRATION HARNESS
 *
 * Grades every card in scripts/calibration-set.json through the LIVE engine
 * (fresh API calls — no caches) and reports deviation from your expected grades.
 * Run this before shipping ANY prompt, model, or grading-code change.
 *
 *   npx tsx scripts/run-calibration.ts
 *   npx tsx scripts/run-calibration.ts --only <cardId>
 *
 * Cost: ~$0.40 and ~45-60s per card (main ensemble + zoom ensemble).
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { gradeCardConversational } from '../src/lib/visionGrader';
import { resolveGradingModel, describeDecision, BASELINE_MODEL, CANARY_MODEL } from '../src/lib/grading/modelRouter';
import { imageDetail } from '../src/lib/grading/imageDetail';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
);

interface CalCard {
  id: string;
  label: string;
  cardType: string;
  expected: number;
  tolerance: number;
  must_detect: string[];
}

(async () => {
  const setPath = path.join(__dirname, 'calibration-set.json');
  const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;
  const cards: CalCard[] = set.cards.filter((c: CalCard) => !only || c.id === only);
  if (cards.length === 0) { console.error('No matching calibration cards.'); process.exit(1); }

  // State what this run actually exercises. A calibration report that does not
  // name its model and image-detail level is unattributable the moment two
  // runs are compared.
  const sample = resolveGradingModel(cards[0]?.id);
  console.log(`\nGOLDEN CALIBRATION RUN — ${cards.length} card(s)`);
  console.log(`model: ${describeDecision(sample)}`);
  console.log(`baseline=${BASELINE_MODEL}  canary=${CANARY_MODEL}  image detail=${imageDetail()}`);
  console.log('='.repeat(70));
  let pass = 0, fail = 0;
  const rows: string[] = [];

  for (const c of cards) {
    const { data: card, error } = await supabase.from('cards').select('front_path, back_path').eq('id', c.id).single();
    if (error || !card) { rows.push(`✗ ${c.label} — CARD NOT FOUND`); fail++; continue; }
    const { data: f } = await supabase.storage.from('cards').createSignedUrl(card.front_path, 3600);
    const { data: b } = await supabase.storage.from('cards').createSignedUrl(card.back_path, 3600);

    const t0 = Date.now();
    try {
      // routingKey is REQUIRED here. Without it resolveGradingModel() falls
      // back to BASELINE, so a run intended to measure the canary silently
      // measured the baseline instead — and the report gave no way to tell.
      const result: any = await gradeCardConversational(
        f!.signedUrl, b!.signedUrl, c.cardType as any, { routingKey: c.id },
      );
      const j = JSON.parse(result.markdown_report);
      const grade = result.extracted_grade?.decimal_grade;
      const secs = ((Date.now() - t0) / 1000).toFixed(0);

      const gradeOk = grade != null && Math.abs(grade - c.expected) <= c.tolerance;
      const haystack = [
        j.final_grade?.summary || '',
        JSON.stringify(j.structural_damage || {}),
        JSON.stringify(j.grading_passes?.consensus_notes || []),
      ].join(' ').toLowerCase();
      const missedDetections = c.must_detect.filter(term => !haystack.includes(term.toLowerCase()));
      const detectOk = missedDetections.length === 0;

      const status = gradeOk && detectOk ? '✓ PASS' : '✗ FAIL';
      if (gradeOk && detectOk) pass++; else fail++;
      rows.push(
        `${status}  ${c.label}\n` +
        `        expected ${c.expected}±${c.tolerance} → got ${grade} (${result.extracted_grade?.uncertainty}) in ${secs}s` +
        `${!detectOk ? `\n        MISSED DETECTIONS: ${missedDetections.join(', ')}` : ''}` +
        `\n        subgrades: C=${j.weighted_scores?.centering_weighted} Co=${j.weighted_scores?.corners_weighted} E=${j.weighted_scores?.edges_weighted} S=${j.weighted_scores?.surface_weighted}  label="${j.final_grade?.condition_label}"`
      );
    } catch (e: any) {
      rows.push(`✗ ${c.label} — GRADING ERROR: ${e.message}`); fail++;
    }
  }

  console.log(rows.join('\n' + '-'.repeat(70) + '\n'));
  console.log('='.repeat(70));
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? '  ⚠️ DO NOT SHIP until failures are understood' : '  — calibration holds, safe to ship'}`);
  process.exit(fail ? 1 : 0);
})();
