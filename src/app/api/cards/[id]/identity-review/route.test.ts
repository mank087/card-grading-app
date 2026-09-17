import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: vi.fn(),
  from: vi.fn(),
  parallels: vi.fn(),
  priceChartingEnabled: vi.fn(),
}));
vi.mock('@/lib/serverAuth', () => ({ verifyAuth: mocks.auth }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: mocks.db }));
vi.mock('@/lib/priceCharting', () => ({
  getAvailableParallels: mocks.parallels,
  isPriceChartingEnabled: mocks.priceChartingEnabled,
}));
import { GET } from './route';

const cardId = '6b292489-42d8-41d4-a00a-d9c9b267d66b';
const context = { params: Promise.resolve({ id: cardId }) };
const request = () => new NextRequest(`http://localhost/api/cards/${cardId}/identity-review`);

function readChain(result: unknown) {
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

const graded = {
  id: cardId,
  user_id: 'owner',
  category: 'Basketball',
  grade_status: 'complete',
  conversational_whole_grade: 9,
  graded_at: '2026-09-16T10:00:00Z',
  identity_revision: 2,
  identity_confirmed_revision: null,
  card_name: 'Michael Jordan',
  featured: 'Michael Jordan',
  card_set: 'Flair',
  release_date: '1995',
  card_number: '116',
  first_look: null,
  conversational_card_info: { parallel_type: 'Hardwood Leaders' },
};

function card(overrides: Record<string, unknown> = {}) {
  mocks.from.mockReturnValue(readChain({ data: { ...graded, ...overrides }, error: null }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE', '2026-09-15');
  mocks.auth.mockResolvedValue({ authenticated: true, userId: 'owner' });
  mocks.db.mockReturnValue({ from: mocks.from });
  mocks.priceChartingEnabled.mockReturnValue(true);
  mocks.parallels.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/cards/[id]/identity-review', () => {
  it('rejects an anonymous read without touching the database', async () => {
    mocks.auth.mockResolvedValue({ authenticated: false, userId: null });
    expect((await GET(request(), context)).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it('rejects an id that is not a card id', async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(response.status).toBe(404);
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it('hides another owner’s card and never looks the catalog up for it', async () => {
    card({ user_id: 'someone-else' });
    expect((await GET(request(), context)).status).toBe(404);
    expect(mocks.parallels).not.toHaveBeenCalled();
  });

  it('hides a deleted card', async () => {
    card({ deleted_at: '2026-09-16T00:00:00Z' });
    expect((await GET(request(), context)).status).toBe(404);
  });

  it('returns the prefill, the review state and no image URLs', async () => {
    card();
    const response = await GET(request(), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body).toMatchObject({
      mode: 'popup', reason: 'eligible', identity_revision: 2,
      identity_confirmed: false, dismissed: false, is_sports: true, first_look_present: false,
    });
    expect(body.fields.find((f: any) => f.key === 'card_set')).toMatchObject({ value: 'Flair', origin: 'from_grading' });
    expect(body.fields.some((f: any) => f.key === 'parallel_type')).toBe(true);
    expect(body).not.toHaveProperty('front_url');
    expect(body).not.toHaveProperty('back_url');
  });

  it('reports a confirmed card as needing nothing', async () => {
    card({ identity_confirmed_revision: 2 });
    const body = await (await GET(request(), context)).json();
    expect(body).toMatchObject({ mode: 'none', reason: 'already_confirmed', identity_confirmed: true });
  });

  it('gives a dismissed card the banner and never the popup', async () => {
    card({ identity_review_dismissed_at: '2026-09-16T12:00:00Z' });
    const body = await (await GET(request(), context)).json();
    expect(body).toMatchObject({ mode: 'banner', reason: 'dismissed', dismissed: true });
  });

  it('looks the catalog up with the prefilled identity and pre-selects the best match', async () => {
    card();
    mocks.parallels.mockResolvedValue([
      { id: 'p1', name: '1995 Flair #116 Michael Jordan', setName: 'Flair Basketball', hasPrice: true },
      { id: 'p2', name: '1995 Flair Hardwood Leaders #116 Michael Jordan', setName: 'Flair Basketball', hasPrice: true },
    ]);
    const body = await (await GET(request(), context)).json();
    expect(mocks.parallels).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'Michael Jordan', year: '1995', setName: 'Flair', cardNumber: '116',
    }));
    expect(body.candidates).toHaveLength(2);
    expect(body.candidates_available).toBe(true);
    expect(body.suggested_candidate_id).toBe('p2');
  });

  it('still answers when the catalog lookup fails', async () => {
    card();
    mocks.parallels.mockRejectedValue(new Error('PriceCharting timeout'));
    const response = await GET(request(), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ candidates: [], candidates_available: false, candidates_error: true });
    expect(body.fields.length).toBeGreaterThan(0);
  });

  it('does not look the catalog up for a non-sports card', async () => {
    card({ category: 'Pokemon' });
    const body = await (await GET(request(), context)).json();
    expect(mocks.parallels).not.toHaveBeenCalled();
    expect(body).toMatchObject({ is_sports: false, candidates: [], candidates_available: false });
    expect(body.fields.some((f: any) => f.key === 'parallel_type')).toBe(false);
  });

  it('never pops up when no rollout date is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE', '');
    card();
    expect((await (await GET(request(), context)).json()).mode).toBe('banner');
  });

  it('prefers what first look read off the card over the stored set', async () => {
    card({
      first_look: {
        version: 'first-look-v1',
        result: {
          printed_text: { card_number_as_printed: '116/086', serial_stamp: null },
          identity: {
            set_name: { value: 'Wonder Bread', source: 'printed' },
            subject: { value: 'Michael Jordan', source: 'recognized' },
            year: { value: null, source: 'unknown' },
            manufacturer: { value: 'Topps', source: 'recognized' },
            insert_or_subset: { value: null, source: 'unknown' },
            card_number: { value: '116', source: 'printed' },
            card_title: { value: null, source: 'unknown' },
          },
          parallel: { parallel_name: 'Base', is_base: true, decided_by: 'observed_color_or_pattern' },
          alternatives: [{ differs_in: 'set_name', value: 'Topps', what_would_settle_it: 'back logo' }],
        },
      },
    });
    const body = await (await GET(request(), context)).json();
    expect(body.first_look_present).toBe(true);
    expect(body.fields.find((f: any) => f.key === 'card_set')).toMatchObject({
      value: 'Wonder Bread', storedValue: 'Flair', origin: 'read_from_card', differsFromStored: true,
    });
    expect(body.fields.find((f: any) => f.key === 'card_number')).toMatchObject({ value: '116/086' });
    expect(body.alternatives).toHaveLength(1);
  });
});
