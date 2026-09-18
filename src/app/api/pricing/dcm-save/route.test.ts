/**
 * Phase 2C: the client-initiated price save. A stale save must answer 409 with
 * code 'price_write_stale' and write nothing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/lib/pricing/__testSupport__/fakeSupabase';

const CARD = '55555555-5555-4555-8555-555555555555';
const USER = '66666666-6666-4666-8666-666666666666';

let db: FakeSupabase & { auth?: any };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => db,
}));

const { POST } = await import('./route');

function seed(extra: Record<string, any> = {}) {
  const fake = createFakeSupabase({
    rows: [{
      id: CARD, user_id: USER, identity_revision: 3, pricing_selection_revision: 1,
      dcm_price_estimate: null, ...extra,
    }],
    ...(extra.__beforeUpdate ? { beforeUpdate: extra.__beforeUpdate } : {}),
  });
  db = Object.assign(fake, {
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
  });
  return db;
}

function request(body: Record<string, unknown>) {
  return {
    headers: { get: (name: string) => (name === 'authorization' ? 'Bearer token' : null) },
    json: async () => body,
  } as any;
}

const BASE_BODY = {
  card_id: CARD, estimate: 120, raw: 40, match_confidence: 'high',
  product_id: 'auto-9', product_name: 'Some product',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  seed();
});

describe('POST /api/pricing/dcm-save', () => {
  it('saves when the revisions still match, guarding on both', async () => {
    const response = await POST(request({
      ...BASE_BODY, identity_revision: 3, pricing_selection_revision: 1,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(db.lastUpdateFilters()).toEqual({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(120);
  });

  it('answers 409 price_write_stale and writes nothing after a correction', async () => {
    seed({ identity_revision: 4 });

    const response = await POST(request({
      ...BASE_BODY, identity_revision: 3, pricing_selection_revision: 1,
    }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('price_write_stale');
    expect(body.success).toBe(false);
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
  });

  it('answers 409 when only the product selection moved', async () => {
    seed({ pricing_selection_revision: 9 });
    const response = await POST(request({
      ...BASE_BODY, identity_revision: 3, pricing_selection_revision: 1,
    }));
    expect(response.status).toBe(409);
  });

  it('accepts a request with no revisions and writes it unguarded', async () => {
    seed({ identity_revision: 7 });

    const response = await POST(request(BASE_BODY));

    expect(response.status).toBe(200);
    expect(db.lastUpdateFilters()).toEqual({ id: CARD });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(120);
  });

  it('still requires ownership of the card', async () => {
    seed({ user_id: '77777777-7777-4777-8777-777777777777' });
    const response = await POST(request(BASE_BODY));
    expect(response.status).toBe(404);
  });
});
