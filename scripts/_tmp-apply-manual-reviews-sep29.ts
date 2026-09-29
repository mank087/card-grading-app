/**
 * One-off (Sept 29 2026): apply the 14 open manual grade reviews, reviewed by
 * hand from the photos. Mirrors POST /api/admin/grade-reviews/[id] step for
 * step (close, details RPC, buildManualResult + complete_manual_grade_review,
 * price refresh after a details change). Dry run by default; --apply writes.
 */
import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { buildManualResult, manualVerdictSchema } from '../src/lib/gradeReview/manualReview';
import { buildDetailsPatch } from '../src/lib/gradeReview/cardDetails';
import { refreshPricesAfterDetails } from '../src/lib/gradeReview/detailsPricing';
import { blockedReason } from '../src/lib/gradeReview/blockedReason';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ADMIN_ID = '4740b08b-a979-45f4-a23a-1f6736c3480d';
const APPLY = process.argv.includes('--apply');

type Scores = [number, number, number, number, number, number, number, number]; // C f/b, Co f/b, E f/b, S f/b
const scores = (s: Scores) => ({ centering_front: s[0], centering_back: s[1], corners_front: s[2], corners_back: s[3], edges_front: s[4], edges_back: s[5], surface_front: s[6], surface_back: s[7] });

interface Plan { id: string; card: string; close?: true; verdict?: 'confirm' | 'clarify' | 'propose_change'; notes?: string; s?: Scores; details?: Record<string, string> }
const PLANS: Plan[] = [
  { id: '0e9fd548-d81a-44e2-b119-f612077a6c1e', card: '1989 Fleer Jordan (deleted)', close: true },
  { id: 'e9edd3e9-2115-4acb-a07e-c2cb90abb2e2', card: '1998 SPx Kobe (deleted)', close: true },
  { id: '5fc230ba-3d3b-4988-b605-df03fbaa90c9', card: '2014 Topps Chrome 85 Adams', verdict: 'propose_change', s: [10, 10, 9, 9, 9, 9, 10, 9],
    notes: "We re-examined your card by hand. The back corner we flagged is sharp, and the marks we called edge whitening are light reflecting off the glossy edge, so we've raised your grade to 9." },
  { id: '98655c44-ed9e-4e7f-8226-dc58549d5f66', card: '2014 Score Adams', verdict: 'propose_change', s: [10, 10, 9, 9, 9, 9, 10, 10],
    notes: "We reviewed your card by hand. The edge wear in the report was actually the printed foil stripe in the card's design, not damage, and your corners are sharp, so we've raised your grade to 9." },
  { id: 'f77fe7a9-f3ba-49ab-a00c-be21b7ca702d', card: '1981 Topps McHale', verdict: 'propose_change', s: [10, 10, 8, 8, 7, 7, 8, 8],
    notes: "On review, the DCM team found the corners sharp and the back's color variation to be normal for this 1981 card stock, not staining. The grade is limited by the rough factory cut along the front left edge, so we've raised it to 7." },
  { id: '1700bc92-a681-4dba-b490-fc5731b0617a', card: '1976 Topps Hank Aaron', verdict: 'propose_change', s: [9, 10, 7, 7, 7, 7, 7, 7],
    notes: "We had a person review your 1976 Topps Hank Aaron (#550). The corners show only light softening and the specks on the front are normal for 1976 printing, so we've raised the grade to 7. Your card details were already correct; the numbers in your request don't appear on the card, so we left them unchanged." },
  { id: 'e7d75cae-3570-484b-b973-0d80868ac3d3', card: '2014 Topps Chrome Refractor Adams', verdict: 'clarify',
    notes: 'The DCM team re-checked your card. The corners look sharp and a surface note in your report had been filed under a corner by mistake. The 9 stands because refractor glare in the photos limits how closely we can confirm a 10.' },
  { id: 'ad43f57d-cda0-4121-ba15-b960f2a43f92', card: '2014 Topps (Chrome) Mike Evans', verdict: 'clarify',
    notes: "The DCM team found no specific defect on this card: corners, edges and centering all look excellent. The grade stays at 9 because a Gem Mint 10 on a chrome finish needs a flawless surface confirmed, and fine surface lines can't be ruled out from photos." },
  { id: 'b2e8b6cb-8649-42ff-b3c2-07c3f3df06fe', card: '2014 Topps Strata Mike Evans', verdict: 'clarify',
    notes: 'The DCM team confirmed the 8. The limiting factor is a rough cut with small white nicks along the front left edge; the corners themselves are sharp.' },
  { id: '24c3e9e9-4a66-4856-b34f-667ecb3daeff', card: '2004 Fleer Tradition Brady', verdict: 'clarify',
    notes: 'The DCM team confirmed the 9. Corners, edges and surface are clean; the limiting factor is front centering, which measures about 60/40 top to bottom (bottom border wider) rather than the 52/48 first reported.' },
  { id: '92dfd8ec-1b9b-44d0-84e4-a7f3c082e161', card: '2014 Topps Platinum Adams', verdict: 'confirm',
    notes: "The DCM team checked all four corners, edges and both surfaces by hand. The card is in excellent shape and the 9 stands; the photos can't show enough to support a 10." },
  { id: '1c1ee4b5-c19c-4f06-8a5c-f9b2e79e42c5', card: '2014 Topps Chrome Adams (chips)', verdict: 'confirm',
    notes: 'We reviewed your card by hand and confirmed small chips along the top front edge near the upper-left corner, which is common on chrome cards. Your grade of 8 stands.' },
  { id: '1a8f7f92-14e1-470a-9fe8-a569e30a1df0', card: '2014 Topps Chrome Adams', verdict: 'confirm',
    notes: 'The DCM team checked all four corners, edges and surfaces by hand. The card is in excellent condition and the 9 stands; minor flecks along the top edge keep it from a 10.' },
  { id: '01a211e0-eaa4-4489-88e7-6231a2d4e3d8', card: 'Eevee SVP 173', verdict: 'confirm', details: { year: '2025', card_number: '173' },
    notes: "Thanks for flagging this. Your Eevee is the SVP 173 black-star promo from 2025, so we've corrected the year and card number. It's a promo rather than a card in the Prismatic Evolutions set, so the set name stays Scarlet & Violet Promos, and your grade of 10 is unchanged." },
];

