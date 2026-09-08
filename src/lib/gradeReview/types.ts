import { z } from 'zod';
import { detailsClaimSchema, type DetailsChange, type DetailsClaim } from './cardDetails';

export const concernLabels = {
  centering: 'Centering', corners: 'Corners', edges: 'Edges',
  surface: 'Surface', explanation: 'Grade explanation', details: 'Card details',
} as const;

// Expand only as each processor is implemented and evaluated.
export const pilotConcernLabels = { centering: concernLabels.centering, corners: concernLabels.corners, edges: concernLabels.edges, surface: concernLabels.surface } as const;

export const reviewRequestSchema = z.object({
  gradeRunId: z.string().uuid(),
  concerns: z.array(z.object({
    category: z.enum(['centering', 'corners', 'edges', 'surface', 'explanation', 'details']),
    side: z.enum(['front', 'back', 'both']),
  }).strict()).min(1).max(6).refine(
    values => new Set(values.map(value => value.category)).size === values.length,
    'Select each concern only once.',
  ),
  note: z.string().trim().max(1000).default(''),
  /** false = the owner is only disputing card details, not the grade. */
  reviewGrade: z.boolean().default(true),
  /** Owner's claimed correct identification; free text, applied by an admin. */
  details: detailsClaimSchema.optional(),
}).strict().refine(v => v.reviewGrade || (v.details && Object.values(v.details).some(x => x && x.trim())), 'Choose the grade, the card details, or both.');
export const hasDetailsClaim = (details: DetailsClaim | null | undefined) => Boolean(details && Object.values(details).some(x => x && String(x).trim()));

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'superseded' | 'awaiting_owner';
export const reviewStatusLabels: Record<ReviewStatus, string> = {
  queued: 'Review requested', processing: 'Review in progress',
  completed: 'Review complete',
  awaiting_owner: 'Grade change awaiting your approval',
  failed: 'Review delayed', superseded: 'A newer grade is available',
};
export interface ReviewSummary {
  id: string;
  requested_at: string;
  status: ReviewStatus;
  concerns: ReviewRequest['concerns'];
  note: string;
  customer_result: string | null;
  outcome?: 'grade_confirmed' | 'report_corrected' | 'grade_corrected' | 'unable_to_verify' | 'change_declined' | null;
  original_grade?: number | null;
  proposed_grade?: number | null;
  owner_decision?: 'accept' | 'keep_original' | null;
  decided_at?: string | null;
  completed_at?: string | null;
  /** Per-face subgrade differences between the original report and the proposed (or applied) correction. */
  changes?: ReviewChange[];
  details_claim?: DetailsClaim | null;
  details_changes?: DetailsChange[] | null;
  details_applied_at?: string | null;
}
export interface ReviewChange { category: 'centering' | 'corners' | 'edges' | 'surface'; side: 'front' | 'back'; from: number; to: number; }
export interface ReviewState {
  enabled: boolean;
  eligible: boolean;
  membershipEligible?: boolean;
  gradeRunId: string | null;
  review: ReviewSummary | null;
}

// Fail closed until the automatic review pilot has been validated.
export function gradeReviewEnabled(): boolean {
  return process.env.GRADE_REVIEW_ENABLED === 'true';
}
