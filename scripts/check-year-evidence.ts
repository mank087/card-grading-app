/**
 * Regrades a few real sports cards and reports whether the model emits the new
 * year_text_seen / year_source evidence fields, and what the year guard does.
 * Read-only: nothing is written back to the DB.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { supabaseServer } from '../src/lib/supabaseServer';
import { gradeCardConversational } from '../src/lib/visionGrader';
import { checkYearEvidence } from '../src/lib/yearGuard';

const N = Number(process.argv[2] || 3);

async function main() {
  const { data, error } = await supabaseServer()
    .from('cards')
    .select('id, serial, category, front_path, back_path, release_date, card_set, featured')
    .eq('category', 'Sports')
    .not('front_path', 'is', null)
    .not('back_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(N);

  if (error) throw error;
  console.log(`Testing ${data!.length} recent sports cards\n`);

  for (const card of data!) {
    console.log(`── ${card.serial || card.id} — ${card.featured || '?'} / ${card.card_set || '?'} (stored year: ${card.release_date || 'none'})`);
    try {
      const [frontUrl, backUrl] = await Promise.all([
        supabaseServer().storage.from('cards').createSignedUrl(card.front_path!, 600),
        supabaseServer().storage.from('cards').createSignedUrl(card.back_path!, 600),
      ]);
      if (!frontUrl.data?.signedUrl || !backUrl.data?.signedUrl) {
        console.log('   ⚠️ could not sign image URLs\n');
        continue;
      }
      const result = await gradeCardConversational(frontUrl.data.signedUrl, backUrl.data.signedUrl, 'sports');
      const json = JSON.parse(result.markdown_report);
      const ci = json.card_info || {};
      const guard = checkYearEvidence(ci);
      console.log(`   year:            ${JSON.stringify(ci.year)}`);
      console.log(`   year_source:     ${JSON.stringify(ci.year_source)}   ${ci.year_source === undefined ? '❌ FIELD MISSING' : '✅'}`);
      console.log(`   year_text_seen:  ${JSON.stringify(ci.year_text_seen)} ${ci.year_text_seen === undefined ? '❌ FIELD MISSING' : '✅'}`);
      console.log(`   guard outcome:   ${guard.outcome}${guard.reason ? ` — ${guard.reason}` : ''}`);
      console.log(`   final year:      ${JSON.stringify(guard.year)}\n`);
    } catch (e: any) {
      console.log(`   ⚠️ grading failed: ${e.message}\n`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