async function load(id: string) {
  const { data: review, error } = await db.from('card_grade_reviews')
    .select('id,card_id,grade_run_id,review_mode,admin_reviewed_at,details_applied_at,status,requester_id').eq('id', id).single();
  if (error) throw error;
  const [{ data: card, error: cErr }, { data: run, error: rErr }] = await Promise.all([
    db.from('cards').select('*').eq('id', review.card_id).maybeSingle(),
    db.from('card_grade_runs').select('snapshot,is_current').eq('id', review.grade_run_id).single()]);
  if (cErr || rErr) throw cErr || rErr;
  return { review, card, run };
}

(async () => {
  console.log(APPLY ? '*** APPLY ***' : '(dry run)');
  for (const p of PLANS) {
    const tag = `${p.id.slice(0, 8)} ${p.card}`;
    const { review, card, run } = await load(p.id);
    if (review.review_mode !== 'manual' || review.admin_reviewed_at || !['queued', 'processing'].includes(review.status)) { console.log(`${tag}: SKIP (already handled: ${review.status})`); continue; }
    const blocked = blockedReason({ review: review as any, run: run as any, card: card as any });

    if (p.close) {
      if (!blocked) { console.log(`${tag}: NOT blocked, refusing to close`); continue; }
      if (!APPLY) { console.log(`${tag}: would close (${blocked})`); continue; }
      const { data: closed, error } = await db.from('card_grade_reviews').update({ status: 'superseded', lease_token: null, lease_expires_at: null })
        .eq('id', p.id).in('status', ['queued', 'processing']).is('admin_reviewed_at', null).select('id');
      if (error) throw error;
      if (closed?.length) {
        const { error: evErr } = await db.from('card_grade_review_events').insert({ review_id: p.id, event_type: 'admin_closed_blocked', actor_id: ADMIN_ID, metadata: { reason: blocked } });
        if (evErr) console.error(`${tag}: event insert failed`, evErr.message);
      }
      console.log(`${tag}: closed`);
      continue;
    }
    if (blocked) { console.log(`${tag}: BLOCKED (${blocked}), skipping`); continue; }

    const verdict = manualVerdictSchema.parse(p.verdict === 'propose_change'
      ? { verdict: p.verdict, notes: p.notes, scores: scores(p.s!), cap: 10, structuralConfirmed: false }
      : { verdict: p.verdict, notes: p.notes });

    let cardNow = card!, runNow = run!, detailsApplied = false;
    if (p.details && !review.details_applied_at) {
      const details = buildDetailsPatch(cardNow as Record<string, unknown>, runNow.snapshot.report, p.details, p.id);
      console.log(`${tag}: details changes`, JSON.stringify(details.changes));
      if (APPLY) {
        const { data: applied, error } = await db.rpc('apply_grade_review_details', { p_id: p.id, p_admin_id: ADMIN_ID, p_patch: details.patch, p_expected: details.expected, p_changes: details.changes });
        if (error) throw error;
        if (applied?.stale) { console.log(`${tag}: details STALE, stopping this review`); continue; }
        detailsApplied = true;
        ({ card: cardNow, run: runNow } = await load(p.id) as any);
      }
    }

    const correction = buildManualResult(cardNow as Record<string, unknown>, runNow.snapshot, p.id, verdict) as any;
    const after = correction.proposedGrade ?? runNow.snapshot.grade;
    if (!APPLY) { console.log(`${tag}: ${verdict.verdict} -> ${correction.outcome}, grade ${runNow.snapshot.grade} -> ${after}`); continue; }
    const { data, error } = await db.rpc('complete_manual_grade_review', { p_id: p.id, p_admin_id: ADMIN_ID, p_verdict: verdict.verdict, p_notes: verdict.notes, p_patch: correction.patch, p_expected: correction.expected });
    if (error) throw error;
    if (data?.stale) { console.log(`${tag}: STALE, not saved`); continue; }
    const pricing = detailsApplied ? await refreshPricesAfterDetails(db as any, review.card_id, { materialChange: true }).catch(e => ({ error: String(e) })) : null;
    console.log(`${tag}: saved ${verdict.verdict}, grade ${runNow.snapshot.grade} -> ${after}`, JSON.stringify(data), pricing ? `pricing ${JSON.stringify(pricing)}` : '');
  }
})().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
