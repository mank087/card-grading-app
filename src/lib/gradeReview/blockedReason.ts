/**
 * Why a manual grade review can no longer be completed, in words an admin can
 * act on. Mirrors the "stale" conditions in complete_manual_grade_review
 * (supabase/migrations/20260908_grade_review_narrative_columns.sql); the RPC
 * only answers {stale:true}, which told the admin nothing. Sept 2026: a
 * customer requested a review, re-graded the card out of its holder, and
 * deleted the original; the queue kept offering the review and every submit
 * failed as "stale".
 */

export interface BlockedReasonInput {
  review: { status: string; requester_id: string; admin_reviewed_at?: string | null };
  run: { is_current: boolean; snapshot: { front_path?: unknown; back_path?: unknown; report?: unknown; grade?: unknown } } | null;
  card: {
    user_id?: string | null; deleted_at?: string | null; ownership_status?: string | null; grade_status?: string | null;
    front_path?: string | null; back_path?: string | null; conversational_grading?: unknown; conversational_whole_grade?: number | null;
  } | null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** null when the review can still be completed. Pure. */
export function blockedReason({ review, run, card }: BlockedReasonInput): string | null {
  if (review.admin_reviewed_at || !['queued', 'processing'].includes(review.status)) return null;
  if (!card) return 'The card no longer exists.';
  if (card.deleted_at) {
    return `The owner deleted this card on ${new Date(card.deleted_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET. There is nothing to publish a verdict on; close the review.`;
  }
  if (card.user_id !== review.requester_id) return 'The card now belongs to a different account.';
  if ((card.ownership_status ?? 'owned') !== 'owned') return `The owner marked this card as ${card.ownership_status}.`;
  if (card.grade_status !== 'complete') return 'The card is being re-graded right now. Reload once grading finishes.';
  if (!run?.is_current) return 'The card was re-graded after this review was requested, so this grade is no longer the card\'s grade.';
  if (!same(card.front_path, run.snapshot.front_path) || !same(card.back_path, run.snapshot.back_path)) return 'The owner replaced the card photos after requesting the review.';
  if (!same(card.conversational_grading, run.snapshot.report) || !same(card.conversational_whole_grade, run.snapshot.grade)) {
    return 'The grade report changed after the review was requested (for example a correction or re-grade).';
  }
  return null;
}
