/**
 * The `user_condition_*` columns a card row carries, built in ONE place.
 *
 * Single upload (src/app/upload/page.tsx) and bulk submissions
 * (src/lib/submissions/service.ts) both call this, so a card graded from a
 * bulk run hands the grader exactly the same condition report / card notes a
 * single upload with the same input would. The grading routes read these
 * columns through ensureProcessedConditionReport(), which the bulk drain
 * reaches by calling the same per-category GET routes.
 *
 * Also owns the condition-step rule for the web wizard: the "Card damage"
 * section starts collapsed, and collapsed means "no card damage" — the report
 * sent is the empty report, byte-for-byte what the old "No visible defects"
 * checkbox sent.
 */

import {
  EMPTY_CONDITION_REPORT,
  hasAnyConditionData,
  type UserConditionReportInput,
} from '@/types/conditionReport';
import { processConditionReport } from '@/lib/conditionReportProcessor';

export const CARD_NOTES_MAX_LENGTH = 500;

export interface UserConditionFields {
  user_condition_report: UserConditionReportInput | null;
  user_condition_processed: ReturnType<typeof processConditionReport> | null;
  has_user_condition_report: boolean;
}

/**
 * @param report      the defect checkboxes + damage notes (EMPTY when the
 *                    damage section is collapsed)
 * @param cardNotes   free-text card notes ("card details for grading
 *                    guidance"); sent as `cardDescription`, context only
 */
export function buildUserConditionFields(
  report: UserConditionReportInput | null | undefined,
  cardNotes: string | null | undefined
): UserConditionFields {
  const base = report ?? EMPTY_CONDITION_REPORT;
  const notes = (cardNotes ?? '').slice(0, CARD_NOTES_MAX_LENGTH).trim();
  const reportWithDescription: UserConditionReportInput = {
    ...base,
    cardDescription: notes || undefined,
  };
  const hasConditionData = hasAnyConditionData(base);
  const hasCardDescription = notes.length > 0;
  const hasAny = hasConditionData || hasCardDescription;
  return {
    user_condition_report: hasAny ? reportWithDescription : null,
    user_condition_processed: hasAny ? processConditionReport(reportWithDescription) : null,
    has_user_condition_report: hasAny,
  };
}

export type ConditionStepState =
  | { ok: true; kind: 'no_damage' }
  | { ok: true; kind: 'damage_reported' }
  | { ok: false; kind: 'damage_open_empty' };

/**
 * Condition-step validity. Collapsed = no card damage (always submittable).
 * Opened = the owner said there is damage, so at least one defect (or a
 * damage note) is required; "No card damage" collapses it again.
 */
export function conditionStepState(
  damageOpen: boolean,
  report: UserConditionReportInput
): ConditionStepState {
  if (!damageOpen) return { ok: true, kind: 'no_damage' };
  if (hasAnyConditionData(report)) return { ok: true, kind: 'damage_reported' };
  return { ok: false, kind: 'damage_open_empty' };
}
