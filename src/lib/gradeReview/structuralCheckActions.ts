/**
 * Admin resolution of a structural-cap check (POST /api/admin/structural-checks/[id]).
 * Kept apart from the route so the whole read-build-guarded-write sequence can be
 * tested with a mock client.
 */
import { buildStructuralClear, buildStructuralConfirm, pendingStructuralCheck, type StructuralPatch } from './structuralCheck';

/** The slice of the Supabase client this uses. */
export interface StructuralDb {
  from(table: string): any;
}
export type StructuralActionResult =
  | { ok: true; status: 200; beforeGrade: number; afterGrade: number; uncappedGrade: number }
  | { ok: false; status: number; error: string; stale?: boolean };

const OPEN_REVIEW = ['queued', 'processing', 'awaiting_owner'];

export async function applyStructuralAction(db: StructuralDb, cardId: string, action: 'confirm' | 'clear', adminId: string, notes?: string): Promise<StructuralActionResult> {
  // The correction builder only patches columns the row carries, so read the full row.
  const { data: card, error } = await db.from('cards').select('*').eq('id', cardId).maybeSingle();
  if (error) throw error;
  if (!card || card.deleted_at) return { ok: false, status: 404, error: 'Card not found.' };

  if (!pendingStructuralCheck(card.conversational_grading)) {
    // The list reads a mirror; a regrade or an already-resolved check leaves it behind.
    const cq = card.capture_quality && typeof card.capture_quality === 'object' ? card.capture_quality : null;
    if (cq?.structural_check?.status === 'pending') {
      await db.from('cards').update({ capture_quality: { ...cq, structural_check: { ...cq.structural_check, status: 'stale' } } }).eq('id', cardId);
    }
    return { ok: false, status: 409, stale: true, error: 'This card no longer has a pending structural check (it was re-graded or already resolved). It has been removed from the list.' };
  }

  // A customer's manual review compares the card against its grade snapshot; editing
  // the report under it would block that review. Resolve it there instead.
  const { data: open, error: reviewError } = await db.from('card_grade_reviews').select('id').eq('card_id', cardId).in('status', OPEN_REVIEW).limit(1);
  if (reviewError) throw reviewError;
  if (open?.length) return { ok: false, status: 409, error: `This card has an open manual grade review (${open[0].id}). Resolve it from Grade Reviews instead.` };

  let built: StructuralPatch;
  try {
    built = action === 'confirm' ? buildStructuralConfirm(card, adminId) : buildStructuralClear(card, adminId, notes);
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    return { ok: false, status: 409, error: code === 'no_uncapped_scores'
      ? 'This report has no uncapped face scores to restore. Use Grade Reviews to correct it by hand.'
      : 'The report could not be corrected automatically. Reload and try again, or correct it from Grade Reviews.' };
  }
  // Optimistic guard: only write over the grade this check was built against.
  const { data: saved, error: saveError } = await db.from('cards').update(built.patch).eq('id', cardId)
    .eq('conversational_whole_grade', built.expectedGrade).select('id');
  if (saveError) throw saveError;
  if (!saved?.length) return { ok: false, status: 409, stale: true, error: 'The card changed while you were reviewing it. Reload and try again.' };
  return { ok: true, status: 200, beforeGrade: built.expectedGrade, afterGrade: built.afterGrade, uncappedGrade: built.check.uncapped_grade };
}
