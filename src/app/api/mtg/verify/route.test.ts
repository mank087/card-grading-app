import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: mocks.db }));
import { POST } from './route';

const request = (headers: Record<string, string> = {}) => new NextRequest('https://dcmgrading.com/api/mtg/verify', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ card_id: 'a9eca6ef-0000-4000-8000-000000000001', card_info: { card_name: 'Anything' } }),
});

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'server-secret'); });
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/mtg/verify is server-to-server only', () => {
  it('refuses a caller without the server secret before touching the database', async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ Authorization: 'Bearer wrong' }))).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  });
});
