import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/serverAuth', () => ({ verifyAuth: mocks.auth }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: mocks.db }));
import { GET, POST } from './route';

const cardId = '6b292489-42d8-41d4-a00a-d9c9b267d66b';
const runId = 'c38c3452-a535-4e3a-9a2c-eebdd1aef5f6';
const context = { params: Promise.resolve({ id: cardId }) };
const valid = { gradeRunId: runId, concerns: [{ category: 'centering', side: 'front' }], note: '' };
function request(body: unknown = valid) {
  return new NextRequest(`http://localhost/api/cards/${cardId}/grade-review`, { method: 'POST', body: JSON.stringify(body) });
}
function readChain(result: unknown) {
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result); chain.single.mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GRADE_REVIEW_ENABLED', 'true');
  vi.stubEnv('GRADE_REVIEW_HISTORY_ENABLED', '');
  mocks.auth.mockResolvedValue({ authenticated: true, userId: 'verified-owner' });
  mocks.db.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
});
afterEach(() => vi.unstubAllEnvs());

describe('grade review API', () => {
  it('returns the membership restriction from database-enforced intake',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message:'review_membership_required'}});
    expect((await POST(request(),context)).status).toBe(403);
  });
  it('shows a disabled review entitlement for an otherwise eligible nonmember',async()=>{
    mocks.from.mockReturnValueOnce(readChain({data:{user_id:'verified-owner',deleted_at:null,ownership_status:'owned',grade_status:'complete',conversational_whole_grade:8,conversational_grading:'{}',front_path:'f',back_path:'b'},error:null}))
      .mockReturnValueOnce(readChain({data:{id:runId,grader_user_id:'verified-owner'},error:null}))
      .mockReturnValueOnce(readChain({data:null,error:null}))
      .mockReturnValueOnce(readChain({data:{is_vip:false,is_card_lover:false},error:null}));
    expect(await (await GET(new NextRequest('http://localhost'),context)).json()).toMatchObject({enabled:true,eligible:false,membershipEligible:false,gradeRunId:runId});
  });
  it('rejects anonymous writes without touching the database', async () => {
    mocks.auth.mockResolvedValue({ authenticated: false, userId: null });
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('fails closed when the rollout switch is absent', async () => {
    vi.stubEnv('GRADE_REVIEW_ENABLED', '');
    expect((await POST(request(), context)).status).toBe(503);
    const result = await GET(new NextRequest('http://localhost'), context);
    expect(await result.json()).toMatchObject({ enabled: false, eligible: false });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('rejects forged identity and grade fields', async () => {
    expect((await POST(request({ ...valid, requester_id: 'victim', grade: 10 }), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not accept unknown grading categories', async () => {
    expect((await POST(request({ ...valid, concerns: [{ category: 'price', side: 'front' }] }), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('sends only verified ownership and the expected run to atomic intake', async () => {
    mocks.rpc.mockResolvedValue({ data: 'review-id', error: null });
    mocks.from.mockReturnValue(readChain({ data: { id: 'review-id', status: 'queued' }, error: null }));
    const response = await POST(request(), context);
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.rpc).toHaveBeenCalledWith('request_card_grade_review', {
      p_card_id: cardId, p_user_id: 'verified-owner', p_run_id: runId, p_concerns: ['centering','corners','edges','surface'].map(category=>({category,side:'both'})), p_note: '', p_details: null,
    });
  });
  it('reports a stale or unauthorized run without exposing database detail', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'review_not_available' } });
    expect((await POST(request(), context)).status).toBe(409);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('handles a committed insertion followed by a failed read without claiming success', async () => {
    mocks.rpc.mockResolvedValue({ data: 'review-id', error: null });
    mocks.from.mockReturnValue(readChain({ data: null, error: { message: 'private database error' } }));
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private database error');
  });
  it('hides another owner’s review before querying private run history', async () => {
    mocks.from.mockReturnValue(readChain({ data: { user_id: 'someone-else', deleted_at: null, ownership_status: 'owned' }, error: null }));
    expect((await GET(new NextRequest('http://localhost'), context)).status).toBe(404);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it('does not infer grading ownership from current ownership', async () => {
    mocks.from.mockReturnValueOnce(readChain({ data: { user_id: 'verified-owner', deleted_at: null, ownership_status: 'owned' }, error: null }))
      .mockReturnValueOnce(readChain({ data: { id: runId, grader_user_id: 'original-submitter' }, error: null }));
    const response = await GET(new NextRequest('http://localhost'), context);
    expect(await response.json()).toEqual({ enabled: true, eligible: false, gradeRunId: null, review: null });
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });
  it('preserves saved review access when new requests are paused', async () => {
    vi.stubEnv('GRADE_REVIEW_ENABLED', ''); vi.stubEnv('GRADE_REVIEW_HISTORY_ENABLED', 'true');
    mocks.from.mockReturnValueOnce(readChain({ data: { user_id: 'verified-owner', deleted_at: null, ownership_status: 'owned' }, error: null }))
      .mockReturnValueOnce(readChain({ data: { id: runId, grader_user_id: 'verified-owner' }, error: null }))
      .mockReturnValueOnce(readChain({ data: { id: 'saved-review', status: 'processing' }, error: null }));
    expect(await (await GET(new NextRequest('http://localhost'), context)).json()).toMatchObject({ enabled: false, eligible: false, review: { id: 'saved-review' } });
  });
});
