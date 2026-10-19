import { describe, expect, it } from 'vitest';
import { describedSerial, describesAnotherCard } from './describedSerial';

const murphy =
  '<div><p>Topps Rookie Catchers Dale Murphy #476 DCM 8</p><p>Serial: <strong>409780</strong></p><p>Look up serial 409780 on the DCM Grading registry</p></div>';

describe('repairListingDescriptions', () => {
  it('reads the serial the description names', () => {
    expect(describedSerial(murphy)).toBe('409780');
    expect(describedSerial('<p>Hand-written, no serial line.</p>')).toBeNull();
  });
  it('flags a description that names another card serial', () => {
    expect(describesAnotherCard(murphy, { serial: '848642' })).toBe(true);
    expect(describesAnotherCard(murphy, { serial: '409780' })).toBe(false);
    expect(describesAnotherCard(murphy, { serial: '000001', org_serial_display: '409780' })).toBe(false);
  });
  it('leaves a description with no serial line alone', () => {
    expect(describesAnotherCard('<p>Nice card, ships fast.</p>', { serial: '848642' })).toBe(false);
  });
});
