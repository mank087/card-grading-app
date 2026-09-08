import { describe, expect, it } from 'vitest';
import { canRequestReview, type ReviewCard } from './eligibility';
import { reviewRequestSchema } from './types';

const card: ReviewCard = {
  user_id: 'owner', deleted_at: null, ownership_status: 'owned', grade_status: 'complete',
  conversational_whole_grade: 8, conversational_grading: '{}', front_path: 'front.jpg', back_path: 'back.jpg',
};

describe('grade review eligibility', () => {
  it('requires the current owner to also be the grading owner', () => {
    expect(canRequestReview(card, 'owner', 'owner')).toBe(true);
    expect(canRequestReview(card, 'visitor', 'owner')).toBe(false);
    expect(canRequestReview(card, 'owner', 'previous-owner')).toBe(false);
    expect(canRequestReview(card, 'owner', null)).toBe(false);
  });
  it.each([
    { deleted_at: '2026-09-06' }, { ownership_status: 'sold' }, { ownership_status: 'archived' },
    { grade_status: 'processing:2026-09-06' }, { grade_status: 'failed' },
    { conversational_whole_grade: null }, { conversational_whole_grade: 0 },
    { front_path: null }, { back_path: null }, { conversational_grading: null },
  ])('rejects unavailable evidence/state: %j', patch => {
    expect(canRequestReview({ ...card, ...patch }, 'owner', 'owner')).toBe(false);
  });
});

describe('grade review request validation', () => {
  const input = { gradeRunId: 'c38c3452-a535-4e3a-9a2c-eebdd1aef5f6', concerns: [{ category: 'centering', side: 'front' }], note: '  Check the border.  ' };
  it('accepts a scoped concern and trims notes', () => {
    expect(reviewRequestSchema.parse(input).note).toBe('Check the border.');
  });
  it.each([
    { concerns: [] }, { concerns: [...input.concerns, ...input.concerns] },
    { concerns: [{ category: 'price', side: 'front' }] },
    { concerns: [{ category: 'centering', side: 'left' }] },
    { concerns: [{ category: 'centering', side: 'front', score: 10 }] },
    { note: 'x'.repeat(1001) }, { gradeRunId: 'not-a-run' }, { requester_id: 'someone-else' }, { status: 'completed' },
  ])('rejects unsafe or invalid input: %j', patch => {
    expect(reviewRequestSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
