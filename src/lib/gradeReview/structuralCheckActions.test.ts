import { describe, expect, it } from 'vitest';
import { applyStructuralAction } from './structuralCheckActions';
import { buildStructuralCheck, structuralMirror, withStructuralCheckSentence } from './structuralCheck';

const capped = { centering_front: 9, centering_back: 10, corners_front: 9, corners_back: 9, edges_front: 9, edges_back: 9, surface_front: 4, surface_back: 4 };
function card(overrides: Record<string, unknown> = {}) {
  const check = buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: capped, preCapSurface: { front: 10, back: 9 }, evidence: 'crease' })!;
  const report = { raw_sub_scores: capped, grading_passes: { averaged_rounded: { centering: 9, corners: 9, edges: 9, surface: 4, final: 4 } },
    final_grade: { whole_grade: 4, summary: withStructuralCheckSentence('Final grade: 4.') }, structural_check: check };
  return { id: 'card-1', conversational_grading: JSON.stringify(report), conversational_whole_grade: 4, conversational_final_grade_summary: report.final_grade.summary,
    capture_quality: { structural_check: structuralMirror(check) }, label_data: { grade: 4 }, deleted_at: null, ...overrides };
}

/** Records every call; each table answers with the queued result. */
function mockDb(row: Record<string, unknown> | null, opts: { openReviews?: { id: string }[]; savedRows?: { id: string }[] } = {}) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const chain = (table: string, result: () => unknown) => {
    const q: any = {};
    for (const op of ['select', 'eq', 'in', 'limit', 'update']) q[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return q; };
    q.maybeSingle = async () => result();
    q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return q;
  };
  const db = { from(table: string) {
    if (table === 'card_grade_reviews') return chain(table, () => ({ data: opts.openReviews ?? [], error: null }));
    let updating = false;
    const q = chain(table, () => updating ? { data: opts.savedRows ?? [{ id: 'card-1' }], error: null } : { data: row, error: null });
    const update = q.update;
    q.update = (...args: unknown[]) => { updating = true; return update(...args); };
    return q;
  } };
  return { db, calls };
}

describe('applyStructuralAction', () => {
  it('clears the cap with a guarded write of the manual-review patch', async () => {
    const { db, calls } = mockDb(card());
    const result = await applyStructuralAction(db, 'card-1', 'clear', 'admin-1');
    expect(result).toEqual({ ok: true, status: 200, beforeGrade: 4, afterGrade: 9, uncappedGrade: 9 });
    const update = calls.find(c => c.op === 'update')!;
    const patch = update.args[0] as Record<string, any>;
    expect(patch.conversational_whole_grade).toBe(9);
    expect(JSON.parse(patch.conversational_grading).structural_check.status).toBe('cleared');
    expect(patch.capture_quality.structural_check.status).toBe('cleared');
    const guards = calls.filter(c => c.table === 'cards' && c.op === 'eq').map(c => c.args);
    expect(guards).toContainEqual(['conversational_whole_grade', 4]);
  });

  it('confirms without touching the grade', async () => {
    const { db, calls } = mockDb(card());
    expect(await applyStructuralAction(db, 'card-1', 'confirm', 'admin-1')).toMatchObject({ ok: true, beforeGrade: 4, afterGrade: 4 });
    const patch = calls.find(c => c.op === 'update')!.args[0] as Record<string, any>;
    expect(patch).not.toHaveProperty('conversational_whole_grade');
    expect(patch.conversational_final_grade_summary).toBe('Final grade: 4. Our team confirmed the crease.');
  });

  it('reports a lost race as stale', async () => {
    const { db } = mockDb(card(), { savedRows: [] });
    expect(await applyStructuralAction(db, 'card-1', 'clear', 'admin-1')).toMatchObject({ ok: false, status: 409, stale: true });
  });

  it('defers to an open manual grade review', async () => {
    const { db, calls } = mockDb(card(), { openReviews: [{ id: 'review-9' }] });
    expect(await applyStructuralAction(db, 'card-1', 'clear', 'admin-1')).toMatchObject({ ok: false, status: 409 });
    expect(calls.some(c => c.op === 'update')).toBe(false);
  });

  it('marks a mirror stale when the report is no longer pending', async () => {
    const { db, calls } = mockDb(card({ conversational_grading: '{"final_grade":{"whole_grade":8}}', conversational_whole_grade: 8 }));
    expect(await applyStructuralAction(db, 'card-1', 'confirm', 'admin-1')).toMatchObject({ ok: false, status: 409, stale: true });
    const patch = calls.find(c => c.op === 'update')!.args[0] as Record<string, any>;
    expect(patch).toEqual({ capture_quality: { structural_check: expect.objectContaining({ status: 'stale' }) } });
  });

  it('404s a missing or deleted card', async () => {
    expect(await applyStructuralAction(mockDb(null).db, 'card-1', 'confirm', 'a')).toMatchObject({ status: 404 });
    expect(await applyStructuralAction(mockDb(card({ deleted_at: '2026-10-01' })).db, 'card-1', 'confirm', 'a')).toMatchObject({ status: 404 });
  });
});
