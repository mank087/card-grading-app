import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/lib/serverAuth', () => ({ verifyAuth: mocks.auth }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => ({ rpc: mocks.rpc }) }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { POST } from './route';
const id = '6b292489-42d8-41d4-a00a-d9c9b267d66b';
const reviewId = 'c38c3452-a535-4e3a-9a2c-eebdd1aef5f6';
const context = { params: Promise.resolve({ id }) };
const request = (body: unknown = { reviewId, decision: 'accept' }) => new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('GRADE_REVIEW_ENABLED','true'); mocks.auth.mockResolvedValue({ authenticated:true,userId:'owner' }); mocks.rpc.mockResolvedValue({ data:{ accepted:true },error:null }); });
afterEach(() => vi.unstubAllEnvs());
describe('owner grade decision', () => {
  it('uses verified identity and only a stored proposal', async () => {
    expect((await POST(request(),context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('decide_own_grade_review',{ p_card_id:id,p_review_id:reviewId,p_user_id:'owner',p_decision:'accept' });
    expect(mocks.revalidate).toHaveBeenCalledWith('/collection');
  });
  it('rejects anonymous and forged grade submissions', async () => {
    expect((await POST(request({reviewId,decision:'accept',grade:10}),context)).status).toBe(400);
    mocks.auth.mockResolvedValue({authenticated:false});
    expect((await POST(request(),context)).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('reports stale proposals without claiming success', async () => {
    mocks.rpc.mockResolvedValue({ data:{stale:true},error:null });
    expect((await POST(request(),context)).status).toBe(409); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('keeps decisions available while intake is paused with history enabled', async () => {
    vi.stubEnv('GRADE_REVIEW_ENABLED',''); vi.stubEnv('GRADE_REVIEW_HISTORY_ENABLED','true');
    mocks.rpc.mockResolvedValue({ data:{accepted:false},error:null });
    expect((await POST(request({reviewId,decision:'keep_original'}),context)).status).toBe(200);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
