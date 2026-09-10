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

describe('parseUploadSiteHostedPicturesResponse', () => {
  it('extracts the EPS FullURL and unescapes ampersands', async () => {
    const { parseUploadSiteHostedPicturesResponse } = await import('./tradingApi');
    const xml = `<?xml version="1.0"?><UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><SiteHostedPictureDetails><PictureName>DCM-1</PictureName><FullURL>https://i.ebayimg.com/00/s/MTAwMFgxMDAw/z/abc/$_1.JPG?set_id=2</FullURL></SiteHostedPictureDetails></UploadSiteHostedPicturesResponse>`;
    const out = parseUploadSiteHostedPicturesResponse(xml);
    expect(out.fullUrl).toBe('https://i.ebayimg.com/00/s/MTAwMFgxMDAw/z/abc/$_1.JPG?set_id=2');
    expect(out.errors).toEqual([]);
  });

  it('returns null and the error when eBay rejects the picture', async () => {
    const { parseUploadSiteHostedPicturesResponse } = await import('./tradingApi');
    const xml = `<UploadSiteHostedPicturesResponse><Ack>Failure</Ack><Errors><ShortMessage>Bad picture</ShortMessage><LongMessage>The picture could not be fetched.</LongMessage><ErrorCode>21916562</ErrorCode><SeverityCode>Error</SeverityCode></Errors></UploadSiteHostedPicturesResponse>`;
    const out = parseUploadSiteHostedPicturesResponse(xml);
    expect(out.fullUrl).toBeNull();
    expect(out.errors[0].code).toBe('21916562');
  });
});
