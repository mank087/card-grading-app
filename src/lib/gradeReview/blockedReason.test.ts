import { blockedReason, type BlockedReasonInput } from './blockedReason';

const snapshot = { front_path: 'u/c/front.jpg', back_path: 'u/c/back.jpg', report: '{"a":1}', grade: 6 };
const base = (): BlockedReasonInput => ({
  review: { status: 'queued', requester_id: 'u1', admin_reviewed_at: null },
  run: { is_current: true, snapshot },
  card: { user_id: 'u1', deleted_at: null, ownership_status: 'owned', grade_status: 'complete',
    front_path: snapshot.front_path, back_path: snapshot.back_path, conversational_grading: snapshot.report, conversational_whole_grade: 6 },
});

describe('blockedReason', () => {
  it('is null for a review that can be completed', () => {
    expect(blockedReason(base())).toBeNull();
  });
  it('names a deleted card first (the Sept 2026 Ryan Williams case)', () => {
    const input = base();
    input.card!.deleted_at = '2026-09-22T16:47:55.116+00:00';
    expect(blockedReason(input)).toMatch(/owner deleted this card on 9\/22\/2026/);
  });
  it('explains re-grades, photo swaps, report changes and ownership', () => {
    const regraded = base(); regraded.run!.is_current = false;
    expect(blockedReason(regraded)).toMatch(/re-graded/);
    const photos = base(); photos.card!.front_path = 'u/c/front2.jpg';
    expect(blockedReason(photos)).toMatch(/replaced the card photos/);
    const report = base(); report.card!.conversational_whole_grade = 7;
    expect(blockedReason(report)).toMatch(/grade report changed/);
    const sold = base(); sold.card!.ownership_status = 'sold';
    expect(blockedReason(sold)).toMatch(/marked this card as sold/);
    const moved = base(); moved.card!.user_id = 'u2';
    expect(blockedReason(moved)).toMatch(/different account/);
  });
  it('does not block reviews that are already finished', () => {
    const done = base(); done.review.status = 'completed'; done.card!.deleted_at = '2026-09-22T16:47:55Z';
    expect(blockedReason(done)).toBeNull();
  });
});
