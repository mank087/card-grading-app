import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const IDS = [
  ['1 Saddam (other)', '910dd3de-d62f-4996-9fd4-f338039668fd'],
  ['2 MJ JPEG (sports)', '917d6b3e-17de-466a-8a0e-167ff54455aa'],
  ['3 MJ camera (sports)', 'b98dc05b-db1d-4432-9095-84964d07eb49'],
  ['4 Andre JPEG (sports)', '848ddbc1-7327-47c5-96b4-ef5e5385ef4d'],
  ['5 Andre camera (other)', 'cd250fa5-e1d6-433b-b355-40233c83a89a'],
];

async function main() {
  for (const [label, id] of IDS) {
    const { data, error } = await supabase.from('cards').select('*').eq('id', id).single();
    console.log('\n' + '='.repeat(90));
    console.log(`CARD ${label}  id=${id}`);
    console.log('='.repeat(90));
    if (error) { console.log('ERROR:', error.message); continue; }
    const r: any = data;
    const show = (k: string) => { if (r[k] !== undefined) console.log(`  ${k}: ${typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]}`); };
    [
      'category','card_name','card_set','card_number','created_at',
      'conversational_evaluated_at','conversational_prompt_version',
      'conversational_whole_grade','conversational_decimal_grade','conversational_preliminary_grade',
      'conversational_grade_uncertainty','conversational_image_confidence',
      'conversational_sub_scores','conversational_weighted_sub_scores',
      'conversational_limiting_factor','conversational_condition_label',
      'capped_grade_reason','weighted_total_pre_cap',
      'conversational_defects_front','conversational_defects_back',
      'front_path','back_path','user_condition_report',
    ].forEach(show);

    // summary + full grading JSON (may be large)
    console.log('\n  --- conversational_summary ---');
    console.log('  ' + (r.conversational_summary || '(none)'));
    console.log('\n  --- conversational_grading (parsed keys) ---');
    let j: any = null;
    try { j = JSON.parse(r.conversational_grading); } catch { console.log('  (unparseable or null)'); }
    if (j) {
      console.log('  top-level keys:', Object.keys(j).join(', '));
      if (j.final_grade) console.log('  final_grade:', JSON.stringify(j.final_grade).slice(0, 1500));
      if (j.grading_passes) console.log('  grading_passes:', JSON.stringify(j.grading_passes).slice(0, 1500));
      // per-face category numbers + prose
      for (const face of ['front','back','front_analysis','back_analysis']) {
        if (j[face]) console.log(`  ${face}:`, JSON.stringify(j[face]).slice(0, 2000));
      }
      for (const cat of ['centering','corners','edges','surface']) {
        if (j[cat]) console.log(`  ${cat}:`, JSON.stringify(j[cat]).slice(0, 1200));
      }
      if (j.zoomAdjustments || j.zoom_adjustments) console.log('  zoom:', JSON.stringify(j.zoomAdjustments || j.zoom_adjustments).slice(0, 1500));
      if (j.structural_damage) console.log('  structural_damage:', JSON.stringify(j.structural_damage));
    }
  }
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
