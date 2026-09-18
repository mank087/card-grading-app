import { describe, it, expect } from 'vitest';
import {
  toTradingServiceToken,
  normalizeDomesticService,
  DEFAULT_DOMESTIC_SHIPPING_SERVICE,
  DOMESTIC_SHIPPING_SERVICES,
} from './tradingApi';

describe('toTradingServiceToken', () => {
  it('sends USPSParcel on the wire for the internal Ground Advantage value', () => {
    // eBay has no USPSGroundAdvantage selling token; USPSParcel is the one it
    // describes as "USPS Ground Advantage" (GeteBayDetails, Sept 9 2026).
    expect(toTradingServiceToken('USPSGroundAdvantage')).toBe('USPSParcel');
  });

  it('passes every other picker value through unchanged', () => {
    for (const s of DOMESTIC_SHIPPING_SERVICES) {
      if (s.value === 'USPSGroundAdvantage') continue;
      expect(toTradingServiceToken(s.value)).toBe(s.value);
    }
    expect(toTradingServiceToken('USPSPriorityMailInternational')).toBe('USPSPriorityMailInternational');
  });

  it('a retired saved default still ends up as USPSParcel on the wire', () => {
    expect(toTradingServiceToken(normalizeDomesticService('USPSFirstClass'))).toBe('USPSParcel');
    expect(toTradingServiceToken(normalizeDomesticService(undefined))).toBe('USPSParcel');
    expect(DEFAULT_DOMESTIC_SHIPPING_SERVICE).toBe('USPSGroundAdvantage');
  });
});
