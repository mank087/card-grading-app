import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ db: vi.fn(), verify: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: mocks.db }));
vi.mock('@/lib/identity/pokemonCatalogLink', () => ({ verifyAndSavePokemonCard: mocks.verify }));
import { POST } from './route';

const cardId = 'a9eca6ef-0000-4000-8000-000000000001';
const request = (headers: Record<string, string> = {}, query = '') => new NextRequest(`https://dcmgrading.com/api/pokemon/verify${query}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ card_id: cardId, card_info: { card_name: 'Anything', card_number: '1/1' } }),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'server-secret');
  mocks.db.mockReturnValue({});
  mocks.verify.mockResolvedValue({ status: 200, body: { success: true, pokemon_api_id: 'sm1-140' } });
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/pokemon/verify is server-to-server only', () => {
  it('refuses an anonymous caller before touching the database', async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ Authorization: 'Bearer a-user-session' }))).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('fails closed in production when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect((await POST(request({ Authorization: 'Bearer ' }))).status).toBe(500);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('runs for the grading routes, passing force, the override and the regrade context through', async () => {
    const response = await POST(request({ Authorization: 'Bearer server-secret' }, '?force=true'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, pokemon_api_id: 'sm1-140' });
    expect(mocks.verify).toHaveBeenCalledWith({}, cardId, expect.objectContaining({
      force: true, overrideCardInfo: { card_name: 'Anything', card_number: '1/1' }, regrade: false, reidentify: false,
    }));
  });
});
