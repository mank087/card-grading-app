import { describe, expect, it } from 'vitest'
import { buildUserConditionFields, conditionStepState } from './userConditionFields'
import { ensureProcessedConditionReport } from './conditionReportProcessor'
import { EMPTY_CONDITION_REPORT, type UserConditionReportInput } from '@/types/conditionReport'
// The mobile app's copy of the condition-step rules (pure TS, no RN imports).
import {
  conditionStepState as mobileConditionStepState,
  buildConditionPayload as mobileBuildConditionPayload,
} from '../../dcm-mobile/lib/conditionStep'
import { EMPTY_REPORT as MOBILE_EMPTY_REPORT } from '../../dcm-mobile/lib/conditionReport'

function withCornerWhitening(): UserConditionReportInput {
  return {
    ...EMPTY_CONDITION_REPORT,
    front: {
      ...EMPTY_CONDITION_REPORT.front,
      corners: { ...EMPTY_CONDITION_REPORT.front.corners, whitening: true },
    },
  }
}

const stripTimestamp = (p: any) => (p ? { ...p, processed_at: 'X' } : p)

describe('conditionStepState (web) — card damage collapsed by default', () => {
  it('collapsed damage is always submittable and means no damage', () => {
    expect(conditionStepState(false, EMPTY_CONDITION_REPORT)).toEqual({ ok: true, kind: 'no_damage' })
  })

  it('opened damage with nothing selected blocks submit', () => {
    expect(conditionStepState(true, EMPTY_CONDITION_REPORT)).toEqual({ ok: false, kind: 'damage_open_empty' })
  })

  it('opened damage with a defect is submittable', () => {
    expect(conditionStepState(true, withCornerWhitening())).toEqual({ ok: true, kind: 'damage_reported' })
  })

  it('opened damage with only a damage note is submittable', () => {
    expect(conditionStepState(true, { ...EMPTY_CONDITION_REPORT, notes: 'small crease top left' }).ok).toBe(true)
  })
})

describe('buildUserConditionFields — collapsed equals the old explicit "No visible defects"', () => {
  // The old web path: "No visible defects" checked cleared the report to
  // EMPTY_CONDITION_REPORT and sent it with the typed card description.
  function legacyNoDefects(cardDescription: string) {
    const reportWithDescription = { ...EMPTY_CONDITION_REPORT, cardDescription: cardDescription.trim() || undefined }
    const hasCardDescription = cardDescription.trim().length > 0
    return {
      user_condition_report: hasCardDescription ? reportWithDescription : null,
      has_user_condition_report: hasCardDescription,
    }
  }

  it('no notes: nothing is sent, exactly as before', () => {
    const fields = buildUserConditionFields(EMPTY_CONDITION_REPORT, '')
    expect(fields).toEqual({ user_condition_report: null, user_condition_processed: null, has_user_condition_report: false })
    expect(fields.user_condition_report).toEqual(legacyNoDefects('').user_condition_report)
  })

  it('notes only: same report as the old checkbox path, processed as context', () => {
    const fields = buildUserConditionFields(EMPTY_CONDITION_REPORT, 'Refractor finish, not scratches')
    const legacy = legacyNoDefects('Refractor finish, not scratches')
    expect(fields.user_condition_report).toEqual(legacy.user_condition_report)
    expect(fields.has_user_condition_report).toBe(true)
    expect(fields.user_condition_processed?.card_description).toBe('Refractor finish, not scratches')
    expect(fields.user_condition_processed?.total_defects_reported).toBe(0)
    expect(fields.user_condition_processed?.has_any_reports).toBe(false)
  })

  it('defects reported: the full report is sent', () => {
    const fields = buildUserConditionFields(withCornerWhitening(), '')
    expect(fields.has_user_condition_report).toBe(true)
    expect(fields.user_condition_processed?.total_defects_reported).toBe(1)
  })

  it('caps card notes at 500 characters', () => {
    const fields = buildUserConditionFields(null, 'x'.repeat(800))
    expect(fields.user_condition_report?.cardDescription).toHaveLength(500)
  })
})

describe('mobile condition step parity', () => {
  it('validation matches web', () => {
    expect(mobileConditionStepState(false, 0)).toEqual({ ok: true, kind: 'no_damage' })
    expect(mobileConditionStepState(true, 0)).toEqual({ ok: false, kind: 'damage_open_empty' })
    expect(mobileConditionStepState(true, 2)).toEqual({ ok: true, kind: 'damage_reported' })
  })

  it('collapsed payload is the old "No visible defects" payload', () => {
    expect(mobileBuildConditionPayload(false, MOBILE_EMPTY_REPORT, '')).toBeNull()
    expect(mobileBuildConditionPayload(false, MOBILE_EMPTY_REPORT, 'Serial /99')).toEqual({
      noDefectsConfirmed: true,
      cardDescription: 'Serial /99',
    })
  })

  it('the grader sees the same card notes from mobile and web', () => {
    const mobileRaw = mobileBuildConditionPayload(false, MOBILE_EMPTY_REPORT, 'Serial /99')
    const fromMobile = ensureProcessedConditionReport(mobileRaw, null)
    const web = buildUserConditionFields(EMPTY_CONDITION_REPORT, 'Serial /99')
    const fromWeb = ensureProcessedConditionReport(web.user_condition_report, web.user_condition_processed)
    expect(fromMobile?.card_description).toBe(fromWeb?.card_description)
    expect(fromMobile?.total_defects_reported).toBe(0)
    expect(fromWeb?.total_defects_reported).toBe(0)
  })

  it('mobile with damage reported keeps profile notes as context, not defects (as on web)', () => {
    const report = { ...MOBILE_EMPTY_REPORT, front: { ...MOBILE_EMPTY_REPORT.front, corners: { ...MOBILE_EMPTY_REPORT.front.corners, whitening: true } } }
    const profile = 'Refractor surface lines are the finish. Light scratch look is the pattern.'
    const payload = mobileBuildConditionPayload(true, report, profile) as Record<string, unknown>
    expect(payload.cardDescription).toBe(profile)
    expect(payload.notes).toBe('')
    const processed = ensureProcessedConditionReport(payload, null)
    expect(processed?.total_defects_reported).toBe(1)
  })

  it('web processed report is stable apart from its timestamp', () => {
    const a = buildUserConditionFields(EMPTY_CONDITION_REPORT, 'abc')
    const b = buildUserConditionFields(EMPTY_CONDITION_REPORT, 'abc')
    expect(stripTimestamp(a.user_condition_processed)).toEqual(stripTimestamp(b.user_condition_processed))
  })
})
