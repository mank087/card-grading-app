export interface ReviewCard {
  user_id: string | null;
  deleted_at: string | null;
  ownership_status: string | null;
  grade_status: string | null;
  conversational_whole_grade: number | null;
  conversational_grading: string | null;
  front_path: string | null;
  back_path: string | null;
}

export function ownsReviewCard(card: ReviewCard, userId: string): boolean {
  return card.user_id === userId && !card.deleted_at &&
    (card.ownership_status === null || card.ownership_status === 'owned');
}

export function canRequestReview(card: ReviewCard, userId: string, graderId: string | null): boolean {
  return ownsReviewCard(card, userId) && graderId === userId &&
    card.grade_status === 'complete' && Number(card.conversational_whole_grade) > 0 &&
    Boolean(card.conversational_grading && card.front_path && card.back_path);
}
