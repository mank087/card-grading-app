/**
 * End-to-end test of the v9.2 evidence-reconciliation rule against the production
 * repro case: David Montgomery 2025 Select (id 22907dd1…), which graded 8/8/10 on
 * three re-shoots within minutes — the 8s carried corners=8 with the model's own
 * prose declaring all corners perfect and zero recorded findings.
 *
 * Replicates the sports route exactly (same images, same condition report).
 * Expected: either corners come back clean (10) or an unjustified 7-8 gets
 * reconciled to 9. FAIL = a category lands ≤8 with no recorded defect.
 */
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
import { gradeCardConversational } from '../src/lib/visionGrader';
import { ensureProcessedConditionReport } from '../src/lib/conditionReportProcessor';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
const CARD_ID = process.argv[2] || '22907dd1-8e00-4d52-8015-5fb5d8c4f1b0';
const CARD_TYPE = (process.argv[3] || 'sports') as any;

async function main() {
  const { data: card, error } = await supabase.from('cards')
    .select('front_path,back_path,user_condition_report,user_condition_processed')
    .eq('id', CARD_ID).single();
  if (error || !card) throw new Error(`card fetch: ${error?.message}`);
  const { data: f } = await supabase.storage.from('cards').createSignedUrl(card.front_path, 3600);
  const { data: b } = await supabase.storage.from('cards').createSignedUrl(card.back_path, 3600);

  const userConditionReport = ensureProcessedConditionReport(
    (card as any).user_condition_report,
    (card as any).user_condition_processed,
  );
  console.log(`condition report present: ${!!userConditionReport}`);

  const result: any = await gradeCardConversational(f!.signedUrl, b!.signedUrl, CARD_TYPE, { userConditionReport });
  const j = JSON.parse(result.markdown_report);
  const w = j.weighted_scores || {};
  console.log('\n════════ RESULT ════════');
  console.log(`final: ${result.extracted_grade?.decimal_grade} (${result.extracted_grade?.uncertainty})`);
  console.log(`subgrades: C=${w.centering_weighted} Co=${w.corners_weighted} E=${w.edges_weighted} S=${w.surface_weighted}`);
  console.log(`consensus notes: ${JSON.stringify(j.grading_passes?.consensus_notes || [])}`);
  const low = ['corners', 'edges', 'surface'].filter(c => (w[`${c}_weighted`] ?? 10) <= 8);
  if (low.length) {
    // acceptable only if a defect is recorded for it
    console.log(`categories <=8: ${low.join(',')} — check defect arrays above for justification`);
  } else {
    console.log('✓ no category <=8 without going through the evidence path');
  }
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
