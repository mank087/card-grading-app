/**
 * One-off corrections for customer Bob Alvestad's two Yogi Berra cards (Sept 28).
 * DRY RUN BY DEFAULT. Nothing is written without --apply.
 *
 *   npx tsx scripts/_tmp-fix-bob-yogi.ts                       # dry run, both steps
 *   npx tsx scripts/_tmp-fix-bob-yogi.ts --step=b --apply      # card B identity fix
 *   npx tsx scripts/_tmp-fix-bob-yogi.ts --step=a --apply      # open card A's review
 *
 * Step b (card df0ea3bc): identity only. Stored as a 1965 Topps; the photo is the
 * 1985 Topps #155 Yogi Berra (Yankees Manager, "(c) 1985 TOPPS" on the back, 1985
 * Yankees checklist). Only the year changes: set "Topps" and #155 are already right.
 * This card has NO card_grade_runs row, so the admin Manual Grade Review page cannot
 * be used for it. The patch is built by the SAME function the admin review uses
 * (buildDetailsPatch: columns, conversational_card_info, report card_info,
 * ai_grading "Card Information", label_data + original_label_data), guarded on the
 * row being unchanged since it was read, then prices are refreshed exactly as the
 * admin review does. No grade column is touched; the grade (6, centering) stands.
 *
 * Step a (card f3d8b035): does NOT change the grade. It only opens a manual review
 * row through the normal request_card_grade_review RPC (a "details" concern, which
 * the membership gate allows for every owner), so the owner can then propose the
 * grade change on /admin/grade-reviews/<id>, where the full ~12-column grade write,
 * narrative rewrite and customer acceptance are handled by the existing code.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { isDeepStrictEqual } from 'node:util';

const APPLY = process.argv.includes('--apply');
const STEP = (process.argv.find(a => a.startsWith('--step='))?.split('=')[1] ?? 'both') as 'a' | 'b' | 'both';
const USER_ID = '6cc6e18b-9a2f-48ce-8f9c-d6a82b447c40';
const CARD_A = 'f3d8b035-9e1a-4c68-b808-4e2ac3aa733f';
const CARD_B = 'df0ea3bc-5dff-4503-bc27-5569a6959fc7';
const CORRECTION_REF = 'owner-fix-2026-09-28-bob-yogi';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function stepB() {
  const { buildDetailsPatch } = await import('../src/lib/gradeReview/cardDetails');
  // select('*') like the admin review route: generateLabelData needs the grade and autograph columns, or the label loses them.
  const cols = '*';
  const { data: card, error } = await db.from('cards').select(cols).eq('id', CARD_B).single();
  if (error || !card) throw error ?? Error('card B not found');
  const row = card as unknown as Record<string, unknown>;
  if (row.user_id !== USER_ID || row.deleted_at) throw Error('card B owner/deleted mismatch; stop');
  if (row.release_date !== '1965') { console.log(`[B] release_date is ${row.release_date}, not 1965. Already fixed? Stopping.`); return; }

  // The card's own report stands in for the run snapshot (there is no run row).
  const { patch, expected, changes } = buildDetailsPatch(row, String(row.conversational_grading), { year: '1985' }, CORRECTION_REF);
  console.log('[B] changes:', changes);
  console.log('[B] columns written:', Object.keys(patch).join(', '));
  const label = patch.label_data as Record<string, unknown> | undefined;
  if (label) console.log('[B] new label contextLine:', label.contextLine, '| grade:', label.grade, '| designation:', label.designation);
  if (!APPLY) { console.log('[B] dry run. Re-run with --step=b --apply to write.'); return; }

  // Guard: re-read and require every patched column to still equal what we built from.
  const { data: again, error: againError } = await db.from('cards').select(Object.keys(expected).join(',')).eq('id', CARD_B).single();
  if (againError || !again) throw againError ?? Error('re-read failed');
  for (const [k, v] of Object.entries(expected)) {
    if (!isDeepStrictEqual((again as unknown as Record<string, unknown>)[k], v)) throw Error(`[B] ${k} changed since read; nothing written`);
  }
  const { data: written, error: writeError } = await db.from('cards').update(patch).eq('id', CARD_B).eq('release_date', '1965').select('id');
  if (writeError) throw writeError;
  if (!written?.length) throw Error('[B] guarded update matched no row; nothing written');
  console.log('[B] identity written.');

  const { refreshPricesAfterDetails } = await import('../src/lib/gradeReview/detailsPricing');
  const pricing = await refreshPricesAfterDetails(db, CARD_B, { materialChange: true });
  console.log('[B] pricing refresh:', pricing);
}

async function stepA() {
  const { data: card, error } = await db.from('cards').select('id,user_id,conversational_whole_grade,grade_status').eq('id', CARD_A).single();
  if (error || !card) throw error ?? Error('card A not found');
  if (card.user_id !== USER_ID) throw Error('card A owner mismatch; stop');
  const { data: run, error: runError } = await db.from('card_grade_runs').select('id').eq('card_id', CARD_A).eq('is_current', true).maybeSingle();
  if (runError || !run) throw runError ?? Error('card A has no current grade run');
  const { data: existing } = await db.from('card_grade_reviews').select('id,status').eq('grade_run_id', run.id).maybeSingle();
  if (existing) { console.log(`[A] review already exists: /admin/grade-reviews/${existing.id} (${existing.status})`); return; }
  console.log(`[A] grade ${card.conversational_whole_grade}, current run ${run.id}. Would open a manual review.`);
  if (!APPLY) { console.log('[A] dry run. Re-run with --step=a --apply to open the review.'); return; }
  const { data: reviewId, error: rpcError } = await db.rpc('request_card_grade_review', {
    p_card_id: CARD_A, p_user_id: USER_ID, p_run_id: run.id,
    p_concerns: [{ category: 'details', side: 'both' }],
    p_note: 'Opened by the DCM team after the customer emailed about this grade: the printed marbled border and sepia back were read as staining.',
    p_details: null,
  });
  if (rpcError) throw rpcError;
  console.log(`[A] review opened: https://dcmgrading.com/admin/grade-reviews/${reviewId}`);
}

(async () => {
  if (APPLY && STEP === 'both') throw Error('--apply needs --step=a or --step=b');
  console.log(APPLY ? '*** APPLY MODE ***' : '(dry run)');
  if (STEP === 'b' || STEP === 'both') await stepB();
  if (STEP === 'a' || STEP === 'both') await stepA();
})().catch(e => { console.error(e); process.exit(1); });
