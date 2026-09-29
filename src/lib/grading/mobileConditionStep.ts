/**
 * Mobile review screen, step 3 ("Report Card Condition") rules. Pure and
 * dependency-free: dcm-mobile/lib/conditionStep.ts and
 * src/lib/grading/mobileConditionStep.ts are verbatim copies, and a web test
 * compares their text (importing from dcm-mobile pulls in its Expo tsconfig,
 * which CI does not install).
 *
 * The "Card damage" section starts collapsed, and collapsed means "no card
 * damage": the payload is exactly what the old "No visible defects" switch
 * produced. Opening it requires at least one defect checkbox.
 */

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
 * there are notes, otherwise nothing. Open = the full report, notes as cardDescription.
 * The server's ensureProcessedConditionReport() processes either shape.
 */
export function buildConditionPayload(
  damageOpen: boolean,
  report: object,
  notes: string
): Record<string, unknown> | null {
  if (!damageOpen) {
    return notes ? { noDefectsConfirmed: true, cardDescription: notes } : null
  }
  // Notes go as cardDescription (context only), as on web: a locked profile such
  // as "refractor lines are the finish" must not be parsed into reported defects.
  const fields = report as Record<string, unknown>
  return notes ? { ...fields, cardDescription: notes } : { ...fields }
}
