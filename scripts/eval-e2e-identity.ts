/**
 * End-to-end check of identification + grade on known cards, with the CURRENT branch's grader.
 *
 * Runs the real gradeCardConversational (ensemble, zoom, independent identification, first
 * look, the blank-number fill) and then the same cardNumberGuard the category routes apply.
 *
 * NOTHING IS WRITTEN TO A CUSTOMER'S CARD. The grader's side writes (first_look,
 * cv_centering, capture_quality, grading model) are all `update ... where id = routingKey`,
 * so each run passes a random UUID that matches no row: first look runs for real, and
 * every write touches zero rows. Reads are one light row per card plus signed photo URLs.
 *
 * Usage: npx tsx scripts/eval-e2e-identity.ts [concurrency=3]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '../../.env.local' });
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';

const CONC = Number(process.argv[2] || 3);
const OUT = '../../grading-work/e2e-identity-2026-09-20/';
const RUNS = OUT + 'runs.jsonl';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Owner-confirmed Wonder Bread Star Wars cards, so there is real truth for set and number. */
const WONDER_BREAD = [
  { blindId: 'WB1', id: '446c2889-236f-45da-bb37-31efe52a04dd' },
  { blindId: 'WB4', id: '1d99d141-7769-436f-b85e-1f82ba86c653' },
  { blindId: 'WB5', id: '55bfab9e-fe16-41ec-b41f-db46e3af9698' },
];
const GUARDED = new Set(['sports', 'other', 'starwars', 'yugioh']);
/** cards.category -> the grader's card type, as src/app/api/vision-grade maps it. */
const engineType = (category: string, sub: string | null): string => {
  const c = (category || '').toLowerCase();
  if (['football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling', 'sports'].includes(c)) return 'sports';
  if (c === 'pokemon') return 'pokemon';
  if (c === 'mtg') return 'mtg';
  if (c === 'lorcana') return 'lorcana';
  if (c === 'one piece') return 'onepiece';
  if (c === 'yu-gi-oh') return 'yugioh';
  return 'other';
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { gradeCardConversational } = await import('../src/lib/visionGrader');
  const { applyCardNumberGuard } = await import('../src/lib/cardNumberGuard');

  const calibration = JSON.parse(readFileSync('../../grading-work/phase1-shadow-2026-09-17/labeled18-manifest.json', 'utf8')).cases
    .map((c: any) => ({ blindId: c.blindId, id: c.id }));
  const done = new Set(existsSync(RUNS) ? readFileSync(RUNS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.outcome !== 'error').map(r => r.blindId) : []);
  const jobs = [...calibration, ...WONDER_BREAD].filter(j => !done.has(j.blindId));
  process.stdout.write(`cards: ${calibration.length + WONDER_BREAD.length} | to run: ${jobs.length}\n`);

  // The grader logs heavily; this run reports through process.stdout only.
  console.log = console.warn = console.info = () => {};
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const started = Date.now();
      const row: any = { ...job };
      try {
        const { data: card, error } = await db.from('cards')
          .select('id, category, sub_category, front_path, back_path, card_name, featured, card_set, card_number, release_date, manufacturer_name, conversational_whole_grade, identity_confirmed_at')
          .eq('id', job.id).maybeSingle();
        if (error || !card) throw new Error(`card row unavailable: ${error?.message || 'not found'}`);
        const { data: f } = await db.storage.from('cards').createSignedUrl(card.front_path, 3600);
        const { data: b } = await db.storage.from('cards').createSignedUrl(card.back_path, 3600);
        if (!f?.signedUrl || !b?.signedUrl) throw new Error('signed URL failed');
        const type = engineType(card.category, card.sub_category);
        row.category = card.category; row.type = type; row.owner_confirmed = !!card.identity_confirmed_at;
        row.stored = { grade: card.conversational_whole_grade, card_name: card.card_name, featured: card.featured, set: card.card_set, number: card.card_number, year: card.release_date, manufacturer: card.manufacturer_name };

        const result = await gradeCardConversational(f.signedUrl, b.signedUrl, type as any, { routingKey: randomUUID(), categoryHint: card.sub_category || undefined } as any);
        const json = JSON.parse(result.markdown_report);
        const info = json.card_info || {};
        row.filled_from_first_look = info.card_number_source === 'first_look';
        row.number_before_guard = info.card_number ?? null;
        if (GUARDED.has(type)) row.guard = applyCardNumberGuard(info, `e2e/${job.blindId}`, { category: type === 'sports' ? 'Sports' : type === 'yugioh' ? 'Yu-Gi-Oh' : 'Other' }).outcome;
        row.outcome = 'graded';
        row.now = { grade: result.extracted_grade?.whole_grade ?? result.extracted_grade?.decimal_grade ?? null, card_name: info.card_name ?? null, featured: info.player_or_character ?? null, set: info.set_name ?? null, number: info.card_number ?? null, year: info.year ?? null, manufacturer: info.manufacturer ?? null, confidence: info.identification_confidence ?? null };
      } catch (e: any) {
        row.outcome = e?.name === 'IncompleteInspectionError' ? 'incomplete' : 'error';
        row.reason = String(e?.message || e).slice(0, 300);
      }
      row.seconds = Math.round((Date.now() - started) / 1000);
      appendFileSync(RUNS, JSON.stringify(row) + '\n');
      process.stdout.write(`${job.blindId}: ${row.outcome}${row.now ? ` grade ${row.now.grade} (stored ${row.stored.grade}) | #${row.now.number}${row.filled_from_first_look ? ' [FILLED from first look]' : ''} (stored #${row.stored.number})` : ' ' + (row.reason || '')} (${row.seconds}s)\n`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
}
main().catch(e => { process.stderr.write(String(e?.stack || e) + '\n'); process.exit(1); });
