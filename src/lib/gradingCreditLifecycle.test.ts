import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), lookup: vi.fn(), eq: vi.fn(), update: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc, from: (table: string) => {
  const query: any = { select: () => query, eq: (...args: any[]) => { mocks.eq(...args); return query; }, maybeSingle: mocks.lookup, update: mocks.update };
  if (table === 'cards') query.update = (data: any) => { mocks.update(data); return { eq: async () => ({ error: null }) }; };
  return query;
} }) }));
vi.mock('./organizations', () => ({ getOrgForUser: vi.fn(), takeOrgCredit: vi.fn(), returnOrgCredits: vi.fn(), assignOrgSerial: vi.fn() }));
import { refundGradeCredit } from './credits';
import { recordGradingFailure } from './gradingFailure';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue({ data: { id: 'initial-charge' }, error: null });
  mocks.rpc.mockResolvedValue({ data: { status: 'refunded', new_balance: 5 }, error: null });
});
describe('charge-specific refund boundary', () => {
  it('resolves only the original grade for an initial submission', async () => {
    expect(await refundGradeCredit('owner', 'card', 'failed')).toMatchObject({ refunded: true, status: 'refunded' });
    expect(mocks.eq).toHaveBeenCalledWith('type', 'grade');
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(mocks.rpc.mock.calls[0][1].p_charge_id).toBe('initial-charge');
  });
  it('uses an explicit prepaid regrade charge without selecting another', async () => {
    await refundGradeCredit('owner', 'card', 'failed', 'regrade-charge');
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1].p_charge_id).toBe('regrade-charge');
  });
  it('does not refund an original charge for an uncharged web regrade', async () => {
    expect(await recordGradingFailure({ cardId: 'card', userId: 'owner', category: 'Pokemon', errorMessage: 'failed', chargeId: null }))
      .toEqual({ refunded: false, refundStatus: 'not_charged' });
    expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('confirms an existing refund without balance writes', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'already_refunded' }, error: null });
    expect(await refundGradeCredit('owner', 'card', 'failed', 'charge')).toMatchObject({ refunded: true, status: 'already_refunded' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(['failed', 'needs_review', 'invalid_charge'])('does not claim a refund for %s', async status => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    expect(await refundGradeCredit('owner', 'card', 'failed', 'charge')).toMatchObject({ refunded: false, status });
  });
  it('does not fall back to unsafe balance writes if the RPC is unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'function unavailable' } });
    expect(await refundGradeCredit('owner', 'card', 'failed')).toMatchObject({ refunded: false, status: 'failed' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('distinguishes missing charge from lookup failure', async () => {
    mocks.lookup.mockResolvedValueOnce({ data: null, error: null });
    expect((await refundGradeCredit('owner', 'card', 'failed')).status).toBe('needs_review');
    mocks.lookup.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    expect((await refundGradeCredit('owner', 'card', 'failed')).status).toBe('failed');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
