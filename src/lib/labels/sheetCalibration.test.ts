import { describe, it, expect } from 'vitest'
import {
  normalizeSheetCalibration,
  sheetLayoutFor,
  DEFAULT_SHEET_CALIBRATION,
  MAX_SHEET_OFFSET_IN,
  toDisplayUnit,
  fromDisplayUnit,
} from './sheetCalibration'

describe('sheet calibration', () => {
  it('default calibration passes the bare density (sheets stay byte-identical)', () => {
    expect(sheetLayoutFor('standard', DEFAULT_SHEET_CALIBRATION)).toBe('standard')
    expect(sheetLayoutFor('up30', null)).toBe('up30')
    expect(sheetLayoutFor('up26', null)).toBe('up26')
  })

  it('non-default calibration becomes print options', () => {
    const cal = normalizeSheetCalibration({ duplexFlip: 'short', offsetsIn: { backX: 0.03 }, unit: 'mm' })
    expect(sheetLayoutFor('up30', cal)).toEqual({
      density: 'up30',
      duplexFlip: 'short',
      offsetsIn: { globalX: 0, globalY: 0, backX: 0.03, backY: 0 },
    })
  })

  it('clamps garbage and out-of-range values', () => {
    const cal = normalizeSheetCalibration({ duplexFlip: 'sideways', offsetsIn: { globalX: 9, globalY: 'x', backY: -1 } })
    expect(cal.duplexFlip).toBe('long')
    expect(cal.offsetsIn).toEqual({ globalX: MAX_SHEET_OFFSET_IN, globalY: 0, backX: 0, backY: -MAX_SHEET_OFFSET_IN })
    expect(normalizeSheetCalibration(null)).toEqual(DEFAULT_SHEET_CALIBRATION)
  })

  it('converts mm <-> inches', () => {
    expect(toDisplayUnit(0.125, 'mm')).toBe(3.18)
    expect(fromDisplayUnit(25.4, 'mm')).toBe(1)
    expect(toDisplayUnit(0.03125, 'in')).toBe(0.0313)
  })
})
