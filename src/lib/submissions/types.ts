// src/lib/submissions/types.ts
//
// Shared shapes for bulk grading submissions.
// Spec: docs/SOW_submissions_bulk_grading_2026-08-31.md
//
// "Submissions" is internal naming only — there is no user-facing product
// name (owner direction, Aug 31). Tables and routes carry the word; no UI
// surface should.

/** Per-submission lifecycle. Mirrors submissions_status_check in the migration. */
export type SubmissionStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'blocked_insufficient_credits'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled';

/** Per-item lifecycle. Mirrors submission_items_status_check in the migration. */
export type SubmissionItemStatus =
  | 'queued'
  | 'dispatched'
  | 'grading'
  | 'graded'
  | 'failed'
  | 'skipped';

/** Statuses that mean "this item still owes us work". */
export const ACTIVE_ITEM_STATUSES: SubmissionItemStatus[] = ['queued', 'dispatched', 'grading'];

/** Statuses that mean "a grade is in flight for this item right now". */
export const IN_FLIGHT_ITEM_STATUSES: SubmissionItemStatus[] = ['dispatched', 'grading'];

/** Hard ceiling per submission (decision 3, resolved Aug 31). */
export const MAX_SUBMISSION_ITEMS = 100;

/**
 * Concurrency ceiling. Above ~5 concurrent grades the zoom pass's OpenAI
 * client — which has no retries and swallows failures — starts silently
 * degrading grades under 429s. Raising this requires zoom-client retries
 * FIRST plus confirmed zoom 429 rates in api_usage_log. See SOW.
 */
export const MAX_IN_FLIGHT = 4;

/** Retry budget per item before it stays failed. */
export const MAX_ITEM_ATTEMPTS = 2;

/**
 * A card stuck in the grading lock longer than this is presumed dead and is
 * failed + refunded. Matches the existing client-side threshold.
 */
export const STUCK_GRADE_MS = 10 * 60 * 1000;

/** Measured OpenAI spend per grade (cost eval, Jul 2026: ~$0.148). */
export const COST_PER_GRADE_USD = 0.16;

/**
 * Backstop spend ceiling per submission. The 100-card ceiling already caps a
 * submission at ~$16, so this only fires if item rows outrun card_count —
 * i.e. something is looping. It is a circuit breaker, not a budget.
 */
export const SUBMISSION_SPEND_CEILING_USD = 25;

export interface SubmissionRow {
  id: string;
  user_id: string;
  name: string | null;
  category: string;
  sub_category: string | null;
  binder_id: string | null;
  status: SubmissionStatus;
  source: string | null;
  card_count: number | null;
  routing_key: string | null;
  created_at: string;
  committed_at: string | null;
  completed_at: string | null;
}

export interface SubmissionItemRow {
  id: string;
  submission_id: string;
  card_id: string | null;
  position: number;
  front_path: string | null;
  back_path: string | null;
  front_hash: string | null;
  back_hash: string | null;
  status: SubmissionItemStatus;
  claimed_at: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
}

/** One front/back pair as handed in by the intake stage. */
export interface SubmissionItemInput {
  position: number;
  front_path: string;
  back_path: string;
  front_hash?: string | null;
  back_hash?: string | null;
}

/**
 * Service results are returned, never thrown — every caller is an API route
 * that needs to map the failure onto a status code, and the credit gate in
 * particular carries structured numbers the UI renders as two offered paths
 * ("keep the first N" / "buy credits").
 */
export type SubmissionError =
  | { code: 'not_found'; message: string }
  | { code: 'forbidden'; message: string }
  | { code: 'invalid'; message: string }
  | { code: 'too_many_items'; message: string; max: number; provided: number }
  | { code: 'incomplete_pairs'; message: string; positions: number[] }
  | {
      code: 'insufficient_credits';
      message: string;
      /** Credits the submission needs (one per item). */
      required: number;
      /** Wallet balance at the moment of the check. */
      balance: number;
      /** How many items the wallet does cover — powers "keep the first N". */
      affordable: number;
    }
  | { code: 'conflict'; message: string }
  | { code: 'internal'; message: string };

export type SubmissionResult<T> = { ok: true; data: T } | { ok: false; error: SubmissionError };

/** HTTP status for each service error code. Keeps routes free of mapping logic. */
export const SUBMISSION_ERROR_STATUS: Record<SubmissionError['code'], number> = {
  not_found: 404,
  forbidden: 403,
  invalid: 400,
  too_many_items: 400,
  incomplete_pairs: 400,
  insufficient_credits: 402,
  conflict: 409,
  internal: 500,
};
