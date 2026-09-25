import { beforeEach, describe, expect, it, vi } from 'vitest';

// Keep the real response helpers (assertTradingSuccess, isQuotaErrorXml); fake only the network call.
vi.mock('./tradingApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./tradingApi')>()), callTradingApi: vi.fn() }));

import { callTradingApi, EbayQuotaError } from './tradingApi';
import { getItemDetailOutcome, getMyEbaySelling } from './sellApi';

const call = vi.mocked(callTradingApi);
const config = { accessToken: 't', sandbox: false };

const getItemXml = (status: string) =>
  `<GetItemResponse><Ack>Success</Ack><Item><ItemID>1</ItemID>` +
  `<SellingStatus><ListingStatus>${status}</ListingStatus><QuantitySold>0</QuantitySold></SellingStatus>` +
  `</Item></GetItemResponse>`;

const activePage = (ids: string[], totalPages: number) =>
  `<GetMyeBaySellingResponse><Ack>Success</Ack><ActiveList><ItemArray>` +
  ids.map(id => `<Item><ItemID>${id}</ItemID><Title>t</Title></Item>`).join('') +
  `</ItemArray><PaginationResult><TotalNumberOfPages>${totalPages}</TotalNumberOfPages></PaginationResult></ActiveList>` +
  `</GetMyeBaySellingResponse>`;

beforeEach(() => call.mockReset());

describe('getItemDetailOutcome', () => {
  it('reads a live listing as found / Active', async () => {
    call.mockResolvedValue(getItemXml('Active'));
    const out = await getItemDetailOutcome(config, '1');
    expect(out.kind).toBe('found');
    expect(out.kind === 'found' && out.detail.listingStatus).toBe('Active');
  });

  it('only error code 17 means the item is gone', async () => {
    call.mockResolvedValue('<Ack>Failure</Ack><Errors><ErrorCode>17</ErrorCode></Errors>');
    expect((await getItemDetailOutcome(config, '1')).kind).toBe('not_found');
  });

  it('any other eBay failure is "no answer", never "gone" (Sept 23: live listings were ended)', async () => {
    call.mockResolvedValue('<Ack>Failure</Ack><Errors><ErrorCode>10007</ErrorCode></Errors>');
    expect((await getItemDetailOutcome(config, '1')).kind).toBe('error');
  });

  it('flags the app-wide call limit (518) so the sync can stop (Sept 25)', async () => {
    call.mockResolvedValue('<Ack>Failure</Ack><Errors><ErrorCode>518</ErrorCode></Errors>');
    const out = await getItemDetailOutcome(config, '1');
    expect(out.kind === 'error' && out.quota).toBe(true);
  });
});

describe('getMyEbaySelling active paging', () => {
  it('reads only the first page unless asked', async () => {
    call.mockResolvedValue(activePage(['a', 'b'], 3));
    const res = await getMyEbaySelling(config, { includeFlags: { active: true } });
    expect(res.active.map(i => i.itemId)).toEqual(['a', 'b']);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('with allActivePages, walks every page so no live listing looks missing', async () => {
    call
      .mockResolvedValueOnce(activePage(['a'], 3))
      .mockResolvedValueOnce(activePage(['b'], 3))
      .mockResolvedValueOnce(activePage(['c'], 3));
    const res = await getMyEbaySelling(config, { includeFlags: { active: true }, allActivePages: true });
    expect(res.active.map(i => i.itemId)).toEqual(['a', 'b', 'c']);
    expect(call).toHaveBeenCalledTimes(3);
    expect(String(call.mock.calls[2][2])).toContain('<PageNumber>3</PageNumber>');
  });

  it('a failed call is an error, never an empty account (Sept 25: every listing became a GetItem call)', async () => {
    call.mockResolvedValue('<Ack>Failure</Ack><Errors><ErrorCode>518</ErrorCode></Errors>');
    await expect(getMyEbaySelling(config, { includeFlags: { active: true } })).rejects.toBeInstanceOf(EbayQuotaError);
    call.mockResolvedValue('<Ack>Failure</Ack><Errors><ErrorCode>931</ErrorCode></Errors>');
    await expect(getMyEbaySelling(config, { includeFlags: { active: true } })).rejects.toThrow(/GetMyeBaySelling Failure 931/);
  });
});
