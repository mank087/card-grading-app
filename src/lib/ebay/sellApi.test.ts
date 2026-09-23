import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./tradingApi', () => ({ callTradingApi: vi.fn() }));

import { callTradingApi } from './tradingApi';
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
    call.mockResolvedValue('<Ack>Failure</Ack><Errors><ErrorCode>518</ErrorCode></Errors>');
    expect((await getItemDetailOutcome(config, '1')).kind).toBe('error');
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
});
