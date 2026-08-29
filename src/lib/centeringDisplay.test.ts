import { describe, it, expect } from 'vitest';
import {
  parseCenteringRatio,
  displayCenteringRatio,
  isCenteringMeasurable,
  centeringQuality,
  centeringTierIcon,
  NOT_MEASURABLE,
} from './centeringDisplay';

describe('parseCenteringRatio', () => {
  it('accepts a real ratio', () => {
    expect(parseCenteringRatio('55/45')).toEqual({ left: 55, right: 45 });
    expect(parseCenteringRatio(' 52 / 48 ')).toEqual({ left: 52, right: 48 });
  });

  it('rejects the v9.21 "could not measure" placeholder', () => {
    expect(parseCenteringRatio('XX/XX')).toBeNull();
    expect(parseCenteringRatio('xx/xx')).toBeNull();
  });

  it('rejects the shapes that produced NaN before', () => {
    for (const v of ['N/A', 'NaN/NaN', 'die-cut', '', null, undefined, 50]) {
      expect(parseCenteringRatio(v as any)).toBeNull();
    }
  });

  it('rejects halves that do not add up to a card', () => {
    expect(parseCenteringRatio('60/60')).toBeNull();
    expect(parseCenteringRatio('10/10')).toBeNull();
  });
});

describe('centeringQuality', () => {
  it('reports NOT measurable rather than Off-Center when nothing was measured', () => {
    // The Venom regression: XX/XX on both axes used to render a red "Off-Center"
    // beside a 9/10 score and prose reading "Good centering".
    expect(centeringQuality('XX/XX', 'XX/XX')).toEqual(NOT_MEASURABLE);
    expect(centeringQuality('N/A', 'N/A')).toEqual(NOT_MEASURABLE);
    expect(centeringQuality('NaN/NaN', 'NaN/NaN')).toEqual(NOT_MEASURABLE);
    expect(centeringQuality('', '')).toEqual(NOT_MEASURABLE);
  });

  it("prefers the grader's own tier, which is what the score and prose came from", () => {
    expect(centeringQuality('XX/XX', 'XX/XX', 'Good').text).toBe('Good');
    expect(centeringQuality('50/50', '50/50', 'Fair').text).toBe('Fair');
  });

  it('ignores a tier that is not one of the five bands', () => {
    expect(centeringQuality('XX/XX', 'XX/XX', 'Excellent-ish')).toEqual(NOT_MEASURABLE);
    expect(centeringQuality('50/50', '50/50', 'nonsense').text).toBe('Perfect');
  });

  it('derives the tier from whichever axis is worse', () => {
    expect(centeringQuality('50/50', '50/50').text).toBe('Perfect');
    expect(centeringQuality('53/47', '50/50').text).toBe('Excellent');
    expect(centeringQuality('55/45', '50/50').text).toBe('Good');
    expect(centeringQuality('60/40', '50/50').text).toBe('Fair');
    expect(centeringQuality('65/35', '50/50').text).toBe('Off-Center');
    // Worst axis wins even when it is the second one.
    expect(centeringQuality('50/50', '65/35').text).toBe('Off-Center');
  });

  it('scores off the one axis that was measurable', () => {
    expect(centeringQuality('65/35', 'XX/XX').text).toBe('Off-Center');
    expect(centeringQuality('XX/XX', '51/49').text).toBe('Perfect');
  });
});

describe('displayCenteringRatio', () => {
  it('passes a real ratio through and dashes everything else', () => {
    expect(displayCenteringRatio('55/45')).toBe('55/45');
    expect(displayCenteringRatio('XX/XX')).toBe('—');
    expect(displayCenteringRatio('NaN/NaN')).toBe('—');
    expect(displayCenteringRatio(undefined)).toBe('—');
  });
});

describe('isCenteringMeasurable / centeringTierIcon', () => {
  it('needs only one usable axis', () => {
    expect(isCenteringMeasurable('XX/XX', '51/49')).toBe(true);
    expect(isCenteringMeasurable('XX/XX', 'XX/XX')).toBe(false);
  });

  it('gives an unmeasurable face a neutral mark, not a failure mark', () => {
    expect(centeringTierIcon(NOT_MEASURABLE.text)).toBe('–');
    expect(centeringTierIcon('Off-Center')).toBe('✗');
    expect(centeringTierIcon('Fair')).toBe('⚠');
    expect(centeringTierIcon('Good')).toBe('✓');
  });
});
