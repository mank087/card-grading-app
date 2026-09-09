import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { canRequestReview, ownsReviewCard } from '@/lib/gradeReview/eligibility';
import { gradeReviewEnabled, hasDetailsClaim, reviewRequestSchema, type ReviewChange } from '@/lib/gradeReview/types';
import { hasManualReviewAccess } from '@/lib/gradeReview/manualReview';

const fields = 'id, requested_at, status, concerns, note, customer_result, outcome, completed_at, original_grade, proposed_grade, owner_decision, decided_at, details_claim, details_changes, details_applied_at';
const patchFields = `${fields}, pending_patch, applied_patch`;

/** Which face scores a proposed (or accepted) correction changes, so the owner sees only what moved. */
function summarizeChanges(review: Record<string, unknown>, snapshotReport: unknown): ReviewChange[] {
  const applied = review.applied_patch as Record<string, unknown> | null;
  const patch = applied && Object.keys(applied).length ? applied : review.pending_patch as Record<string, unknown> | null;
  const after = patch?.conversational_sub_scores as Record<string, Record<string, unknown>> | undefined;
  if (!after) return [];
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(String(snapshotReport))?.raw_sub_scores ?? {}; } catch { /* legacy report shape: no per-face baseline */ }
  const changes: ReviewChange[] = [];
  for (const category of ['centering', 'corners', 'edges', 'surface'] as const) for (const side of ['front', 'back'] as const) {
    const from = raw[`${category}_${side}`], to = after[category]?.[side];
    if (typeof from === 'number' && typeof to === 'number' && from !== to) changes.push({ category, side, from, to });
  }
  return changes;
}
function publicReview(review: Record<string, unknown> | null, snapshotReport: unknown) {
  if (!review) return null;
  const { pending_patch: _pending, applied_patch: _applied, ...rest } = review;
  return { ...rest, changes: summarizeChanges(review, snapshotReport) };
}
const privateHeaders = { 'Cache-Control': 'private, no-store' };
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) return json({ error: 'Please sign in.' }, 401);
    const { id } = await params;
    if (!isUuid(id)) return json({ error: 'Card not found.' }, 404);
    // Before migration/rollout, the endpoint remains harmless and the UI hidden.
    const enabled = gradeReviewEnabled();
    if (!enabled && process.env.GRADE_REVIEW_HISTORY_ENABLED !== 'true') return json({ enabled: false, eligible: false, gradeRunId: null, review: null });
    const db = supabaseServer();
    const { data: card, error } = await db.from('cards')
      .select('user_id, deleted_at, ownership_status, grade_status, conversational_whole_grade, conversational_grading, front_path, back_path, conversational_card_info')
      .eq('id', id).maybeSingle();
    if (error) throw error;
    if (!card || !ownsReviewCard(card, auth.userId)) return json({ error: 'Card not found.' }, 404);
    const { data: run, error: runError } = await db.from('card_grade_runs')
      .select('id, grader_user_id, snapshot').eq('card_id', id).eq('is_current', true).maybeSingle();
    if (runError) throw runError;
    if (!run || run.grader_user_id !== auth.userId) {
      return json({ enabled, eligible: false, gradeRunId: null, review: null });
    }
    const { data: review, error: reviewError } = await db.from('card_grade_reviews')
      .select(patchFields).eq('grade_run_id', run.id).eq('requester_id', auth.userId).maybeSingle();
    if (reviewError) throw reviewError;
    const { data: credits, error: creditsError } = await db.from('user_credits').select('is_vip,is_card_lover,card_lover_current_period_end').eq('user_id',auth.userId).maybeSingle();
    if(creditsError) throw creditsError;
    const membershipEligible=hasManualReviewAccess(credits);
    const canRequest = enabled && !review && canRequestReview(card, auth.userId, run.grader_user_id);
    const info = (() => { const v = (card as Record<string, unknown>).conversational_card_info; try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } })() as Record<string, unknown> | null;
    const rawConfidence = info?.identification_confidence;
    const identificationConfidence = rawConfidence === 'high' || rawConfidence === 'medium' || rawConfidence === 'low' ? rawConfidence : null;
    return json({ enabled, membershipEligible, eligible: canRequest && membershipEligible, detailsEligible: canRequest, identificationConfidence, gradeRunId: run.id, review: publicReview(review, (run.snapshot as Record<string, unknown> | null)?.report) });
  } catch {
    return json({ error: 'Unable to load grade review information. Please try again.' }, 503);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) return json({ error: 'Please sign in.' }, 401);
    if (!gradeReviewEnabled()) return json({ error: 'Grade review requests are not available yet.' }, 503);
    const { id } = await params;
    if (!isUuid(id)) return json({ error: 'Card not found.' }, 404);
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: 'Review request is too long.' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid review request.' }, 400); }
    const parsed = reviewRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'Select your concerns and keep your note under 1,000 characters.' }, 400);
    const db = supabaseServer();
    const details = hasDetailsClaim(parsed.data.details) ? Object.fromEntries(Object.entries(parsed.data.details!).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()])) : null;
    const concerns = [
      ...(parsed.data.reviewGrade ? ['centering','corners','edges','surface'].map(category => ({category,side:'both'})) : []),
      ...(details ? [{ category: 'details', side: 'both' }] : []),
    ];
    const { data: reviewId, error } = await db.rpc('request_card_grade_review', {
      p_card_id: id, p_user_id: auth.userId, p_run_id: parsed.data.gradeRunId,
      p_concerns: concerns, p_note: parsed.data.note, p_details: details,
    });
    if (error) {
      if (error.message.includes('review_membership_required')) return json({ error: 'Manual grade reviews are available to VIP purchasers and active Card Lovers members.' }, 403);
      if (error.message.includes('review_not_available')) return json({ error: 'This grade is no longer available for review. Refresh the card to see its current status.' }, 409);
      if (error.message.includes('invalid_review')) return json({ error: 'Invalid review request.' }, 400);
      throw error;
    }
    const { data: review, error: readError } = await db.from('card_grade_reviews')
      .select(fields).eq('id', reviewId).eq('requester_id', auth.userId).single();
    if (readError) throw readError;
    return json({ review }, 202);
  } catch {
    // The insertion may already have committed; resubmission safely returns it.
    return json({ error: 'Unable to confirm your request. Please try again; a repeat submission will not create another review.' }, 503);
  }
}
