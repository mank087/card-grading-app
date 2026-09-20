/**
 * End-to-end check of the v9.26 evidence rule with the real grader. Same safety as
 * scripts/eval-e2e-identity.ts: a random UUID routing key, so every side write touches zero rows.
 * Usage: npx tsx scripts/eval-e2e-confidence.ts <cardId> [cardId...]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '../../.env.local' });
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const engineType = (category: string) => {
  const c = (category || '').toLowerCase();
  if (['football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling', 'sports'].includes(c)) return 'sports';
  return ({ pokemon: 'pokemon', mtg: 'mtg', lorcana: 'lorcana', 'one piece': 'onepiece', 'yu-gi-oh': 'yugioh' } as Record<string, string>)[c] || 'other';
};

(async () => {
  const { gradeCardConversational } = await import('../src/lib/visionGrader');
  const ids = process.argv.slice(2);
  console.log = console.warn = console.info = () => {};
  await Promise.all(ids.map(async id => {
    try {
      const { data: card } = await db.from('cards').select('id, category, sub_category, front_path, back_path, conversational_whole_grade, conversational_image_confidence').eq('id', id).maybeSingle();
      if (!card) throw new Error('not found');
      const f = await db.storage.from('cards').createSignedUrl(card.front_path, 3600), b = await db.storage.from('cards').createSignedUrl(card.back_path, 3600);
      const result = await gradeCardConversational(f.data!.signedUrl, b.data!.signedUrl, engineType(card.category) as any, { routingKey: randomUUID(), categoryHint: card.sub_category || undefined } as any);
      const j = JSON.parse(result.markdown_report); const gp = j.grading_passes || {};
      process.stdout.write(`${id.slice(0, 8)} stored ${card.conversational_whole_grade} (${card.conversational_image_confidence}) -> now ${result.extracted_grade?.whole_grade ?? result.extracted_grade?.decimal_grade} | letter ${j.image_quality?.confidence_letter} | uncertainty ${j.image_quality?.grade_uncertainty} | coverage overrode letter: ${j.image_quality?.coverage_supports_grade === true} | passes ${[gp.pass_1?.final, gp.pass_2?.final, gp.pass_3?.final].join('/')} | hold: ${gp.grade_hold ? gp.grade_hold.cause : 'none'}\n`);
    } catch (e: any) { process.stdout.write(`${id.slice(0, 8)} ERROR ${String(e?.message || e).slice(0, 160)}\n`); }
  }));
})();
