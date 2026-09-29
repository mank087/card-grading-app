// One-off (Sept 29): complete Bob Alvestad's manual grade review for card f3d8b035
// (1995 Collector's Edge Yogi Berra) through the same builder + RPC as
// POST /api/admin/grade-reviews/[id]. Dry run by default; --apply writes.
import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { buildManualResult, manualVerdictSchema } from '../src/lib/gradeReview/manualReview';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const REVIEW_ID = 'bc9fc1f9-cc24-478f-8a44-06fb0bc2f2f3';
const APPLY = process.argv.includes('--apply');
const verdict = manualVerdictSchema.parse({
  verdict: 'propose_change',
  notes: "The front border is a printed marbled 'aged stone' design and the back is intentionally sepia-toned; both were misread as staining. Surface is clean apart from light handling; edges and corners show minor wear.",
  scores: { centering_front: 10, centering_back: 10, corners_front: 7, corners_back: 8, edges_front: 7, edges_back: 7, surface_front: 8, surface_back: 8 },
  cap: 10, structuralConfirmed: false,
});
(async () => {
  const { data: admins, error: aErr } = await db.from('admin_users').select('id,email').limit(10);
  if (aErr) throw aErr;
  console.log('admin users:', admins?.map(a => `${a.id} ${a.email}`));
  const adminId = process.argv.find(a => a.startsWith('--admin='))?.split('=')[1];
  const { data: review, error } = await db.from('card_grade_reviews').select('id,card_id,grade_run_id,review_mode,admin_reviewed_at,status').eq('id', REVIEW_ID).single();
  if (error) throw error;
  console.log('review:', review);
  if (review.card_id !== 'f3d8b035-9e1a-4c68-b808-4e2ac3aa733f' || review.review_mode !== 'manual' || review.admin_reviewed_at) throw Error('unexpected review state');
  const [{ data: card, error: cErr }, { data: run, error: rErr }] = await Promise.all([
    db.from('cards').select('*').eq('id', review.card_id).single(),
    db.from('card_grade_runs').select('snapshot').eq('id', review.grade_run_id).single()]);
  if (cErr || rErr) throw cErr || rErr;
  const correction = buildManualResult(card, run!.snapshot, REVIEW_ID, verdict);
  console.log('outcome:', (correction as any).outcome, '| grade', run!.snapshot.grade, '->', (correction as any).proposedGrade, '| patch keys:', Object.keys(correction.patch).join(', '));
  if (!APPLY) { console.log('Dry run. Nothing written.'); return; }
  if (!adminId || !admins?.some(a => a.id === adminId)) throw Error('pass --admin=<admin_users.id>');
  const { data, error: saveError } = await db.rpc('complete_manual_grade_review', { p_id: REVIEW_ID, p_admin_id: adminId, p_verdict: verdict.verdict, p_notes: verdict.notes, p_patch: correction.patch, p_expected: correction.expected });
  if (saveError) throw saveError;
  console.log('saved:', data);
})();
