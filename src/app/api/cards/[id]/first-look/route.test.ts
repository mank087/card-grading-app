import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: vi.fn(),
  from: vi.fn(),
  signed: vi.fn(),
  originals: vi.fn(),
  run: vi.fn(),
  record: vi.fn(),
}));
vi.mock('@/lib/serverAuth', () => ({ verifyAuth: mocks.auth }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: mocks.db }));
vi.mock('@/lib/signedUrlBatch', () => ({ createSignedImageMap: mocks.signed }));
vi.mock('@/lib/images/originalImages', () => ({ fetchCardOriginals: mocks.originals }));
vi.mock('@/lib/identification/firstLookRunner', () => ({
  runFirstLook: mocks.run,
  recordFirstLook: mocks.record,
}));
import { POST } from './route';
import { __clearFirstLookGuard } from '@/lib/identification/firstLookOnDemand';

const cardId = '6b292489-42d8-41d4-a00a-d9c9b267d66b';
const context = { params: Promise.resolve({ id: cardId }) };
const request = () => new NextRequest(`http://localhost/api/cards/${cardId}/first-look`, { method: 'POST' });

function readChain(result: unknown) {
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

const base = {
  id: cardId,
  user_id: 'owner',
  category: 'Pokemon',
  card_set: 'Base Set',
  front_path: 'owner/card/front.jpg',
  back_path: 'owner/card/back.jpg',
  first_look: null,
};

function card(overrides: Record<string, unknown> = {}) {
  mocks.from.mockReturnValue(readChain({ data: { ...base, ...overrides }, error: null }));
}

const result = {
  printed_text: { card_number_as_printed: '4/102', serial_stamp: null },
  identity: {
    set_name: { value: 'Base Set', source: 'printed' },
    subject: { value: 'Charizard', source: 'recognized' },
    year: { value: null, source: 'unknown' },
    manufacturer: { value: null, source: 'unknown' },
    insert_or_subset: { value: null, source: 'unknown' },
    card_number: { value: '4', source: 'printed' },
    card_title: { value: null, source: 'unknown' },
  },
  parallel: { parallel_name: 'Base', is_base: true, decided_by: 'observed_color_or_pattern' },
  alternatives: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  __clearFirstLookGuard();
  vi.stubEnv('FIRST_LOOK_ON_DEMAND', '1');
  vi.stubEnv('FIRST_LOOK_SEARCH', '');
  mocks.auth.mockResolvedValue({ authenticated: true, userId: 'owner' });
  mocks.db.mockReturnValue({ from: mocks.from, storage: { from: vi.fn() } });
  mocks.signed.mockResolvedValue(new Map([
    ['owner/card/front.jpg', { url: 'https://signed/front', thumbUrl: null }],
    ['owner/card/back.jpg', { url: 'https://signed/back', thumbUrl: null }],
  ]));
  mocks.originals.mockResolvedValue({ front: Buffer.from('front'), back: Buffer.from('back') });
  mocks.run.mockResolvedValue({ version: 'first-look-v1', pass: 'contract', search_ran: false, searches: 0, result });
  mocks.record.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/cards/[id]/first-look', () => {
  it('rejects an anonymous request without touching the database', async () => {
    mocks.auth.mockResolvedValue({ authenticated: false, userId: null });
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it('is off unless FIRST_LOOK_ON_DEMAND is set, and never pays for a run', async () => {
    vi.stubEnv('FIRST_LOOK_ON_DEMAND', '');
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ first_look: null, enabled: false });
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it('refuses another owner’s card before downloading anything', async () => {
    card({ user_id: 'someone-else' });
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.originals).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('refuses a sold card', async () => {
    card({ ownership_status: 'sold' });
    const response = await POST(request(), context);
    expect(response.status).toBe(423);
    expect((await response.json()).code).toBe('card_sold_locked');
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('gives back a stored first look instead of paying for a second one', async () => {
    card({ first_look: { version: 'first-look-v1', result } });
    const body = await (await POST(request(), context)).json();
    expect(body.reused).toBe(true);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(body.fields.find((f: any) => f.key === 'card_number')).toMatchObject({ value: '4/102' });
  });

  it('runs the contract, stores it and returns the prefill', async () => {
    card();
    const response = await POST(request(), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith(
      { front: expect.any(Buffer), back: expect.any(Buffer) },
      { allowSearch: false },
    );
    expect(mocks.record).toHaveBeenCalledWith(cardId, expect.objectContaining({ version: 'first-look-v1' }));
    expect(body.reused).toBe(false);
    expect(body.fields.find((f: any) => f.key === 'card_set')).toMatchObject({ value: 'Base Set', origin: 'read_from_card' });
  });

  it('allows the search pass only when FIRST_LOOK_SEARCH is on', async () => {
    vi.stubEnv('FIRST_LOOK_SEARCH', '1');
    card();
    await POST(request(), context);
    expect(mocks.run).toHaveBeenCalledWith(expect.anything(), { allowSearch: true });
  });

  it('answers with no first look when the run could not produce one', async () => {
    card();
    mocks.run.mockResolvedValue(null);
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ first_look: null, fields: null });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('answers with no first look rather than an error when the download fails', async () => {
    card();
    mocks.originals.mockRejectedValue(new Error('image download failed (403/403)'));
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ first_look: null, fields: null });
  });

  it('skips a card whose photos are missing', async () => {
    card({ back_path: null });
    expect(await (await POST(request(), context)).json()).toEqual({ first_look: null, fields: null });
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('runs once for two concurrent requests on the same card', async () => {
    card();
    let release: (value: unknown) => void = () => {};
    mocks.run.mockImplementation(() => new Promise(resolve => {
      release = () => resolve({ version: 'first-look-v1', result });
    }));
    const first = POST(request(), context);
    await new Promise(resolve => setTimeout(resolve, 5));
    const second = await POST(request(), { params: Promise.resolve({ id: cardId }) });
    expect(second.status).toBe(202);
    expect(await second.json()).toMatchObject({ running: true, first_look: null });
    release(null);
    await first;
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  it('releases the guard after a failed run', async () => {
    card();
    mocks.run.mockRejectedValueOnce(new Error('openai down'));
    await POST(request(), context);
    mocks.run.mockResolvedValue({ version: 'first-look-v1', result });
    expect((await POST(request(), context)).status).toBe(200);
    expect(mocks.run).toHaveBeenCalledTimes(2);
  });
});
