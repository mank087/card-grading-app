import { describe, expect, it } from 'vitest';
import { getUncertaintyFromConfidence } from './gradeDisplayUtils';

describe('uncertainty shown beside a grade', () => {
  it('still comes from the confidence letter', () => {
    expect(['A', 'B', 'C', 'D'].map(l => getUncertaintyFromConfidence(l))).toEqual(['±0', '±1', '±2', '±3']);
    expect(getUncertaintyFromConfidence(null)).toBe('±1');
  });

  it('never shows a 10 with plus or minus 2', () => {
    expect(getUncertaintyFromConfidence('C', 10)).toBe('±1');
    expect(getUncertaintyFromConfidence('c', '10')).toBe('±1');
  });

  it('leaves every other card exactly as before', () => {
    expect(getUncertaintyFromConfidence('C', 9)).toBe('±2');
    expect(getUncertaintyFromConfidence('C')).toBe('±2');
    expect(getUncertaintyFromConfidence('D', 10)).toBe('±3');
    expect(getUncertaintyFromConfidence('B', 10)).toBe('±1');
  });
});
