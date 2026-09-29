/**
 * Review screen, step 3 ("Report Card Condition") rules — pure, no React
 * Native imports, so the web test suite can exercise them
 * (src/lib/gradingRunMobileParity.test.ts).
 *
 * The "Card damage" section starts collapsed, and collapsed means "no card
 * damage": the payload is exactly what the old "No visible defects" switch
 * produced. Opening it requires at least one defect checkbox.
 */

import type { ConditionReportData } from './conditionReport'

export type MobileConditionStep =
  | { ok: true; kind: 'no_damage' }
  | { ok: true; kind: 'damage_reported' }
  | { ok: false; kind: 'damage_open_empty' }

export function conditionStepState(damageOpen: boolean, defectCount: number): MobileConditionStep {
  if (!damageOpen) return { ok: true, kind: 'no_damage' }
  if (defectCount > 0) return { ok: true, kind: 'damage_reported' }
  return { ok: false, kind: 'damage_open_empty' }
}

/**
 * user_condition_report as the mobile app writes it. Collapsed = the old
 * "No visible defects" payload: { noDefectsConfirmed, cardDescription } when
 * there are notes, otherwise nothing. Open = the full report with the notes.
 * The server's ensureProcessedConditionReport() processes either shape.
 */
export function buildConditionPayload(
  damageOpen: boolean,
  report: ConditionReportData,
  notes: string
): Record<string, unknown> | null {
  if (!damageOpen) {
    return notes ? { noDefectsConfirmed: true, cardDescription: notes } : null
  }
  return { ...report, notes }
}
